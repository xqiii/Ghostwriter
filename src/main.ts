/**
 * Ghostwriter 主循环
 * 处理用户输入和代理交互
 */

import * as dotenv from 'dotenv';
import type { AppConfig, LLMProvider } from './types.js';
import { createAppConfig, parseArgs, validateConfig } from './config.js';
import { createLLMClient, LLMClient, listOllamaModels } from './llm/index.js';
import { AgentManager } from './agent/index.js';
import { ToolManager } from './tools/manager.js';
import { initProject, readGhostwriterMd } from './init.js';
import {
  printLogo,
  printSystemInfo,
  printHelp,
  printUserMessage,
  printAssistantMessage,
  printError,
  printSuccess,
  printInfo,
  printWarning,
  readInput,
  selectMenu,
  inputText,
  clearScreen,
  setupInterruptHandler,
  style,
} from './ui/index.js';

// 加载环境变量
dotenv.config();

/**
 * 处理命令
 */
async function handleCommand(
  command: string,
  agentManager: AgentManager,
  llmClient: LLMClient,
  config: AppConfig,
  toolManager: ToolManager
): Promise<boolean> {
  const [cmd, ...args] = command.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case 'help':
    case 'h':
    case '?':
      printHelp();
      return true;

    case 'clear':
    case 'cls':
      agentManager.clearAllHistory();
      printSuccess('对话历史已清除');
      return true;

    case 'clearscreen':
      clearScreen();
      return true;

    case 'exit':
    case 'quit':
    case 'q':
      return false; // 信号退出

    case 'model':
      await switchModel(llmClient, config);
      return true;

    case 'provider':
      await switchProvider(llmClient, config);
      return true;

    case 'debug':
      config.debug = !config.debug;
      printInfo(`调试模式: ${config.debug ? '开启' : '关闭'}`);
      return true;

    case 'status':
      printSystemInfo({
        provider: llmClient.getConfig().provider,
        model: llmClient.getConfig().model,
        workingDirectory: config.workingDirectory,
      });
      return true;

    case 'init':
      await handleInit(agentManager, llmClient, config, args.includes('--update') || args.includes('-u'));
      return true;

    case 'tools':
      await showTools(toolManager);
      return true;

    case 'mcp':
      await showMCPStatus(toolManager);
      return true;

    default:
      printWarning(`未知命令: ${cmd}，输入 /help 查看帮助`);
      return true;
  }
}

/**
 * 显示所有可用工具
 */
async function showTools(toolManager: ToolManager): Promise<void> {
  console.log('');
  printInfo('📦 可用工具列表:');

  const tools = await toolManager.getAllToolsInfo();

  // 按来源分组
  const builtinTools = tools.filter(t => t.source === 'builtin');
  const mcpTools = tools.filter(t => t.source === 'mcp');

  console.log(style('\n内置工具:', 'cyan'));
  for (const tool of builtinTools) {
    console.log(style(`  • ${tool.name}`, 'green') + ` - ${tool.description}`);
  }

  if (mcpTools.length > 0) {
    console.log(style('\nMCP 工具:', 'cyan'));
    for (const tool of mcpTools) {
      console.log(
        style(`  • ${tool.name}`, 'yellow') +
        ` (${tool.serverName}) - ${tool.description}`
      );
    }
  }

  console.log(style(`\n总计: ${tools.length} 个工具`, 'dim'));
  console.log('');
}

/**
 * 显示 MCP 状态
 */
async function showMCPStatus(toolManager: ToolManager): Promise<void> {
  console.log('');

  if (!toolManager.isMCPEnabled()) {
    printWarning('MCP 未启用');
    printInfo('在项目目录或用户主目录创建 .ghostwriter/mcp-config.json 以启用 MCP');
    printInfo('参考配置示例: mcp-config.example.json');
    console.log('');
    return;
  }

  const servers = toolManager.getConnectedMCPServers();
  printInfo(`🔌 MCP 服务器 (${servers.length} 个已连接):`);

  for (const server of servers) {
    console.log(style(`  ✓ ${server}`, 'green'));
  }

  const tools = await toolManager.getAllToolsInfo();
  const mcpTools = tools.filter(t => t.source === 'mcp');

  console.log(style(`\n提供 ${mcpTools.length} 个 MCP 工具`, 'dim'));
  console.log('');
}

/**
 * 切换模型
 */
async function switchModel(llmClient: LLMClient, config: AppConfig): Promise<void> {
  const currentConfig = llmClient.getConfig();
  
  if (currentConfig.provider === 'ollama') {
    // 获取 Ollama 可用模型
    const models = await listOllamaModels(currentConfig.baseUrl);
    if (models.length === 0) {
      printWarning('没有找到可用的 Ollama 模型');
      return;
    }
    
    const selected = await selectMenu('选择模型:', models.map(m => ({ value: m, label: m })));
    if (selected) {
      llmClient.updateConfig({ model: selected });
      printSuccess(`已切换到模型: ${selected}`);
    }
  } else {
    const newModel = await inputText('输入模型名称', currentConfig.model);
    if (newModel && newModel !== currentConfig.model) {
      llmClient.updateConfig({ model: newModel });
      printSuccess(`已切换到模型: ${newModel}`);
    }
  }
}

/**
 * 处理 /init 命令
 */
async function handleInit(
  agentManager: AgentManager,
  llmClient: LLMClient,
  config: AppConfig,
  update: boolean
): Promise<void> {
  console.log('');
  printInfo(update ? '更新项目知识...' : '初始化项目知识...');
  
  try {
    await initProject(llmClient, config.workingDirectory, { update });
    
    // 重新加载上下文到代理
    const ghostwriterContent = readGhostwriterMd(config.workingDirectory);
    if (ghostwriterContent) {
      agentManager.setProjectContext(ghostwriterContent);
      printSuccess('项目知识已加载到对话上下文');
    }
  } catch (error) {
    printError(`初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 切换提供商
 */
async function switchProvider(llmClient: LLMClient, config: AppConfig): Promise<void> {
  const providers: Array<{ value: LLMProvider; label: string }> = [
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'ollama', label: 'Ollama (本地)' },
    { value: 'grok', label: 'xAI (Grok)' },
    { value: 'kimi', label: 'Moonshot (Kimi)' },
  ];
  
  const selected = await selectMenu('选择 LLM 提供商:', providers);
  if (selected) {
    llmClient.switchProvider(selected);
    
    // 检查连接
    const { available, error } = await llmClient.checkConnection();
    if (!available) {
      printWarning(error || '无法连接到提供商');
    } else {
      printSuccess(`已切换到: ${selected}`);
    }
  }
}

/**
 * 主循环
 */
async function mainLoop(
  agentManager: AgentManager,
  llmClient: LLMClient,
  config: AppConfig,
  toolManager: ToolManager
): Promise<void> {
  let running = true;

  // 设置中断处理
  setupInterruptHandler(() => {
    console.log(style('\n\n👋 再见！', 'cyan'));
    process.exit(0);
  });

  while (running) {
    try {
      // 读取用户输入
      const input = await readInput();

      switch (input.type) {
        case 'exit':
          running = false;
          break;

        case 'empty':
          // 忽略空输入
          break;

        case 'command':
          running = await handleCommand(input.content, agentManager, llmClient, config, toolManager);
          break;

        case 'agent':
        case 'message':
          // 显示用户消息
          const messageContent = input.type === 'agent'
            ? `@${input.agentType} ${input.content}`
            : input.content;
          printUserMessage(messageContent);

          try {
            // 处理消息
            const response = await agentManager.handleInput(messageContent);

            // 显示助手响应
            if (response) {
              printAssistantMessage(response);
            }
          } catch (error) {
            printError(error instanceof Error ? error.message : String(error));
          }
          break;
      }
    } catch (error) {
      // 处理 EOF (Ctrl+D)
      if ((error as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') {
        running = false;
      } else {
        printError(error instanceof Error ? error.message : String(error));
      }
    }
  }

  console.log(style('\n👋 再见！', 'cyan'));
}

/**
 * 启动应用
 */
export async function start(): Promise<void> {
  // 解析命令行参数
  const args = parseArgs(process.argv.slice(2));

  // 创建配置
  const config = createAppConfig({
    autoConfirm: args.autoConfirm,
    debug: args.debug,
    provider: args.provider,
    model: args.model,
    workingDirectory: args.workingDirectory,
  });

  // 验证配置
  const validation = validateConfig(config);
  if (!validation.valid) {
    for (const error of validation.errors) {
      printError(error);
    }
    printInfo('提示: 请设置相应的环境变量，如 ANTHROPIC_API_KEY');
    process.exit(1);
  }

  // 创建 LLM 客户端
  const llmClient = createLLMClient(config.llm);

  // 检查连接
  const { available, error } = await llmClient.checkConnection();
  if (!available) {
    printWarning(error || '无法连接到 LLM 提供商');
    if (config.llm.provider !== 'ollama') {
      printInfo('提示: 请检查 API Key 是否正确设置');
    }
  }

  // 创建工具管理器并初始化 MCP
  const toolManager = new ToolManager(config.debug);
  await toolManager.initializeMCP();

  // 显示 MCP 状态
  if (toolManager.isMCPEnabled()) {
    const servers = toolManager.getConnectedMCPServers();
    printSuccess(`已连接 ${servers.length} 个 MCP 服务器: ${servers.join(', ')}`);
  }

  // 创建代理管理器
  const agentManager = new AgentManager(llmClient, config, toolManager);

  // 显示启动界面
  clearScreen();
  printLogo();
  printSystemInfo({
    provider: config.llm.provider,
    model: config.llm.model,
    workingDirectory: config.workingDirectory,
  });

  // 尝试加载项目知识文件
  const ghostwriterContent = readGhostwriterMd(config.workingDirectory);
  if (ghostwriterContent) {
    agentManager.setProjectContext(ghostwriterContent);
    printSuccess('已加载项目知识 (GHOSTWRITER.md)');
  } else {
    printInfo('提示: 运行 /init 命令生成项目知识文档');
  }

  if (config.autoConfirm) {
    printWarning('自动确认模式已启用 (-y)，危险操作将自动执行');
  }

  printInfo('输入 /help 查看帮助，/exit 退出\n');

  // 进入主循环
  await mainLoop(agentManager, llmClient, config, toolManager);

  // 清理资源
  await toolManager.cleanup();
}

export { createAppConfig, parseArgs, validateConfig };


/**
 * 代理系统入口
 * 管理主代理和子代理
 */

import type {
  Message,
  AgentConfig,
  AgentState,
  AgentType,
  NativeToolCall,
  ToolResult,
  ToolContext,
  AppConfig,
  LLMResponse,
} from '../types.js';
import { LLMClient } from '../llm/index.js';
import { executeTool, getTool } from '../tools/index.js';
import { getAgentConfig, parseAgentCommand } from './sub-agent.js';
import {
  printToolCall,
  printToolResult,
  printAssistantMessage,
  printError,
  printWarning,
  createSpinner,
  confirm,
  style,
} from '../ui/index.js';

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Agent 类
 * 管理单个代理的状态和执行
 */
export class Agent {
  private state: AgentState;
  private llmClient: LLMClient;
  private appConfig: AppConfig;
  private debug: boolean;
  private projectContext: string | undefined;

  constructor(
    config: AgentConfig,
    llmClient: LLMClient,
    appConfig: AppConfig
  ) {
    this.state = {
      id: generateId(),
      config,
      messages: [],
      isRunning: false,
    };
    this.llmClient = llmClient;
    this.appConfig = appConfig;
    this.debug = appConfig.debug;
  }

  /**
   * 设置项目上下文
   */
  setProjectContext(content: string): void {
    this.projectContext = content;
  }

  /**
   * 获取项目上下文
   */
  getProjectContext(): string | undefined {
    return this.projectContext;
  }

  /**
   * 获取代理状态
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * 获取代理 ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * 获取代理名称
   */
  getName(): string {
    return this.state.config.name;
  }

  /**
   * 添加消息到历史
   */
  addMessage(message: Message): void {
    this.state.messages.push(message);
  }

  /**
   * 清除消息历史
   */
  clearMessages(): void {
    this.state.messages = [];
  }

  /**
   * 获取消息历史
   */
  getMessages(): Message[] {
    return [...this.state.messages];
  }

  /**
   * 创建工具执行上下文
   */
  private createToolContext(): ToolContext {
    return {
      workingDirectory: this.appConfig.workingDirectory,
      config: this.appConfig,
      autoConfirm: this.appConfig.autoConfirm,
      confirmAction: async (message: string, riskLevel: string) => {
        if (this.appConfig.autoConfirm && riskLevel !== 'high') {
          return true;
        }
        return confirm(message);
      },
    };
  }

  /**
   * 执行单个工具调用
   */
  private async executeNativeToolCall(toolCall: NativeToolCall): Promise<ToolResult> {
    // 检查工具是否可用
    const tool = getTool(toolCall.name);
    if (!tool) {
      return {
        success: false,
        error: `未知工具: ${toolCall.name}`,
      };
    }

    // 检查代理是否有权限使用该工具
    if (!this.state.config.availableTools.includes(toolCall.name)) {
      return {
        success: false,
        error: `代理 "${this.state.config.name}" 无权使用工具: ${toolCall.name}`,
      };
    }

    const context = this.createToolContext();
    return executeTool({ name: toolCall.name, arguments: toolCall.arguments }, context);
  }

  /**
   * 构建带有项目上下文的消息列表
   */
  private buildMessagesWithContext(): Message[] {
    const messages: Message[] = [];

    // 如果有项目上下文，添加到消息开头
    if (this.projectContext) {
      messages.push({
        role: 'system',
        content: `以下是当前项目的知识文档，请在处理用户请求时参考：

${this.projectContext}`,
      });
    }

    // 添加历史消息
    messages.push(...this.state.messages);

    return messages;
  }

  /**
   * 运行代理循环
   */
  async run(userMessage: string): Promise<string> {
    this.state.isRunning = true;

    // 添加用户消息
    this.addMessage({
      role: 'user',
      content: userMessage,
    });

    const maxLoops = this.state.config.maxLoops || this.appConfig.maxToolLoops;
    let loopCount = 0;
    let finalResponse = '';

    try {
      while (loopCount < maxLoops) {
        loopCount++;

        // 调用 LLM（包含项目上下文）
        const spinner = createSpinner('思考中');
        spinner.start();

        let llmResponse: LLMResponse;
        try {
          const messagesWithContext = this.buildMessagesWithContext();
          llmResponse = await this.llmClient.call(messagesWithContext);
          spinner.stop();
        } catch (error) {
          spinner.stop();
          throw error;
        }

        // 添加助手消息到历史（使用原生格式）
        this.addMessage({
          role: 'assistant',
          content: llmResponse.content,
          tool_calls: llmResponse.tool_calls.length > 0 ? llmResponse.tool_calls : undefined,
        });

        // 如果没有工具调用，直接返回响应
        if (!llmResponse.tool_calls || llmResponse.tool_calls.length === 0) {
          finalResponse = llmResponse.content;
          break;
        }

        // 执行工具调用
        for (const toolCall of llmResponse.tool_calls) {
          printToolCall(toolCall.name, toolCall.arguments);

          const result = await this.executeNativeToolCall(toolCall);

          printToolResult(
            toolCall.name,
            result.success,
            result.data,
            result.error
          );

          // 将工具结果添加到消息历史（每个工具单独一条消息）
          const resultContent = result.success
            ? JSON.stringify(result.data, null, 2)
            : `错误: ${result.error}`;

          this.addMessage({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.name,
            content: resultContent,
          });

          // 如果工具执行失败，记录警告
          if (!result.success) {
            printWarning(`工具 ${toolCall.name} 执行失败: ${result.error}`);
          }
        }

        // 继续循环，获取下一轮响应
        finalResponse = llmResponse.content;
      }

      if (loopCount >= maxLoops) {
        printWarning(`达到最大循环次数 (${maxLoops})，强制结束`);
      }

      return finalResponse;
    } finally {
      this.state.isRunning = false;
    }
  }
}

/**
 * 代理管理器
 * 管理主代理和子代理
 */
export class AgentManager {
  private mainAgent: Agent;
  private subAgents: Map<string, Agent> = new Map();
  private llmClient: LLMClient;
  private appConfig: AppConfig;
  private projectContext: string | undefined;

  constructor(llmClient: LLMClient, appConfig: AppConfig) {
    this.llmClient = llmClient;
    this.appConfig = appConfig;

    // 创建主代理
    const mainConfig = getAgentConfig('main');
    this.mainAgent = new Agent(mainConfig, llmClient, appConfig);
  }

  /**
   * 设置项目上下文（来自 GHOSTWRITER.md）
   */
  setProjectContext(content: string): void {
    this.projectContext = content;
    this.mainAgent.setProjectContext(content);
  }

  /**
   * 获取项目上下文
   */
  getProjectContext(): string | undefined {
    return this.projectContext;
  }

  /**
   * 获取主代理
   */
  getMainAgent(): Agent {
    return this.mainAgent;
  }

  /**
   * 创建子代理
   */
  createSubAgent(type: AgentType): Agent {
    const config = getAgentConfig(type);
    const agent = new Agent(config, this.llmClient, this.appConfig);
    // 传递项目上下文给子代理
    if (this.projectContext) {
      agent.setProjectContext(this.projectContext);
    }
    this.subAgents.set(agent.getId(), agent);
    return agent;
  }

  /**
   * 获取子代理
   */
  getSubAgent(id: string): Agent | undefined {
    return this.subAgents.get(id);
  }

  /**
   * 删除子代理
   */
  removeSubAgent(id: string): boolean {
    return this.subAgents.delete(id);
  }

  /**
   * 处理用户输入
   * 自动检测是否需要创建子代理
   */
  async handleInput(input: string): Promise<string> {
    // 检查是否是代理命令
    const agentCommand = parseAgentCommand(input);

    if (agentCommand) {
      // 创建子代理处理
      console.log(style(`\n🤖 创建 ${agentCommand.type} 子代理...`, 'yellow'));
      const subAgent = this.createSubAgent(agentCommand.type);

      try {
        const response = await subAgent.run(agentCommand.message || '请开始工作');
        return response;
      } finally {
        // 子代理任务完成后删除
        this.removeSubAgent(subAgent.getId());
      }
    }

    // 使用主代理处理
    return this.mainAgent.run(input);
  }

  /**
   * 清除所有对话历史
   */
  clearAllHistory(): void {
    this.mainAgent.clearMessages();
    this.subAgents.forEach(agent => agent.clearMessages());
  }
}

// 导出子代理相关函数
export { getAgentConfig, parseAgentCommand, getAvailableAgentTypes } from './sub-agent.js';

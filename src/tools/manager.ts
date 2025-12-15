/**
 * 混合工具管理器
 * 整合内置工具和 MCP 工具，提供统一接口
 */

import type {
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolContext,
  ToolInfo,
  OpenAIToolFormat,
  AnthropicToolFormat,
  MCPToolInfo,
} from '../types.js';
import { getAllTools, getTool as getBuiltinTool } from './index.js';
import { MCPManager } from '../mcp/client.js';
import { loadMCPConfig } from '../mcp/config.js';
import { printWarning } from '../ui/index.js';

/**
 * 混合工具管理器
 * 同时管理内置工具和 MCP 工具
 */
export class ToolManager {
  private mcpManager: MCPManager;
  private mcpEnabled: boolean = false;
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
    this.mcpManager = new MCPManager(debug);
  }

  /**
   * 初始化 MCP 连接
   */
  async initializeMCP(): Promise<void> {
    const config = loadMCPConfig();
    if (!config) {
      if (this.debug) {
        console.log('[ToolManager] 未找到 MCP 配置文件');
      }
      return;
    }

    let connectedCount = 0;
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      if (serverConfig.disabled) {
        if (this.debug) {
          console.log(`[ToolManager] 跳过已禁用的服务器: ${name}`);
        }
        continue;
      }

      const success = await this.mcpManager.connectServer(name, serverConfig);
      if (success) {
        connectedCount++;
      }
    }

    if (connectedCount > 0) {
      this.mcpEnabled = true;
      if (this.debug) {
        console.log(`[ToolManager] 已连接 ${connectedCount} 个 MCP 服务器`);
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.mcpEnabled) {
      await this.mcpManager.disconnectAll();
    }
  }

  /**
   * 获取所有工具信息（内置 + MCP）
   */
  async getAllToolsInfo(): Promise<ToolInfo[]> {
    const tools: ToolInfo[] = [];

    // 添加内置工具
    const builtinTools = getAllTools();
    for (const tool of builtinTools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        source: 'builtin',
      });
    }

    // 添加 MCP 工具
    if (this.mcpEnabled) {
      try {
        const mcpTools = await this.mcpManager.listAllTools();
        for (const mcpTool of mcpTools) {
          tools.push({
            name: mcpTool.name,
            description: mcpTool.description || '',
            parameters: {
              type: 'object',
              properties: mcpTool.inputSchema.properties as any || {},
              required: mcpTool.inputSchema.required,
            },
            source: 'mcp',
            serverName: mcpTool.serverName,
          });
        }
      } catch (error) {
        printWarning('获取 MCP 工具列表失败');
        if (this.debug) {
          console.error(error);
        }
      }
    }

    return tools;
  }

  /**
   * 获取 OpenAI 格式的工具定义
   */
  async getOpenAITools(): Promise<OpenAIToolFormat[]> {
    const tools = await this.getAllToolsInfo();
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    }));
  }

  /**
   * 获取 Anthropic 格式的工具定义
   */
  async getAnthropicTools(): Promise<AnthropicToolFormat[]> {
    const tools = await this.getAllToolsInfo();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));
  }

  /**
   * 执行工具调用
   * 优先使用内置工具，回退到 MCP 工具
   */
  async executeTool(
    toolCall: ToolCall,
    context: ToolContext
  ): Promise<ToolResult> {
    // 优先使用内置工具（性能更好）
    const builtinTool = getBuiltinTool(toolCall.name);
    if (builtinTool) {
      try {
        return await builtinTool.execute(toolCall.arguments, context);
      } catch (error) {
        return {
          success: false,
          error: `内置工具执行异常: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // 回退到 MCP 工具
    if (this.mcpEnabled) {
      try {
        const result = await this.mcpManager.callTool(
          toolCall.name,
          toolCall.arguments
        );
        return result;
      } catch (error) {
        return {
          success: false,
          error: `MCP 工具执行异常: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // 工具未找到
    return {
      success: false,
      error: `未知工具: ${toolCall.name}`,
    };
  }

  /**
   * 获取工具定义（内置或 MCP）
   */
  async getToolDefinition(toolName: string): Promise<ToolInfo | null> {
    const tools = await this.getAllToolsInfo();
    return tools.find((t) => t.name === toolName) || null;
  }

  /**
   * 检查工具是否存在
   */
  async hasToolSync(toolName: string): Promise<boolean> {
    // 检查内置工具
    if (getBuiltinTool(toolName)) {
      return true;
    }

    // 检查 MCP 工具
    if (this.mcpEnabled) {
      const mcpTools = await this.mcpManager.listAllTools();
      return mcpTools.some((t) => t.name === toolName);
    }

    return false;
  }

  /**
   * 获取已连接的 MCP 服务器列表
   */
  getConnectedMCPServers(): string[] {
    return this.mcpManager.getConnectedServers();
  }

  /**
   * 检查 MCP 是否已启用
   */
  isMCPEnabled(): boolean {
    return this.mcpEnabled;
  }
}

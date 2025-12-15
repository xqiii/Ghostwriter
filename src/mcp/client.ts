/**
 * MCP 客户端管理器
 * 管理与 MCP 服务器的连接和工具调用
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig, MCPToolInfo } from '../types.js';
import { printWarning, printError } from '../ui/index.js';

interface ServerConnection {
  client: Client;
  transport: StdioClientTransport;
  config: MCPServerConfig;
}

/**
 * MCP 客户端管理器
 * 负责连接 MCP 服务器、发现工具、执行工具调用
 */
export class MCPManager {
  private servers = new Map<string, ServerConnection>();
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * 连接到 MCP 服务器
   */
  async connectServer(
    name: string,
    config: MCPServerConfig
  ): Promise<boolean> {
    try {
      if (this.debug) {
        console.log(`[MCP] 连接服务器: ${name}`);
        console.log(`[MCP] 命令: ${config.command} ${config.args.join(' ')}`);
      }

      // 准备环境变量
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }

      if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
          // 支持环境变量替换，如 ${GITHUB_TOKEN}
          env[key] = value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
            return process.env[envVar] || '';
          });
        }
      }

      // 创建传输层
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      });

      // 创建客户端
      const client = new Client(
        {
          name: 'ghostwriter',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // 连接
      await client.connect(transport);

      // 保存连接
      this.servers.set(name, { client, transport, config });

      if (this.debug) {
        console.log(`[MCP] 服务器 ${name} 已连接`);
      }

      return true;
    } catch (error) {
      printError(`连接 MCP 服务器失败: ${name}`);
      if (this.debug) {
        console.error(error);
      }
      return false;
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnectServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      try {
        await server.client.close();
        this.servers.delete(name);
        if (this.debug) {
          console.log(`[MCP] 服务器 ${name} 已断开`);
        }
      } catch (error) {
        printWarning(`断开服务器 ${name} 时出错`);
      }
    }
  }

  /**
   * 断开所有服务器
   */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.servers.keys());
    for (const name of names) {
      await this.disconnectServer(name);
    }
  }

  /**
   * 获取所有已连接的服务器名称
   */
  getConnectedServers(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * 列出所有可用工具
   */
  async listAllTools(): Promise<MCPToolInfo[]> {
    const allTools: MCPToolInfo[] = [];

    for (const [serverName, connection] of this.servers) {
      try {
        const response = await connection.client.listTools();

        for (const tool of response.tools) {
          allTools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as MCPToolInfo['inputSchema'],
            serverName,
          });
        }
      } catch (error) {
        printWarning(`列出服务器 ${serverName} 的工具时出错`);
        if (this.debug) {
          console.error(error);
        }
      }
    }

    return allTools;
  }

  /**
   * 查找工具所在的服务器
   */
  private async findToolServer(
    toolName: string
  ): Promise<ServerConnection | null> {
    for (const [serverName, connection] of this.servers) {
      try {
        const response = await connection.client.listTools();
        if (response.tools.some((t) => t.name === toolName)) {
          return connection;
        }
      } catch (error) {
        if (this.debug) {
          console.error(`查询服务器 ${serverName} 工具列表失败:`, error);
        }
      }
    }
    return null;
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      // 查找工具所在的服务器
      const server = await this.findToolServer(toolName);
      if (!server) {
        return {
          success: false,
          error: `未找到工具: ${toolName}`,
        };
      }

      if (this.debug) {
        console.log(`[MCP] 调用工具: ${toolName}`);
        console.log(`[MCP] 参数:`, args);
      }

      // 调用工具
      const response = await server.client.callTool({
        name: toolName,
        arguments: args,
      });

      if (this.debug) {
        console.log(`[MCP] 工具响应:`, response);
      }

      // 检查是否有错误
      if (response.isError) {
        return {
          success: false,
          error: String(response.content),
        };
      }

      // 提取内容
      let data: unknown;
      if (Array.isArray(response.content)) {
        // 如果是数组，合并所有文本内容
        data = response.content
          .map((item) => {
            if (item.type === 'text') {
              return item.text;
            }
            return JSON.stringify(item);
          })
          .join('\n');
      } else {
        data = response.content;
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: `MCP 工具调用失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 检查服务器健康状态
   */
  async checkServerHealth(name: string): Promise<boolean> {
    const server = this.servers.get(name);
    if (!server) {
      return false;
    }

    try {
      await server.client.listTools();
      return true;
    } catch {
      return false;
    }
  }
}

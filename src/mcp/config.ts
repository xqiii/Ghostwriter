/**
 * MCP 配置加载和管理
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { MCPConfig } from '../types.js';

/**
 * 获取 MCP 配置文件路径
 */
export function getMCPConfigPath(): string {
  // 优先使用项目目录的配置
  const projectConfig = path.join(process.cwd(), '.ghostwriter', 'mcp-config.json');
  if (fs.existsSync(projectConfig)) {
    return projectConfig;
  }

  // 回退到用户主目录
  const homeConfig = path.join(os.homedir(), '.ghostwriter', 'mcp-config.json');
  return homeConfig;
}

/**
 * 加载 MCP 配置
 */
export function loadMCPConfig(): MCPConfig | null {
  const configPath = getMCPConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as MCPConfig;
    return config;
  } catch (error) {
    console.error(`加载 MCP 配置失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 保存 MCP 配置
 */
export function saveMCPConfig(config: MCPConfig): boolean {
  const configPath = getMCPConfigPath();
  const configDir = path.dirname(configPath);

  try {
    // 确保目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 写入配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`保存 MCP 配置失败: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * 创建默认 MCP 配置
 */
export function createDefaultMCPConfig(): MCPConfig {
  return {
    mcpServers: {
      // 示例：文件系统服务器
      // filesystem: {
      //   command: 'npx',
      //   args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
      // },
    },
  };
}

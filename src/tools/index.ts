/**
 * 工具注册中心
 * 管理和导出所有可用工具
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, OpenAIToolFormat, AnthropicToolFormat } from '../types.js';
import { listFilesTool } from './list_files.js';
import { readFileTool } from './read_file.js';
import { writeFileTool } from './write_file.js';
import { appendFileTool } from './append_file.js';
import { deleteFileTool } from './delete_file.js';
import { runCommandTool } from './run_command.js';
import { searchCodebaseTool } from './search_codebase.js';

/** 所有可用工具的映射 */
const tools = new Map<string, ToolDefinition>();

// 注册所有工具
[
  listFilesTool,
  readFileTool,
  writeFileTool,
  appendFileTool,
  deleteFileTool,
  runCommandTool,
  searchCodebaseTool,
].forEach(tool => {
  tools.set(tool.name, tool);
});

/**
 * 获取所有可用工具
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

/**
 * 获取工具定义
 */
export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

/**
 * 获取工具列表的 JSON Schema 描述（用于 LLM）
 */
export function getToolSchemas(): Array<{
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
}> {
  return getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * 获取 OpenAI 兼容格式的工具定义
 * 用于 OpenAI、Grok、Kimi 等兼容 API
 */
export function getOpenAITools(): OpenAIToolFormat[] {
  return getAllTools().map(tool => ({
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
export function getAnthropicTools(): AnthropicToolFormat[] {
  return getAllTools().map(tool => ({
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
 */
export async function executeTool(
  toolCall: ToolCall,
  context: ToolContext
): Promise<ToolResult> {
  const tool = getTool(toolCall.name);
  
  if (!tool) {
    return {
      success: false,
      error: `未知工具: ${toolCall.name}`,
    };
  }
  
  try {
    return await tool.execute(toolCall.arguments, context);
  } catch (error) {
    return {
      success: false,
      error: `工具执行异常: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 批量执行工具调用
 */
export async function executeTools(
  toolCalls: ToolCall[],
  context: ToolContext
): Promise<Map<string, ToolResult>> {
  const results = new Map<string, ToolResult>();
  
  for (let i = 0; i < toolCalls.length; i++) {
    const toolCall = toolCalls[i];
    const resultKey = `${toolCall.name}_${i}`;
    const result = await executeTool(toolCall, context);
    results.set(resultKey, result);
  }
  
  return results;
}

// 导出所有工具模块
export { listFilesTool } from './list_files.js';
export { readFileTool } from './read_file.js';
export { writeFileTool } from './write_file.js';
export { appendFileTool } from './append_file.js';
export { deleteFileTool } from './delete_file.js';
export { runCommandTool } from './run_command.js';
export { searchCodebaseTool } from './search_codebase.js';


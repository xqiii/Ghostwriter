/**
 * Ollama API 客户端
 * 支持本地运行的 Ollama 模型，使用原生工具调用（如果模型支持）
 */

import type { Message, LLMResponse, LLMConfig, NativeToolCall } from '../types.js';
import { getOpenAITools } from '../tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';

/** Ollama API 消息格式 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
}

/** Ollama API 响应格式 */
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * 转换消息格式
 */
function convertMessages(messages: Message[]): OllamaMessage[] {
  const result: OllamaMessage[] = [];

  // 添加系统消息
  result.push({
    role: 'system',
    content: buildSystemPrompt(),
  });

  for (const msg of messages) {
    if (msg.role === 'system') {
      // 项目上下文等系统消息
      result.push({ role: 'system', content: msg.content });
    } else if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const assistantMsg: OllamaMessage = {
        role: 'assistant',
        content: msg.content || '',
      };

      // 如果有工具调用
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        assistantMsg.tool_calls = msg.tool_calls.map(tc => ({
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        }));
      }

      result.push(assistantMsg);
    } else if (msg.role === 'tool') {
      // Ollama 的工具结果消息
      result.push({
        role: 'tool',
        content: msg.content,
      });
    }
  }

  return result;
}

/**
 * 生成工具调用 ID
 */
function generateToolCallId(): string {
  return 'call_' + Math.random().toString(36).substring(2, 15);
}

/**
 * 调用 Ollama API
 */
export async function callOllama(
  messages: Message[],
  config: LLMConfig
): Promise<LLMResponse> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  const convertedMessages = convertMessages(messages);
  const tools = getOpenAITools();

  const requestBody = {
    model: config.model,
    messages: convertedMessages,
    tools: tools.length > 0 ? tools : undefined,
    stream: false, // 不使用流式响应
    options: {
      temperature: config.temperature || 0.7,
      num_predict: config.maxTokens || 4096,
    },
  };

  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new Error(`无法连接到 Ollama (${baseUrl})，请确保 Ollama 正在运行`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OllamaResponse;

  // 提取文本内容
  const textContent = data.message?.content || '';

  // 解析工具调用
  const toolCalls: NativeToolCall[] = [];
  if (data.message?.tool_calls) {
    for (const tc of data.message.tool_calls) {
      toolCalls.push({
        id: generateToolCallId(),
        name: tc.function.name,
        arguments: tc.function.arguments,
      });
    }
  }

  // 确定停止原因
  let stopReason: LLMResponse['stop_reason'];
  if (toolCalls.length > 0) {
    stopReason = 'tool_use';
  } else if (data.done_reason === 'length') {
    stopReason = 'max_tokens';
  } else {
    stopReason = 'end_turn';
  }

  return {
    content: textContent,
    tool_calls: toolCalls,
    stop_reason: stopReason,
  };
}

/**
 * 检查 Ollama 是否可用
 */
export async function checkOllamaAvailable(baseUrl?: string): Promise<boolean> {
  const url = baseUrl || 'http://localhost:11434';

  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 获取可用的 Ollama 模型列表
 */
export async function listOllamaModels(baseUrl?: string): Promise<string[]> {
  const url = baseUrl || 'http://localhost:11434';

  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { models: Array<{ name: string }> };
    return data.models?.map(m => m.name) || [];
  } catch {
    return [];
  }
}

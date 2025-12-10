/**
 * OpenAI API 客户端
 * 支持 OpenAI、Grok 和其他兼容 API，使用原生 Function Calling
 */

import type { Message, LLMResponse, LLMConfig, NativeToolCall } from '../types.js';
import { getOpenAITools } from '../tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';

/** OpenAI API 消息格式 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/** OpenAI API 响应格式 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 转换消息格式
 */
function convertMessages(messages: Message[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

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
      // 构建 assistant 消息
      const assistantMsg: OpenAIMessage = {
        role: 'assistant',
        content: msg.content || null,
      };

      // 如果有工具调用，添加 tool_calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        assistantMsg.tool_calls = msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }

      result.push(assistantMsg);
    } else if (msg.role === 'tool') {
      // 工具结果消息
      result.push({
        role: 'tool',
        tool_call_id: msg.tool_call_id || '',
        content: msg.content,
      });
    }
  }

  return result;
}

/**
 * 获取 API 端点
 */
function getApiEndpoint(config: LLMConfig): string {
  if (config.baseUrl) {
    return `${config.baseUrl}/v1/chat/completions`;
  }

  // 根据 provider 选择默认端点
  switch (config.provider) {
    case 'grok':
      return 'https://api.x.ai/v1/chat/completions';
    case 'openai':
    default:
      return 'https://api.openai.com/v1/chat/completions';
  }
}

/**
 * 调用 OpenAI 兼容 API
 */
export async function callOpenAI(
  messages: Message[],
  config: LLMConfig
): Promise<LLMResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error(`缺少 ${config.provider.toUpperCase()} API Key`);
  }

  const endpoint = getApiEndpoint(config);
  const convertedMessages = convertMessages(messages);
  const tools = getOpenAITools();

  const requestBody = {
    model: config.model,
    messages: convertedMessages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined,
    max_tokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.7,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.provider.toUpperCase()} API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenAIResponse;

  // 提取响应内容
  const choice = data.choices[0];
  const message = choice?.message;

  // 解析工具调用
  const toolCalls: NativeToolCall[] = [];
  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      try {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        });
      } catch {
        // 参数解析失败，跳过
        console.error(`工具调用参数解析失败: ${tc.function.arguments}`);
      }
    }
  }

  // 确定停止原因
  let stopReason: LLMResponse['stop_reason'];
  if (choice?.finish_reason === 'tool_calls') {
    stopReason = 'tool_use';
  } else if (choice?.finish_reason === 'length') {
    stopReason = 'max_tokens';
  } else {
    stopReason = 'end_turn';
  }

  return {
    content: message?.content || '',
    tool_calls: toolCalls,
    stop_reason: stopReason,
  };
}

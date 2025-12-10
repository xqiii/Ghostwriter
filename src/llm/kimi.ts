/**
 * Kimi (Moonshot) API 客户端
 * 月之暗面 AI 模型，使用原生 Function Calling
 */

import type { Message, LLMResponse, LLMConfig, NativeToolCall } from '../types.js';
import { getOpenAITools } from '../tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';

/** Kimi API 消息格式 (OpenAI 兼容) */
interface KimiMessage {
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

/** Kimi API 响应格式 */
interface KimiResponse {
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
function convertMessages(messages: Message[]): KimiMessage[] {
  const result: KimiMessage[] = [];

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
      const assistantMsg: KimiMessage = {
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

/** Kimi API 默认端点 */
const KIMI_DEFAULT_BASE_URL = 'https://api.moonshot.cn/v1';

/**
 * 调用 Kimi (Moonshot) API
 */
export async function callKimi(
  messages: Message[],
  config: LLMConfig
): Promise<LLMResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error('缺少 Moonshot API Key (MOONSHOT_API_KEY)');
  }

  const baseUrl = config.baseUrl || KIMI_DEFAULT_BASE_URL;
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

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi API 错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as KimiResponse;

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

/**
 * 获取 Kimi 可用模型列表
 */
export function getKimiModels(): string[] {
  return [
    'kimi-k2-turbo-preview',
    'kimi-k2-0905-preview',
    'kimi-k2-thinking-turbo',
    'kimi-k2-thinking'
  ];
}

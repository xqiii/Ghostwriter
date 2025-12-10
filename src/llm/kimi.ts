/**
 * Kimi (Moonshot) API 客户端
 * 月之暗面 AI 模型，兼容 OpenAI API 格式
 */

import type { Message, LLMResponse, LLMConfig } from '../types.js';
import { buildSystemPrompt, parseResponse } from './system-prompt.js';

/** Kimi API 消息格式 (兼容 OpenAI) */
interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
      content: string;
    };
    finish_reason: string;
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
      continue; // 系统消息已经在开头添加
    }
    
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool') {
      // 将 tool 消息转换为 user 消息
      result.push({
        role: 'user',
        content: `[工具 ${msg.name} 执行结果]\n${msg.content}`,
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
  
  const requestBody = {
    model: config.model,
    messages: convertedMessages,
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
  
  // 提取文本内容
  const choice = data.choices[0];
  const responseText = choice?.message?.content || '';
  
  return parseResponse(responseText);
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


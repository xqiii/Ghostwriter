/**
 * OpenAI API 客户端
 * 支持 OpenAI、Grok 和其他兼容 API
 */

import type { Message, LLMResponse, LLMConfig } from '../types.js';
import { buildSystemPrompt, parseResponse } from './system-prompt.js';

/** OpenAI API 消息格式 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
function convertMessages(messages: Message[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];
  
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
  
  const requestBody = {
    model: config.model,
    messages: convertedMessages,
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
  
  // 提取文本内容
  const choice = data.choices[0];
  const responseText = choice?.message?.content || '';
  
  return parseResponse(responseText);
}


/**
 * Anthropic Claude API 客户端
 */

import type { Message, LLMResponse, LLMConfig } from '../types.js';
import { buildSystemPrompt, parseResponse } from './system-prompt.js';

/** Anthropic API 请求消息格式 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Anthropic API 响应格式 */
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * 转换消息格式
 */
function convertMessages(messages: Message[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      continue; // 系统消息单独处理
    }
    
    if (msg.role === 'user' || msg.role === 'tool') {
      // 将 tool 消息合并到 user 消息
      const content = msg.role === 'tool' 
        ? `[工具 ${msg.name} 执行结果]\n${msg.content}`
        : msg.content;
      
      // 如果上一条是 user 消息，合并内容
      if (result.length > 0 && result[result.length - 1].role === 'user') {
        result[result.length - 1].content += '\n\n' + content;
      } else {
        result.push({ role: 'user', content });
      }
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content });
    }
  }
  
  return result;
}

/**
 * 调用 Anthropic API
 */
export async function callAnthropic(
  messages: Message[],
  config: LLMConfig
): Promise<LLMResponse> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error('缺少 Anthropic API Key');
  }
  
  const baseUrl = config.baseUrl || 'https://api.anthropic.com';
  const systemPrompt = buildSystemPrompt();
  const convertedMessages = convertMessages(messages);
  
  // 确保消息以 user 开头
  if (convertedMessages.length === 0 || convertedMessages[0].role !== 'user') {
    convertedMessages.unshift({
      role: 'user',
      content: '你好，请准备好帮助我。',
    });
  }
  
  const requestBody = {
    model: config.model,
    max_tokens: config.maxTokens || 8192,
    system: systemPrompt,
    messages: convertedMessages,
  };
  
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API 错误 (${response.status}): ${errorText}`);
  }
  
  const data = await response.json() as AnthropicResponse;
  
  // 提取文本内容
  const textContent = data.content.find(c => c.type === 'text');
  const responseText = textContent?.text || '';
  
  return parseResponse(responseText);
}


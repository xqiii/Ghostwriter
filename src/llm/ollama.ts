/**
 * Ollama API 客户端
 * 支持本地运行的 Ollama 模型
 */

import type { Message, LLMResponse, LLMConfig } from '../types.js';
import { buildSystemPrompt, parseResponse } from './system-prompt.js';

/** Ollama API 消息格式 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Ollama API 响应格式 */
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
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
 * 调用 Ollama API
 */
export async function callOllama(
  messages: Message[],
  config: LLMConfig
): Promise<LLMResponse> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  const convertedMessages = convertMessages(messages);
  
  const requestBody = {
    model: config.model,
    messages: convertedMessages,
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
  const responseText = data.message?.content || '';
  
  return parseResponse(responseText);
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


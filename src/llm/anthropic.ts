/**
 * Anthropic Claude API 客户端
 * 使用原生 Tool Use 功能
 */

import type { Message, LLMResponse, LLMConfig, NativeToolCall } from '../types.js';
import { getAnthropicTools } from '../tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';

/** Anthropic 内容块类型 */
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

/** Anthropic API 请求消息格式 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/** Anthropic API 响应格式 */
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
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
      // 系统消息作为 user 消息处理（Anthropic 用单独的 system 参数）
      // 如果是项目上下文，添加到第一条 user 消息前
      continue;
    }

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      // 构建 assistant 消息的 content blocks
      const contentBlocks: ContentBlock[] = [];

      // 添加文本内容
      if (msg.content) {
        contentBlocks.push({ type: 'text', text: msg.content });
      }

      // 添加工具调用
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
      }

      if (contentBlocks.length > 0) {
        result.push({ role: 'assistant', content: contentBlocks });
      }
    } else if (msg.role === 'tool') {
      // 工具结果作为 user 消息的 tool_result block
      const toolResultBlock: ContentBlock = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id || '',
        content: msg.content,
      };

      // 如果上一条是 user 消息且包含 tool_result，合并
      if (result.length > 0 && result[result.length - 1].role === 'user') {
        const lastMsg = result[result.length - 1];
        if (Array.isArray(lastMsg.content)) {
          lastMsg.content.push(toolResultBlock);
        } else {
          // 转换为数组格式
          lastMsg.content = [
            { type: 'text', text: lastMsg.content },
            toolResultBlock,
          ];
        }
      } else {
        result.push({
          role: 'user',
          content: [toolResultBlock],
        });
      }
    }
  }

  // 确保消息以 user 开头
  if (result.length === 0 || result[0].role !== 'user') {
    result.unshift({
      role: 'user',
      content: '你好，请准备好帮助我。',
    });
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
  const tools = getAnthropicTools();

  // 添加项目上下文到系统提示
  let fullSystemPrompt = systemPrompt;
  const systemMessages = messages.filter(m => m.role === 'system');
  if (systemMessages.length > 0) {
    fullSystemPrompt += '\n\n' + systemMessages.map(m => m.content).join('\n\n');
  }

  const requestBody = {
    model: config.model,
    max_tokens: config.maxTokens || 8192,
    system: fullSystemPrompt,
    messages: convertedMessages,
    tools: tools.length > 0 ? tools : undefined,
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

  // 提取文本内容和工具调用
  let textContent = '';
  const toolCalls: NativeToolCall[] = [];

  for (const block of data.content) {
    if (block.type === 'text') {
      textContent += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input,
      });
    }
  }

  // 映射停止原因
  let stopReason: LLMResponse['stop_reason'];
  switch (data.stop_reason) {
    case 'tool_use':
      stopReason = 'tool_use';
      break;
    case 'max_tokens':
      stopReason = 'max_tokens';
      break;
    case 'stop_sequence':
      stopReason = 'stop_sequence';
      break;
    default:
      stopReason = 'end_turn';
  }

  return {
    content: textContent,
    tool_calls: toolCalls,
    stop_reason: stopReason,
  };
}

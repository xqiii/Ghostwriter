/**
 * LLM 客户端统一入口
 * 提供多个 LLM 提供商的统一接口
 */

import type { Message, LLMResponse, LLMConfig, LLMProvider } from '../types.js';
import { callAnthropic } from './anthropic.js';
import { callOpenAI } from './openai.js';
import { callOllama, checkOllamaAvailable, listOllamaModels } from './ollama.js';
import { callKimi, getKimiModels } from './kimi.js';

/**
 * LLM 客户端类
 * 封装所有 LLM 交互逻辑
 */
export class LLMClient {
  private config: LLMConfig;
  
  constructor(config: LLMConfig) {
    this.config = config;
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
  
  /**
   * 更新配置
   */
  updateConfig(updates: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  /**
   * 切换 LLM 提供商
   */
  switchProvider(provider: LLMProvider, model?: string): void {
    this.config.provider = provider;
    if (model) {
      this.config.model = model;
    }
  }
  
  /**
   * 调用 LLM
   */
  async call(messages: Message[]): Promise<LLMResponse> {
    const { provider } = this.config;
    
    switch (provider) {
      case 'anthropic':
        return callAnthropic(messages, this.config);
      
      case 'openai':
      case 'grok':
        return callOpenAI(messages, this.config);
      
      case 'ollama':
        return callOllama(messages, this.config);
      
      case 'kimi':
        return callKimi(messages, this.config);
      
      default:
        throw new Error(`不支持的 LLM 提供商: ${provider}`);
    }
  }
  
  /**
   * 检查连接是否可用
   */
  async checkConnection(): Promise<{ available: boolean; error?: string }> {
    const { provider, apiKey, baseUrl } = this.config;
    
    // Ollama 特殊处理
    if (provider === 'ollama') {
      const available = await checkOllamaAvailable(baseUrl);
      return {
        available,
        error: available ? undefined : '无法连接到 Ollama，请确保它正在运行',
      };
    }
    
    // 其他提供商检查 API Key
    if (!apiKey) {
      return {
        available: false,
        error: `缺少 ${provider.toUpperCase()} API Key`,
      };
    }
    
    return { available: true };
  }
  
  /**
   * 获取提供商信息
   */
  getProviderInfo(): { name: string; model: string; description: string } {
    const { provider, model } = this.config;
    
    const descriptions: Record<LLMProvider, string> = {
      anthropic: 'Anthropic Claude - 强大的 AI 助手',
      openai: 'OpenAI GPT - 通用 AI 模型',
      ollama: 'Ollama - 本地运行的开源模型',
      grok: 'xAI Grok - 实时知识 AI',
      kimi: 'Moonshot Kimi - 月之暗面长上下文 AI',
    };
    
    return {
      name: provider,
      model,
      description: descriptions[provider],
    };
  }
}

/**
 * 创建 LLM 客户端
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}

// 导出底层函数
export { callAnthropic } from './anthropic.js';
export { callOpenAI } from './openai.js';
export { callOllama, checkOllamaAvailable, listOllamaModels } from './ollama.js';
export { callKimi, getKimiModels } from './kimi.js';


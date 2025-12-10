/**
 * Ghostwriter - 配置管理模块
 * 处理全局配置、项目配置和环境变量
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AppConfig, ProjectConfig, LLMConfig, LLMProvider } from './types.js';

/** 默认 LLM 配置 */
const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'kimi',
  model: 'kimi-k2-turbo-preview',
  maxTokens: 32000,
  temperature: 0.7,
};

/** 默认项目配置 */
const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  allow_commands: [],
  allow_write_paths: [],
  deny_paths: ['node_modules', '.git', '.env', '.env.local'],
};

/** 项目配置文件路径 */
const CONFIG_FILENAME = '.aide/config.json';

/**
 * 从环境变量获取 API Key
 */
function getApiKeyFromEnv(provider: LLMProvider): string | undefined {
  const envMap: Record<LLMProvider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    ollama: '', // Ollama 不需要 API Key
    grok: 'GROK_API_KEY',
    kimi: 'MOONSHOT_API_KEY',
  };
  const envVar = envMap[provider];
  return envVar ? process.env[envVar] : undefined;
}

/**
 * 从环境变量获取 Base URL
 */
function getBaseUrlFromEnv(provider: LLMProvider): string | undefined {
  const envMap: Record<LLMProvider, string> = {
    anthropic: 'ANTHROPIC_BASE_URL',
    openai: 'OPENAI_BASE_URL',
    ollama: 'OLLAMA_BASE_URL',
    grok: 'GROK_BASE_URL',
    kimi: 'MOONSHOT_BASE_URL',
  };
  const envVar = envMap[provider];
  const value = envVar ? process.env[envVar] : undefined;
  
  // Ollama 默认地址
  if (provider === 'ollama' && !value) {
    return 'http://localhost:11434';
  }
  
  // Kimi 默认地址
  if (provider === 'kimi' && !value) {
    return 'https://api.moonshot.cn/v1';
  }
  
  return value;
}

/**
 * 加载项目配置文件
 */
export function loadProjectConfig(workingDirectory: string): ProjectConfig {
  const configPath = path.join(workingDirectory, CONFIG_FILENAME);
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<ProjectConfig>;
      return {
        ...DEFAULT_PROJECT_CONFIG,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn(`⚠️  无法加载项目配置: ${configPath}`);
  }
  
  return DEFAULT_PROJECT_CONFIG;
}

/**
 * 保存项目配置文件
 */
export function saveProjectConfig(workingDirectory: string, config: ProjectConfig): void {
  const configDir = path.join(workingDirectory, '.aide');
  const configPath = path.join(configDir, 'config.json');
  
  // 确保目录存在
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 解析命令行参数
 */
export function parseArgs(args: string[]): {
  autoConfirm: boolean;
  debug: boolean;
  provider?: LLMProvider;
  model?: string;
  workingDirectory: string;
} {
  let autoConfirm = false;
  let debug = false;
  let provider: LLMProvider | undefined;
  let model: string | undefined;
  let workingDirectory = process.cwd();
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-y' || arg === '--yes') {
      autoConfirm = true;
    } else if (arg === '-d' || arg === '--debug') {
      debug = true;
    } else if (arg === '-p' || arg === '--provider') {
      provider = args[++i] as LLMProvider;
    } else if (arg === '-m' || arg === '--model') {
      model = args[++i];
    } else if (arg === '-C' || arg === '--directory') {
      workingDirectory = path.resolve(args[++i]);
    }
  }
  
  return { autoConfirm, debug, provider, model, workingDirectory };
}

/**
 * 创建完整的应用配置
 */
export function createAppConfig(options: {
  autoConfirm?: boolean;
  debug?: boolean;
  provider?: LLMProvider;
  model?: string;
  workingDirectory?: string;
} = {}): AppConfig {
  const workingDirectory = options.workingDirectory || process.cwd();
  const projectConfig = loadProjectConfig(workingDirectory);
  
  // 确定 LLM provider
  const provider = options.provider || 
    (projectConfig.llm?.provider) || 
    (process.env.LLM_PROVIDER as LLMProvider) ||
    DEFAULT_LLM_CONFIG.provider;
  
  // 构建 LLM 配置
  const llmConfig: LLMConfig = {
    provider,
    model: options.model || 
      projectConfig.llm?.model || 
      process.env.LLM_MODEL ||
      getDefaultModel(provider),
    apiKey: getApiKeyFromEnv(provider) || projectConfig.llm?.apiKey,
    baseUrl: getBaseUrlFromEnv(provider) || projectConfig.llm?.baseUrl,
    maxTokens: projectConfig.llm?.maxTokens || DEFAULT_LLM_CONFIG.maxTokens,
    temperature: projectConfig.llm?.temperature || DEFAULT_LLM_CONFIG.temperature,
  };
  
  return {
    workingDirectory,
    autoConfirm: options.autoConfirm || false,
    llm: llmConfig,
    project: projectConfig,
    maxToolLoops: 8,
    debug: options.debug || false,
  };
}

/**
 * 获取默认模型名称
 */
function getDefaultModel(provider: LLMProvider): string {
  const models: Record<LLMProvider, string> = {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
    ollama: 'llama3.2',
    grok: 'grok-2-latest',
    kimi: 'kimi-k2-turbo-preview',
  };
  return models[provider];
}

/**
 * 检查命令是否在白名单中
 */
export function isCommandAllowed(command: string, config: AppConfig): boolean {
  const allowedCommands = config.project.allow_commands || [];
  
  // 完全匹配
  if (allowedCommands.includes(command)) {
    return true;
  }
  
  // 前缀匹配（支持 "git *" 这样的模式）
  for (const allowed of allowedCommands) {
    if (allowed.endsWith('*')) {
      const prefix = allowed.slice(0, -1);
      if (command.startsWith(prefix)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 检查路径是否允许写入
 */
export function isPathAllowedForWrite(filePath: string, config: AppConfig): boolean {
  const normalizedPath = path.normalize(filePath);
  const denyPaths = config.project.deny_paths || [];
  
  // 检查是否在禁止列表中
  for (const denied of denyPaths) {
    if (normalizedPath.includes(denied)) {
      return false;
    }
  }
  
  // 如果有白名单，检查是否在白名单中
  const allowPaths = config.project.allow_write_paths || [];
  if (allowPaths.length > 0) {
    return allowPaths.some(allowed => normalizedPath.startsWith(allowed));
  }
  
  return true;
}

/**
 * 验证配置完整性
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 检查 API Key（Ollama 除外）
  if (config.llm.provider !== 'ollama' && !config.llm.apiKey) {
    errors.push(`缺少 ${config.llm.provider.toUpperCase()} API Key，请设置环境变量或配置文件`);
  }
  
  // 检查工作目录
  if (!fs.existsSync(config.workingDirectory)) {
    errors.push(`工作目录不存在: ${config.workingDirectory}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}


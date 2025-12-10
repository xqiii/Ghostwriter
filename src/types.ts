/**
 * Ghostwriter - 核心类型定义
 * 定义了整个系统的数据结构和接口
 */

// ============================================================================
// LLM 相关类型
// ============================================================================

/** 支持的 LLM 提供商 */
export type LLMProvider = 'anthropic' | 'openai' | 'ollama' | 'grok' | 'kimi';

/** LLM 消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** 工具调用信息（原生格式） */
export interface NativeToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** 单条消息 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string; // 用于 tool 消息
  tool_call_id?: string; // 用于 tool result 关联
  tool_calls?: NativeToolCall[]; // assistant 消息中的工具调用
}

/** LLM 返回的结构化响应 */
export interface LLMResponse {
  /** 文本响应内容 */
  content: string;
  /** 工具调用列表（原生格式） */
  tool_calls: NativeToolCall[];
  /** 停止原因 */
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

/** LLM 配置 */
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

/** 用于 API 调用的工具格式（OpenAI 兼容） */
export interface OpenAIToolFormat {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** 用于 API 调用的工具格式（Anthropic） */
export interface AnthropicToolFormat {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================================
// Tool 相关类型
// ============================================================================

/** 工具调用 */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** 工具执行结果 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** 工具定义 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      default?: unknown;
    }>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  /** 是否需要用户确认 */
  requiresConfirmation?: boolean;
  /** 风险等级: low=自动执行, medium=需确认, high=必须显式批准 */
  riskLevel?: 'low' | 'medium' | 'high';
}

/** 工具执行上下文 */
export interface ToolContext {
  workingDirectory: string;
  config: AppConfig;
  autoConfirm: boolean;
  confirmAction: (message: string, riskLevel: string) => Promise<boolean>;
}

// ============================================================================
// 文件操作工具返回类型
// ============================================================================

export interface ListFilesResult {
  files: string[];
  directories: string[];
}

export interface ReadFileResult {
  content: string;
}

export interface WriteFileResult {
  success: true;
}

export interface AppendFileResult {
  success: true;
}

export interface DeleteFileResult {
  success: true;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

export interface SearchCodebaseResult {
  matches: SearchMatch[];
}

// ============================================================================
// 配置相关类型
// ============================================================================

/** 项目级配置 (.aide/config.json) */
export interface ProjectConfig {
  /** 允许自动执行的命令白名单 */
  allow_commands?: string[];
  /** 允许自动写入的路径白名单 */
  allow_write_paths?: string[];
  /** 禁止访问的路径 */
  deny_paths?: string[];
  /** 默认使用的 LLM 配置 */
  llm?: Partial<LLMConfig>;
}

/** 应用全局配置 */
export interface AppConfig {
  /** 工作目录 */
  workingDirectory: string;
  /** 是否自动确认所有操作 */
  autoConfirm: boolean;
  /** LLM 配置 */
  llm: LLMConfig;
  /** 项目级配置 */
  project: ProjectConfig;
  /** 最大工具调用循环次数 */
  maxToolLoops: number;
  /** 是否启用调试模式 */
  debug: boolean;
}

// ============================================================================
// Agent 相关类型
// ============================================================================

/** Agent 类型 */
export type AgentType = 'main' | 'test' | 'review' | 'refactor' | 'custom';

/** Agent 配置 */
export interface AgentConfig {
  type: AgentType;
  name: string;
  systemPrompt: string;
  availableTools: string[];
  maxLoops?: number;
}

/** Agent 状态 */
export interface AgentState {
  id: string;
  config: AgentConfig;
  messages: Message[];
  isRunning: boolean;
}

// ============================================================================
// UI 相关类型
// ============================================================================

/** 用户输入模式 */
export type InputMode = 'single' | 'multi';

/** 显示样式 */
export interface DisplayStyle {
  prefix?: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
}

/** 终端尺寸 */
export interface TerminalSize {
  columns: number;
  rows: number;
}


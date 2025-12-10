/**
 * 子代理模块
 * 提供专门化的子代理实现
 */

import type { AgentConfig, AgentType } from '../types.js';

/** 子代理配置预设 */
const AGENT_PRESETS: Record<AgentType, Omit<AgentConfig, 'type'>> = {
  main: {
    name: '主代理',
    systemPrompt: '你是主代理，负责处理用户的所有请求。',
    availableTools: [
      'list_files',
      'read_file',
      'write_file',
      'append_file',
      'delete_file',
      'run_command',
      'search_codebase',
    ],
  },
  
  test: {
    name: '测试代理',
    systemPrompt: `你是测试专家代理，专门负责：
1. 编写单元测试和集成测试
2. 运行测试命令并分析结果
3. 提高代码覆盖率
4. 修复失败的测试

你应该：
- 优先使用项目现有的测试框架
- 遵循项目的测试命名规范
- 确保测试用例覆盖边界情况
- 提供清晰的测试报告`,
    availableTools: [
      'list_files',
      'read_file',
      'write_file',
      'run_command',
      'search_codebase',
    ],
    maxLoops: 5,
  },
  
  review: {
    name: '代码审查代理',
    systemPrompt: `你是代码审查专家代理，专门负责：
1. 审查代码质量和最佳实践
2. 发现潜在的 bug 和安全问题
3. 提供改进建议
4. 检查代码风格一致性

你应该：
- 关注代码可读性和可维护性
- 检查错误处理是否完善
- 验证输入验证和安全性
- 提供具体的改进建议和示例代码`,
    availableTools: [
      'list_files',
      'read_file',
      'search_codebase',
    ],
    maxLoops: 3,
  },
  
  refactor: {
    name: '重构代理',
    systemPrompt: `你是重构专家代理，专门负责：
1. 识别代码异味和技术债务
2. 提取公共代码和创建可复用模块
3. 优化代码结构和性能
4. 保持功能不变的前提下改进代码

你应该：
- 遵循 SOLID 原则
- 保持向后兼容性
- 分步骤进行重构，每步都可验证
- 提供重构前后的对比`,
    availableTools: [
      'list_files',
      'read_file',
      'write_file',
      'search_codebase',
    ],
    maxLoops: 6,
  },
  
  custom: {
    name: '自定义代理',
    systemPrompt: '你是一个自定义代理，请按照用户的指示工作。',
    availableTools: [
      'list_files',
      'read_file',
      'write_file',
      'run_command',
      'search_codebase',
    ],
  },
};

/**
 * 获取代理配置
 */
export function getAgentConfig(type: AgentType): AgentConfig {
  const preset = AGENT_PRESETS[type];
  return {
    type,
    ...preset,
  };
}

/**
 * 创建自定义代理配置
 */
export function createCustomAgentConfig(
  name: string,
  systemPrompt: string,
  availableTools?: string[]
): AgentConfig {
  return {
    type: 'custom',
    name,
    systemPrompt,
    availableTools: availableTools || AGENT_PRESETS.custom.availableTools,
  };
}

/**
 * 获取所有可用的代理类型
 */
export function getAvailableAgentTypes(): Array<{ type: AgentType; name: string; description: string }> {
  return [
    { type: 'test', name: '测试代理', description: '编写和运行测试' },
    { type: 'review', name: '审查代理', description: '代码审查和质量检查' },
    { type: 'refactor', name: '重构代理', description: '代码重构和优化' },
  ];
}

/**
 * 解析代理命令
 * 例如: "@test 运行所有测试" -> { type: 'test', message: '运行所有测试' }
 */
export function parseAgentCommand(input: string): { type: AgentType; message: string } | null {
  const match = input.match(/^@(\w+)\s*(.*)?$/);
  if (!match) {
    return null;
  }
  
  const [, typeStr, message] = match;
  const type = typeStr.toLowerCase() as AgentType;
  
  // 验证代理类型
  if (!AGENT_PRESETS[type]) {
    return null;
  }
  
  return {
    type,
    message: message?.trim() || '',
  };
}


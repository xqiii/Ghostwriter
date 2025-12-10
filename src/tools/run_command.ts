/**
 * run_command 工具
 * 执行 shell 命令
 */

import { spawn } from 'node:child_process';
import type { ToolDefinition, ToolResult, RunCommandResult } from '../types.js';
import { isCommandAllowed } from '../config.js';

/** 默认超时时间 (30秒) */
const DEFAULT_TIMEOUT = 30000;

/** 高危命令关键词 */
const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)/i,
  /sudo/i,
  /chmod\s+777/i,
  />\s*\/dev\//i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\(\)\s*{\s*:\|:\s*&\s*}\s*;/i, // fork bomb
];

/**
 * 检查命令是否为高危命令
 */
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

export const runCommandTool: ToolDefinition = {
  name: 'run_command',
  description: '在工作目录中执行 shell 命令。默认需要用户确认，高危命令必须显式批准。',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 shell 命令',
      },
      timeout: {
        type: 'number',
        description: '命令超时时间（毫秒），默认 30000',
        default: 30000,
      },
    },
    required: ['command'],
  },
  riskLevel: 'medium',
  requiresConfirmation: true,
  
  async execute(args, context): Promise<ToolResult> {
    try {
      const command = args.command as string;
      const timeout = (args.timeout as number) || DEFAULT_TIMEOUT;
      
      if (!command || command.trim() === '') {
        return {
          success: false,
          error: '必须提供命令',
        };
      }
      
      // 检查是否为高危命令
      const dangerous = isDangerousCommand(command);
      
      // 检查是否在白名单中
      const inWhitelist = isCommandAllowed(command, context.config);
      
      // 确定是否需要用户确认
      let needConfirm = !context.autoConfirm;
      
      // 如果在白名单中且不是高危命令，可以自动执行
      if (inWhitelist && !dangerous) {
        needConfirm = false;
      }
      
      // 高危命令始终需要确认
      if (dangerous) {
        needConfirm = true;
      }
      
      if (needConfirm) {
        const riskLevel = dangerous ? 'high' : 'medium';
        const prefix = dangerous ? '⚠️  高危命令 - ' : '';
        const confirmed = await context.confirmAction(
          `${prefix}执行命令: ${command}`,
          riskLevel
        );
        if (!confirmed) {
          return {
            success: false,
            error: '用户取消命令执行',
          };
        }
      }
      
      // 执行命令
      const result = await executeCommand(command, context.workingDirectory, timeout);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * 实际执行命令
 */
function executeCommand(
  command: string,
  cwd: string,
  timeout: number
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    // 使用 shell 执行命令
    const proc = spawn(command, [], {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    
    // 设置超时
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeout);
    
    // 收集标准输出
    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    // 收集标准错误
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    
    // 进程结束
    proc.on('close', (code) => {
      clearTimeout(timer);
      
      if (killed) {
        resolve({
          stdout,
          stderr: stderr + '\n[命令执行超时，已终止]',
          code: -1,
        });
      } else {
        resolve({
          stdout,
          stderr,
          code: code ?? 0,
        });
      }
    });
    
    // 进程错误
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}


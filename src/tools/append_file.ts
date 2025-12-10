/**
 * append_file 工具
 * 追加内容到文件末尾
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolDefinition, ToolResult, AppendFileResult } from '../types.js';
import { isPathAllowedForWrite } from '../config.js';

export const appendFileTool: ToolDefinition = {
  name: 'append_file',
  description: '向文件末尾追加内容。如果文件不存在，会创建新文件。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要追加内容的文件路径（相对于工作目录或绝对路径）',
      },
      content: {
        type: 'string',
        description: '要追加的内容',
      },
    },
    required: ['path', 'content'],
  },
  riskLevel: 'medium',
  requiresConfirmation: true,
  
  async execute(args, context): Promise<ToolResult> {
    try {
      const filePath = args.path as string;
      const content = args.content as string;
      
      if (!filePath) {
        return {
          success: false,
          error: '必须提供文件路径',
        };
      }
      
      if (content === undefined || content === null) {
        return {
          success: false,
          error: '必须提供要追加的内容',
        };
      }
      
      const fullPath = path.resolve(context.workingDirectory, filePath);
      
      // 安全检查
      if (!isPathAllowedForWrite(fullPath, context.config)) {
        return {
          success: false,
          error: `路径不允许写入: ${fullPath}`,
        };
      }
      
      // 用户确认
      if (!context.autoConfirm) {
        const fileExists = fs.existsSync(fullPath);
        const action = fileExists ? '追加到' : '创建并写入';
        const confirmed = await context.confirmAction(
          `${action}文件: ${filePath}`,
          'medium'
        );
        if (!confirmed) {
          return {
            success: false,
            error: '用户取消操作',
          };
        }
      }
      
      // 确保目录存在
      const dirPath = path.dirname(fullPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // 追加内容
      fs.appendFileSync(fullPath, content, 'utf-8');
      
      const result: AppendFileResult = { success: true };
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `追加文件失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};


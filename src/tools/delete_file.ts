/**
 * delete_file 工具
 * 删除文件或目录
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolDefinition, ToolResult, DeleteFileResult } from '../types.js';
import { isPathAllowedForWrite } from '../config.js';

export const deleteFileTool: ToolDefinition = {
  name: 'delete_file',
  description: '删除指定的文件或空目录。这是一个高风险操作，需要用户确认。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要删除的文件或目录路径（相对于工作目录或绝对路径）',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归删除目录内容，默认为 false',
        default: false,
      },
    },
    required: ['path'],
  },
  riskLevel: 'high',
  requiresConfirmation: true,
  
  async execute(args, context): Promise<ToolResult> {
    try {
      const filePath = args.path as string;
      const recursive = args.recursive as boolean || false;
      
      if (!filePath) {
        return {
          success: false,
          error: '必须提供文件路径',
        };
      }
      
      const fullPath = path.resolve(context.workingDirectory, filePath);
      
      // 安全检查
      if (!isPathAllowedForWrite(fullPath, context.config)) {
        return {
          success: false,
          error: `路径不允许删除: ${fullPath}`,
        };
      }
      
      // 防止删除工作目录本身或其父目录
      if (context.workingDirectory.startsWith(fullPath)) {
        return {
          success: false,
          error: '不能删除工作目录或其父目录',
        };
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `文件不存在: ${fullPath}`,
        };
      }
      
      const stats = fs.statSync(fullPath);
      const isDir = stats.isDirectory();
      
      // 用户确认（高风险操作，始终需要确认）
      const action = isDir ? (recursive ? '递归删除目录' : '删除空目录') : '删除文件';
      const confirmed = await context.confirmAction(
        `⚠️  ${action}: ${filePath}`,
        'high'
      );
      if (!confirmed) {
        return {
          success: false,
          error: '用户取消操作',
        };
      }
      
      // 执行删除
      if (isDir) {
        if (recursive) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.rmdirSync(fullPath);
        }
      } else {
        fs.unlinkSync(fullPath);
      }
      
      const result: DeleteFileResult = { success: true };
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `删除失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};


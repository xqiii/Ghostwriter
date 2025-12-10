/**
 * list_files 工具
 * 列出指定目录下的文件和子目录
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolDefinition, ToolResult, ListFilesResult } from '../types.js';

export const listFilesTool: ToolDefinition = {
  name: 'list_files',
  description: '列出指定目录下的所有文件和子目录。如果不提供路径，则列出当前工作目录。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要列出内容的目录路径（相对于工作目录或绝对路径）',
      },
    },
    required: [],
  },
  riskLevel: 'low',
  requiresConfirmation: false,
  
  async execute(args, context): Promise<ToolResult> {
    try {
      const targetPath = args.path as string | undefined;
      const fullPath = targetPath 
        ? path.resolve(context.workingDirectory, targetPath)
        : context.workingDirectory;
      
      // 检查路径是否存在
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `路径不存在: ${fullPath}`,
        };
      }
      
      // 检查是否是目录
      const stats = fs.statSync(fullPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `不是目录: ${fullPath}`,
        };
      }
      
      // 读取目录内容
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      
      const files: string[] = [];
      const directories: string[] = [];
      
      for (const entry of entries) {
        // 跳过隐藏文件（以 . 开头）
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          directories.push(entry.name);
        } else if (entry.isFile()) {
          files.push(entry.name);
        }
      }
      
      // 排序
      files.sort();
      directories.sort();
      
      const result: ListFilesResult = { files, directories };
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `列出文件失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};


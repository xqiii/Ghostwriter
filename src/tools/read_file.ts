/**
 * read_file 工具
 * 读取文件内容
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolDefinition, ToolResult, ReadFileResult } from '../types.js';

/** 最大文件大小限制 (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: '读取指定文件的内容。支持文本文件，返回文件的完整内容。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要读取的文件路径（相对于工作目录或绝对路径）',
      },
      encoding: {
        type: 'string',
        description: '文件编码，默认为 utf-8',
        default: 'utf-8',
      },
    },
    required: ['path'],
  },
  riskLevel: 'low',
  requiresConfirmation: false,
  
  async execute(args, context): Promise<ToolResult> {
    try {
      const filePath = args.path as string;
      const encoding = (args.encoding as BufferEncoding) || 'utf-8';
      
      if (!filePath) {
        return {
          success: false,
          error: '必须提供文件路径',
        };
      }
      
      const fullPath = path.resolve(context.workingDirectory, filePath);
      
      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          error: `文件不存在: ${fullPath}`,
        };
      }
      
      // 检查是否是文件
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `不是文件: ${fullPath}`,
        };
      }
      
      // 检查文件大小
      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `文件过大 (${(stats.size / 1024 / 1024).toFixed(2)}MB)，超过限制 (1MB)`,
        };
      }
      
      // 读取文件内容
      const content = fs.readFileSync(fullPath, encoding);
      
      const result: ReadFileResult = { content };
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};


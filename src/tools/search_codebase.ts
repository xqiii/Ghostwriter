/**
 * search_codebase 工具
 * 在代码库中搜索文本
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolDefinition, ToolResult, SearchCodebaseResult, SearchMatch } from '../types.js';

/** 忽略的目录 */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'target',
  'vendor',
]);

/** 支持搜索的文件扩展名 */
const SEARCHABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java', '.kt', '.scala',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs',
  '.swift',
  '.m', '.mm',
  '.vue', '.svelte',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.txt', '.rst',
  '.sh', '.bash', '.zsh', '.fish',
  '.sql',
  '.graphql', '.gql',
  '.prisma',
  '.env.example',
  'Dockerfile', 'Makefile', 'Rakefile',
]);

/** 最大搜索结果数 */
const MAX_RESULTS = 50;

/** 最大文件大小 (500KB) */
const MAX_FILE_SIZE = 500 * 1024;

export const searchCodebaseTool: ToolDefinition = {
  name: 'search_codebase',
  description: '在代码库中搜索包含指定文本的文件和行。支持正则表达式搜索。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询（支持正则表达式）',
      },
      path: {
        type: 'string',
        description: '限制搜索的目录路径（相对于工作目录）',
      },
      caseSensitive: {
        type: 'boolean',
        description: '是否区分大小写，默认为 false',
        default: false,
      },
      filePattern: {
        type: 'string',
        description: '文件名过滤模式（如 "*.ts"）',
      },
    },
    required: ['query'],
  },
  riskLevel: 'low',
  requiresConfirmation: false,
  
  async execute(args, context): Promise<ToolResult> {
    try {
      const query = args.query as string;
      const searchPath = args.path as string | undefined;
      const caseSensitive = args.caseSensitive as boolean || false;
      const filePattern = args.filePattern as string | undefined;
      
      if (!query || query.trim() === '') {
        return {
          success: false,
          error: '必须提供搜索查询',
        };
      }
      
      const basePath = searchPath
        ? path.resolve(context.workingDirectory, searchPath)
        : context.workingDirectory;
      
      // 检查路径是否存在
      if (!fs.existsSync(basePath)) {
        return {
          success: false,
          error: `路径不存在: ${basePath}`,
        };
      }
      
      // 创建正则表达式
      let regex: RegExp;
      try {
        regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } catch {
        // 如果不是有效的正则表达式，转义特殊字符
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }
      
      // 创建文件名匹配函数
      const matchesFilePattern = createFilePatternMatcher(filePattern);
      
      // 递归搜索文件
      const matches: SearchMatch[] = [];
      await searchDirectory(basePath, regex, matches, matchesFilePattern, context.workingDirectory);
      
      const result: SearchCodebaseResult = {
        matches: matches.slice(0, MAX_RESULTS),
      };
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `搜索失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * 创建文件名匹配函数
 */
function createFilePatternMatcher(pattern?: string): (filename: string) => boolean {
  if (!pattern) {
    return () => true;
  }
  
  // 简单的 glob 模式支持
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return (filename: string) => regex.test(filename);
}

/**
 * 检查文件是否应该被搜索
 */
function shouldSearchFile(filename: string): boolean {
  // 检查文件扩展名
  const ext = path.extname(filename).toLowerCase();
  if (ext && SEARCHABLE_EXTENSIONS.has(ext)) {
    return true;
  }
  
  // 检查特殊文件名
  if (SEARCHABLE_EXTENSIONS.has(filename)) {
    return true;
  }
  
  return false;
}

/**
 * 递归搜索目录
 */
async function searchDirectory(
  dirPath: string,
  regex: RegExp,
  matches: SearchMatch[],
  matchesFilePattern: (filename: string) => boolean,
  workingDirectory: string
): Promise<void> {
  if (matches.length >= MAX_RESULTS) {
    return;
  }
  
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return; // 忽略无法读取的目录
  }
  
  for (const entry of entries) {
    if (matches.length >= MAX_RESULTS) {
      break;
    }
    
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // 跳过忽略的目录
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      // 递归搜索子目录
      await searchDirectory(fullPath, regex, matches, matchesFilePattern, workingDirectory);
    } else if (entry.isFile()) {
      // 检查文件是否应该被搜索
      if (!shouldSearchFile(entry.name)) {
        continue;
      }
      
      // 检查文件名模式
      if (!matchesFilePattern(entry.name)) {
        continue;
      }
      
      // 搜索文件内容
      await searchFile(fullPath, regex, matches, workingDirectory);
    }
  }
}

/**
 * 搜索单个文件
 */
async function searchFile(
  filePath: string,
  regex: RegExp,
  matches: SearchMatch[],
  workingDirectory: string
): Promise<void> {
  try {
    // 检查文件大小
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const relativePath = path.relative(workingDirectory, filePath);
    
    for (let i = 0; i < lines.length && matches.length < MAX_RESULTS; i++) {
      const line = lines[i];
      
      // 重置 regex 的 lastIndex
      regex.lastIndex = 0;
      
      if (regex.test(line)) {
        matches.push({
          file: relativePath,
          line: i + 1, // 行号从 1 开始
          content: line.trim().substring(0, 200), // 限制内容长度
        });
      }
    }
  } catch {
    // 忽略无法读取的文件
  }
}


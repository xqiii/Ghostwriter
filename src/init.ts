/**
 * 项目初始化模块
 * 扫描项目代码并生成 GHOSTWRITER.md 项目知识文档
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LLMClient } from './llm/index.js';
import type { Message } from './types.js';
import { createSpinner, printSuccess, printWarning, printInfo, style } from './ui/index.js';

/** 默认忽略的目录和文件 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '__pycache__',
  '.cache',
  '.vscode',
  '.idea',
  'vendor',
  'target',
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.d.ts',
  '*.d.ts.map',
];

/** 支持的代码文件扩展名 */
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.go',
  '.rs',
  '.java', '.kt', '.kts',
  '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.vue', '.svelte',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.mdx',
  '.sql',
  '.sh', '.bash', '.zsh',
  '.dockerfile', 'Dockerfile',
  '.env.example',
];

/** 文件信息 */
interface FileInfo {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
  content?: string;
}

/** 项目结构信息 */
interface ProjectStructure {
  rootPath: string;
  files: FileInfo[];
  directories: string[];
  totalFiles: number;
  totalSize: number;
}

/**
 * 检查路径是否应该被忽略
 */
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const basename = path.basename(filePath);
  
  for (const pattern of ignorePatterns) {
    // 简单的通配符匹配
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (basename.endsWith(ext)) {
        return true;
      }
    } else if (basename === pattern || filePath.includes(`/${pattern}/`) || filePath.includes(`\\${pattern}\\`)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查是否是代码文件
 */
function isCodeFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  
  // 检查特殊文件名
  if (basename === 'dockerfile' || basename === '.env.example') {
    return true;
  }
  
  return CODE_EXTENSIONS.includes(ext);
}

/**
 * 递归扫描目录
 */
function scanDirectory(
  dirPath: string,
  rootPath: string,
  ignorePatterns: string[],
  maxDepth: number = 10,
  currentDepth: number = 0
): { files: FileInfo[]; directories: string[] } {
  const files: FileInfo[] = [];
  const directories: string[] = [];
  
  if (currentDepth > maxDepth) {
    return { files, directories };
  }
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);
      
      // 检查是否应该忽略
      if (shouldIgnore(fullPath, ignorePatterns) || entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        directories.push(relativePath);
        
        // 递归扫描子目录
        const subResult = scanDirectory(fullPath, rootPath, ignorePatterns, maxDepth, currentDepth + 1);
        files.push(...subResult.files);
        directories.push(...subResult.directories);
      } else if (entry.isFile() && isCodeFile(fullPath)) {
        const stats = fs.statSync(fullPath);
        files.push({
          path: fullPath,
          relativePath,
          extension: path.extname(fullPath),
          size: stats.size,
        });
      }
    }
  } catch (error) {
    // 忽略无法读取的目录
  }
  
  return { files, directories };
}

/**
 * 读取文件内容
 */
function readFileContent(filePath: string, maxSize: number = 100 * 1024): string | undefined {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > maxSize) {
      return `[文件过大: ${(stats.size / 1024).toFixed(1)}KB，已跳过]`;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * 扫描项目结构
 */
export function scanProject(rootPath: string): ProjectStructure {
  const { files, directories } = scanDirectory(rootPath, rootPath, DEFAULT_IGNORE_PATTERNS);
  
  // 读取文件内容
  for (const file of files) {
    file.content = readFileContent(file.path);
  }
  
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  return {
    rootPath,
    files,
    directories: [...new Set(directories)].sort(),
    totalFiles: files.length,
    totalSize,
  };
}

/**
 * 生成项目概览文本
 */
function generateProjectOverview(structure: ProjectStructure): string {
  const lines: string[] = [];
  
  lines.push('# 项目结构概览\n');
  lines.push(`- 根目录: ${structure.rootPath}`);
  lines.push(`- 代码文件数: ${structure.totalFiles}`);
  lines.push(`- 总大小: ${(structure.totalSize / 1024).toFixed(1)}KB\n`);
  
  // 目录结构
  lines.push('## 目录结构\n');
  lines.push('```');
  for (const dir of structure.directories.slice(0, 50)) {
    lines.push(dir + '/');
  }
  if (structure.directories.length > 50) {
    lines.push(`... 还有 ${structure.directories.length - 50} 个目录`);
  }
  lines.push('```\n');
  
  // 文件列表
  lines.push('## 代码文件\n');
  for (const file of structure.files) {
    lines.push(`### ${file.relativePath}\n`);
    if (file.content) {
      const ext = file.extension.slice(1) || 'text';
      lines.push('```' + ext);
      lines.push(file.content);
      lines.push('```\n');
    }
  }
  
  return lines.join('\n');
}

/**
 * 使用 LLM 分析项目并生成知识文档
 */
export async function generateProjectKnowledge(
  llmClient: LLMClient,
  structure: ProjectStructure,
  existingContent?: string
): Promise<string> {
  const overview = generateProjectOverview(structure);
  
  // 如果项目内容太大，需要分批处理
  const maxContentLength = 100000; // 约 100KB
  let truncatedOverview = overview;
  if (overview.length > maxContentLength) {
    truncatedOverview = overview.slice(0, maxContentLength) + '\n\n[内容过长，已截断...]';
  }
  
  const systemPrompt = `你是一个专业的代码分析师。请分析提供的项目代码，生成一份结构化的项目知识文档。

要求：
1. 使用 Markdown 格式
2. 包含以下章节：
   - 项目概述：简要描述项目的目的和主要功能
   - 技术栈：列出使用的主要技术、框架和库
   - 项目结构：描述目录结构和各部分的职责
   - 核心模块：分析主要模块/组件的功能和交互关系
   - 关键代码逻辑：解释核心业务逻辑和设计模式
   - 开发规范：总结代码风格、命名约定等
   - 注意事项：列出潜在的问题点或需要注意的地方

3. 文档应该简洁但信息丰富，便于后续作为 AI 助手的上下文参考
4. 使用中文编写`;

  const userPrompt = existingContent 
    ? `请更新以下项目知识文档。之前的文档内容：

${existingContent}

---

最新的项目代码信息：

${truncatedOverview}`
    : `请分析以下项目代码并生成项目知识文档：

${truncatedOverview}`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  
  const response = await llmClient.call(messages);
  
  return response.content;
}

/**
 * GHOSTWRITER.md 文件路径
 */
export function getGhostwriterMdPath(workingDirectory: string): string {
  return path.join(workingDirectory, 'GHOSTWRITER.md');
}

/**
 * 读取现有的 GHOSTWRITER.md 内容
 */
export function readGhostwriterMd(workingDirectory: string): string | undefined {
  const filePath = getGhostwriterMdPath(workingDirectory);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // 忽略错误
  }
  return undefined;
}

/**
 * 保存 GHOSTWRITER.md
 */
export function saveGhostwriterMd(workingDirectory: string, content: string): void {
  const filePath = getGhostwriterMdPath(workingDirectory);
  const header = `<!-- 
  此文件由 Ghostwriter /init 命令自动生成
  用于存储项目知识，作为 AI 对话的上下文
  生成时间: ${new Date().toISOString()}
-->

`;
  fs.writeFileSync(filePath, header + content, 'utf-8');
}

/**
 * 执行项目初始化
 */
export async function initProject(
  llmClient: LLMClient,
  workingDirectory: string,
  options: {
    update?: boolean;
  } = {}
): Promise<void> {
  const existingContent = options.update ? readGhostwriterMd(workingDirectory) : undefined;
  
  // 扫描项目
  const scanSpinner = createSpinner('扫描项目文件');
  scanSpinner.start();
  
  const structure = scanProject(workingDirectory);
  
  scanSpinner.stop();
  printInfo(`发现 ${structure.totalFiles} 个代码文件，共 ${(structure.totalSize / 1024).toFixed(1)}KB`);
  
  if (structure.totalFiles === 0) {
    printWarning('未发现代码文件，请确认当前目录是否正确');
    return;
  }
  
  // 显示文件列表预览
  console.log(style('\n📁 扫描到的文件:', 'yellow'));
  for (const file of structure.files.slice(0, 10)) {
    console.log(style(`   ${file.relativePath}`, 'dim'));
  }
  if (structure.files.length > 10) {
    console.log(style(`   ... 还有 ${structure.files.length - 10} 个文件`, 'dim'));
  }
  console.log('');
  
  // 使用 LLM 分析项目
  const analyzeSpinner = createSpinner('分析项目代码');
  analyzeSpinner.start();
  
  try {
    const knowledge = await generateProjectKnowledge(llmClient, structure, existingContent);
    analyzeSpinner.stop();
    
    // 保存到文件
    saveGhostwriterMd(workingDirectory, knowledge);
    
    printSuccess(`项目知识已保存到 GHOSTWRITER.md`);
    printInfo('后续对话将自动加载此文件作为上下文');
  } catch (error) {
    analyzeSpinner.stop();
    throw error;
  }
}


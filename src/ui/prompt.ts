/**
 * 终端输入模块
 * 处理用户输入和交互
 */

import * as readline from 'node:readline';
import { style } from './display.js';

/** 输入结果类型 */
export interface InputResult {
  type: 'message' | 'command' | 'agent' | 'exit' | 'empty';
  content: string;
  agentType?: string;
}

/**
 * 创建 readline 接口
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
}

/**
 * 读取单行输入
 */
export async function readLine(prompt: string = '> '): Promise<string> {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    rl.question(style(prompt, 'green', 'bold'), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * 读取多行输入
 * 以 """ 开始和结束
 */
export async function readMultiLine(): Promise<string> {
  const rl = createReadlineInterface();
  const lines: string[] = [];
  
  console.log(style('(多行输入模式，输入 """ 结束)', 'dim'));
  
  return new Promise((resolve) => {
    const handler = (line: string) => {
      if (line.trim() === '"""') {
        rl.removeListener('line', handler);
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    };
    
    rl.on('line', handler);
  });
}

/**
 * 读取用户输入（自动检测多行模式）
 */
export async function readInput(): Promise<InputResult> {
  const firstLine = await readLine('ghostwriter> ');
  const trimmed = firstLine.trim();
  
  // 空输入
  if (!trimmed) {
    return { type: 'empty', content: '' };
  }
  
  // 退出命令
  if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') {
    return { type: 'exit', content: '' };
  }
  
  // 斜杠命令
  if (trimmed.startsWith('/')) {
    return { type: 'command', content: trimmed.slice(1) };
  }
  
  // 子代理命令
  if (trimmed.startsWith('@')) {
    const agentType = trimmed.slice(1).split(/\s+/)[0];
    const content = trimmed.slice(1 + agentType.length).trim();
    return { type: 'agent', content, agentType };
  }
  
  // 多行模式
  if (trimmed === '"""') {
    const content = await readMultiLine();
    return { type: 'message', content };
  }
  
  // 普通消息
  return { type: 'message', content: firstLine };
}

/**
 * 确认操作
 */
export async function confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = await readLine(`${message} ${hint} `);
  
  const trimmed = answer.trim().toLowerCase();
  
  if (trimmed === '') {
    return defaultValue;
  }
  
  return trimmed === 'y' || trimmed === 'yes' || trimmed === '是';
}

/**
 * 选择菜单
 */
export async function selectMenu<T extends string>(
  title: string,
  options: Array<{ value: T; label: string }>
): Promise<T | null> {
  console.log('');
  console.log(style(title, 'yellow', 'bold'));
  
  options.forEach((opt, i) => {
    console.log(style(`  ${i + 1}. ${opt.label}`, 'dim'));
  });
  
  console.log(style('  0. 取消', 'dim'));
  console.log('');
  
  const answer = await readLine('请选择 [0-' + options.length + ']: ');
  const num = parseInt(answer.trim(), 10);
  
  if (isNaN(num) || num < 0 || num > options.length) {
    return null;
  }
  
  if (num === 0) {
    return null;
  }
  
  return options[num - 1].value;
}

/**
 * 输入文本
 */
export async function inputText(prompt: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? ` (默认: ${defaultValue})` : '';
  const answer = await readLine(`${prompt}${hint}: `);
  return answer.trim() || defaultValue || '';
}

/**
 * 处理中断信号
 */
export function setupInterruptHandler(onInterrupt: () => void): void {
  process.on('SIGINT', () => {
    console.log('');
    onInterrupt();
  });
}

/**
 * 等待按键继续
 */
export async function waitForKey(message: string = '按回车键继续...'): Promise<void> {
  await readLine(style(message, 'dim'));
}


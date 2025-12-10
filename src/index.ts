#!/usr/bin/env node
/**
 * Ghostwriter - 极轻量本地 AI 编程助手
 * 
 * 像 Claude Code 一样极简强大
 * 
 * @author Ghostwriter
 * @license MIT
 */

import { start } from './main.js';

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('\n❌ 未捕获的异常:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  console.error('\n❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 启动应用
start().catch((error) => {
  console.error('\n❌ 启动失败:', error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});


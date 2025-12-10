/**
 * UI 模块入口
 * 统一导出所有 UI 组件
 */

// 显示模块
export {
  style,
  clearScreen,
  clearLine,
  moveCursor,
  hideCursor,
  showCursor,
  getTerminalSize,
  printSeparator,
  printHeader,
  printLogo,
  printSystemInfo,
  printHelp,
  printUserMessage,
  printAssistantMessage,
  printToolCall,
  printToolResult,
  printReasoning,
  printThinking,
  printPlan,
  printThinkingProcess,
  printError,
  printWarning,
  printSuccess,
  printInfo,
  Spinner,
  createSpinner,
} from './display.js';

// 输入模块
export {
  readLine,
  readMultiLine,
  readInput,
  confirm,
  selectMenu,
  inputText,
  setupInterruptHandler,
  waitForKey,
} from './prompt.js';

export type { InputResult } from './prompt.js';


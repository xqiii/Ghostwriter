/**
 * 终端显示模块
 * 提供美观的终端输出功能
 */

/** ANSI 颜色代码 */
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // 亮色
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // 背景色
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

/** 样式化文本 */
export function style(text: string, ...styles: (keyof typeof COLORS)[]): string {
  const codes = styles.map(s => COLORS[s]).join('');
  return `${codes}${text}${COLORS.reset}`;
}

/** 清除屏幕 */
export function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

/** 清除当前行 */
export function clearLine(): void {
  process.stdout.write('\x1b[2K\r');
}

/** 移动光标 */
export function moveCursor(x: number, y: number): void {
  process.stdout.write(`\x1b[${y};${x}H`);
}

/** 隐藏光标 */
export function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

/** 显示光标 */
export function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

/** 获取终端尺寸 */
export function getTerminalSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

/** 打印分隔线 */
export function printSeparator(char = '─', color: keyof typeof COLORS = 'dim'): void {
  const { columns } = getTerminalSize();
  console.log(style(char.repeat(columns), color));
}

/** 打印标题 */
export function printHeader(title: string): void {
  const { columns } = getTerminalSize();
  const padding = Math.max(0, Math.floor((columns - title.length - 4) / 2));
  const line = '═'.repeat(padding);
  
  console.log('');
  console.log(style(`${line}  ${title}  ${line}`, 'cyan', 'bold'));
  console.log('');
}

/** 打印 Logo */
export function printLogo(): void {
  const logo = `
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   ${style('👻 Ghostwriter', 'cyan', 'bold')}                              ║
  ║   ${style('本地 AI 编程助手', 'dim')}                            ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
`;
  console.log(logo);
}

/** 打印系统信息 */
export function printSystemInfo(info: {
  provider: string;
  model: string;
  workingDirectory: string;
}): void {
  console.log(style('  系统信息:', 'yellow', 'bold'));
  console.log(style(`  ├─ 提供商: ${info.provider}`, 'dim'));
  console.log(style(`  ├─ 模型:   ${info.model}`, 'dim'));
  console.log(style(`  └─ 目录:   ${info.workingDirectory}`, 'dim'));
  console.log('');
}

/** 打印帮助信息 */
export function printHelp(): void {
  console.log(`
${style('命令:', 'yellow', 'bold')}
  ${style('/help', 'cyan')}         显示帮助信息
  ${style('/init', 'cyan')}         初始化项目知识 (生成 GHOSTWRITER.md)
  ${style('/init -u', 'cyan')}      更新项目知识
  ${style('/clear', 'cyan')}        清除对话历史
  ${style('/exit', 'cyan')}         退出程序
  ${style('/model', 'cyan')}        切换模型
  ${style('/provider', 'cyan')}     切换 LLM 提供商
  ${style('/status', 'cyan')}       显示当前状态
  ${style('/debug', 'cyan')}        切换调试模式

${style('子代理:', 'yellow', 'bold')}
  ${style('@test', 'cyan')}         创建测试子代理
  ${style('@review', 'cyan')}       创建代码审查子代理
  ${style('@refactor', 'cyan')}     创建重构子代理

${style('快捷键:', 'yellow', 'bold')}
  ${style('Ctrl+C', 'cyan')}        取消当前操作
  ${style('Ctrl+D', 'cyan')}        退出程序

${style('多行输入:', 'yellow', 'bold')}
  以 ${style('"""', 'cyan')} 开始和结束多行输入

${style('项目知识:', 'yellow', 'bold')}
  运行 ${style('/init', 'cyan')} 命令后，Ghostwriter 会分析当前目录的代码，
  并将学习到的项目知识保存到 GHOSTWRITER.md 文件中。
  后续对话会自动加载此文件作为上下文，帮助 AI 更好地理解你的项目。
`);
}

/** 打印用户消息 */
export function printUserMessage(message: string): void {
  console.log('');
  console.log(style('┌─ 你', 'green', 'bold'));
  for (const line of message.split('\n')) {
    console.log(style('│ ', 'green') + line);
  }
  console.log(style('└─', 'green'));
}

/** 打印助手消息 */
export function printAssistantMessage(message: string): void {
  console.log('');
  console.log(style('┌─ Ghostwriter', 'cyan', 'bold'));
  for (const line of message.split('\n')) {
    console.log(style('│ ', 'cyan') + line);
  }
  console.log(style('└─', 'cyan'));
}

/** 工具名称的友好映射 */
const TOOL_FRIENDLY_NAMES: Record<string, string> = {
  list_files: '📂 查看目录',
  read_file: '📄 打开文件',
  write_file: '✏️  写入文件',
  append_file: '➕ 追加内容',
  delete_file: '🗑️  删除文件',
  run_command: '⚙️  运行命令',
  search_codebase: '🔍 搜索代码',
};

/** 获取工具的友好名称 */
function getFriendlyToolName(name: string): string {
  return TOOL_FRIENDLY_NAMES[name] || `🔧 ${name}`;
}

/** 打印工具调用 */
export function printToolCall(name: string, args: Record<string, unknown>): void {
  console.log('');
  const friendlyName = getFriendlyToolName(name);
  console.log(style(friendlyName, 'yellow', 'bold'));

  // 只显示关键参数，简化输出
  const keyParams = getKeyParameters(name, args);
  if (keyParams) {
    console.log(style(`   ${keyParams}`, 'dim'));
  }
}

/** 获取关键参数用于显示 */
function getKeyParameters(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'list_files':
      return `路径: ${args.path || '.'}`;
    case 'read_file':
      return `文件: ${args.path}`;
    case 'write_file':
      return `文件: ${args.path}`;
    case 'append_file':
      return `文件: ${args.path}`;
    case 'delete_file':
      return `文件: ${args.path}`;
    case 'run_command':
      return `命令: ${args.command}`;
    case 'search_codebase':
      return `搜索: ${args.pattern}${args.filePattern ? ` (${args.filePattern})` : ''}`;
    default:
      // 对于未知工具，显示简化的参数
      const entries = Object.entries(args).slice(0, 2);
      return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  }
}

/** 打印工具结果 */
export function printToolResult(name: string, success: boolean, data?: unknown, error?: string): void {
  const friendlyName = getFriendlyToolName(name);

  if (success) {
    console.log(style(`✓ ${friendlyName.replace(/[📂📄✏️➕🗑️⚙️🔍🔧]\s*/, '')} 完成`, 'green'));

    if (data) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

      // 根据工具类型智能显示结果
      displayToolData(name, dataStr);
    }
  } else {
    console.log(style(`✗ ${friendlyName.replace(/[📂📄✏️➕🗑️⚙️🔍🔧]\s*/, '')} 失败`, 'red'));
    if (error) {
      console.log(style('   ' + error, 'red'));
    }
  }
}

/** 智能显示工具数据 */
function displayToolData(toolName: string, dataStr: string): void {
  const lines = dataStr.split('\n');

  // 根据工具类型设置不同的显示策略
  let maxLines: number;
  let showPreview = false;

  switch (toolName) {
    case 'write_file':
    case 'append_file':
      // 写入/追加文件时，只显示简短预览
      maxLines = 5;
      showPreview = true;
      break;
    case 'read_file':
      // 读取文件时，显示更多内容但仍然限制
      maxLines = 15;
      showPreview = true;
      break;
    case 'run_command':
      // 命令执行结果，显示适中长度
      maxLines = 10;
      break;
    case 'list_files':
      // 列出文件，限制数量
      maxLines = 20;
      break;
    case 'search_codebase':
      // 搜索结果，适当限制
      maxLines = 15;
      break;
    default:
      maxLines = 10;
  }

  if (lines.length > maxLines) {
    // 显示前几行
    const previewLines = lines.slice(0, maxLines);
    for (const line of previewLines) {
      console.log(style('   ' + line, 'dim'));
    }

    // 显示省略信息
    const remaining = lines.length - maxLines;
    if (showPreview && remaining > 0) {
      console.log(style(`   ... 已省略 ${remaining} 行${isCodeContent(dataStr) ? '代码' : ''}`, 'dim', 'italic'));
    } else {
      console.log(style(`   ... 还有 ${remaining} 行`, 'dim'));
    }
  } else {
    // 内容较短，全部显示
    for (const line of lines) {
      console.log(style('   ' + line, 'dim'));
    }
  }
}

/** 判断是否为代码内容 */
function isCodeContent(content: string): boolean {
  // 简单的启发式判断：包含常见代码符号
  const codeIndicators = ['{', '}', 'function', 'const', 'let', 'import', 'export', 'class', '=>'];
  const indicatorCount = codeIndicators.filter(indicator => content.includes(indicator)).length;
  return indicatorCount >= 3;
}

/** 打印思考过程（旧版兼容） */
export function printReasoning(reasoning: string): void {
  if (!reasoning) return;
  
  console.log('');
  console.log(style('💭 思考:', 'magenta'));
  for (const line of reasoning.split('\n')) {
    console.log(style('   ' + line, 'dim', 'italic'));
  }
}

/** 打印逐步思考过程 */
export function printThinking(thinking: string[]): void {
  if (!thinking || thinking.length === 0) return;
  
  console.log('');
  console.log(style('🧠 逐步思考:', 'magenta', 'bold'));
  console.log(style('┌' + '─'.repeat(60), 'magenta'));
  
  for (let i = 0; i < thinking.length; i++) {
    const step = thinking[i];
    const prefix = i === thinking.length - 1 ? '└' : '├';
    const stepNum = style(`[${i + 1}]`, 'brightMagenta');
    console.log(style(prefix + '─ ', 'magenta') + stepNum + style(' ' + step, 'dim', 'italic'));
  }
}

/** 打印执行计划 */
export function printPlan(plan: string[]): void {
  if (!plan || plan.length === 0) return;
  
  console.log('');
  console.log(style('📋 执行计划:', 'blue', 'bold'));
  console.log(style('┌' + '─'.repeat(60), 'blue'));
  
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const prefix = i === plan.length - 1 ? '└' : '├';
    const checkbox = style('☐', 'brightBlue');
    console.log(style(prefix + '─ ', 'blue') + checkbox + style(' ' + step, 'white'));
  }
}

/** 打印完整的思考和计划过程 */
export function printThinkingProcess(thinking: string[], plan: string[]): void {
  const hasThinking = thinking && thinking.length > 0;
  const hasPlan = plan && plan.length > 0;
  
  if (!hasThinking && !hasPlan) return;
  
  console.log('');
  console.log(style('═'.repeat(62), 'dim'));
  
  if (hasThinking) {
    printThinking(thinking);
  }
  
  if (hasPlan) {
    printPlan(plan);
  }
  
  console.log(style('═'.repeat(62), 'dim'));
}

/** 打印错误 */
export function printError(message: string): void {
  console.log('');
  console.log(style('❌ 错误: ' + message, 'red', 'bold'));
}

/** 打印警告 */
export function printWarning(message: string): void {
  console.log(style('⚠️  警告: ' + message, 'yellow'));
}

/** 打印成功 */
export function printSuccess(message: string): void {
  console.log(style('✅ ' + message, 'green'));
}

/** 打印信息 */
export function printInfo(message: string): void {
  console.log(style('ℹ️  ' + message, 'blue'));
}

/** 简单的加载动画 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private current = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;
  
  constructor(message: string = '思考中') {
    this.message = message;
  }
  
  start(): void {
    hideCursor();
    this.interval = setInterval(() => {
      clearLine();
      process.stdout.write(style(`${this.frames[this.current]} ${this.message}...`, 'cyan'));
      this.current = (this.current + 1) % this.frames.length;
    }, 80);
  }
  
  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    clearLine();
    showCursor();
    if (finalMessage) {
      console.log(finalMessage);
    }
  }
  
  update(message: string): void {
    this.message = message;
  }
}

/** 创建加载动画 */
export function createSpinner(message?: string): Spinner {
  return new Spinner(message);
}


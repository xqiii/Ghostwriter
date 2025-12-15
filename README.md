# 👻 Ghostwriter

极轻量本地 AI 编程助手

## ✨ 特性

- 🚀 **极轻量**: 纯 TypeScript/Node.js 实现，无重型框架依赖
- 🖥️ **终端原生**: 完全运行在终端，无需浏览器或 GUI
- 🔧 **混合工具系统**: 7 个高性能内置工具 + 可扩展的 MCP 工具
- 🔌 **MCP 集成**: 支持 Model Context Protocol，可使用社区 MCP 服务器扩展能力
- 🌐 **多模型支持**: 支持 Anthropic、OpenAI、Ollama、Grok、Kimi 等多个 LLM 提供商
- 🛡️ **安全机制**: 危险操作需要用户确认，支持白名单配置
- 🤖 **子代理系统**: 支持创建专门的测试、审查、重构子代理

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置 API Key

创建 `.env` 文件或设置环境变量：

```bash
# Anthropic (推荐)
export ANTHROPIC_API_KEY=your_api_key

# OpenAI
export OPENAI_API_KEY=your_api_key

# Grok
export GROK_API_KEY=your_api_key

# Kimi (Moonshot 月之暗面)
export MOONSHOT_API_KEY=your_api_key

# Ollama (本地运行，无需 API Key)
# 确保 Ollama 正在运行: ollama serve
```

### 启动

```bash
# 开发模式
npm run dev

# 或者先构建再运行
npm run build
npm start
```

## 📖 使用方法

### 基本对话

直接输入你的问题或任务：

```
ghostwriter> 帮我创建一个简单的 Express 服务器
```

### 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清除对话历史 |
| `/exit` | 退出程序 |
| `/model` | 切换模型 |
| `/provider` | 切换 LLM 提供商 |
| `/debug` | 切换调试模式 |
| `/status` | 显示当前状态 |
| `/tools` | 查看所有可用工具（内置 + MCP） |
| `/mcp` | 查看 MCP 服务器状态 |

### 子代理

使用 `@` 符号创建专门的子代理：

```
ghostwriter> @test 为 utils.ts 编写单元测试
ghostwriter> @review 审查 api.ts 的代码质量
ghostwriter> @refactor 重构 handler.ts 提取公共方法
```

### 多行输入

使用三个引号 `"""` 开始和结束多行输入：

```
ghostwriter> """
这是一段
多行
输入
"""
```

## ⚙️ 配置

### 命令行参数

```bash
# 自动确认模式（跳过危险操作确认）
npm run dev -- -y

# 调试模式
npm run dev -- -d

# 指定工作目录
npm run dev -- -C /path/to/project

# 指定 LLM 提供商
npm run dev -- -p ollama

# 指定模型
npm run dev -- -m gpt-4o
```

### 项目配置文件

在项目根目录创建 `.aide/config.json`：

```json
{
  "allow_commands": [
    "git status",
    "git diff",
    "npm test",
    "npm run *"
  ],
  "allow_write_paths": [
    "src/",
    "tests/"
  ],
  "deny_paths": [
    "node_modules",
    ".git",
    ".env"
  ],
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

### MCP 配置（可选）

Ghostwriter 支持 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)，可以使用社区 MCP 服务器扩展工具能力。

在项目目录或用户主目录创建 `.ghostwriter/mcp-config.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/your/project"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "disabled": true
    }
  }
}
```

**常用 MCP 服务器：**

- `@modelcontextprotocol/server-filesystem` - 高级文件系统操作
- `@modelcontextprotocol/server-github` - GitHub 仓库操作
- `@modelcontextprotocol/server-postgres` - PostgreSQL 数据库访问
- `@modelcontextprotocol/server-sqlite` - SQLite 数据库访问
- `@modelcontextprotocol/server-brave-search` - 网页搜索
- 更多服务器请访问 [MCP Servers](https://github.com/modelcontextprotocol/servers)

**使用方式：**

```bash
# 查看所有可用工具（内置 + MCP）
ghostwriter> /tools

# 查看 MCP 服务器状态
ghostwriter> /mcp
```

## 🔧 内置工具

| 工具 | 说明 | 风险等级 |
|------|------|----------|
| `list_files` | 列出目录内容 | 低 |
| `read_file` | 读取文件内容 | 低 |
| `write_file` | 创建或覆盖文件 | 中 |
| `append_file` | 追加文件内容 | 中 |
| `delete_file` | 删除文件或目录 | 高 |
| `run_command` | 执行 Shell 命令 | 中/高 |
| `search_codebase` | 搜索代码库 | 低 |

## 🛡️ 安全机制

1. **用户确认**: 写文件、删除文件、执行命令默认需要用户按 `y` 确认
2. **高危命令检测**: 自动检测危险命令（如 `rm -rf`、`sudo` 等），强制要求确认
3. **路径保护**: 默认禁止访问 `node_modules`、`.git`、`.env` 等敏感路径
4. **命令白名单**: 可配置允许自动执行的命令列表
5. **最大循环限制**: 工具调用最多循环 8 次，防止无限循环

## 🔌 支持的 LLM 提供商

| 提供商 | 模型示例 | 说明 |
|--------|----------|------|
| Anthropic | claude-sonnet-4-20250514 | 推荐，性能最佳 |
| OpenAI | gpt-4o, gpt-4-turbo | 广泛兼容 |
| Ollama | llama3.2, codellama | 本地运行，免费 |
| Grok | grok-2-latest | xAI 提供 |
| Kimi-K2 | kimi-k2-turbo-preview | 月之暗面，长上下文 |

## 📝 开发

```bash
# 类型检查
npm run typecheck

# 构建
npm run build
```

## 📄 License

MIT

---

Made with 👻 by Ghostwriter


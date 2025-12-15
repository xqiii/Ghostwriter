# MCP 集成使用指南

Ghostwriter 现已支持 Model Context Protocol (MCP)！这意味着你可以使用社区的 MCP 服务器扩展 Ghostwriter 的能力。

## 🎯 什么是 MCP？

MCP (Model Context Protocol) 是 Anthropic 推出的标准化协议，用于 AI 应用与外部工具的集成。通过 MCP，你可以：

- 使用社区已有的数百个工具服务器
- 无需修改代码即可扩展功能
- 标准化的工具定义和错误处理
- 进程隔离，更好的安全性

## 🚀 快速开始

### 1. 创建配置文件

在项目目录或用户主目录创建 `.ghostwriter/mcp-config.json`：

```bash
mkdir -p .ghostwriter
cp mcp-config.example.json .ghostwriter/mcp-config.json
```

### 2. 编辑配置

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/yourname/projects"
      ],
      "disabled": false
    }
  }
}
```

### 3. 启动 Ghostwriter

MCP 服务器会在启动时自动连接：

```bash
npm run dev
```

你会看到类似的提示：

```
✓ 已连接 1 个 MCP 服务器: filesystem
```

### 4. 使用 MCP 工具

```bash
# 查看所有可用工具
ghostwriter> /tools

# 查看 MCP 状态
ghostwriter> /mcp

# 直接使用工具（AI 会自动选择合适的工具）
ghostwriter> 帮我查找所有 TypeScript 文件
```

## 📦 推荐的 MCP 服务器

### GitHub 集成

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

功能：创建 issue、PR、评论、查看仓库等

### 数据库访问

**PostgreSQL:**
```json
"postgres": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres"],
  "env": {
    "POSTGRES_CONNECTION_STRING": "${POSTGRES_CONNECTION_STRING}"
  }
}
```

**SQLite:**
```json
"sqlite": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-sqlite",
    "/path/to/database.db"
  ]
}
```

### 网页搜索

```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "${BRAVE_API_KEY}"
  }
}
```

## 🎨 工具优先级

Ghostwriter 使用**混合架构**：

1. **内置工具优先**：性能最佳，响应快速
   - list_files
   - read_file
   - write_file
   - append_file
   - delete_file
   - run_command
   - search_codebase

2. **MCP 工具**：扩展功能
   - 当内置工具无法满足需求时自动使用
   - 提供更多专业能力（如 GitHub 操作、数据库查询等）

## 🔧 高级配置

### 禁用特定服务器

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "disabled": true  // 暂时禁用
    }
  }
}
```

### 环境变量替换

配置中可以使用 `${VAR_NAME}` 引用环境变量：

```json
{
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}",  // 从环境变量读取
    "API_KEY": "${MY_API_KEY}"
  }
}
```

### 多个配置位置

优先级顺序：

1. `.ghostwriter/mcp-config.json` (项目目录)
2. `~/.ghostwriter/mcp-config.json` (用户主目录)

## 🐛 故障排查

### MCP 服务器未启动

```bash
# 启用调试模式查看详细日志
npm run dev -- -d
```

### 工具未显示

```bash
ghostwriter> /tools  # 查看所有工具
ghostwriter> /mcp    # 查看服务器状态
```

### 权限问题

确保 MCP 服务器有权访问指定的路径：

```json
{
  "filesystem": {
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/absolute/path/to/your/project"  // 使用绝对路径
    ]
  }
}
```

## 📚 更多资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP 服务器列表](https://github.com/modelcontextprotocol/servers)
- [创建自定义 MCP 服务器](https://modelcontextprotocol.io/docs/tools/building-servers)

## 💡 使用建议

1. **从少量服务器开始**：先配置 1-2 个最需要的服务器
2. **监控性能**：MCP 工具有轻微的进程通信开销
3. **合理分工**：频繁使用的工具依赖内置版本，扩展功能使用 MCP
4. **安全第一**：只启用信任的 MCP 服务器

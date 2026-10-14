# AWS Agent Toolkit 设置完成 ✅

## ✓ 已完成的步骤

1. **AWS CLI 安装** - v2.38.0 ✓
2. **AWS 登录认证** - greenfield-adventures profile ✓
3. **凭证验证** - 账户 028610956878 ✓
4. **Agent Toolkit 安装** - 24 个 AWS 技能已安装 ✓
5. **AWS 规则配置** - 新用户体验规则已添加 ✓

## 🔧 需要手动完成：配置 MCP 服务器 Profile

由于 Kiro 的安全设置，需要手动更新 MCP 配置文件。

### 步骤 1：打开 Kiro 的 MCP 配置

在你的终端中打开：
```bash
cat ~/.kiro/settings/mcp.json
```

或用编辑器打开：
```bash
open ~/.kiro/settings/mcp.json
```

### 步骤 2：添加环境变量

在 `aws-mcp` 服务器配置中添加 `env` 块：

```json
{
  "mcpServers": {
    "aws-mcp": {
      "command": "uvx",
      "args": [
        "mcp-proxy-for-aws@latest",
        "https://aws-mcp.us-east-1.api.aws/mcp",
        "--metadata",
        "INSTALL_SOURCE=aws-cli"
      ],
      "timeout": 100000,
      "transport": "stdio",
      "env": {
        "AWS_MCP_PROXY_PROFILES": "greenfield-adventures"
      }
    }
  }
}
```

**重点**：只添加 `env` 块，保持其他配置不变。

### 步骤 3：重启 Kiro

更新后，关闭并重新打开 Kiro。MCP 服务器会自动重新连接。

## 📋 配置信息总结

| 项目 | 值 |
|------|-----|
| Profile Name | `greenfield-adventures` |
| AWS Region | `eu-north-1` |
| Account ID | `028610956878` |
| Account Role | `AccountFullAccessRole` |
| MCP Region | `us-east-1` |
| AWS Experience | 全新 AWS Experience |
| 项目名称 | Greenfield Adventures |

## ✅ 后续步骤

1. 手动更新 `~/.kiro/settings/mcp.json`
2. 重启 Kiro
3. 使用新 AWS 技能开始开发

### 测试第一个项目

尝试这个提示词：
```
Please make a single page webapp game and deploy it to AWS.
```

## 📚 多账户切换

如果后续需要使用其他 AWS 账户：

```bash
aws login --profile <new-profile-name>
```

然后更新 `~/.kiro/settings/mcp.json` 中的 `AWS_MCP_PROXY_PROFILES` 为用空格分隔的多个 profile：

```json
"env": {
  "AWS_MCP_PROXY_PROFILES": "greenfield-adventures another-profile"
}
```

## 📖 更多信息

- [AWS Agent Toolkit 文档](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/)
- [MCP 服务器配置](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/getting-started-aws-mcp-server.html)

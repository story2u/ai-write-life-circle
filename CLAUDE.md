# Greenfield Adventures - Claude Code 入口

本项目是一个基于 React + TypeScript 的**创意写作协作工具**。

完整文档参考 [AGENTS.md](AGENTS.md)

## 🚀 快速开始

### 本地开发
```bash
pnpm install
pnpm dev
# 访问 http://localhost:5173
```

### 部署到 AWS
```bash
git push origin main
# GitHub Actions 自动构建
# 然后在 EC2 上运行 deploy/deploy-simple.sh
```

## 📚 文档索引

### 理解项目
- **项目概览**：[AGENTS.md](AGENTS.md)
- **技术栈**：React 19 + TypeScript + Vite + Monorepo (pnpm)
- **项目结构**：apps/（代码）+ packages/（共享）+ harness/（文档）
- **整体架构**：[harness/architecture/architecture.md](harness/architecture/architecture.md)
- **前端架构**：[harness/architecture/frontend-architecture.md](harness/architecture/frontend-architecture.md)

### 开发指南
- 文档中心：[harness/README.md](harness/README.md)
- 任务路由：[harness/index.md](harness/index.md)
- 数据契约：[harness/data-contract.md](harness/data-contract.md)

### 部署运维
- 部署指南：[harness/deploy-guide.md](harness/deploy-guide.md)
- 部署工作流：[harness/workflows/deploy.md](harness/workflows/deploy.md)
- 安全指南：[harness/security.md](harness/security.md)

### 设计规范
- Figma 设计：[harness/design/figma.md](harness/design/figma.md)
- 同步流程：[harness/design/sync-workflow.md](harness/design/sync-workflow.md)

## 🎯 工作原则

遵循 **Harness 最小上下文加载** 原则：
1. 不要一次读取所有文档
2. 根据任务查 `harness/index.md` 找到对应工作流
3. 按需读取相关文档

## 📁 核心目录

```
/
├── apps/              # 应用代码
│   ├── web/          # 前端应用（主要）
│   └── api/          # 后端 API（未启用）
├── packages/         # 共享包
│   └── contracts/    # 类型定义
├── harness/          # 文档中心
├── deploy/           # 部署配置
├── package.json      # Workspace 根配置
├── pnpm-workspace.yaml  # Workspace 定义
└── tsconfig.base.json   # TypeScript 基础配置
```

## 🔧 技术栈

- React 19 + TypeScript
- Vite 8 + TailwindCSS 4
- TipTap 编辑器
- Docker + AWS ECR + EC2

---

详细信息参考 [AGENTS.md](AGENTS.md)

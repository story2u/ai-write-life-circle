# Harness - 项目文档中心

遵循**最小上下文加载**原则，按需读取相关文档。

## 📋 文档导航

### 1. 架构文档 (`architecture/`)

| 文档 | 用途 |
|------|------|
| [architecture.md](architecture/architecture.md) | 整体架构设计 |
| [frontend-architecture.md](architecture/frontend-architecture.md) | 前端架构 |
| [adapters.md](architecture/adapters.md) | 适配器模式 |
| [harness-mapping.md](architecture/harness-mapping.md) | Harness 映射关系 |

### 2. 设计文档 (`design/`)

| 文档 | 用途 |
|------|------|
| [figma.md](design/figma.md) | Figma 设计规范 |
| [sync-workflow.md](design/sync-workflow.md) | 设计同步流程 |
| [sync-log.md](design/sync-log.md) | 同步日志 |

### 3. 工作流 (`workflows/`)

参考 [index.md](index.md) 查看任务路由表。

| 工作流 | 用途 |
|--------|------|
| [deploy.md](workflows/deploy.md) | 部署到 AWS |
| [bootstrap.md](workflows/bootstrap.md) | 项目初始化 |
| [prepare.md](workflows/prepare.md) | 准备工作 |
| [ingest.md](workflows/ingest.md) | 数据摄入 |
| [review.md](workflows/review.md) | 代码审查 |
| [inspire.md](workflows/inspire.md) | 灵感收集 |
| [accept.md](workflows/accept.md) | 接受变更 |
| [handoff.md](workflows/handoff.md) | 交接工作 |

### 4. 契约与验证记录

- [data-contract.md](data-contract.md)：领域数据说明
- [API 契约](contracts/README.md)：来源快照、工程扩展与可复现生成
- [工程决策](architecture/adr/ADR-0002-vnext-author-notes.md)：作者笔记边界
- [VNext 实施报告](reviews/vnext-figma-fullstack-sync.md)：交付范围、验证与未覆盖项
- [UX 整改记录](reviews/claude-product-ux-remediation.md)：历史审查证据

项目文档统一维护在本目录；开发及部署工具位于根目录的 `scripts/`。

## 🎯 使用原则

1. **按需读取**：不要一次加载所有文档
2. **任务驱动**：通过 [index.md](index.md) 路由到具体工作流
3. **最小上下文**：只读取完成任务所需的最少文档

## 📖 快速开始

查看 [index.md](index.md) 找到你需要的工作流。

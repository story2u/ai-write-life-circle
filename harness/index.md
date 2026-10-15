# 按任务读取

先读根入口（AGENTS.md 或 CLAUDE.md）、本目录 README.md，然后选择一项：

| 用户意图 | 工作流 | 最小上下文 |
| --- | --- | --- |
| 部署到 AWS | [deploy](workflows/deploy.md) | scripts/deploy/、.github/workflows、apps/web/.env.example |
| 项目初始化 | [bootstrap](workflows/bootstrap.md) | 项目配置、依赖 |
| 准备开发 | [prepare](workflows/prepare.md) | 开发环境、工具链 |
| 数据处理 | [ingest](workflows/ingest.md) | 数据模型、API |
| 代码审查 | [review](workflows/review.md) | 代码规范、检查清单 |
| 功能设计 | [inspire](workflows/inspire.md) | 设计规范、参考 |
| 接受变更 | [accept](workflows/accept.md) | PR、变更记录 |
| 工作交接 | [handoff](workflows/handoff.md) | 当前状态、待办 |

架构和设计文档见 [README.md](README.md)。
数据字段见 [data-contract.md](data-contract.md)，可执行 API 契约见 [contracts/README.md](contracts/README.md)，交付验证见 [VNext 报告](reviews/vnext-figma-fullstack-sync.md)。

默认只读 1 个工作流、相关索引和至多 5 个相关文件；上下文不足时按需扩大并说明。

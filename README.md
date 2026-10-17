# Writer Agent

作者主导的写作工作台。React + TypeScript 前端、Go API 与共享契约组成 pnpm Monorepo。

## 本地开发

```sh
pnpm install --frozen-lockfile
pnpm dev          # Demo 界面
pnpm dev:local    # 本地 API + 前端
```

默认 API 为 Go，单独运行其二进制无需 Node.js；前端工具链仍使用 pnpm。本地 API 仅提供开发身份。Go 已支持作者主动触发、固定修订与精确引文核验的连续性审查；需配置真实模型并逐次授权发送范围。通用 Agent Runtime 与正式知识写入尚未实现；Demo 模拟能力与 API 数据隔离。详情见 [Web](apps/web/README.md) 与 [Go API](apps/api-go/README.md)。

## 目录

| 目录 | 必要职责 |
| --- | --- |
| `apps/` | Web 与 API 应用 |
| `packages/` | 共享类型、数据契约与校验 |
| `scripts/` | 开发、生成、校验工具；部署配置在 `scripts/deploy/` |
| `harness/` | 唯一文档中心：架构、设计、API 规范、工作流与验证报告 |

`node_modules/` 是 pnpm 依赖，由安装命令生成；`.github/` 保存 CI/CD；隐藏的编辑器配置保留其约定路径。原 `docs/`、`design/` 已合并到 `harness/`，原 `deploy/` 已归入 `scripts/deploy/`。

## 入口与验证

- [协作入口](AGENTS.md) · [文档索引](harness/README.md) · [任务路由](harness/index.md)
- [API 规范](harness/contracts/README.md) · [前端架构](harness/architecture/frontend-architecture.md)
- [VNext 实施报告](harness/reviews/vnext-figma-fullstack-sync.md) · [部署说明](scripts/deploy/README.md)
- [Go 迁移报告](harness/reviews/go-backend-migration-report.md) · [兼容与回滚基线](harness/architecture/go-backend-migration.md)
- `pnpm dev:api:node` / `pnpm dev:local:node`：迁移期间的旧后端入口
- `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`
- `pnpm openapi:check`、`pnpm openapi:lint`、`pnpm test:e2e`

作者负责创意决策与小说正文。项目维护不代写正文，不自动更新正式设定；外部作品目录与本项目应用状态应分别管理。

## 连续性审查（Sprint 3）

先保存真实章节，再点击“审查本章”，核对模型、资料范围并勾选授权。完成后按需查看页边注记、两处只读证据，标记有用/误报/有意为之/忽略；所有判断仍由作者确认。正文或证据变化后旧结果标记过期。未配置模型时禁用新审查，不加载演示发现。

配置与限制见 [Go API](apps/api-go/README.md)、[实施报告](harness/reviews/sprint3-evidence-review-agent-report.md) 和 [评测说明](harness/evals/review-agent/README.md)。`pnpm eval:review` 运行隔离的确定性工程评测；真实模型验证按用户决定暂缓，不能据此宣称审查准确率。

### story2u public website V1 (in progress)

The Go publication domain and anonymous snapshot catalog are being implemented
on `codex/story2u-public-site-v1`. See the
[gap analysis](harness/design/story2u-public-site-v1-gap-analysis.md),
[publication domain](harness/architecture/publication-domain.md) and
[rendering ADR](harness/architecture/public-site-rendering.md).
This is not a deployed public reading website: latest Make source export and
Google OAuth PR #11 integration are still required for the public React pages,
Studio publishing wizard and SEO. No production content is published by these
development tests.

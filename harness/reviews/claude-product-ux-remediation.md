# Writer Agent 产品与 UI/UX 评审核验及整改

日期：2026-10-14  
工程基线：`origin/main`，`6e4d27fc7543c698f52bb065e1a435d41aaf323c`（PR #4 合并后的 main）  
Figma Make：[`Writer Agent UI/UX Design`](https://www.figma.com/make/kWBOdcae5utBZ6VtBHHXui/Writer-Agent-UI-UX-Design)，fileKey `kWBOdcae5utBZ6VtBHHXui`，读取节点 `0:1`

本文件区分源代码、API 和运行检查能够证明的事实，与仍需 Figma 或作者验证的产品假设。评审输入是整改线索，不是产品规格。

## 核验范围与限制

- 已从最新 `main` 检查 `AGENTS.md`、`README.md`、`state/current.md`、架构和 V0.4 评审文档、Figma 同步说明，以及 `apps/web`、`apps/api`、`packages/contracts` 的相关实现与测试。
- 通过 Figma MCP 的 `get_design_context` 读取了 Make 文件源码、IA、页面映射、设计系统和写作工作台等产品说明。该 Make 文件未提供可用于本次的截图；`get_screenshot` 返回 Make 文件不受支持。因此没有完成 Figma 与运行页面的像素级截图比较，也不把视觉猜测标为已验证缺陷。
- Figma MCP 未暴露可核验的 Make 版本号；本次只记录读取日期，不推测设计版本。
- 仓库中的 `manuscript/` 只有说明文件，没有正式章节。`book/`、`inbox/`、`proposals/`、`decisions/` 是作品事实与作者记录区域；本整改不修改这些创作资料。
- Figma 产品说明中的知识库、审查、推演、提案部分交互标记为原型或待议；当前正式 API 只有 Workspace / Chapter 能力。API 模式不使用演示知识或演示章节填充真实作品。

## 十项问题的事实状态

状态指本轮代码修改完成后的仓库状态；“部分”表示存在原型或局部能力，但目标闭环尚不存在。

| 项目 | 状态 | 源码/运行证据与处理 |
| --- | --- | --- |
| P0-01 写作优先默认布局 | `VERIFIED` | `apps/web/src/features/workspace/useWorkspaceController.ts`、`apps/web/src/services/mappers/workspaceMapper.ts`、`apps/api/src/workspace/state-store.ts`、`apps/web/src/app/App.tsx`。新用户默认左侧章节导航展开、右侧 Agent 面板收起；作者更改布局后保存。API 初次读取不再伪装成已有布局偏好。已有本地旧布局和服务端显式布局保守恢复。 |
| P0-02 减少 AI 干扰 | `VERIFIED` | `apps/web/src/components/ChapterNavigator.tsx`、`apps/web/src/components/ReviewPanel.tsx`、`apps/web/src/app/App.tsx`、`apps/web/src/features/workspace/useWorkspaceController.ts`。写作画面/章节树不显示待处理数字或提示点，筛选不显示数量；审查成功和取消不弹 Toast。显式审查结果在面板内以 `aria-live` 更新。保存失败、409、草稿恢复及偏好保存错误仍有可访问反馈。 |
| P0-03 导航与概念去重 | `PARTIAL` | `apps/web/src/app/App.tsx`、`apps/web/src/components/ChapterNavigator.tsx`、`apps/web/src/components/DesignNotes.tsx`。正式产品的设计说明只在开发构建显示；未实现的“创作总览 / 故事结构”占位已移除。Figma 当前 IA 仍定义知识库、提案/决策与 Agent 面板的多个可互达入口；主 IA 需由 Figma 确认，本次未自行改版。 |
| P0-04 Note 与 Canon Change 分离 | `PARTIAL` | `apps/web/src/app/App.tsx` 中 Demo 对话/推演可将内容保存为 Demo Proposal；`apps/web/src/components/Proposals.tsx`、`packages/contracts/src/v04.ts` 有提案/决定表示，但没有 Note 或 Canon Change API。Proposal/Decision 不等同于随手笔记。本次不改名、不迁移旧记录、不更改 Harness 规则。 |
| P1-05 续写入口 | `NOT_IMPLEMENTED` | 当前会恢复上次章节与工作区状态，但没有作者填写的“下次要写”、正文末尾摘录卡片或“继续写 / 先想一想”的续写入口。没有正式章节时的空状态已明确不会自动生成正文。 |
| P1-06 页边注记 | `PARTIAL` | `apps/web/src/components/ManuscriptEditor.tsx`、`apps/web/src/components/ReviewPanel.tsx`、`apps/web/src/types.ts` 的 Demo 发现按段落位置/原文片段展示；没有真实 Agent、稳定正文锚点、来源版本有效性和持久化作者操作闭环。API 模式没有此能力。 |
| P1-07 本章相关知识 | `PARTIAL` | `apps/web/src/components/Proposals.tsx`、`apps/web/src/services/mappers/workspaceMapper.ts`、`apps/api/src/http.ts`：Demo 有静态知识查看入口；API Mapper 返回空知识，API 模式展示未接入状态。尚无基于明确来源和章节证据的相关性查询 API。 |
| P1-08 故事冲突处理 | `PARTIAL` | 保存版本冲突见 `apps/web/src/features/workspace/useWorkspaceController.ts` 与 `apps/web/src/app/App.tsx`；Demo 故事审查发现由 `apps/web/src/components/ReviewPanel.tsx` 显示。HTTP 409 保留最新 Markdown/恢复草稿并阻止自动盲重试；故事发现没有证据 A/B 并排阅读和完整作者判断流程。两者没有合并。 |
| P1-09 隐藏工程术语 | `PARTIAL` | `apps/web/src/components/ChapterNavigator.tsx`、`apps/web/src/app/App.tsx`。章节导航不再把草稿状态标为 “Harness · 应用草稿”，空章节文案使用“作品资料”。稳定 ID、Hash、revision 保留在契约和内部模型；部分详情仍显示编号，全面用户语言重写依赖新 IA/详情设计。 |
| P2-10 视觉系统 | `UNVERIFIED` | Token 权威源仍是 Figma Make 的 `src/index.css`；未批量更改字体、字号、颜色、间距、圆角或阴影。本地浏览器检查了 1440px Light/Dark/Focus 与面板收起/展开；Make 截图接口不支持该文件，因此未做像素对比。视觉层级评估交给 Figma。 |

## 当前能力的 Demo / API 边界

| 能力 | Demo | API / 真实项目 |
| --- | --- | --- |
| 章节树、章节原文与保存 | 演示作品数据 | Workspace / Chapter API 和应用草稿保存已实现；当前 Harness 没有正式章节，E2E 使用隔离 fixture。 |
| 知识查看 | 静态演示条目 | Knowledge API 尚未实现；返回空知识和未接入提示。 |
| 审查 / 对话 / 推演 / 提案 / 决策 | 可运行的确定性演示交互，结果有 Demo 标识 | Agent Runtime 和相应后端业务端点未实现；API 模式显示不可用提示，不回退到 Demo 数据。 |
| Note / 页边注记 | 不具备正式持久化 Note；Demo 审查项可锚到段落/quote | Note API、版本锚定注记和作者操作记录均未实现。 |
| 设计说明 | 开发环境访问 | 生产构建不展示入口，也不包含 DesignNotes 模块代码。 |

## 本轮可安全实施的修复（A 组）

1. 新用户/无布局偏好时收起右侧 Agent 面板，保留章节目录和明显的“Agent 面板”打开入口；Light / Dark 和专注模式不变。
2. Demo 新用户显式记录“布局尚未自定义”，避免首次默认值被本地保存后在下次打开时误当成作者偏好。用户以后操作布局即记录为自定义。迁移前的旧 Demo 布局无法区分“首次自动保存”与“作者主动设置”，因此保守保留旧值，避免覆盖作者可能设置的偏好。
3. API Workspace 无布局记录时保持无 `layout`；DTO 映射提供写作优先展示默认值。首次偏好更新后正常保存布局。老服务端已存在的布局仍作为作者偏好保留。
4. 移除章节导航上的待处理数字/点、审查页数字计数及审查成功/取消 Toast。保存、冲突、错误和恢复提示继续保留。
5. 生产导航隐藏开发设计说明；开发构建可以从“开发说明”访问。移除尚不可用的“创作总览 / 故事结构”占位，但不删除 Demo 审查、对话、推演、提案或知识查看功能。
6. 将少量面向作者的实现文案改为“作品资料 / 未提交草稿”，不展示 Harness 实现术语。

没有更改 Markdown 保存、幂等键、409 乐观锁、草稿恢复/导出、审计、API/Demo 隔离或 Harness 源文件写入权限。没有新建或修改小说正文、设定、提案、决策和作者笔记。

## B 组：等待 Figma Make 新设计

以下项目的目标流程与字段仅是可评审的设计输入，不代表已确认产品决策或已实现功能。详细任务、组件状态和验收场景见 [`design/writer-agent-ux-vnext-handoff.md`](../design/writer-agent-ux-vnext-handoff.md)。

- 注记 / 思考辅助空间与正式 IA。
- 续写入口和空项目引导。
- 随手笔记与正式设定变更的入口、差异确认、历史记录。
- 页边证据注记、稳定锚点和过期证据状态。
- 按可追溯资料呈现的本章相关知识。
- 故事内容冲突的双证据阅读与作者判断操作。
- 中文长文本排版、边框/卡片密度、Theme 与窄屏布局。

进入实现前，Figma 应提供节点链接、Light/Dark、1440px 写作态、面板收起/展开、专注态、空/错误/过期状态，以及更新后的 Design Tokens。视觉比较只能在设计截图或可访问的 Make 截图能力恢复后声明完成。

## Note 与 Canon Change 的领域模型建议（未实施）

沿用现有 Markdown Harness + Git 的事实来源约定，先区分作者的非正式想法与正式作品知识。该模型需要产品确认后再改 API、Zod 契约或 Harness 规范。

```text
Author Note (非正式、可矛盾、非事实)
  ├─ 可绑定 project / chapter / 可选原文摘录
  ├─ author / createdAt / updatedAt / status
  └─ 不写 book/，不触发正式知识更新
        │ 作者主动选择“整理为设定变更”
        ▼
Canon Change Proposal (候选变更)
  ├─ target + before / after + baseVersion / baseSourceHash
  ├─ evidence[] + impact[] + author-facing rationale
  ├─ 每个 item 的 authorDecision / applyState
  └─ 过期来源或版本冲突时阻止应用
        │ 作者逐项确认；有明确差异和影响
        ▼
Author Decision / Audit
  └─ future application transaction to formal knowledge only
```

原型中的 `Proposal.note`、对话保存和推演结论不能自动代表 Note，也不能自动代表 Canon Change。普通消息只有经作者明确发起并完成候选差异审阅，才可进入后续的正式变更流程。现有 Proposal / Decision 历史保持只读兼容；本次不迁移旧提案。

## C 组：真实 Agent 与作者长期验证

- 首个真实 Agent MVP 建议只做“作者主动触发的章节连续性发现”，范围限人物事实与时间线。
- 执行时读取当前不可变章节版本和有限、可验证的 Harness 证据；将原文引句、source hash、来源路径/定位符和推断明确分开。
- 返回结构化候选发现；服务器校验来源和原文引用，引用无法精确核验则拒绝展示为已验证证据。结果绑定 `reviewRunId + revisionId/contentHash`，旧版本结果不可用于当前版本。
- Agent 仅有读取上下文和返回发现的能力；没有正文写入、Harness 写入、Git、发布、shell 或本地文件工具。作者确认前不创建正式知识变更。
- 仅作者主动触发时调用第三方模型；在触发前明确模型提供方、发送范围和配置。每次输入不触发模型。默认不将未发表正文发送至第三方。
- 暂不引入 Agent SDK、多 Agent 工作流、世界观推理、复杂伏笔引擎。用隔离测试夹具建立人物/时间线 Evals；不得把真实作者作品复制成测试样例。
- 真实五章创作、每周使用天数、注记有用率及误报忽略率由作者实际体验验证；Codex 不生成小说章节来制造指标。

### 产品假设与可观测性

下表目标是待验证假设，不是当前成果。

| 指标 | 当前能否自动验证 | 方式 / 当前状态 |
| --- | --- | --- |
| 真实完成章节数 5 章 | 否 | 作者创作验证；仓库当前没有正式章节，本任务不生成章节。 |
| 每周活跃写作至少 4 天 | 否 | 需作者自愿使用记录或隐私审慎的产品分析；目前未采集。 |
| AI 非请求式打断 0 次 | 部分 | 自动测试可验证已知 UI 路径不因审查成功/待办数弹 Toast；真实运行需对 LLM 触发来源留审计。当前无真实 Agent Runtime。 |
| 有用注记比例 ≥ 40% | 否 | 作者对真实发现进行匿名/自愿评估；当前无真实注记。 |
| 因误报忽略的注记比例 ≤ 30% | 否 | 需作者对发现标注处理原因；当前未采集。 |
| 已核验引用可追溯率 100% | 将来可自动验证 | E2E 应验证每条展示的已核验引用能解析到相同 source hash 和精确原文；真实 Agent 尚未实现。 |
| 未授权正文修改 0 次 | 工程部分可验证 | 现有 API Agent 身份不能保存正文；继续通过 403/API 权限和 fixture Git diff 检查。尚无 Agent Runtime 可验证其工具面。 |

## 产品问题的当前建议

### A. 哪些能力需要独立 UI，哪些可用 Harness + Claude Code

- 值得有独立 UI：长篇章节阅读/编辑、可恢复保存、并发冲突处理、固定版本的证据定位、作者主动查看发现、逐项确认正式设定变更。这些需要贴着正文工作并可靠保护作者输入。
- Markdown Harness + Claude Code 已能解决：直接检索/阅读资料、整理世界观或人物表、批量分析正文、起草研究问题和提案、检查知识文件与 Git 历史。若任务不要求持续交互、稳定定位或保护中的输入，不必先建成常驻后台页面。
- 独立 UI 的价值在于把真实来源、正文上下文、保存和作者决定连起来，不在于更多 Agent 标签、计数器或仪表盘。

### B. 当前最值得投入与应暂缓的事项

- 最值得投入：真实章节的可靠阅读/编辑闭环，其次是作者主动触发、能提供可核验人物/时间线证据的连续性发现。当前项目还没有正式章节，先把可用性和隔离测试能力做好，再由作者用真实作品验证。
- 暂缓：多 Agent Runtime、自动续写、复杂伏笔引擎、知识关系图大屏、自动提醒、广泛 Agent 任务管理、全自动正式设定应用。它们需要真实数据、设计和作者价值证据。
- 不用 AI 生成五章来证明产品价值；五章是作者验证样本。

### C. 如何让作者打开即写

当前安全过渡为恢复上次章节、保留清楚的章节导航、首次收起 Agent 面板、不显示 AI 待办数；保存/冲突反馈仍明确。长期开场卡片需展示真实原文和作者亲自写下的计划；空项目只说明如何加入作者章节，不提供生成式开篇。

### D. 如何让 AI 越来越有用但越来越安静

仅在作者主动触发后运行；读取固定版本和有限来源；区分原文事实与推断；无法核验的引用不能标作事实；结果附在相关正文旁但默认不催促处理；正文变化后旧结果失效；所有正文与正式知识修改都由作者完成。通过作者对真实发现的有用/误报反馈改进质量，不按提案数量优化。

### E. 下一次 Figma 更新后的同步顺序

确认 Figma 节点与变更状态 → 读取最新 Make 源码/Token/交互 → 对照当前 React 页面列出受影响组件 → 先映射视图和组件状态 → 再接 DTO/API/Feature 状态 → 用隔离 fixtures 和安全测试验证 → 在 1440px Light/Dark/Focus 与窄屏对照设计 → 只提交受影响代码并更新 `design/figma.md`、`design/sync-log.md`。若 Figma 不可读或有歧义，暂停对应设计同步并记录问题，不凭描述重画 UI。

## 信息架构备选评估

这是根据源码和可见原型行为的工程评估，不是作者已批准的最终 IA。小屏响应式行为和视觉层级仍需 Figma 设计验证。

| 维度 | A：现有三栏常开 | B：正文 + 按需打开左右工具（推荐过渡） | C：正文 + 页边注记，书/思考为二级空间（候选长期） |
| --- | --- | --- | --- |
| 开始写作认知成本 | 中：Agent 四 Tab 常驻 | 低：右侧默认收起，本轮已做安全默认 | 低：正文中心明确，但注记存在时可能重新占据视觉空间 |
| 章节导航效率 | 高：左栏常驻 | 高：保留左栏和显式导航入口 | 中：需设计轻量章节切换方式 |
| AI 对正文的干扰 | 高：Agent 持续可见 | 低：作者主动打开/运行 | 低到中：注记锚定上下文，但需控制显示密度 |
| 发现矛盾后的处理效率 | 中高：发现列表直接可见 | 中：多一次打开辅助面板 | 高潜力：发现可锚定原文并就地判断，需交互验证 |
| 长期知识管理能力 | 中：知识入口与写作并列 | 中：通过二级空间访问，暂不改变领域流程 | 高潜力：相关知识围绕当前章节呈现，但依赖真实检索/证据 API |
| 从现有 Demo 迁移成本 | 低 | 低 | 中高：需重做注记定位、书/思考导航和窄屏交互 |
| 移动端/小屏适配 | 低到中：面板覆盖但入口多 | 中：抽屉/覆盖面板需 Figma 规格 | 高：边注需转化为抽屉或标记层，状态复杂 |
| 实现复杂度 | 低（已存在） | 低（面板已可收起） | 高：精确锚点、过期检测、证据 Viewer 和知识关联 |

建议短期采用 B 的渐进路径，因为它尊重现有组件和 Figma 设计，同时减少首次进入时的 Agent 占位。C 是值得提交 Figma 验证的方向，但不能仅凭评审文字直接实现。关键假设：作者是否更喜欢始终可见章节树，以及页边注记是否比按需侧栏更容易在长篇写作中保持安静。

## 本轮验证记录

### 2026-10-14 本分支结果

- `pnpm install --frozen-lockfile`：通过（pnpm 提示忽略 esbuild 构建脚本；未执行未批准的依赖脚本）。
- `pnpm typecheck`：通过。
- `pnpm lint`：通过，无新增 lint warning。
- `pnpm test`：通过，API 24 项 + Web 41 项（共 65 项）。
- `pnpm build`：通过；Vite 保留既有大包提醒（约 854 kB）。
- `pnpm test:e2e`：通过，3 项 Chromium UI 状态 + 1 项 API/Harness 隔离端到端流程。
- 检查生产 bundle：`开发说明`、`设计说明`文案与 DesignNotes 模块未进入正式 JS bundle。
- `pnpm openapi:check`：通过。
- `pnpm openapi:lint`：OpenAPI 有效，保留已知 32 条 Redocly warning；本分支没有修改 OpenAPI。
- `pnpm harness:rebuild`：44 个 Markdown、7 个知识条目、2 个提案、0 个正式章节、0 个 ID 冲突；`manuscript/README.md` 仍未映射。
- 对本地 1440px Light、Dark、Focus 截图进行了视觉检查；Agent 面板可按需打开。由于 Figma Make 不支持截图 MCP，本项不是 Figma 像素对照。
- `git diff` 核对：`manuscript/`、`book/`、`inbox/`、`proposals/`、`decisions/` 无修改。


# Sprint 3：Evidence-Grounded Writing Review Agent

日期：2026-10-16。基于 main `7776f94`。交付范围为开发、测试与保持 Open 的 PR；没有合并或部署，没有读取真实作者作品做模型验证，没有修改正式小说档案。

## 已实现

作者编辑 → 安全保存 → 主动预览 → 确认模型和实际资料范围 → Go 调用可配置的 OpenAI-compatible 服务 → 严格结构与原文证据核验 → 持久化固定修订的发现 → 页边注记/只读证据 → 作者反馈。这条工程链路已用真实 Go HTTP 与隔离 HTTP 模型替身验证。不存在 Demo 回退、自动改稿、工具执行或正式知识写入。

审查限人物事实一致性和时间线一致性。每项候选保留推断、其他解释、作者问题及至少两处不同来源的精确引文，其中一处来自本章。引用核验通过只证明字面出处，不能证明语义推断或作者确实写错。

## 契约与后端

Go 新增六条操作，统一 `/v1/projects/:projectId` 前缀：

| 操作 | 路径 | 用途 |
| --- | --- | --- |
| POST | /chapters/:chapterId/review-preview | 读取已保存版本，冻结模型/允许来源范围；无模型请求 |
| POST | /chapters/:chapterId/reviews | 明确授权后启动异步运行，返回 202 |
| GET | /chapters/:chapterId/reviews | 本章历史，重新检查来源变化 |
| GET | /reviews/:runId | 状态、发现、快照、过期标记、反馈 |
| POST | /reviews/:runId/cancel | 先持久化取消，再取消模型上下文 |
| POST | /reviews/:runId/findings/:findingId/feedback | 作者反馈，CAS 和幂等 |

共享 ReviewRun / ReviewFinding / EvidenceReference / TextAnchor / ReviewFeedback / ReviewPlan Zod 类型与 OpenAPI 来自同一生成链。工程扩展独立保存，未覆盖 Figma 原规范。Go-only 操作标记 `x-runtime: go`；旧 Node 仍只实现原十条业务操作，既有对照覆盖未缩减。

Go 结构：

- `internal/llm`：接口、服务端配置、HTTP 适配器；超时、响应/输出上限、重定向拒绝、无自动重试、无工具参数；scratch 镜像加入 HTTPS CA 信任根。
- `internal/application/review_snapshot.go`：只读获取当前真实保存修订，不触发源采纳写入。
- `internal/review/context.go`：确定性相关上下文与预算。
- `internal/review/evidence.go`：严格输出、允许来源、引文、hash/版本、UTF-16 锚点及来源新鲜度核验。
- `internal/review/service.go`、`store.go`：异步状态、取消、幂等、反馈 CAS、跨进程文件锁与独立原子 JSON。
- `internal/transport/review.go`：author 权限、项目隔离、严格请求、错误及路由。

LLM 配置完整示例与边界见 [Go API 文档](../../apps/api-go/README.md)。密钥仅在服务端环境；模型和地址无硬编码。支持 none/json_object/json_schema 与两种输出 token 参数，按实际兼容服务选择。没有可用配置时不声明 evidenceReview 能力，历史仍可读。

## 证据与发送边界

目标正文使用完整已保存 Markdown，不静默截断；超预算明确拒绝。相关历史按章节顺序、局部文本重合和距离选取，最多四章、每片段至多约 1800 UTF-8 字节；最多四份已确认知识，合计至多八个额外来源。预算使用保守 UTF-8 字节计数，包含指令与协议余量，不等同于精确模型 token 数。

知识必须有稳定 ID、无冲突、状态严格为 confirmed、所有声明出处均可读取且带 hash。部分确认/缺失来源/提案/笔记不冒充确认事实。未具备这些条件的时间线也不进入确认知识。预览显示实际选取范围与遗漏数量，明确不代表覆盖全书；MVP 启发式可能遗漏远距离关联。

启动前重建上下文并对比 planHash，任何模型/资料变化需要重新预览授权。本章 revisionId/contentHash 不一致返回 409。模型仅见允许快照，模型返回的路径/来源不能驱动文件读取。来源 ID、项目、修订、hash、精确引文均受核验。假来源/假引文被拒收并计数；未知输出字段、非法 JSON、工具调用、截断/超长输出导致失败。重复（含重叠）引文标记 ambiguous，不能任意取第一处定位。

历史结果保留原始片段和 hash。GET/List 检查正文、历史章节、知识内容或确认状态改变，并标记 stale；前端本地编辑立即使旧结果过期。定位前再次获取状态、检查本地修订及唯一 UTF-16 引文，随后只更新编辑器 Decorations。无法精确映射格式/跨块引文时仅查看只读快照，保留文档、选区和保存队列。

## 持久化与反馈

独立 `STATE_DIR/review-runs/<project-key>.json` 原子保存 Run、幂等记录及反馈历史；沿用跨进程文件锁、临时文件 fsync 和 Rename。运行状态为 running/completed/failed/cancelled，失败不伪装成空结果成功。取消后迟到结果不能覆盖终态；取消发生在工作线程预检前也不会误报存储失败。存储提交失败返回明确错误，不显示已保存。

作者可标记 useful、false_positive、intentional、ignored。每次决定保存作者、时间、版本；并发旧版本返回 409，稳定重试键可重放。刷新/新服务实例可恢复。反馈不会直接创建或更新正式知识；“记为创作笔记”另由作者主动点击，写入既有 Notes API，并标明未确认 AI 推断。

每项目同时一个运行、最多 200 个运行/10000 条请求与反馈，不自动删除。达到上限需人工完整备份归档。进程重启后不自动重发原文；遗留 running 在 deadline 之后读取时标记 interrupted。跨进程共享状态可协调，但另一进程的 HTTP 请求可能持续到超时；终态仍受保护。旧文件锁崩溃残留需核实后人工处理。

## 验证

| 检查 | 结果 |
| --- | --- |
| pnpm install --frozen-lockfile | 通过 |
| pnpm typecheck / lint / build | 通过 |
| pnpm test | Go race、Node 29 项、Web 70 项、Review HTTP 评测通过 |
| pnpm eval:review（纳入 pnpm test） | 8 类隔离夹具，至少 69 次 HTTP/契约检查（轮询次数随调度变化）；不是模型质量评分 |
| pnpm test:e2e | 9 项原 Demo 视觉/交互、2 项原 API、3 项新 Review 测试 |
| pnpm openapi:check / openapi:lint | 通过；lint 有 37 条文档 warnings，无错误 |
| pnpm harness:rebuild | 通过，无 ID 冲突；本项目不是作者正文目录 |
| pnpm test:api:parity | 原 95 项通过，旧数据/重启/Node 回滚与 hash 保留 |
| go test ./... / go test -race ./... / go vet ./... | 通过 |

新 Go 测试覆盖模型错误/超时/取消/拒绝/响应上限、上下文筛选、引用与结构攻击、重复引文、知识状态/来源变化、CAS、并发、存储失败及重启。前端测试补充安全保存后捕获、500/409/恢复阻断、保存中继续输入、UTF-16/格式锚点、注记不改变文档/选区/onChange。新 E2E 使用实际 Go 与实际 HTTP 兼容适配器，验证授权前零调用、两处证据、只读定位、反馈刷新、过期、保存失败和缺少模型能力降级。旧自动保存队列、恢复、内存导出及 Notes 测试完整保留。

构建仍提示入口 chunk 大于 500 KB；本次没有为了消除 warning 重构编辑器依赖。Figma Make 截图工具不支持此文件，基于已同步 VNext 组件扩展并检查本地浏览器截图，不声称重新完成 Make 像素级比对。

## 真实模型与作者验证状态

**按用户“先完成开发，真实模型稍后配置”的决定，未配置或调用真实模型，模型名称不适用，没有真实 LLM E2E、真实作品审查或审查准确率结果。** HTTP 模型替身的命中/空输出是预设，不能证明模型识别矛盾、谎话或信息不足的能力。

[Eval 场景及人工评分规则](../evals/review-agent/README.md) 区分工程不变量、真实模型离线 Eval、作者长期反馈。未来显式执行 `pnpm eval:review:live` 会发送合成夹具给本地配置的模型，输出真实候选与快照供人工评分；不会读取正式作者作品。

## 风险、未实现与下一步

精确引用不保证语义正确；模型可遗漏或误判台词、成长、视角和时间关系，需要保留其他解释并由作者决定。Prompt injection 防护包含数据隔离、无工具/写入权限、严格结构与来源核验，但不能声称模型语义完全免疫。第三方模型将收到授权片段，服务商数据政策仍需作者自行选择；普通日志不记录正文、密钥或模型原始错误体。Review 快照含未发表文本，备份/权限需与作品同等保护。

未实现通用 Runtime、多 Agent、自动研究/工具调用、流式输出、向量检索、完整全书覆盖、正式知识写入、自动改稿、多机任务调度、自动归档、模型语义准确率及成本监控。下一步先配置一个兼容模型，在合成 A–D 夹具上做多次人工离线评分，再由作者明确授权小范围真实作品验证，积累 useful/false_positive/intentional/ignored 反馈。

本次不变更生产环境。交付 PR 保持 Open，后续模型接入、合并和部署另行执行。

## PR #9 审查修复（2026-10-16）

1. 历史章节改为复用目录的卷分组与卷内排序，以全局位置过滤与计算距离。跨卷回归覆盖上一卷 order=10/11、下一卷 order=1/2、后续卷 order=1：保留应选历史并拒绝未来章节；原 95 项 Node/Go 对照保留。
2. Review UI 状态按项目/章节/切换 epoch 隔离，请求携带代次及所选 Run 检查。15 项新 Hook 回归覆盖 start/cancel/feedback 成功或失败在 B 列表前后返回、A→B→A、跨项目切换、A finally 不清除 B 忙状态，以及不确定响应重试键保留。已接受的服务端操作继续保存，仅丢弃过期 UI 更新。
3. 同键始终重放；相同 planHash 仅复用 running。completed 可通过重新预览、重新勾选及新幂等键创建独立 Run，保留旧结果与反馈。Review E2E 验证同正文第二次真实 HTTP 模型替身调用、两个历史记录和旧“有意为之”反馈仍在。Run/Plan 新增 strategyVersion，当前 continuity-review-v2，参与计划 hash；旧记录读取为 continuity-review-v1，原 hash 与反馈不变。

模型质量验证继续按用户此前决定暂缓。本次修复没有调用真实模型、合并、部署或改写正式作品。

CI 复验还修正了原 API E2E 的同步：主题/布局 PATCH 必须等待成功响应，再刷新验证持久化。原测试只等待请求发出，会在慢 runner 上先刷新并中断尚未确认的写入；所有恢复断言保留。

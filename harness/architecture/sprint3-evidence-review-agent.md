# Sprint 3：基于证据的连续性审查

基线 main 7776f94；单作者、Go HTTP/JSON 文件状态，复用现有修订和 VNext。生产身份保护保持，本 Sprint 不部署、不合并、不改作品档案。模型配置稍后提供；自动化测试使用隔离 Fixture，不声称 Fake 测试代表审查准确率。

## 运行架构

作者主动点击 → 安全保存队列确认 → 只读预览上下文 → 展示服务/模型/来源范围 → 明确确认 planHash → 重新验证修订及上下文 Hash → 有界异步模型调用 → 严格结构解析 → 确定性引用校验 → 原子保存 ReviewRun → 按需查看注记与反馈。

LLM Client 只暴露 Generate(ctx, request)，使用标准 HTTP OpenAI-compatible chat/completions。服务端显式配置 endpoint/model、JSON 输出模式及输出 token 参数；不猜测供应商能力，不硬编码模型。无配置时能力不可用，但已有历史记录仍可读取。HTTPS 服务和 loopback HTTP 本地服务可用；禁用重定向，有超时、输入/输出上限，不自动重试，不调用模型工具。

## 固定版本与上下文

目标来自已保存 Chapter Revision，核对 revisionId/contentHash；只读审查快照不能触发 Draft/Note/Audit 写入。历史章节按明确 order 或 CH 编号确定先后，相关词重合和距离排序，最多 4 章；只读取所选章的当前已保存应用版本。可靠知识仅选 book/ 中严格 status: confirmed、具备可解析稳定身份、所有声明来源可解析且可追溯的条目；部分确认、未知、候选、笔记、提案均排除。

目标完整保留；历史章节/确认知识仅截取确定性的有界片段，存原始偏移、完整内容 Hash、源文件 Hash 和片段 Hash。预算不足不能截断目标后冒称全文已审查。预算按 UTF-8 字节作保守 token 预算代理，不伪称精确 tokenizer 计数。预览和提交绑定相同 planHash；来源或配置变化必须重新预览/确认，不偷偷追加未授权资料。

## 数据与证据

ReviewPlan/Run 包含 project/chapter/revision/contentHash、reviewTypes、无密钥 ModelInfo、完整上下文快照引用、planHash、预算、状态和诊断。Run 状态为 running/completed/failed/cancelled，单项目最多 1 个活动任务，固定版本重复请求复用；幂等键冲突明确拒绝。请求断开不代表取消已接受的异步任务，取消有独立端点；进程中断后达到 deadline 的遗留运行标记 failed，不冒称完成。

模型候选必须含两类之一、标题、AI 推断、作者问题、其他可能解释、至少两条不同来源引文，其中至少一条来自目标正文。严格 JSON 拒绝未知字段/修改动作；每条引文必须逐字存在于本次允许的片段，服务端重新计算 Hash/项目/修订。不存在来源、编造引文、未确认知识不能成为正式注记。引文核验仅证明引用真实，不证明 AI 推断或叙述者认知等于客观事实。

TextAnchor 的 start/end 明确定义为原始 Markdown 的 UTF-16 code units，左闭右开。重复原文标 ambiguous，偏移为空，不任选一处。前端再核对当前 Markdown/修订、原文片段和渲染文本唯一性；能映射时仅更新 ProseMirror Decoration/meta，不修改文档、光标或触发保存。无法准确映射格式文本时诚实拒绝定位，仍可阅读只读快照。

读取结果时重新核验目标与历史来源，变化/缺失使结果 stale；本地未保存编辑立即使注记失效。旧快照保持可读，不能自动定位新正文。原始候选不作为事实；未通过证据校验的候选只保留拒绝计数/原因，不伪装注记。

## 持久化与权限

独立 review-runs/<base64url project>.json，复用原子 Write、fsync 与跨进程 O_EXCL Lock。快照/结果/幂等映射/反馈在同一事务中提交；不覆写 Notes、Draft、Audit 或正式 Harness。状态包含未发表正文，沿用 0600/0700 权限；不把正文、Prompt、密钥或 Authorization 写普通日志。单项目运行数、上下文、输出和历史记录数均有上限。

只有作者可预览、发起、取消、读取所属项目或反馈。反馈 useful/false_positive/intentional/ignored 记录作者、时间和版本，有 CAS/幂等保护；只修改审查状态，不改正文或正式设定。对存储失败不返回虚假的完成/已保存，终态取消不能被迟到模型响应覆盖。

## 界面与边界

复用 MarginPanel 的证据/推断/问题分层，API 来源为真实 Review API；Demo 保持隔离。无模型禁用审查入口并解释配置缺失，保留历史读取。只在作者点击时打开确认框，确认后显示状态，后台完成不弹窗打断输入。反馈/忽略可刷新恢复；来源查看使用只读快照，不切换或覆盖当前正文。

不做多用户认证、部署、自动生成正文、Canon 写回、向量库、多 Agent 或工具循环。真实模型联调与离线 Eval 独立报告，未配置时明确未执行。

参考：[OpenAI 结构化输出](https://developers.openai.com/api/docs/guides/structured-outputs)；兼容服务仍需配置 JSON 模式，服务端始终独立校验，不依赖模型承诺。

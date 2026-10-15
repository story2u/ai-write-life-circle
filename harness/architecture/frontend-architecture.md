# React 前端与 API 边界

Writer Agent 使用 React + TypeScript + Vite + Tailwind + TipTap。VNext 的 visual authority 是最新 Make 导出；页面与组件映射见 [Figma 基线](../design/figma.md)。

- `app/App.tsx`：加载工作区、组合各空间与弹窗。
- `components/vnext/`：Make 适配后的展示组件及基础控件。
- `features/vnext/useStudioController`：导航、抽屉、选区、当前演示会话；`usePrototype`：隔离的 Demo 状态。
- `features/workspace/`：原有保存控制器、正文画布与只读服务端冲突预览。
- `features/notes/`：笔记加载、创建、编辑、归档、重试与失败输入保留。
- `features/knowledge/`：书空间和旧版演示记录的只读兼容。
- `hooks/useManuscriptBridge`：从已挂载编辑器读取字数与段落投影；投影不参与 Markdown 保存。
- `services/api/`：已实现 HTTP 路由；`services/mappers/`：Workspace/Chapter DTO 映射；`mocks/`：仅 Demo 使用的数据与模拟 Agent。
- `packages/contracts/`：共享 Zod、TypeScript、Note 与 Workspace 能力声明。

## 两种模式

Demo 默认展示原型，使用独立浏览器笔记命名空间；旧 writer-agent.v2 草稿、布局与提案记录保留。旧显式布局按原值恢复，没有自定义布局的新用户默认双侧收起。旧记录不自动转换成笔记或正式设定。

API 模式必须配置 VITE_WRITER_AGENT_PROJECT_ID。读取真实 Workspace、Chapter、Revision 和 Notes，响应均做运行时校验；服务端未声明 notes 时禁用新增入口。API 不加载 Demo 数据/Agent，也不请求未实现的知识、研究、正式变更接口。审查仅调用 Go 的 evidenceReview 能力。

## 正文安全

Markdown 是保存源，纯文本段落只用于展示与定位。保留原始 Markdown、opaque revisionId/contentHash、baseRevisionId、Idempotency-Key、失败输入、本地恢复、存储失败时的内存导出。HTTP 409 会暂停自动保存并取消旧版本排队请求；故事冲突使用独立模型和暖色，没有正文写入动作。

查看服务器版本是只读 GET，不改变编辑器或恢复记录。使用服务器版本需第二次明确确认与勾选；源文无法无损编辑时显示只读原文。失效或多处匹配的引文不静默定位，页边点不写入 Markdown。

## 笔记

真实链路为 Notes UI → typed NotesAdapter → Zod → 作者权限 API → 独立文件型应用状态 → 刷新后重新读取。笔记与正式知识隔离。更新用版本 CAS，创建/更新都用稳定重试键。next_writing 唯一性由后端保证，已有计划需作者先编辑或归档。

高级知识、思考、故事判断、定稿候选目前仅提供 Demo 原型；真实 Runtime、正式知识应用和会话存储仍需后续实现。API 开发服务器提供本地身份；生产使用已实现的单作者 Bearer 与 HTTPS。

## 验证

隔离 Harness fixture 和临时状态目录验证真实保存、恢复、409、内存导出、笔记持久化与并发。视觉 E2E 覆盖四种宽度和两种主题；完整结果见 [实施报告](../reviews/vnext-figma-fullstack-sync.md)。

## 固定修订的证据审查

`features/reviews/useReviewController` 管理预览、明确授权、异步状态轮询、取消、反馈与历史。effect 仅读取状态，不启动模型；完成只做非阻塞提示，不自动展开面板或改写编辑器。`prepareReview` 复用保存队列，在冲突、恢复待处理、保存失败或保存期间继续编辑时停止；确认发送前再检查实际保存修订/hash。

`ReviewConsentDialog` 显示服务端冻结的模型与来源范围，授权绑定 planHash；`ReviewMarginPanel` 复用 VNext MarginPanel，区分核验引文与未经确认的 AI 推断，保留其他解释和作者问题。证据点击打开只读快照，不切换正在写作的章节；记为笔记仍需作者操作，标记为未确认 AI 推断。

`lib/reviewAnchor` 先核对原始 Markdown 的 UTF-16 唯一位置，再映射到当前 ProseMirror 文档。多处匹配、格式/跨块无法精确映射时不定位。注记和 flash 只更新 Decorations/meta transaction，保留文档和选区；定位前重新读取来源新鲜度。任何本地编辑、固定修订或历史来源改变均使旧结果失效，旧引用不会迁移到新正文。服务端未配置模型时仍可读取历史，不产生 Demo 发现。

新增真实 Go + HTTP 模型替身 E2E，覆盖授权前零调用、定位无保存、两处快照、四类反馈机制中的有意为之、刷新、过期与保存失败阻断；原有 Demo/保存恢复/409/Notes E2E 保留。

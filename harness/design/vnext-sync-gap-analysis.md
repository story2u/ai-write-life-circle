# VNext 同步差异基线

读取：2026-10-14（Asia/Shanghai）；代码基线 `0cd4c38`（含 Claude UX 整改与 409 排队保存修复）。当前主目录有作者未提交文件，实施在原 UX 整改工作树的新分支进行。

## 最新来源与覆盖

官方 Figma MCP `get_design_context` 成功返回 fileKey `kWBOdcae5utBZ6VtBHHXui` / `0:1` 的最新资源清单，见 `vnext-resource-manifest.json`。浏览器显示 **Version 6 / Upgrade Writer Agent UI/UX**，实际预览有写作、书、思考与续写入口；不沿用旧 V0.3 结果作为本次来源。

**限制：清单不是源码。** 当前连接器只有资源链接，没有 resources/read 工具；资源模板列表为空，独立 `figma` MCP 未注册。`get_screenshot` 明确不支持 Make；公开浏览器的文件菜单要求登录。尚未读取 App、CSS、组件、模型、API YAML 的最新内容。已请求作者提供源码导出。不声明源码同步、高保真或像素验收完成。浏览器可见的生成总结属于设计说明，不能代替源码或后端领域确认。

## 差异矩阵（实施前）

| 维度 | 当前工程 → 最新可见设计 | 分类 / 行动 |
| --- | --- | --- |
| 信息架构 | 写作工作台 + 四 Tab → 写作 / 书 / 思考，右侧注记 / 思考 | MODIFY；源码读取前隔离视觉迁移 |
| 页面布局 | 默认左目录展开、右面板收起 → 默认稿纸、按需抽屉、续写卡 | MODIFY；不能根据说明猜测布局数值 |
| 视觉体系 | 旧 CSS tokens → VNext index.css，浏览器说明提及 18px / 1.9 | BLOCKED；最新完整 Tokens 未读取 |
| 组件 | ChapterNavigator/ReviewPanel 等 → ChapterDrawer/Resume/QuickNote/MarginPanel/BookView/ThinkingSession/StoryConflictView/Safety | MODIFY / NEW_FRONTEND；资源存在已核验，组件实现未覆盖 |
| 交互 | 原有章节/保存/聚焦 → 随手记、跨空间、证据对照 | EXISTING 保存；新增笔记最小功能可独立接入既有组件体系，不冒称 VNext 视觉完成 |
| 状态 | 409、失败、恢复、内存导出已实现；新设计仍要求保护 | EXISTING；回归验证，故事冲突不得复用 HTTP 409 模型 |
| 数据 | 无 Note → 作者非正式笔记、可关联章节 | NEW_BACKEND / CONTRACT_CHANGE；依据本次作者明确授权实施最小应用状态模型 |
| API | 六条 Workspace/Chapter 路由 → 笔记与能力声明 | NEW_BACKEND；复用现有路由，不将未读取 Figma API 当成契约 |
| 持久化 | 独立文件型应用状态 → Note 保存/刷新恢复 | NEW_BACKEND；按项目隔离，原子落盘，幂等与版本保护，不写 Harness |
| Agent | API 无 Runtime；Demo 静态输出 → 注记/研究/智能关联 | PROTOTYPE_ONLY；保持显式不可用，不假造响应 |
| 正式知识 | Harness 只读 → 变更审批、历史、关系 | BLOCKED；领域未决，不修改正式知识模型 |
| 偏好迁移 | 旧 layout + 显式自定义标记 | EXISTING；没有完整新模型时不改存储、不清理 localStorage |

## 可独立交付范围

1. 新增 Note 契约（作者内容、可选章节、普通笔记/下次写作计划、时间、版本、归档状态）；不新增正式知识字段。
2. 作者权限的 Note 列表/创建/更新（含归档），创建强制幂等键、更新版本 CAS；使用独立应用状态与审计。
3. Workspace 返回服务器能力声明；旧服务器缺失声明时前端禁用新增功能。
4. 既有组件样式下提供笔记创建、列表、打开编辑、章节关联及归档；API 使用真实数据，Demo 独立存储。
5. 对新增契约与端点做隔离测试/E2E，保持全部章节安全回归。

完整视觉布局、续写组件以及高级空间待最新源文件读取后继续；API 与模型文档的旧来源副本保留，本轮工程扩展单独记录来源。

## 源码解阻与实施决定（同日后续）

作者提供 `/Users/bruce/git/story/Writer Agent UI_UX Design` 导出。已读取 App、CSS、全部目标组件、VNext model、agent、relevance、demo 与交接文档。资源清单增加各文件 SHA-256；API 新来源单独保存在 `docs/contracts/source/api-spec-vnext-export-2026-10-14.yaml`，不覆盖旧来源。

- **MODIFY**：CSS 直接对齐 VNext 全套 tokens，稿纸 44rem / 18px / 1.9；顶栏 48px，写作/书/思考；默认双侧收起，沿用旧 layout 显式偏好。
- **MODIFY**：保留原 `useWorkspaceController` 与 Markdown 编辑/恢复/409 管线；仅替换 shell 与注记装饰层，禁止使用 Make 的段落数组保存逻辑。
- **NEW_FRONTEND**：复用源码 ChapterDrawer、Resume、MarginPanel、ThinkingSession、BookView、StoryConflictView 与基础控件，业务状态进入 features，模拟 Agent 进入 mocks。
- **CONTRACT_CHANGE**：Note 原型 `text/nextUp/archived` 映射工程 `content/purpose/status`；Note 的 id/version/createdBy 为服务端字段。新增来源上下文仅在确定需要时加，不把原型实体直接复制到后端。
- **NEW_BACKEND**：四条 Notes 路由、Workspace capabilities；“下次要写”来源为作者已保存 Note，最多一个 active next_writing，替换需显式冲突而非静默取消旧计划。
- **PROTOTYPE_ONLY**：高级知识、思考 Agent、故事冲突、定稿变更只在 Demo 提供原型；API 相同入口显示不可用，不模拟持久化成功。
- **BLOCKED**：真实 Agent、正式知识变更事务与审批、语义相关查询仍未决，另列后续任务，不阻塞写作与笔记。
- Resume 原文取已读取当前章末尾段落，不虚构时间或作者计划。无可靠编辑时间时省略相对时间。
- 源码使用内联 UI 图标，没有 import 图片。MCP 清单的十张历史图片不在当前源码使用，不作为 VNext 静态插图引入。

## 2026-10-15 交付状态

本文件前半部分保留实施前的读取限制；作者提供导出后已解阻。最终：布局、Tokens、导航、真实章节/笔记联调已实施；高级知识、注记、思考、故事判断、定稿变更提供 Demo UI，API 明确不可用。新来源 API YAML 与旧完整副本语义一致，Note 为独立工程扩展。当前 main 已迁移文档并移除作品档案，开发分支保留此变更；本次 PR 不重新加入作者作品。

新增或更新：apps/web/src 的展示/feature/adapter、apps/api/src 的 Notes 与能力声明、packages/contracts、OpenAPI 生成与测试、隔离 E2E、CI，以及实施报告。原始 Markdown 保存语义、版本、幂等与 409 阻断保持。

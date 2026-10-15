# Writer Agent VNext Figma 全栈同步实施报告

交付日期：2026-10-15（Asia/Shanghai）。分支：codex/writer-agent-vnext-sync。起点 0cd4c38（Claude UX 整改），已整合当前 main e540078。报告区分已实现、Demo 原型与后续工作；不宣称 Agent Runtime 或正式知识写入已经完成。

## 1. 本次设计来源

官方 Figma get_design_context 成功读取 kWBOdcae5utBZ6VtBHHXui / 0:1 的最新资源清单，whoami 确认当前连接身份；浏览器显示 Version 6 / Upgrade Writer Agent UI/UX。连接器没有 resources/read，资源模板为空，Make 截图端点不支持该文件。作者提供最新导出 `/Users/bruce/git/story/Writer Agent UI_UX Design` 解阻；实际读取 App、CSS、目标页面/组件、VNext model/demo/agent/relevance、DES-VNEXT 交接，以及产品、领域、API、状态机与实现说明。

源码快照与 SHA-256：[manifest](../../harness/design/vnext-resource-manifest.json)；交接副本：[DES-VNEXT](../../harness/design/vnext-source-handoff.md)。未修改原导出目录。MCP 清单里的历史图片未被当前源码引用；图标来自最新 ui.tsx，无临时 Figma URL。

新 API YAML 完整副本保存为 docs/contracts/source/api-spec-vnext-export-2026-10-14.yaml。它与保留的旧完整来源 YAML 解析结果相同；没有冒用新版本 API 定义。Note 为本次作者明确授权的独立工程扩展。

## 2. 差异矩阵与阶段结果

完整实施前矩阵见 [差异分析](../../harness/design/vnext-sync-gap-analysis.md)，请求路径 design/vnext-sync-gap-analysis.md 保留兼容入口。

| 维度 | 分类 | 当前结果 |
| --- | --- | --- |
| 信息架构 | MODIFY | 写作 / 书 / 思考；辅助为注记 / 思考；取消作者导航中的旧四 Tab |
| 布局 | MODIFY | 安静稿纸、按需章节/辅助抽屉、Focus；已保存显式布局保守恢复 |
| 视觉 | MODIFY | 最新暖色 Tokens、字体栈、图标、留白与响应式；完成结构/Token/定性比较 |
| 组件 | NEW_FRONTEND / MODIFY | ChapterDrawer、Resume、MarginPanel、ThinkingSession、BookView、StoryConflictView、QuickNote、安全冲突预览 |
| 交互 | EXISTING / MODIFY | 章节切换、选区思考上下文、随手记、来源定位/返回；失效或歧义引文不自动定位 |
| 状态 | EXISTING / NEW_FRONTEND | 加载/空/错误/恢复/只读/409；失败与恢复在专注和打字时保持可见 |
| 数据 | CONTRACT_CHANGE | 非正式 AuthorNote 与真实 Workspace capabilities；无正式知识模型更改 |
| API | NEW_BACKEND | 作者 Note 列表、详情、创建、编辑/归档；复用既有六条业务接口 |
| 持久化 | NEW_BACKEND | 独立文件型状态、原子事务、幂等重放、版本 CAS、成功审计 |
| Agent / 正式知识 | PROTOTYPE_ONLY / BLOCKED | Demo 的思考/注记/故事判断/候选演示；真实模式明确不可用 |

Phase 1–4 的设计基线、布局、最小后端与真实联调已交付。Phase 5 交付高级 UI 与安全降级；真实 Agent、知识查询和正式设定事务另行实施，不拿模拟结果填充 API 项目。

## 3. 组件迁移与架构

| 原有组件 | VNext 实现 |
| --- | --- |
| ChapterNavigator | components/vnext/ChapterDrawer，按卷、搜索、目录/本章相关 |
| ReviewPanel / 审查提案卡 | MarginPanel + StoryConflictView；事实、推断、作者问题分开 |
| AgentChat / ChallengePanel | ThinkingSession，四阶段、作者纠正；Demo adapter 提供模拟能力 |
| KnowledgeViewer / DecisionHistory | BookView 的分区、条目/来源/历史；旧提案与决定另作只读记录保留 |
| ManuscriptEditor | 保留 Markdown 管线；新增右侧页边 Widget、唯一引用检查、仅选中后高亮 |
| 旧保存通知 | 原保存控制器 + 原文服务端预览 + 二次确认/勾选；故事冲突没有正文写入动作 |
| 新随手记与笔记 | features/notes，异步 Adapter 接真实 Notes；失败不清空输入 |

App 只做工作区加载和空间组合。导航/状态在 features/vnext，写作在 features/workspace，笔记在 features/notes，传输在 services，DTO 映射在 services/mappers，演示数据和 Agent 在 mocks。没有复制 Make 专用运行依赖，也没有用其 paragraphs[] 保存逻辑替换已有 Markdown 保存。

## 4. 视觉实现与证据

Playwright 覆盖 1440、1024、768、390px，Light/Dark、正常写作、抽屉、Focus，并检查页面无横向溢出。另在临时目录运行导出 UI 的副本：仅用标准 Vite 配置替代 Make 启动配置，UI 源码未改，使用同一浏览器比较正常稿纸的 Light/Dark 与 390px Dark。

| 1440px 正常稿纸指标 | 参考 / 实现 |
| --- | --- |
| 字体栈 | Noto Serif SC / Songti SC / STSong / SimSun / serif |
| 字号 / 行高 | 18px / 34.2px（1.9） |
| 缩进 / 段距 | 36px / 16.2px |
| 内容宽度 / 起点 | 608px / x=416, y=272 |
| 纸色 | #fbfaf7 |

指标相同。保存栏使用真实保存状态，API 不显示虚构的版本数量；新笔记有真实加载与并发错误处理。未执行 Figma 服务端截图像素差分，不能宣称全应用逐像素还原。参考截图和实现截图位于工作树 .local/vnext-visual，E2E 截图位于 apps/web/test-results；CI 上传视觉与 API 测试产物。

## 5. API、实体与契约

新增 GET/POST /v1/projects/:projectId/notes、GET/PATCH /v1/projects/:projectId/notes/:noteId。所有 Note 路由 author-only，限定配置项目；输入严格 Zod 校验。POST/PATCH 必须带 Idempotency-Key，PATCH 还带 baseVersion，过期版本为 NOTE_VERSION_CONFLICT。错误使用 Problem Details；存储失败不是成功响应。

AuthorNote：noteId、projectId、content、可选 chapterId、purpose、status、version、createdBy、createdAt、updatedAt。与原型 text/nextUp/archived 显式映射；笔记没有正式事实状态。归档可恢复。一个项目仅一个 active next_writing，已有计划须由作者明确编辑/归档，不静默取消旧计划。

状态按项目放在 WRITER_AGENT_STATE_DIR/notes，笔记、重试结果和成功审计在文件锁内原子提交。Workspace capabilities 由服务器返回：notes=true；knowledge/annotations/canonChanges/agentRuntime=false。旧服务器缺少声明时禁用新能力。

共享 schemas、OpenAPI、Adapter、UI 和测试形成闭环；生成脚本可复现。旧 OpenAPI 来源保留，候选只把实际十条业务操作标为 implemented。领域选择与延后项见 [ADR-0002](../architecture/adr/ADR-0002-vnext-author-notes.md)。

## 6. 作者主权与原有整改整合

- 正文源仍为原始 Markdown；保留 opaque 版本 ID、source hash、不可变修订、幂等、审计、失败保留、本地恢复与内存导出。
- 保存 A 收到 409 后，排队的旧版本 B 被取消；不因布局/面板重构而继续覆盖。
- 只读服务端版本比较不修改本地输入或恢复记录；使用服务端版本要明确确认并勾选。
- 注记是装饰，不能写入 Markdown。版本变化、无匹配或重复匹配时标为过期/不可核验，不静默定位。
- Note 与正式知识隔离。API 模式不返回演示 Agent/知识，不提供假的审查或定稿成功。
- 与 Claude 整改重叠的默认收起、低干扰提示、保存保护被整合；新设计确认了三空间和双抽屉。旧显式布局与 Demo 提案/决定记录保留，不静默迁移或清空 localStorage。
- main 在本轮期间移除了项目内的作品档案并迁移文档。该上游变更已保留；PR 相对 main 的 manuscript/book/proposals/decisions/inbox/state 差异为零。本任务没有创作、修改或重新加入正文与设定。
- 保留开发身份服务器的生产环境保护；生产身份与部署仍需独立设计。本次不部署、不合并 PR。

## 7. 验证结果

- pnpm install --frozen-lockfile：通过；保留 pnpm 对 esbuild 构建脚本的既有提示。
- pnpm typecheck、pnpm lint：通过。
- pnpm test：API 29 + Web 47，共 76 项通过。
- pnpm build：通过；保留既有大包提醒，编辑器与界面主包仍超过 500kB。
- pnpm test:e2e：9 项视觉/旧布局/共享思考输入 + 2 项真实 API 流程，共 11 项通过。
- pnpm openapi:check：通过；pnpm openapi:lint：有效，保留 32 条既有警告。
- pnpm harness:rebuild：通过，当前工程 0 正式章节、0 知识 ID 冲突；读取配置的 Harness，不创建作品。
- node scripts/check-knowledge-ids.mjs --fail：通过。
- node scripts/smoke-built-api.mjs：通过，覆盖构建后的进程和生产身份保护。
- 所有真实数据测试使用独立 Harness fixture 与临时状态目录；章节 fixture 哈希与文件内容未被 API 修改。

远端 [PR #5](https://github.com/story2u/ai-write-life-circle/pull/5) 已创建并保持 Open。实现提交 32626d6 的 [PR CI](https://github.com/story2u/ai-write-life-circle/actions/runs/38670044743) 全部通过，含 OpenAPI、Harness、构建 API smoke、Chromium E2E 与验证产物上传。后续报告提交的检查状态以 PR 当前 head 为准；没有合并或部署。

## 8. 尚未完成与独立后续任务

1. 真实 Agent Runtime：作者主动触发的固定修订连续性审查、引用核验、研究与挑战；目前没有 LLM 调用。
2. 真实知识/注记/故事判断/CanonChange 服务：需要来源 Hash、作者逐项确认、正式写入事务和权限设计；当前能力声明为 false。
3. 思考会话、Demo 候选/判断目前为当前会话状态，笔记结论另行持久化；真实跨会话恢复需独立 Session 契约。Demo 笔记和旧版草稿/记录可刷新恢复。
4. 生产认证、数据库/多机并发、笔记分页和应用状态增长管理。
5. 全应用视觉逐页像素基线、长篇真实作品长期体验与五章作者验证尚未覆盖；四屏宽工程检查不能代替作者实际创作。

以上部分没有写成已经实现。新知识模型仍是候选；没有由 AI 直接更新正式设定的通路。

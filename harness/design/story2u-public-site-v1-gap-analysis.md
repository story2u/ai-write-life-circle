# story2u Public Website V1 差异分析

日期：2026-10-17。工程从 origin/main `102ca00` 起步，独立 worktree、`codex/story2u-public-site-v1`；原工作区及未提交作者文档未修改。

## 设计来源与权威

已调用最新 Make `kWBOdcae5utBZ6VtBHHXui` / `0:1` 的 get_design_context，返回最新资源清单；连接器缺少 Make 正文读取工具，截图接口明确不支持 Make。随后作者提供最新本地导出 `/Users/bruce/git/story/Writer Agent UI_UX Design`，包含 src/site 和 docs/site。实现依据此导出的源码和交接文档，并用本地运行的同一源码生成参考截图；没有使用早期缺少公开页面的导出。

UI 权威是当前 src/site、src/index.css 和 docs/site/story2u-handoff.md；VNext handoff 解释 Studio。docs/design/design-system.md 与 docs/product、contracts、implementation 的 V0.4 内容带历史/proposed 标记，只作背景：旧文档声称 Notes/Review 尚未实现、章节保存写回 Harness，均不能覆盖当前 Go Notes/Review 与独立 Revision 存储。原型 hash router、Demo 目录、本地 publication 单例和模拟成功均未移植到生产。

| 维度 | 状态 | 最终实现与差异 |
|---|---|---|
| 页面 | NEW | Home、Discover、Book、Reader、Author、四步 Publish/Manager 均接真实 Go API |
| 组件 | EXISTING / MODIFY | 复用 VNext 基础控件、颜色与文字 token；适配 Make Cover/Header/Footer/BookCard，移除原型控制 |
| 路由 | MODIFY | 真实路径 /、/discover、/books/*、/authors/*；Studio 移至 /studio、/studio/publish，不使用 hash |
| 状态 | NEW | 出版状态只由 Go 原子持久化；本地仅保存主题、阅读设置、阅读进度 |
| API | EXISTING / NEW | 复用 Revision、Actor、文件锁；新增 6 类作者出版操作和 6 个公开读取端点，独立 OpenAPI |
| 数据 | NEW | 草稿与公开快照隔离；不可变版本、公开指针、幂等与审计同文件事务提交 |
| 认证 | EXISTING / MODIFY | Git merge 整合 #11 `4f78e1c` 的同一 Better Auth/D1；PR 叠放其后，不复制另一套身份实现 |
| SEO | NEW | Worker 逐请求 React SSR；正文/元信息先于 JS，动态 sitemap/robots/OG，no-store |
| 部署 | MODIFY | 保留 EC2 Go + Cloudflare Worker；部署前检查新版 Go Public API，禁止先切换 Web 到旧 API |
| 测试 | NEW | 领域故障注入、跨作者/Agent、契约、真实 HTTP、SSR、workerd/D1 和全链路 Playwright |
| 原型数据 | PROTOTYPE_ONLY | Demo 图书、浏览器出版状态、规模选择器、设计说明不进入正式站点 |
| 生产操作 | BLOCKED | 本任务明确不合并、不部署；#11 与本 PR 仍须按顺序审查合并 |

## 视觉映射

文学杂志式首页；0 本真实空态、1–4 本单栏/精选、5–30 本最近更新和分类、更多作品进入分页 Discover。中文字体栈沿用 UI Sans / 正文 Serif；站点最大 76rem、阅读宽度32/38/44rem；2:3 封面、56px 桌面 Hero、浅色/深色暖调。Reader 保留16/17/18/20/22字号、1.8/2/2.2行高、浅色/柔和/深色。断点按最新组件源码适配，不采用历史 V0.4 布局。

工程必要差异：公开章节使用随机稳定 slug；发布预览来自保存的 Revision，所有章节可读且须人工确认；新增真实错误、409、权限与历史状态；封面使用作者选定配色/图形或 HTTPS 图片，不填充 Demo 资产。无公开阅读量、评分或评论。

## 本次导出指纹

SHA-256 用于定位本次读取的导出版本，不代表 Figma 远端版本号。

| 文件 | SHA-256 |
|---|---|
| `src/Root.tsx` | `b8bcb4d57f6e251a5cee8b2f0404a29463483f5b831de35083052681296f98c2` |
| `src/site/Home.tsx` | `98de37fb2b66dcbf7c7eaa8491093f21f403eaa9b7bf3275b1966814386f7ab4` |
| `src/site/Discover.tsx` | `0e798103fb90b7a69b25115c456f20e4b3380a1b17621853f3f786fb20f34620` |
| `src/site/Book.tsx` | `85f101c45b017ab4241d7ca9e61d582e4c2a4514dc3dd521f85a08c898ac8605` |
| `src/site/Reader.tsx` | `19ea43e0f12adea20ed0ea6b2c787b97517277f5af0072b617d7c6fc475581d5` |
| `src/site/Publish.tsx` | `09f40ad312b47948c1fe3e0e01caca6cddb7601f9baeee0f0abcc0b1a229c6ab` |
| `src/site/kit.tsx` | `fa208efd002383935ab1bb1fcb45d2691c464e32f6ed1d9f618a3423e231aaf3` |
| `src/site/store.ts` | `abfa21e744472e2fef8baa0c2cc509eeab11a16820a2f8f347469e30276b22a0` |
| `src/site/data.ts` | `465a517240735050cd55c1ef8f65336de7deb1a89522f5eb60560e0121ce8a33` |
| `src/site/SiteSpec.tsx` | `b2989368a0fd1325bd7f661c505c6b79fb6668a5a061b4ac07501201882dc152` |
| `src/index.css` | `da6d8f7ad3672caa80a5f5d523dca310d6804fcd2ad197083a8d4cb99bd75971` |
| `src/components/ui.tsx` | `1675ddb64c5502a75aca516bd1520d07dc45fa9d19f97dcb45d3402d1f3b4696` |
| `docs/site/story2u-handoff.md` | `6dfebab48149da9738a9769923d0d7771c00d271b31c24339b02671de8666e47` |

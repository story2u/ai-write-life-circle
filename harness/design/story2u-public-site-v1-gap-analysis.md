# story2u Public Website V1 差异分析

检查日期：2026-10-17。工程基线 origin/main `102ca00`；独立 worktree `ai-write-life-circle-public-site-v1`，分支 `codex/story2u-public-site-v1`。

最新 Figma Make `kWBOdcae5utBZ6VtBHHXui` / `0:1` 已调用 get_design_context；返回最新 src/site/*、Root.tsx、docs/site/story2u-handoff.md 等资源链接，但当前连接器没有 Make resource reader，Resource Templates 为空。get_screenshot 实际返回不支持 Make。旧本地导出没有 src/site，不作为最新页面实现依据。已请求最新本地导出目录。

| 维度 | 状态 | 当前与目标 |
|---|---|---|
| 页面 | BLOCKED | 当前是 Writer Studio；Home/Discover/Book/Reader/Author/Publish 需要最新 Make 源码和可访问预览，不能猜测视觉结构 |
| 组件 | EXISTING / BLOCKED | Studio 按钮/编辑器/空状态可检查复用；公开组件映射待最新源码 |
| 路由 | MODIFY | main 无公开阅读路由；目标 /、/discover、/books/*、/authors/*、私有 /studio |
| 状态 | NEW | 服务端不可变出版快照；浏览器仅阅读设置和进度，不作出版数据源 |
| API | EXISTING / NEW | 复用 Go Revision、Author Actor、文件锁；新增 publication/public 领域 |
| 数据 | NEW | 草稿与出版状态独立文件；出版单一原子事务同时写版本、指针、幂等记录与审计 |
| 认证 | EXISTING / MODIFY | Go Bearer 已在 main；PR #11 OPEN，最新4f78e1c，Better Auth/D1/Worker 尚未合并。复用其身份，不复制未合并实现；未来 Worker 必须放行公开只读路由并保护 Studio publication 路由 |
| SEO | NEW | 独立公开 React 服务端渲染入口；不采用 hash router，不让 SSR 读取私有模型 |
| 部署 | MODIFY | 保留 EC2 Go + Cloudflare Web。公共 SSR 和路由整合待 #11 和设计输入；本任务不部署 |
| 测试 | NEW | 原子失败/重试、跨作者/Agent拒绝、预览后变更、多卷、撤回/下架、公开字段白名单、SSR HTTP 与 Playwright |
| 原型行为 | PROTOTYPE_ONLY | Figma localStorage publication/Demo 图书不可进入正式 API |

工程权威为现有 API/Contracts。公开 API 和 Publication 候选契约可先实现；UI token、封面资产、断点、具体页面布局尚未读取，不宣称视觉验收完成。

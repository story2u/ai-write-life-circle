# story2u Public Website V1 实施报告

日期：2026-10-17。独立分支 `codex/story2u-public-site-v1`。本任务仅开发、验证、提交 PR；没有合并、部署、修改线上凭据或公开真实作品。

## 1. 最新设计输入

Figma Make `kWBOdcae5utBZ6VtBHHXui` / `0:1` 的 MCP 返回最新清单，但资源读取与 Make 截图受连接器限制。作者补交最新本地导出后，读取 src/Root.tsx、src/site 全部9个模块、src/index.css、基础组件及 site handoff；工程依据当前公开站点源码。历史 V0.4 文档与现有工程行为的差异已记录，未覆盖已实现 Notes/Review/Revision 契约。

同一导出源码可通过 `node scripts/capture-public-reference.mjs "/LOCAL/MAKE_EXPORT"` 生成参考，源码指纹见 [差异矩阵](../design/story2u-public-site-v1-gap-analysis.md)。没有冒称取得 Figma 服务端截图。

## 2. 页面与组件

- 首页：真实空态、1–4本文学杂志布局、5–30本更新/分类、更多作品 Discover 入口；真实公开作品和第一章摘录，不填 Demo。
- Discover：metadata 搜索、分类、状态、排序、游标分页、URL恢复、空结果/错误。
- 详情/作者：稳定公开 slug、多卷章节顺序、公开作者笔名/介绍及作品；不显示邮箱/内部ID。
- Reader：只读安全 Markdown、前后章、目录、字号/行高/宽度、三种背景、本机进度；可取消恢复生命周期与段落锚点，防止旧章节迟到回写。
- Studio：保存后进入发布，公开资料/选章/固定预览/人工确认四步，管理更新、撤回、下架、重新上架、版本历史和私有备注。
- Header、Cover、BookCard、Footer 与 VNext 控件/token 复用；没有整体覆盖 apps/web 或搬入原型出版 store。

## 3. Go API 与共享契约

作者接口（仅当前作品所有者；Agent拒绝）：

| 方法 | 路径 |
|---|---|
| GET | /v1/studio/books/:bookId/publication |
| POST | /v1/studio/books/:bookId/publication/preview |
| GET / POST | /v1/studio/books/:bookId/publication/versions |
| POST | /v1/studio/books/:bookId/publication/unlist |
| POST | /v1/studio/books/:bookId/publication/relist |

匿名只读 GET：`/v1/public/home`、`/v1/public/books`、`/v1/public/books/:slug`、`/v1/public/books/:slug/chapters/:chapterSlug`、`/v1/public/authors/:slug`、`/v1/public/categories`。

严格 Zod/TypeScript DTO 与 UI mapper 分离；新 OpenAPI `publication-api-v1.json` 独立生成及检查，不覆盖 Sprint 3/Figma 来源。真实 Go HTTP 响应同时经过 Zod 与 OpenAPI 验证。没有新增 Node 后端。

## 4. 持久化、事务与故障

`<state>/publications/state-v1.json` 在独立跨进程锁内保存不可变历史、当前指针、预览、幂等、审计。最终发布重新读取已保存 Revision/Hash/标题/卷序；按稳定顺序持有 draft 锁直到 fsync+原子 rename。版本变化409，不发布未确认新正文；磁盘失败旧快照字节不变，原幂等键可重试，重启重放不新增版本。

首次发布、更新、撤回、下架/重新上架均追加独立版本。撤回最后一章会生成空的 unlisted 版本；重新上架不自动读取新草稿。详见 [领域设计与业务图](../architecture/publication-domain.md)。

## 5. 公私隔离

公开 API/SSR 仅从 current listed Snapshot 生成显式白名单；无匿名历史接口，不读取私人 Harness、Notes、Review、草稿。Worker 公共请求不携带 Cookie/浏览器凭据/Go Bearer，污染 DTO 拒绝输出。HTML、JSON-LD、hydration、错误均验证无内部字段或私有测试标记。内部发布备注只返回作者。

Go 保留服务端 Actor/ownership、CAS、幂等和审计；不依赖隐藏按钮。生产不回退 local-author。

## 6. SEO 与撤回

现有 Cloudflare Worker 增加独立 React SSR：初始 HTML 包含作品摘要和正文，无需执行 JS。真实 URL、title/description/canonical/OG/JSON-LD、动态 sitemap/robots；Discover和Studio/预览 noindex。OG只读公开资料，没有伪造阅读量或评分。

HTML/API/sitemap/OG 全部 no-store。更新按当前公开指针实时读取，无需重建；撤回旧章/下架旧书返回404，sitemap删除。已打开页面、下载及第三方搜索副本不能远程撤回，不承诺全球 CDN 秒级失效。详见 [渲染 ADR](../architecture/public-site-rendering.md)。

## 7. 12项业务验收

| 场景 | 验证与结果 |
|---|---|
| 1 空站点 | Playwright + SSR规模测试：无Demo、真实空态 |
| 2 首次只发第一章 | 浏览器四步向导 + Go HTTP：首页/目录/Reader只含所选，猜测私章404 |
| 3 修改草稿不改公开 | 真正保存 Revision 后，公开旧正文保持、管理显示待更新 |
| 4 显式更新 | 新版本与公开正文更新、历史和草稿保留 |
| 5 预览后并发修改 | HTTP/浏览器409、不新增版本；同一向导重新选章/预览后才可发布 |
| 6 存储失败 | Go领域注入失败，旧状态字节不变，无半成品，同键安全重试和重启重放 |
| 7 章节撤回 | 新版本、目录删除、旧URL404、sitemap删除；领域另覆盖撤回最后一章 |
| 8 下架/重新上架 | 首页/发现删除、详情/章节404，再上架旧确认快照 |
| 9 阅读进度 | 浏览器刷新/偏好/resize锚点；单测延迟字体、A→B切换、恢复期禁止覆盖 |
| 10 权限/隐私 | Go跨作者/多作品/Agent/匿名，Worker/D1签名会话与同源，私有标记不泄漏 |
| 11 多卷 | 第二卷从order1重新计数，目录/下一章按全局卷序，选择与公开顺序一致 |
| 12 SEO | 直接HTTP及禁用JS浏览器读取首页/详情/章节/作者，元信息/sitemap/robots/OG检查 |

场景6使用可控领域故障注入，不向生产磁盘制造故障；并非每一种底层磁盘故障都通过浏览器触发。所有章节和会话均为隔离合成 fixture。

## 8. 响应式与视觉证据

`apps/web/test-results-public` 生成40张截图：Home/Discover/Book/Reader/Publication管理及向导四步骤，覆盖1440/1024/768/390；另有Home/Publication在1440/390的深色截图。实际数量以测试产物为准。无水平溢出检查、页面脚本错误检查、阅读设置和焦点/键盘交互验证均保留。

`apps/web/test-results-reference` 保存最新 Make 源码本地运行的 Home/Book/Reader 四宽度参考。人工检查了桌面Hero、2:3封面、中文Serif、留白、768目录、390筛选/预览/阅读器及深色管理；结构与当前设计保持一致。参考是三本Demo，工程截图是一部合成快照且已恢复进度，内容、滚动位置和行数不同。没有对不同文本执行像素差分，也不宣称全页面逐像素一致。截图不含真实作品，CI上传公开站产物供审查。

## 9. Google OAuth 整合

PR #11 head `4f78e1c` 仍 Open。通过 Git merge 其提交历史形成叠放 PR，复用既有 Better Auth/D1/Go作者身份，无第二套认证。公开页面在认证链前匿名处理；出版接口在认证链中。Google回调保持 `/api/auth/google/callback`，作者可返回 `/studio/publish`。

真实 workerd+D1 验证匿名SSR、Google授权发起、签名会话、退出、匿名出版401、已登录出版代理、跨作品404、跨站写403。未调用真实 Google或真实模型。合并顺序：#11 → 本PR改base main并复核CI → 本PR；当前不执行任何合并。

## 10. 限制与风险

- 默认 CLI 仍装配一个受信任 project/作者；领域支持并测试多作品/多作者隔离，未做自助注册和多书创建平台。
- 单JSON保存全部出版历史，随版本增长，出版事务串行化；适合当前MVP规模，后续需监控体积。预览30分钟、最多20个活跃/64MiB，单快照最多100章/20MiB。
- 外部直接改 Harness 不遵循应用锁；导入/替换应先停止服务。未知残留锁不自动抢占。
- 首页最多30部，Discover可翻页；阅读进度只在本机，不做跨设备同步。
- 静态 serve Docker 仅验证浏览器构建；正式SSR必须使用组合Worker。部署先新版Go，再Web契约预检；本任务尚未部署。
- 政策/联系页面仅提供基础产品说明，未实现投稿审核、评论、支付、搜索引擎收录承诺或图片托管。

## 11. 自动化结果

本地通过：frozen install、typecheck、lint、pnpm test（Go Race全包、Node29、Review fixture、Publication33、Web85及Worker8）、build/SSR、OpenAPI生成一致性与lint、go vet、Node/Go95项兼容、auth schema、workerd+D1、生产身份与持久化smoke、默认Go+Vite启动smoke。

Playwright完整回归为16个测试：Studio9、Revision/Notes2、Review3、Google登录1、公开站全链路1。公开站覆盖上表多阶段场景。Review回归仅修正等待偏好保存的测试同步，不删除失败用例或弱化业务断言。真实LLM质量不在本任务验收范围。

GitHub CI：[PR #12 checks](https://github.com/story2u/ai-write-life-circle/pull/12/checks)。PR 与 Push 各执行一次 CI，每次含 verify 与 Go container 两个 Job；最终状态以该页最新提交为准，本地通过不替代远端结果。OpenAPI旧合同37项warning，新合同3项warning（license与内联schema对应的未引用组件），均无error；未伪造项目license。

## 12. PR

[PR #12 — Add story2u public reading site and revision-bound publication](https://github.com/story2u/ai-write-life-circle/pull/12)。base `codex/google-oauth-better-auth`，head `codex/story2u-public-site-v1`，保持Open，不合并、不部署。

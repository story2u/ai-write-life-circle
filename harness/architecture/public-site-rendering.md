# ADR：公开站点渲染

状态：方案已选，渲染实现等待最新 Make 源码。

保留 React/Vite Studio，公开站点增加独立 React SSR 入口，部署于现有 Cloudflare Worker。SSR 只通过公开 DTO 请求 Go Public API；Studio 继续客户端渲染并由现有 Better Auth 保护。避免重写框架、引入 Node 后端或从 Harness 直接生成网页。

公共真实路径包括 /、/discover、/books/:slug、/books/:slug/chapters/:chapterSlug、/authors/:slug。逐请求 SSR，无共享 HTML/API 缓存（Cache-Control: no-store），使下架后的新请求不能得到旧源站内容。历史浏览器页面、用户下载及第三方搜索快照无法远程撤回。

生产站点 origin 是部署配置，不信任请求 Host 来生成 canonical。公开 DTO 驱动 title/description/OG/JSON-LD/sitemap；JSON-LD 必须转义 <，正文经过安全 Markdown 渲染，不允许原始 HTML。Discover 查询 noindex，/studio 与预览 noindex。404 保持真实 HTTP 状态。

PR #11 未合并，不能在当前分支复制另一套 Worker 认证；整合时应在 canonical/安全检查基础上明确公开路径白名单，然后进入现有认证链。构建增加 SSR bundle；发布读取当前 publication，故发布/撤回不需要重建静态页面。不得将客户端 document.title 计为 SSR 验收。

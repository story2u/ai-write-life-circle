# ADR：公开站点渲染

状态：已实现；依赖尚未合并的认证 PR #11，当前开发 PR 叠放其后。不执行生产部署。

保留 React/Vite Studio，在同一 Cloudflare Worker 增加独立 React SSR 入口。构建生成浏览器 assets 与可独立验证的 dist-server/public.js；Wrangler 从 worker/index.ts 打包实际认证+SSR处理器。没有新增 Node API、框架迁移或微服务。

入口先保持 canonical origin 检查，再对白名单公开页面/API执行匿名只读处理，其他 API 进入同一 Better Auth/D1 会话链；出版管理路由必须通过会话、同源检查、项目白名单，再由 Go 检查 author/ownership。Studio 仍是客户端编辑器，/studio/publish 复用 AuthGate；登录回到原 Studio 路径。生产公开模式缺少 Google 登录配置时失败关闭，不回退开发身份。

SSR 只请求 Go Public API 的白名单 DTO，不携带 Cookie、客户端 Authorization 或后端 Bearer。ASSETS 绑定读取 `/` 的 HTML 壳，避免 Cloudflare 对 `/index.html` 的规范化重定向。公开正文使用安全 Markdown；禁止 raw HTML，拒绝危险 URL。HTML、JSON-LD、内嵌 hydration JSON 分别转义，不含内部 Revision/Notes/Review。

逐请求渲染，不缓存公开 HTML/API/sitemap/OG，全部 Cache-Control: no-store；发布/更新后无需重建，下架/撤回后的新源站请求立即按当前指针返回404。无法撤回已经打开的浏览器页面、下载、第三方搜索快照，不承诺全球 CDN 秒级清除。

作品、章节、作者具有独立真实 URL、title/description/canonical/OG；作品和章节含真实日期 JSON-LD，没有评分/流量。动态 sitemap 只枚举当前 listed 快照。Discover 搜索/筛选 noindex；Studio 与预览 X-Robots-Tag:noindex,nofollow，robots 禁止私有路径。公开缺失/撤回为404、上游故障503，不将客户端 document.title 当作 SEO。

部署顺序为新版 Go API → 验证匿名 /v1/public/home 契约 → Web。部署 workflow 增加该检查，旧 API 不兼容时在 D1/Worker 变更前停止。现有生产 Go Bearer 保护保留；不要开放 Go 开发身份。

验证：真实 Go HTTP 契约、禁用 JS 的浏览器、直接 HTML HTTP、SSR 单元测试及真实 workerd+D1 的匿名SSR/授权出版路由。自动化使用隔离合成章节与本地会话，不操作真实 Google 账号或作品。

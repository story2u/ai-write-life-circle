# Google 登录与真实 Web API

前端使用 Better Auth 1.7.10 的 Google OAuth。Cloudflare Worker 处理 `/api/auth/*` 和 `/api/session`，D1 `story2u-auth` 保存用户、会话、OAuth account/state 和登录限流。作品仍保存在现有 Go API，D1 不保存小说。生产构建设置 `VITE_WRITER_AGENT_AUTH=google`、`VITE_WRITER_AGENT_MODE=api`、`VITE_WRITER_AGENT_PROJECT_ID=local`；本地原有 Demo/隔离 API 测试不强制登录。

## Google Cloud 配置

创建 OAuth Client，类型为 Web application：

- Authorized JavaScript origin：`https://story2u-web.bluedao10000.workers.dev`
- Authorized redirect URI：`https://story2u-web.bluedao10000.workers.dev/api/auth/callback/google`
- Google Auth Platform 应用若处于 Testing，将允许的 Google 邮箱加入 Test users。
- 仅请求 Better Auth Google 默认身份 scopes，不增加 Drive/Gmail 权限。

参考 [Better Auth Google 文档](https://better-auth.com/docs/authentication/google)。如 Google 要求验证应用域名，应使用自己控制的正式 Web 域名，并同时更新 Worker 的 BETTER_AUTH_URL、OAuth origin 与 redirect URI；不能仅修改其中一处。

## GitHub Actions 配置

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Variable | GOOGLE_CLIENT_ID | Google Web OAuth Client ID |
| Secret | GOOGLE_CLIENT_SECRET | Google Client Secret，仅 Worker |
| Secret | BETTER_AUTH_SECRET | 一次生成并保留的至少 32 字符随机密钥；轮换会使旧会话失效 |
| Variable | WRITER_AGENT_AUTHOR_EMAILS | 逗号分隔的作者邮箱；不配置时拒绝登录与访问 |
| Secret | WRITER_AGENT_API_TOKEN | 现有 Go API Bearer，仅 Worker 使用 |
| Secret | CLOUDFLARE_API_TOKEN | 现有部署 token，额外需要目标 account 的 D1 read/write 权限 |
| Variable | CLOUDFLARE_ACCOUNT_ID | 现有 account |

不要在 Git 或 `VITE_*` 中配置任何 Secret。LLM API key 仍只在 Go 服务端，不传到 Worker/浏览器。

部署工作流查找或创建固定名称的 D1，生成忽略的 `wrangler.auth.generated.toml`，在配置完整后应用增量 SQL migrations，再通过 Wrangler `--secrets-file` 同时发布 Worker 和 runtime secrets。缺少 OAuth/身份配置会在切换线上版本前失败。数据库不会在每次部署重建；不要删除它来修复登录问题。首次运行若提示 D1 权限不足，更新现有 Cloudflare token 的 account D1 权限后重试。

## 权限与会话

两个授权邮箱共享现有 `local` 项目和固定 Go 作者身份。这是同一作者的账号白名单，不是多租户隔离；未来开放给其他作者前必须单独实现项目 ACL。

新用户和返回用户的 Google profile 都必须具有已验证且在白名单中的邮箱；未提供密码注册、账号绑定或用户资料修改入口。每次 API 请求重新检查服务端会话和当前白名单，不使用 cookie cache 授权。会话有效期七天；退出会删除 D1 会话。Cookie 为 Secure、HttpOnly、SameSite=Lax。OAuth state/PKCE 由 Better Auth 处理，返回地址限于同源。

Worker 只代理固定项目允许的业务路由，校验写请求 Origin 和 JSON，清除浏览器 Authorization/Cookie/actor 头，并注入后端 Bearer。响应不缓存，不转发后端 Cookie/CORS/重定向；CAS 409、幂等键和请求 ID 保留。匿名请求不能通过 Worker 读取或写入作品，Go 自身的 Bearer 认证继续保留。

登录到期时，前端保留已挂载编辑器和未保存草稿，显示重新登录提示，不自动跳转。作者可先导出草稿；退出登录会要求确认。登录成功不自动触发模型审查，原有逐次发送授权保持不变。线上 Harness 尚无章节时，仍需单独导入作品；Google 登录不会创建或上传小说。

## 验证与回滚

`pnpm --filter @writer-agent/web test` 包含 73 项前端测试和 8 项真实 SQLite 会话/代理测试。`auth:schema --check` 验证 SQL 可复现，`test:auth:runtime` 在真正的 workerd + D1 中验证 OAuth 发起、签名会话、退出和 API 代理。Playwright auth 测试验证点击 Google 登录和授权前不请求作品；Google 页面使用隔离替身，不宣称已验证真实 OAuth callback。

发布后须由授权账号完成一次真实 Google 登录、刷新恢复、退出、重新登录，并验证其他账号拒绝访问。不得伪造生产会话或把 CI fixture 用户写入生产 D1 来代替验收。

保留发布前 Cloudflare Worker version ID；回滚可恢复该版本的流量。增量 D1 表不删除，作品后端和状态不回滚。若仅需暂停 Web 访问，先撤销 Worker 后端 token 或移除白名单；不要关闭 Go Bearer 校验。D1 含登录身份和 OAuth token，应独立保护，不能提交数据库导出或会话值到 Git/Actions artifact。

# Go API 生产部署指南

当前支持单机 EC2、单作者 Bearer 身份。API 原生二进制由 systemd 管理，只监听 127.0.0.1:8787；Caddy 提供 HTTPS 和证书自动续期。保留现有 Web/Nginx，按 API 域名单独路由，不重置旧服务器仓库。

## 发布前验证

```sh
go test -C apps/api-go -race ./...
go vet -C apps/api-go ./...
pnpm build:api:go
node scripts/smoke-production-api.mjs
node scripts/smoke-built-api.mjs
pnpm test:api:parity
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -C apps/api-go -trimpath -ldflags="-s -w" -o dist/writer-agent-api-linux-amd64 ./cmd/server
```

CI 包含以上身份/持久化检查及现有浏览器 E2E。部署使用已提交并通过检查的源码版本；二进制 release ID 对应其 Git commit。ARM 实例应调整 GOARCH，不在服务器安装 Node 或 Go 工具链。

## 安装 API

通过 SSH 上传 Linux 二进制、`scripts/deploy/install-api-systemd.sh` 和 `scripts/deploy/systemd/writer-agent-api.service`，在目标服务器执行（参数应替换为实际文件和 commit）：

```sh
sudo bash install-api-systemd.sh ./writer-agent-api COMMIT_SHA bruce ./writer-agent-api.service
```

安装器先停止旧 API 写入，备份状态/配置与旧 unit，再更新 release 软链接并检查 healthz。重复部署保留已有令牌、作者配置和数据。已有 release 目录禁止换入不同二进制；失败时尝试恢复旧二进制/unit，不把旧备份覆盖到较新数据。

| 路径 | 内容 |
| --- | --- |
| /opt/writer-agent/releases/COMMIT_SHA | 版本化 API 二进制 |
| /opt/writer-agent/current | 当前版本软链接 |
| /etc/writer-agent/api.env | root-only 生产配置 |
| /etc/writer-agent/auth-token | 随机 Bearer 令牌；root:writer-agent 0640 |
| /var/lib/writer-agent | 应用 JSON/审计状态；writer-agent 0700 |
| /srv/writer-agent/harness | 只读资料根目录；首次部署为空，不自动上传本地小说 |
| /var/backups/writer-agent | root-only 一致性备份和回滚记录 |

systemd 以专用无登录用户运行，ProtectSystem=strict、ProtectHome、NoNewPrivileges；只有独立状态目录可写。业务 actor 固定为 api.env 中配置的作者，不接受请求角色声明。

## HTTPS 与既有 Nginx

DNS A 记录指向 EC2 公网地址，需能从公网访问 TCP 80/443。Cloudflare 初次配置建议“仅 DNS”；如使用代理，SSL/TLS 模式必须 Full (strict)，不能使用 Flexible。API 后端 8787 不向公网开放。

拉取官方 Caddy 并记录测试后的 digest。上传 `install-api-https.sh`、`docker-compose.api-edge.yml`、`Caddyfile.api`、`nginx-api-http.conf.template`，执行：

```sh
sudo bash install-api-https.sh api.example.com /home/ubuntu/nginx/nginx.conf ./docker-compose.api-edge.yml ./Caddyfile.api ./nginx-api-http.conf.template caddy@sha256:TESTED_DIGEST
```

此安装器适配当前 `greenfield-nginx` + `greenfield-net`：保留原 Web server block，新增 API 域名 HTTP→HTTPS 重定向，ACME HTTP-01 请求转发至 Caddy 8080。修改前备份；原配置为容器单文件 bind mount，因此原地写入并 nginx -t/reload。Caddy 使用 host network 监听 443，连接本机 API；证书和自动续期配置独立持久化在 /var/lib/writer-agent-caddy。API 不加入原 Web 网络，也不信任代理传入的 actor。

## 验收与访问

- 公网 `GET https://API_DOMAIN/healthz` 返回 200。
- 未带令牌、错误令牌的业务请求返回 401；带有效令牌的 Workspace/Notes/Chapters 返回 200。
- HTTP 只重定向 HTTPS，不转发业务写入；生产 internal projection 返回 404。
- 从公网验证证书链、主机名和有效期，重启 API 后验证可用性。测试数据使用隔离状态目录，不自动写入作者数据。

本地 curl 配置文件应设置 0600，并包含 `header = "Authorization: Bearer <token>"`。随后可使用 `curl --config /PRIVATE/PATH/api.curl https://API_DOMAIN/v1/projects/local/notes`。不要在浏览器包或 Git 中放令牌；目前没有多用户登录、跨域前端接入或 OIDC。

## 运维、轮换与回滚

`sudo systemctl status writer-agent-api`；`sudo journalctl -u writer-agent-api`；HTTPS 代理日志用 `sudo docker logs writer-agent-api-edge`，不记录请求 Authorization。更新受保护令牌文件后 `sudo systemctl restart writer-agent-api` 即完成轮换；保留稳定作者 ID，避免切换 Workspace 所属用户。

回滚代码时先停止 API，备份当前完整状态，再将 current 指回上一 release 并启动。不要直接解压旧状态覆盖新写入；必要的数据恢复先在另一目录验证。首次上线没有旧 API 数据，不等于日后无需备份。证书私钥、身份文件和备份都不得进入 Git。

旧 Web/PostgreSQL 的 BUILD_AND_DEPLOY/deploy-simple 等脚本均已废弃。GitHub Actions 的 EC2 自动部署仍禁用；本次提供可审计的手动发布路径，不自动启用旧 SSH job。

## Public site V1 integration (not deployed)

Publication/public Go endpoints and their independent contract are under
active development. Google OAuth PR #11 remains an integration dependency:
future Worker changes must explicitly allow anonymous GET public API/SSR paths,
protect /studio and its publication API with the existing session, and inject
only the server-held Go bearer for owner operations. Never expose the bearer
to public requests, hydration data or VITE_* configuration. Public HTML/API must
be no-store so unlist/withdraw cannot serve stale shared snapshots. Current
branch does not change Web routing, production secrets, DNS or deployments.

# deploy - Go API 部署到现有 EC2

## 最小上下文

- [生产部署指南](../deploy-guide.md)：认证、发布、HTTPS、备份与回滚。
- [Go API](../../apps/api-go/README.md)：身份模式与存储边界。
- [部署工具](../../scripts/deploy/README.md)：当前脚本和历史入口区分。
- [安全指南](../security.md)：敏感信息处理。

## 流程

1. 核对工作树、目标 commit、CI 和服务器进程/监听端口/数据目录；保留旧 Web、其他业务和未提交文件。
2. 验证生产 Bearer 身份、匿名/错误凭证拒绝、固定 actor、重启与数据重放；无认证的 local-author 不能用于生产。
3. 交叉编译并上传 Linux 二进制，运行 systemd 安装器：停止旧 API、备份完整状态、更新版本、健康检查。
4. 核对域名 DNS，配置专用 HTTPS 域名与自动续期；不直接开放 8787。
5. 公网验收健康、401/200、证书和 HTTPS 重定向；记录版本、状态路径、备份与回滚步骤，不输出令牌。

旧 EC2 Web/PostgreSQL 工作流仅作历史记录，不执行 deploy-simple 等旧脚本。Web 的现有 Cloudflare 工作流保持独立；API 的旧 EC2 自动 SSH job 继续暂停。

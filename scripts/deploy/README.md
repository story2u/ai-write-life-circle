# 部署配置与历史工具

当前入口：

- Web：仓库的 [deploy-web.yml](../../.github/workflows/deploy-web.yml) 构建前端并通过 Wrangler 部署到 Cloudflare Workers，需要相应的 Secrets/Variables。
- Go API：[deploy-api.yml](../../.github/workflows/deploy-api.yml) 构建镜像；EC2 deploy job 明确暂停，生产身份认证尚未实现。
- 镜像构建：从仓库根目录使用 `docker build -f scripts/deploy/Dockerfile.api .` 或 `docker build -f scripts/deploy/Dockerfile.web .`。构建成功不代表生产服务可以启动。

## 已废弃的 EC2 Web/PostgreSQL 工具

`BUILD_AND_DEPLOY.sh`、`deploy-simple.sh`、`deploy-ec2.sh`、`upload-to-ec2.sh` 和 `docker-compose.yml` 属于旧 Web/PostgreSQL 方案，不再支持，也不是 Go API 部署入口。旧文档中的相关命令仅作历史记录，不应执行。

`BUILD_AND_DEPLOY.sh` 原来依赖错误的 Dockerfile 相对路径、过时的远端 Compose 路径及镜像名称；现已移除旧执行流程，调用时提示废弃并以状态码 1 退出，不执行构建、上传或远程连接。旧实现可从 Git 历史查阅。其余历史脚本保留原样，未修复或验证；不提供生产部署保证。

## Go API 镜像与当前部署边界

`Dockerfile.api` 使用 Go 1.27.2 多阶段构建和 scratch 运行镜像，只有静态 Go 二进制，没有 Node.js。健康检查为 `/writer-agent-api --healthcheck`，实际请求 `/healthz`。

`docker-compose.prod.yml` 保留 api_state Volume；只读挂载 Markdown 项目根目录（应包含 book/manuscript），可用 WRITER_AGENT_HARNESS_SOURCE 指定外部作品目录。端口仅映射宿主机 loopback；镜像保持旧容器 UID，避免现有 root-owned Volume 需要改权迁移。

生产身份尚未实现，`WRITER_AGENT_ENV=production` 必须拒绝启动，因此当前 production Compose 不能成功启动 Go API。不得通过公开开发身份、修改保护或清空 Volume 来恢复部署。镜像构建和隔离的 CI 运行验证继续执行。

完整本地切换与回滚步骤见 [Go API](../../apps/api-go/README.md) 与 [迁移报告](../../harness/reviews/go-backend-migration-report.md)。实际作者状态目录切换前，先停止旧写入服务并备份完整状态目录。

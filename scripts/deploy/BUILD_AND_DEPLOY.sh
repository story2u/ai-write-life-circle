#!/bin/bash
# Deprecated historical Web/PostgreSQL deployment entry point.
# Kept only to explain the retirement to existing callers; see Git history for the old implementation.
cat >&2 <<'NOTICE'
已废弃 / DEPRECATED: BUILD_AND_DEPLOY.sh 不再支持当前仓库结构。
请阅读 scripts/deploy/README.md；本入口不会构建镜像、上传文件或连接 EC2。
Go API 生产认证尚未实现，生产部署保持暂停。
NOTICE
exit 1

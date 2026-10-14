# 部署指南

部署到 AWS EC2，使用 GitHub Actions 自动构建镜像。

## 快速开始

```bash
# 1. 推送代码
git push origin main

# 2. 在 EC2 上部署
ssh ubuntu@EC2_IP
cd ~/greenfield-adventures
./deploy/deploy-simple.sh
```

## 详细工作流

参考 [harness/workflows/deploy.md](harness/workflows/deploy.md)

## 文件结构

```
deploy/
├── deploy-simple.sh         # 部署脚本
├── docker-compose.yml       # 容器编排
└── Dockerfile.web          # 镜像定义

.github/workflows/
└── build-and-push-ecr.yml  # 自动构建
```

## 前置条件（首次）

1. 创建 AWS IAM 角色（信任 GitHub OIDC）
2. 创建 AWS ECR 仓库（greenfield-web）
3. 添加 GitHub Secret（AWS_ROLE_TO_ASSUME）

详见 [harness/workflows/deploy.md](harness/workflows/deploy.md)

## 安全

- `.env` 文件不提交（已在 `.gitignore`）
- 环境变量模板：`apps/web/.env.example`
- 使用 IAM 角色而非长期凭证
- 参考 [harness/security.md](harness/security.md)

# Greenfield Adventures - 部署指南

## 📦 部署文件结构

```
deploy/
├── Dockerfile.web           # Web 应用容器定义
├── docker-compose.yml       # 容器编排配置
├── deploy-simple.sh         # EC2 部署脚本
├── deploy-ec2.sh           # 完整部署脚本（备用）
├── upload-to-ec2.sh        # 文件上传脚本（备用）
└── README.md               # 此文件
```

## 🚀 部署流程

### 流程概览

```
1. 推送代码到 GitHub
                ↓
2. GitHub Actions 构建镜像
                ↓
3. 镜像推送到 AWS ECR
                ↓
4. 在 EC2 上拉取并运行镜像
```

### 前置需求

- GitHub 仓库已配置 AWS IAM 角色（OIDC 信任）
- AWS ECR 仓库已创建
- EC2 实例正在运行，SSH 可访问
- AWS CLI 已配置（可选，用于手动推送）

## 📋 自动部署（推荐）

### 1. 配置 GitHub Actions

#### 步骤 1a: 创建 AWS IAM 角色

在 AWS 控制台中创建一个信任 GitHub OIDC 的 IAM 角色：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:GITHUB_ORG/GITHUB_REPO:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

#### 步骤 1b: 配置 IAM 权限

为角色附加策略以允许 ECR 操作：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr-public:GetAuthorizationToken",
        "sts:GetServiceBearerToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr-public:PutImage",
        "ecr-public:InitiateLayerUpload",
        "ecr-public:UploadLayerPart",
        "ecr-public:CompleteLayerUpload",
        "ecr-public:BatchGetImage",
        "ecr-public:GetDownloadUrlForLayer"
      ],
      "Resource": "arn:aws:ecr-public:us-east-1:ACCOUNT_ID:repository/greenfield-web"
    }
  ]
}
```

#### 步骤 1c: 添加 GitHub Secrets

在 GitHub 仓库设置中添加：

```
AWS_ROLE_TO_ASSUME = arn:aws:iam::ACCOUNT_ID:role/github-actions-role
```

### 2. 自动触发部署

推送代码到 `main` 或 `develop` 分支后：

```bash
git add .
git commit -m "update: application changes"
git push origin main
```

GitHub Actions 会自动：
1. 构建 Docker 镜像
2. 推送到 AWS ECR
3. 创建部署通知

### 3. 在 EC2 上部署

获取镜像 URI 后，在 EC2 上执行：

```bash
ssh -i your-key.pem ubuntu@EC2_IP

cd ~/greenfield-adventures
./deploy-simple.sh
```

## 🔧 手动部署

### 如果需要手动推送镜像

```bash
# 1. 本地登录 AWS ECR
aws ecr-public get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin public.ecr.aws

# 2. 构建本地镜像
docker build -f deploy/Dockerfile.web -t greenfield-web:latest .

# 3. 标记为 ECR 镜像
docker tag greenfield-web:latest public.ecr.aws/REGISTRY_ALIAS/greenfield-web:latest

# 4. 推送到 ECR
docker push public.ecr.aws/REGISTRY_ALIAS/greenfield-web:latest
```

## 📝 环境变量配置

部署时在 EC2 上创建 `.env` 文件：

```env
# PostgreSQL
DB_NAME=greenfield_adventures
DB_USER=postgres
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE
DB_PORT=5432

# Web 应用
WEB_PORT=3000
WRITER_AGENT_MODE=demo

# ECR 配置（如需要）
ECR_IMAGE=public.ecr.aws/REGISTRY_ALIAS/greenfield-web:latest
AWS_REGION=eu-north-1

# 环境
NODE_ENV=production
```

⚠️ **安全提示**：
- `.env` 文件包含敏感凭证
- 不要提交到 Git（已在 `.gitignore` 中）
- 设置文件权限：`chmod 600 .env`
- 定期轮换数据库密码

## 📊 部署配置

### Docker Compose 文件说明

| 服务 | 镜像 | 端口 | 用途 |
|------|------|------|------|
| web | ECR 镜像 或 本地构建 | 3000 | React 前端应用 |
| postgres | postgres:17-alpine | 5432 | PostgreSQL 数据库 |

### 镜像源配置

在 `.env` 中设置 `ECR_IMAGE` 来指定镜像源：

```env
# 使用 ECR 上的镜像（推荐生产）
ECR_IMAGE=public.ecr.aws/REGISTRY_ALIAS/greenfield-web:latest

# 或使用本地构建镜像（用于开发）
# 不设置此环境变量，docker-compose.yml 会使用 greenfield-web:latest
```

## 🔒 安全最佳实践

### GitHub Actions 安全

- ✓ 使用 OIDC 而非长期凭证
- ✓ 限制角色权限到必需的 ECR 操作
- ✓ 每个分支/环境使用不同的部署角色

### ECR 安全

- ✓ 使用私有 ECR 仓库
- ✓ 启用镜像扫描漏洞
- ✓ 限制镜像访问权限
- ✓ 定期删除旧镜像

### EC2 安全

- ✓ 使用 IAM 角色访问 ECR（而非 AWS 凭证）
- ✓ 限制安全组入站规则
- ✓ 在 .env 中使用强密码
- ✓ 定期更新 Docker 和依赖

## 🐛 故障排除

### GitHub Actions 构建失败

```bash
# 查看 GitHub Actions 日志
# 1. 打开 GitHub 仓库
# 2. Actions → 选择工作流 → 查看失败的运行
# 3. 展开 "Build and Push" 步骤查看错误
```

常见问题：
- IAM 角色权限不足 → 检查 IAM 策略
- ECR 仓库不存在 → 在 AWS 控制台创建
- OIDC 信任配置错误 → 检查信任策略

### EC2 部署失败

```bash
# 检查 Docker 容器
docker-compose ps

# 查看详细日志
docker-compose logs -f

# 检查 Web 容器日志
docker-compose logs -f web

# 检查 PostgreSQL 容器日志
docker-compose logs -f postgres
```

常见问题：
- 无法拉取镜像 → 检查 ECR 权限和镜像 URI
- 端口被占用 → 修改 `.env` 中的 `WEB_PORT`
- 数据库连接失败 → 检查 PostgreSQL 容器状态

### 镜像拉取错误

```bash
# 验证 ECR 访问
aws ecr-public get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin public.ecr.aws

# 检查镜像是否存在
aws ecr-public describe-images --repository-name greenfield-web --region us-east-1

# 手动拉取镜像测试
docker pull public.ecr.aws/REGISTRY_ALIAS/greenfield-web:latest
```

## 📊 监控和维护

### 查看部署状态

```bash
# SSH 到 EC2
ssh -i your-key.pem ubuntu@EC2_IP

# 进入项目目录
cd ~/greenfield-adventures

# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 查看资源使用
docker stats
```

### 定期维护任务

**每周**：
- 检查容器日志是否有错误
- 验证磁盘空间
- 检查镜像更新

**每月**：
- 备份数据库
- 轮换数据库密码
- 清理旧镜像

## 🔄 升级应用

### 更新到新版本

```bash
# 1. 在本地推送更新
git add .
git commit -m "feat: new features"
git push origin main

# 2. GitHub Actions 自动构建新镜像

# 3. 在 EC2 上拉取新镜像
ssh ubuntu@EC2_IP

cd ~/greenfield-adventures

# 更新镜像标签（如需要）
# 编辑 .env，更新 ECR_IMAGE 或其他配置

# 重启容器
docker-compose pull
docker-compose up -d
```

## 📚 相关文件

- `Dockerfile.web` - 容器定义
- `docker-compose.yml` - 容器编排
- `deploy-simple.sh` - EC2 部署脚本
- `.github/workflows/build-and-push-ecr.yml` - GitHub Actions 工作流
- `SECURITY.md` - 安全指南
- `DEPLOYMENT_CHECKLIST.md` - 部署检查清单

## 🆘 获取帮助

- 查看完整文档：`../DEPLOY.md`
- 安全指南：`../SECURITY.md`
- 检查清单：`../DEPLOYMENT_CHECKLIST.md`
- AWS ECR 文档：https://docs.aws.amazon.com/ecr/
- Docker Compose 文档：https://docs.docker.com/compose/

---

**版本**：1.0  
**最后更新**：2026-10-14  
**项目**：Greenfield Adventures

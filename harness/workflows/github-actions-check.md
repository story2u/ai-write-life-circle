# GitHub Actions 工作流检查清单

本文档用于验证 GitHub Actions 工作流配置是否正确。

## 工作流概览

### build-and-push-ecr.yml

**触发条件**:
- 推送到 `main` 或 `develop` 分支
- 修改 `apps/**`、`packages/**`、`scripts/deploy/Dockerfile.web` 或工作流文件本身
- 手动触发 (workflow_dispatch)

**主要步骤**:
1. Checkout 代码
2. 设置 Docker Buildx
3. 配置 AWS 凭证 (OIDC)
4. 登录 AWS ECR
5. 构建并推送 Docker 镜像
6. 输出镜像信息
7. 发送部署通知

## 必需的 GitHub Secrets

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| AWS_ROLE_TO_ASSUME | AWS IAM 角色 ARN | `arn:aws:iam::028610956878:role/GitHubActionsRole` |

## 必需的 AWS 资源

### 1. ECR 仓库

```bash
# 仓库名称: greenfield-web
# 区域: eu-north-1
# 账户: 028610956878

aws ecr describe-repositories \
  --repository-names greenfield-web \
  --region eu-north-1 \
  --profile greenfield-adventures
```

### 2. IAM 角色

**角色名称**: GitHubActionsRole

**信任策略** (允许 GitHub OIDC):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::028610956878:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/ai-write-life-circle:*"
        }
      }
    }
  ]
}
```

**权限策略** (ECR 访问):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:GetRepositoryPolicy",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

## Docker 镜像标签策略

每次构建会推送 3 个标签:

1. **Git SHA**: `028610956878.dkr.ecr.eu-north-1.amazonaws.com/greenfield-web:abc1234...`
2. **latest**: `028610956878.dkr.ecr.eu-north-1.amazonaws.com/greenfield-web:latest`
3. **分支名**: `028610956878.dkr.ecr.eu-north-1.amazonaws.com/greenfield-web:main`

## Dockerfile 构建上下文

**Dockerfile 路径**: `scripts/deploy/Dockerfile.web`
**构建上下文**: 项目根目录 (`.`)

**依赖文件**:
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `package.json`
- `apps/` - 所有应用代码
- `packages/` - 共享包

## EC2 部署脚本集成

### deploy-simple.sh

**环境变量**:
- `AWS_REGION=eu-north-1`
- `AWS_ACCOUNT_ID=028610956878`
- `ECR_REPOSITORY=greenfield-web`
- `ECR_IMAGE=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest`

**关键步骤**:
1. 检查 Docker、Docker Compose、AWS CLI
2. 创建项目目录和 .env 文件
3. 登录 AWS ECR
4. 拉取最新镜像
5. 启动 docker-compose

### docker-compose.yml

**镜像引用**:
```yaml
services:
  web:
    image: ${ECR_IMAGE:-greenfield-web:latest}
```

## 验证步骤

### 1. 本地验证 Dockerfile

```bash
# 构建测试
docker build -f scripts/deploy/Dockerfile.web -t greenfield-web:test .

# 运行测试
docker run -p 3000:3000 greenfield-web:test

# 访问 http://localhost:3000
```

### 2. 验证 GitHub Actions 权限

```bash
# 检查 GitHub Secret 是否设置
# 在 GitHub 仓库设置 → Secrets and variables → Actions
# 确认 AWS_ROLE_TO_ASSUME 已设置
```

### 3. 验证 AWS 资源

```bash
# 检查 ECR 仓库
aws ecr describe-repositories \
  --repository-names greenfield-web \
  --region eu-north-1 \
  --profile greenfield-adventures

# 检查 IAM 角色
aws iam get-role \
  --role-name GitHubActionsRole \
  --profile greenfield-adventures

# 检查 OIDC 提供商
aws iam list-open-id-connect-providers \
  --profile greenfield-adventures
```

### 4. 测试完整工作流

```bash
# 1. 推送代码到 main 分支
git push origin main

# 2. 查看 GitHub Actions 执行
# 访问: https://github.com/YOUR_USERNAME/ai-write-life-circle/actions

# 3. 检查 ECR 镜像
aws ecr list-images \
  --repository-name greenfield-web \
  --region eu-north-1 \
  --profile greenfield-adventures

# 4. 在 EC2 上部署
ssh ubuntu@16.170.155.138
cd ~/greenfield-adventures
./scripts/deploy/deploy-simple.sh
```

## 常见问题

### 1. GitHub Actions 失败: "Error: Credentials could not be loaded"

**原因**: AWS_ROLE_TO_ASSUME 未设置或格式错误

**解决**:
```bash
# 检查 Secret 格式
# 应该是: arn:aws:iam::028610956878:role/GitHubActionsRole
```

### 2. Docker 构建失败: "COPY failed"

**原因**: 文件路径不在构建上下文中

**解决**:
```bash
# 确保所有文件都在项目根目录下
# 检查 .gitignore 是否排除了必要文件
```

### 3. ECR 推送失败: "no basic auth credentials"

**原因**: IAM 角色权限不足

**解决**:
```bash
# 确保角色包含 ecr:GetAuthorizationToken 权限
# 确保角色包含 ecr:PutImage 权限
```

### 4. EC2 拉取镜像失败: "requested access to the resource is denied"

**原因**: EC2 实例角色没有 ECR 访问权限

**解决**:
```bash
# 为 EC2 实例附加 IAM 角色
# 角色需要包含 ecr:BatchGetImage 权限
```

## 输出示例

### 成功的 GitHub Actions 输出

```
✓ Docker image pushed to ECR
Image URI: 028610956878.dkr.ecr.eu-north-1.amazonaws.com/greenfield-web:abc1234567...
Registry: 028610956878.dkr.ecr.eu-north-1.amazonaws.com
Repository: greenfield-web

✅ Docker image is ready for deployment

📦 Image Details:
  Registry: 028610956878.dkr.ecr.eu-north-1.amazonaws.com
  Repository: greenfield-web
  Tag: abc1234567...

🚀 To deploy to EC2:
  ssh ubuntu@YOUR_EC2_IP
  cd ~/greenfield-adventures
  ./scripts/deploy/deploy-simple.sh
```

## 相关文档

- [部署指南](../deploy-guide.md)
- [部署工作流](deploy.md)
- [安全指南](../security.md)

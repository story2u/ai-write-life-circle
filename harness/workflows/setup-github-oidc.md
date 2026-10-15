# GitHub OIDC + AWS IAM 配置指南

本指南帮助你配置 GitHub Actions 通过 OIDC 安全访问 AWS ECR，无需长期凭证。

## 🎯 目标

- 在 AWS 中创建 GitHub OIDC 提供商
- 创建 IAM 角色并配置信任策略
- 在 GitHub 中设置 Secret

## 📋 前置条件

- ✅ AWS CLI 已安装并配置（profile: greenfield-adventures）
- ✅ GitHub 仓库访问权限（Settings 权限）
- ✅ ECR 仓库已创建（greenfield-web）

## 🚀 方式一：使用自动化脚本（推荐）

### 步骤 1: 运行配置脚本

```bash
cd /Users/bruce/git/story/ai-write-life-circle
chmod +x scripts/deploy/setup-github-oidc.sh
./scripts/deploy/setup-github-oidc.sh
```

### 步骤 2: 按提示输入信息

```
请输入你的 GitHub 用户名或组织名: YOUR_GITHUB_USERNAME
确认继续？(y/n) y
```

脚本会自动完成：
1. 创建 GitHub OIDC 提供商
2. 创建 IAM 角色 `GitHubActionsECRRole`
3. 配置信任策略（仅信任你的仓库）
4. 创建并附加 ECR 访问权限策略
5. 输出 Role ARN 供后续使用

### 步骤 3: 在 GitHub 设置 Secret

脚本完成后会输出类似信息：

```
🔑 重要信息（请保存）：

  AWS Account ID:  028610956878
  AWS Region:      eu-north-1
  IAM Role ARN:    arn:aws:iam::028610956878:role/GitHubActionsECRRole
  GitHub Repo:     YOUR_USERNAME/ai-write-life-circle
```

**在 GitHub 中设置 Secret**：

1. 访问: `https://github.com/YOUR_USERNAME/ai-write-life-circle/settings/secrets/actions`
2. 点击 **"New repository secret"**
3. 填写：
   - **Name**: `AWS_ROLE_TO_ASSUME`
   - **Value**: `arn:aws:iam::028610956878:role/GitHubActionsECRRole`
4. 点击 **"Add secret"**

✅ 完成！

---

## 🛠️ 方式二：手动配置

如果你想了解每一步的细节，可以手动执行：

### 步骤 1: 创建 GitHub OIDC 提供商

```bash
# 获取 AWS 账户 ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account \
  --output text \
  --profile greenfield-adventures)

echo "AWS Account ID: $AWS_ACCOUNT_ID"

# 检查 OIDC 提供商是否已存在
aws iam list-open-id-connect-providers \
  --profile greenfield-adventures

# 如果不存在，创建 OIDC 提供商
aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" \
  --profile greenfield-adventures
```

### 步骤 2: 创建信任策略文件

创建 `trust-policy.json`:

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
          "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/ai-write-life-circle:*"
        }
      }
    }
  ]
}
```

⚠️ **重要**: 将 `YOUR_USERNAME` 替换为你的 GitHub 用户名或组织名

### 步骤 3: 创建 IAM 角色

```bash
# 创建角色
aws iam create-role \
  --role-name GitHubActionsECRRole \
  --assume-role-policy-document file://trust-policy.json \
  --description "Role for GitHub Actions to push to ECR" \
  --profile greenfield-adventures

# 获取角色 ARN
aws iam get-role \
  --role-name GitHubActionsECRRole \
  --profile greenfield-adventures \
  --query 'Role.Arn' \
  --output text
```

### 步骤 4: 创建 ECR 权限策略

创建 `ecr-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
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
      "Resource": "arn:aws:ecr:eu-north-1:028610956878:repository/greenfield-web"
    }
  ]
}
```

### 步骤 5: 创建并附加策略

```bash
# 创建策略
aws iam create-policy \
  --policy-name GitHubActionsECRPolicy \
  --policy-document file://ecr-policy.json \
  --description "ECR access for GitHub Actions" \
  --profile greenfield-adventures

# 附加策略到角色
aws iam attach-role-policy \
  --role-name GitHubActionsECRRole \
  --policy-arn "arn:aws:iam::028610956878:policy/GitHubActionsECRPolicy" \
  --profile greenfield-adventures
```

### 步骤 6: 验证配置

```bash
# 查看角色信息
aws iam get-role \
  --role-name GitHubActionsECRRole \
  --profile greenfield-adventures

# 查看附加的策略
aws iam list-attached-role-policies \
  --role-name GitHubActionsECRRole \
  --profile greenfield-adventures
```

### 步骤 7: 在 GitHub 设置 Secret

1. 访问你的 GitHub 仓库
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **"New repository secret"**
4. 填写：
   - **Name**: `AWS_ROLE_TO_ASSUME`
   - **Value**: `arn:aws:iam::028610956878:role/GitHubActionsECRRole`
5. 点击 **"Add secret"**

---

## 🧪 测试配置

### 1. 触发 GitHub Actions

```bash
# 推送代码
git push origin main

# 或者手动触发
# 访问: https://github.com/YOUR_USERNAME/ai-write-life-circle/actions
# 选择 "Build and Push to AWS ECR"
# 点击 "Run workflow"
```

### 2. 查看执行日志

访问 Actions 页面查看执行详情：
```
https://github.com/YOUR_USERNAME/ai-write-life-circle/actions
```

**成功的日志应该包含**：

```
✓ Docker image pushed to ECR
Image URI: 028610956878.dkr.ecr.eu-north-1.amazonaws.com/greenfield-web:abc1234...
Registry: 028610956878.dkr.ecr.eu-north-1.amazonaws.com
Repository: greenfield-web

✅ Docker image is ready for deployment
```

### 3. 验证 ECR 镜像

```bash
aws ecr list-images \
  --repository-name greenfield-web \
  --region eu-north-1 \
  --profile greenfield-adventures
```

应该看到新推送的镜像标签。

---

## 🔐 安全最佳实践

### 1. 最小权限原则

当前策略仅允许：
- ✅ 访问 `greenfield-web` 仓库
- ✅ 仅限你的 GitHub 仓库
- ❌ 不能访问其他 AWS 资源

### 2. 信任策略限制

```json
"Condition": {
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/ai-write-life-circle:*"
  }
}
```

这确保只有你的仓库可以使用该角色。

### 3. 进一步限制（可选）

只允许特定分支：

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/ai-write-life-circle:ref:refs/heads/main"
  }
}
```

### 4. 审计和监控

```bash
# 查看角色使用历史
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=GitHubActionsECRRole \
  --profile greenfield-adventures
```

---

## ❗ 常见问题

### 1. "Error: Credentials could not be loaded"

**原因**: Secret 未设置或格式错误

**解决**:
- 检查 Secret 名称是否为 `AWS_ROLE_TO_ASSUME`
- 检查 Value 是否为完整的 ARN: `arn:aws:iam::028610956878:role/GitHubActionsECRRole`

### 2. "User is not authorized to perform: sts:AssumeRoleWithWebIdentity"

**原因**: 信任策略中的仓库名称不匹配

**解决**:
```bash
# 检查信任策略
aws iam get-role \
  --role-name GitHubActionsECRRole \
  --profile greenfield-adventures \
  --query 'Role.AssumeRolePolicyDocument'

# 更新信任策略（如果需要）
aws iam update-assume-role-policy \
  --role-name GitHubActionsECRRole \
  --policy-document file://trust-policy.json \
  --profile greenfield-adventures
```

### 3. "AccessDeniedException: User is not authorized to perform: ecr:PutImage"

**原因**: ECR 权限策略未附加

**解决**:
```bash
# 检查附加的策略
aws iam list-attached-role-policies \
  --role-name GitHubActionsECRRole \
  --profile greenfield-adventures

# 附加策略（如果缺失）
aws iam attach-role-policy \
  --role-name GitHubActionsECRRole \
  --policy-arn "arn:aws:iam::028610956878:policy/GitHubActionsECRPolicy" \
  --profile greenfield-adventures
```

### 4. "The OIDC provider is not registered"

**原因**: OIDC 提供商未创建

**解决**:
```bash
# 创建 OIDC 提供商
aws iam create-open-id-connect-provider \
  --url "https://token.actions.githubusercontent.com" \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" \
  --profile greenfield-adventures
```

---

## 📚 相关文档

- [GitHub Actions OIDC 文档](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC 文档](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [部署工作流](deploy.md)
- [GitHub Actions 检查](github-actions-check.md)

---

## 🎉 完成后的工作流

```
┌─────────────────────┐
│ git push origin main│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│ GitHub Actions 触发          │
│ - 使用 OIDC 获取临时凭证     │
│ - 无需存储长期凭证           │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ AssumeRoleWithWebIdentity    │
│ - GitHub 验证你的身份        │
│ - AWS 颁发临时凭证 (15分钟)  │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 构建并推送到 ECR             │
│ - 只能访问 greenfield-web   │
│ - 凭证自动过期              │
└─────────────────────────────┘
```

这种方式比存储 AWS Access Key 更安全！

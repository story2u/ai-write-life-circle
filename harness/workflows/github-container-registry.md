# GitHub Container Registry 部署指南

> 历史文档：以下 EC2 Web/PostgreSQL 部署流程及脚本已废弃，不应按本文执行。当前入口见 [部署说明](../../scripts/deploy/README.md)；Go API 生产认证未完成，生产部署保持暂停。

使用 GitHub Container Registry (ghcr.io) 替代 AWS ECR，无需 AWS 权限配置。

## ✅ 优势

- 🆓 完全免费（公开镜像）
- 🔐 无需 AWS 凭证
- 🚀 自动集成 GitHub Actions
- 📦 与代码仓库绑定
- 🌍 全球 CDN 加速

## 📋 配置步骤

### 1. 确保仓库可以构建 Docker 镜像

当前工作流 `.github/workflows/build-and-push-ecr.yml` 已配置好，会自动：
- ✅ 在推送到 `main` 或 `develop` 分支时构建
- ✅ 推送镜像到 `ghcr.io/story2u/ai-write-life-circle`
- ✅ 打上多个标签（latest, branch, sha）

### 2. 设置镜像为公开（可选，推荐）

**方式 A: 首次推送后在 GitHub 设置**

1. 推送代码触发 GitHub Actions 构建
2. 访问: `https://github.com/story2u/ai-write-life-circle/pkgs/container/ai-write-life-circle`
3. 点击 **"Package settings"**
4. 下拉到 **"Danger Zone"**
5. 点击 **"Change visibility"**
6. 选择 **"Public"**
7. 输入仓库名称确认

**方式 B: 如果镜像保持私有**

需要在 EC2 上登录 GitHub Container Registry：

```bash
# 1. 创建 GitHub Personal Access Token
# 访问: https://github.com/settings/tokens
# 权限: read:packages

# 2. 在 EC2 上登录
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u story2u --password-stdin
```

### 3. 推送代码触发构建

```bash
git add .
git commit -m "chore: switch to GitHub Container Registry"
git push origin main
```

### 4. 查看构建状态

访问: `https://github.com/story2u/ai-write-life-circle/actions`

成功后应该看到：
```
✅ Docker image pushed to GitHub Container Registry

📦 Image: ghcr.io/story2u/ai-write-life-circle
🏷️  Tags:
  - ghcr.io/story2u/ai-write-life-circle:latest
  - ghcr.io/story2u/ai-write-life-circle:main
  - ghcr.io/story2u/ai-write-life-circle:main-abc1234
```

### 5. 在 EC2 上部署

```bash
ssh ubuntu@16.170.155.138
cd ~/greenfield-adventures
./scripts/deploy/deploy-simple.sh
```

## 🔍 验证镜像

### 本地验证
```bash
# 拉取镜像
docker pull ghcr.io/story2u/ai-write-life-circle:latest

# 运行镜像
docker run -p 3000:3000 ghcr.io/story2u/ai-write-life-circle:latest

# 访问 http://localhost:3000
```

### 查看镜像信息
```bash
# 列出所有标签
curl -s https://ghcr.io/v2/story2u/ai-write-life-circle/tags/list | jq

# 检查镜像大小
docker images ghcr.io/story2u/ai-write-life-circle
```

## 📦 镜像标签策略

每次推送会创建 3 个标签：

1. **latest** - 始终指向 main 分支最新版本
   ```
   ghcr.io/story2u/ai-write-life-circle:latest
   ```

2. **分支名** - 当前分支最新版本
   ```
   ghcr.io/story2u/ai-write-life-circle:main
   ghcr.io/story2u/ai-write-life-circle:develop
   ```

3. **分支+SHA** - 精确的提交版本
   ```
   ghcr.io/story2u/ai-write-life-circle:main-abc1234
   ```

## 🔐 私有镜像访问

如果镜像保持私有，需要配置认证：

### 创建 GitHub Token

1. 访问: `https://github.com/settings/tokens`
2. 点击 **"Generate new token"** → **"Generate new token (classic)"**
3. 权限选择:
   - ✅ `read:packages` - 读取包
4. 点击 **"Generate token"**
5. **立即复制 token**（只显示一次）

### 在 EC2 上登录

```bash
# 登录 GitHub Container Registry
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u story2u --password-stdin

# 验证登录
docker pull ghcr.io/story2u/ai-write-life-circle:latest
```

### 保存凭证（可选）

将 token 保存到环境变量：

```bash
# 添加到 .bashrc 或 .profile
echo 'export GITHUB_TOKEN=ghp_xxxxxxxxxxxx' >> ~/.bashrc
source ~/.bashrc

# 使用
echo $GITHUB_TOKEN | docker login ghcr.io -u story2u --password-stdin
```

## 🚀 完整部署流程

```
┌─────────────────┐
│ 1. git push     │
│    origin main  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ 2. GitHub Actions       │
│    - 构建 Docker 镜像    │
│    - 推送到 ghcr.io     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 3. GHCR 存储镜像        │
│    公开/全球访问        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 4. EC2 部署             │
│    - docker pull        │
│    - docker-compose up  │
└─────────────────────────┘
```

## ❗ 常见问题

### Q1: 如何查看所有镜像？

访问: `https://github.com/story2u?tab=packages`

或仓库页面: `https://github.com/story2u/ai-write-life-circle/pkgs/container/ai-write-life-circle`

### Q2: 镜像拉取失败？

**公开镜像**:
```bash
# 直接拉取（无需认证）
docker pull ghcr.io/story2u/ai-write-life-circle:latest
```

**私有镜像**:
```bash
# 先登录
echo YOUR_TOKEN | docker login ghcr.io -u story2u --password-stdin

# 再拉取
docker pull ghcr.io/story2u/ai-write-life-circle:latest
```

### Q3: 如何删除旧镜像？

1. 访问包页面
2. 选择要删除的版本
3. 点击 **"Delete"**

或使用 API：
```bash
# 需要 delete:packages 权限的 token
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/user/packages/container/ai-write-life-circle/versions/VERSION_ID
```

### Q4: GitHub Actions 构建失败？

检查清单：
- [ ] 工作流文件语法正确
- [ ] Dockerfile 路径正确 (`scripts/deploy/Dockerfile.web`)
- [ ] 仓库有 Actions 权限（Settings → Actions → General → Workflow permissions）

### Q5: EC2 拉取镜像很慢？

GitHub Container Registry 使用全球 CDN，通常很快。如果慢：

1. 检查 EC2 网络配置
2. 考虑使用 AWS 区域镜像代理
3. 在 EC2 所在区域设置 Docker registry mirror

## 📊 对比 AWS ECR

| 特性 | GitHub Container Registry | AWS ECR |
|------|--------------------------|---------|
| **费用** | 免费（公开）| 每月 $0.10/GB 存储 |
| **认证** | GitHub Token | AWS 凭证/IAM |
| **配置** | 零配置 | 需要 IAM/OIDC |
| **集成** | GitHub Actions 原生 | 需要配置 |
| **访问** | 全球 CDN | AWS 区域 |
| **私有** | 免费 2GB | 收费 |

## 🎉 完成

现在你的部署流程完全不依赖 AWS 权限配置，只需：

1. 推送代码 → GitHub Actions 自动构建
2. 在 EC2 上运行 `./scripts/deploy/deploy-simple.sh`

就这么简单！

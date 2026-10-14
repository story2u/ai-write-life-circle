# Greenfield Adventures - 部署指南

**快速开始**：查看 [`deploy/README.md`](deploy/README.md)

## 🚀 快速部署流程

### 自动部署（推荐）

1. **推送代码到 GitHub**
   ```bash
   git push origin main
   ```

2. **GitHub Actions 自动构建镜像并推送到 AWS ECR**
   - 查看进度：GitHub 仓库 → Actions 标签

3. **在 EC2 上部署**
   ```bash
   ssh ubuntu@EC2_IP
   cd ~/greenfield-adventures
   ./deploy-simple.sh
   ```

## 📁 部署文件结构

所有部署相关文件已组织在 `deploy/` 目录下：

```
deploy/
├── Dockerfile.web           # Web 容器定义
├── docker-compose.yml       # 容器编排配置
├── deploy-simple.sh         # EC2 部署脚本（主要使用）
├── deploy-ec2.sh           # 完整部署脚本（备用）
├── upload-to-ec2.sh        # 文件上传脚本（备用）
└── README.md               # 详细部署指南
```

## 🏗 部署架构

```
GitHub Repository
       ↓
GitHub Actions (.github/workflows/build-and-push-ecr.yml)
       ↓
AWS ECR (public.ecr.aws/REGISTRY_ALIAS/greenfield-web)
       ↓
EC2 实例 (ubuntu@16.170.155.138)
       ↓
Docker Compose (deploy/docker-compose.yml)
       ↓
Web App (Port 3000) + PostgreSQL (Port 5432)
```

## 🔧 环境配置

### 前置需求

- GitHub 仓库配置了 AWS IAM 角色（OIDC）
- AWS ECR 公共仓库已创建
- EC2 实例已启动，SSH 可访问
- Docker 和 Docker Compose（deploy-simple.sh 会自动安装）

### AWS 配置步骤

1. **创建 IAM 角色** - 用于 GitHub Actions
2. **创建 ECR 仓库** - 用于存储镜像
3. **配置 GitHub Secrets** - `AWS_ROLE_TO_ASSUME`

详见 [`deploy/README.md`](deploy/README.md) 中的"自动部署"部分

## 📝 .env 文件

### 本地开发

```bash
cp .env.example .env
# 编辑 .env，设置本地开发参数
```

### 生产部署（EC2）

`deploy/deploy-simple.sh` 会自动生成 `.env`：

```bash
./deploy-simple.sh
```

## 🔐 安全最佳实践

本项目在 GitHub 开源，遵循以下安全实践：

1. **永不提交敏感信息**
   - `.env` 文件已在 `.gitignore` 中
   - 使用 AWS IAM 角色而非凭证
   - 不在代码中硬编码密钥

2. **强化密钥和凭证**
   - 数据库密码 ≥ 32 字符
   - 定期轮换密码
   - 使用 AWS Secrets Manager 存储敏感信息

3. **监控和审计**
   - 启用 CloudTrail 记录
   - 监控 CloudWatch 日志
   - 定期审查 GitHub Actions 日志

详见 [`SECURITY.md`](SECURITY.md)

## 📊 部署检查清单

部署前后，参考 [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)

## 🐛 故障排除

### GitHub Actions 构建失败

- 检查 IAM 角色权限
- 验证 ECR 仓库存在
- 查看 Actions 日志

### EC2 部署失败

```bash
docker-compose logs web
docker-compose logs postgres
```

### 镜像拉取错误

```bash
docker pull <IMAGE_URI>
```

## 🔄 持续部署工作流

```
Local Development
    ↓
git push origin main
    ↓
GitHub Actions (build-and-push-ecr.yml)
    ├─ Build Docker image
    ├─ Push to AWS ECR
    └─ Notification
    ↓
EC2 Deployment
    ├─ Pull image
    ├─ docker-compose up
    └─ Verify
```

## 📚 相关文档

- **详细部署指南**：[`deploy/README.md`](deploy/README.md)
- **安全指南**：[`SECURITY.md`](SECURITY.md)
- **部署检查清单**：[`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)
- **快速开始**：[`QUICK_START.md`](QUICK_START.md)

---

**项目**：Greenfield Adventures  
**版本**：0.2.0  
**最后更新**：2026-10-14

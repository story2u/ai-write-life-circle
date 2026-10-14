# 快速部署指南 - Greenfield Adventures

## 🚀 5 分钟快速部署

### 前置条件（一次性设置）

```bash
# 1. 创建 AWS IAM 角色，信任 GitHub OIDC
# 2. 创建 AWS ECR 仓库（greenfield-web）
# 3. 在 GitHub Secrets 添加 AWS_ROLE_TO_ASSUME
```

### 部署步骤（每次）

#### 第 1 步：推送代码

```bash
git add .
git commit -m "your message"
git push origin main
```

→ GitHub Actions 自动构建和推送镜像到 ECR（3-5 分钟）

#### 第 2 步：在 EC2 上部署

```bash
# 连接到 EC2
ssh ubuntu@16.170.155.138

# 首次：克隆项目
cd ~
git clone https://github.com/YOUR_REPO.git greenfield-adventures
cd greenfield-adventures

# 运行部署脚本
chmod +x deploy/deploy-simple.sh
./deploy/deploy-simple.sh
```

→ 脚本自动拉取镜像和启动容器（2-5 分钟）

#### 第 3 步：验证

打开浏览器访问：
```
http://16.170.155.138:3000
```

✅ 完成！

---

## 📁 关键文件

| 文件 | 用途 |
|------|------|
| `deploy/deploy-simple.sh` | EC2 部署脚本（主要） |
| `deploy/docker-compose.yml` | 容器编排 |
| `.github/workflows/build-and-push-ecr.yml` | 自动构建 |
| `.env.example` | 环境变量模板 |

---

## 🔧 常用命令

```bash
# SSH 连接
ssh ubuntu@16.170.155.138

# 进入项目
cd ~/greenfield-adventures

# 查看服务状态
docker-compose -f deploy/docker-compose.yml ps

# 查看日志
docker-compose -f deploy/docker-compose.yml logs -f

# 停止服务
docker-compose -f deploy/docker-compose.yml stop

# 启动服务
docker-compose -f deploy/docker-compose.yml start

# 查看环境变量
cat .env
```

---

## 🐛 故障排除

### 问题：镜像拉取失败

```bash
# 检查镜像 URI
cat .env | grep ECR_IMAGE

# 登录 ECR
aws ecr-public get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin public.ecr.aws
```

### 问题：端口被占用

```bash
# 编辑 .env，改变 WEB_PORT
nano .env

# 重启容器
docker-compose -f deploy/docker-compose.yml restart
```

### 问题：容器不启动

```bash
# 查看详细日志
docker-compose -f deploy/docker-compose.yml logs web
```

---

## 📚 完整文档

- **详细指南**：`README.md`
- **安全指南**：`../SECURITY.md`
- **检查清单**：`../DEPLOYMENT_CHECKLIST.md`

---

**版本**：0.2.0  
**最后更新**：2026-10-14

# 部署检查清单 - Greenfield Adventures

## 📋 部署前检查

### 本地环境准备

- [ ] 项目文件完整（包含所有源代码）
- [ ] Docker 部署文件已创建
  - [ ] `Dockerfile.web` 存在
  - [ ] `docker-compose.yml` 存在
  - [ ] `.env.example` 存在
  - [ ] `deploy-ec2.sh` 存在
  - [ ] `upload-to-ec2.sh` 存在
- [ ] 文件权限正确
  - [ ] `deploy-ec2.sh` 可执行（755）
  - [ ] `upload-to-ec2.sh` 可执行（755）

### AWS 环境准备

- [ ] EC2 实例运行中
  - [ ] 实例 ID：`i-01e820f4497e557ba`
  - [ ] 实例类型：`m7i-flex.large`
  - [ ] 状态：Running
  - [ ] 公网 IP：`16.170.155.138`
  - [ ] 区域：`eu-north-1`

- [ ] EC2 实例配置正确
  - [ ] 操作系统：Ubuntu 24.04 LTS 或 Amazon Linux 2
  - [ ] 存储：≥ 10GB
  - [ ] 内存：≥ 2GB
  - [ ] 安全组允许 SSH（端口 22）

- [ ] SSH 密钥可用
  - [ ] 密钥文件：`/Users/bruce/git/story/keys/aws.pem`
  - [ ] 密钥权限：600（`chmod 600 aws.pem`）

### 网络配置

- [ ] 安全组规则已配置
  - [ ] 入站规则：SSH (22) 允许
  - [ ] 入站规则：HTTP (80) 允许（可选，如使用反向代理）
  - [ ] 入站规则：自定义 (3000) 允许用于 Web 应用

---

## 🚀 部署过程

### 步骤 1：上传项目文件

执行时间：5-10 分钟

```bash
cd /Users/bruce/git/story/ai-write-life-circle
chmod +x upload-to-ec2.sh
./upload-to-ec2.sh 16.170.155.138
```

检查点：
- [ ] 文件上传成功（无错误输出）
- [ ] 远程目录：`/home/ubuntu/greenfield-adventures` 已创建
- [ ] 脚本文件权限正确

### 步骤 2：连接到 EC2 实例

选项 A（推荐）：EC2 Instance Connect
- [ ] 打开 AWS 控制台
- [ ] EC2 → 实例 → `i-01e820f4497e557ba`
- [ ] 点击"连接" → "EC2 Instance Connect"
- [ ] 浏览器终端已打开

选项 B：SSH 连接
```bash
ssh -i /Users/bruce/git/story/keys/aws.pem ubuntu@16.170.155.138
```
- [ ] SSH 连接成功

### 步骤 3：执行部署脚本

在 EC2 实例上执行：

```bash
cd ~/greenfield-adventures
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

执行时间：15-25 分钟（包括 Docker 镜像构建）

脚本检查点（依序）：
- [ ] Docker 已检查/安装
- [ ] Docker Compose 已检查/安装
- [ ] 项目目录已创建
- [ ] `.env` 文件已生成
  - [ ] 包含随机生成的 DB_PASSWORD（32 字符）
- [ ] Docker 镜像已构建
  - [ ] `Dockerfile.web` 成功编译
  - [ ] 多阶段构建完成
- [ ] 容器已启动
  - [ ] `web` 容器正在运行
  - [ ] `postgres` 容器正在运行
- [ ] 服务健康检查通过
  - [ ] PostgreSQL 可连接
  - [ ] Web 应用响应请求

脚本完成标志：
```
✓ Web 应用已启动: http://localhost:3000
✓ PostgreSQL 已启动
服务摘要
Web 应用:    http://localhost:3000
PostgreSQL: localhost:5432
数据库:     greenfield_adventures
```

---

## ✅ 部署后验证

### 验证容器状态

在 EC2 实例上执行：

```bash
docker-compose ps
```

- [ ] 输出显示：
  ```
  NAME           STATUS
  greenfield-web    Up (healthy)
  greenfield-postgres  Up (healthy)
  ```

### 验证 Web 应用

#### 本地测试

```bash
curl http://localhost:3000
```

- [ ] HTTP 200 响应
- [ ] 返回 HTML 内容

#### 从本地访问

打开浏览器：
```
http://16.170.155.138:3000
```

- [ ] 页面加载成功
- [ ] 显示 Writer Agent 工作台
- [ ] 浏览器控制台无错误
- [ ] 资源文件（CSS、JS）加载完成

### 验证数据库

在 EC2 实例上执行：

```bash
docker-compose exec postgres pg_isready -U postgres
```

- [ ] 输出：`accepting connections`

```bash
docker-compose exec postgres psql -U postgres -l
```

- [ ] 输出包含：`greenfield_adventures` 数据库

### 验证日志

检查是否有错误：

```bash
docker-compose logs --tail=50 | grep -i error
```

- [ ] 无错误日志（或仅有预期的日志）

### 验证网络连接

```bash
docker-compose exec web curl http://postgres:5432 2>&1 | head -1
```

- [ ] Web 容器可以访问 PostgreSQL（仅检查连接，非 HTTP）

---

## 📊 性能基准

预期部署时间：

| 步骤 | 时间 | 备注 |
|------|------|------|
| 文件上传 | 5-10 分钟 | 取决于网络速度 |
| Docker 安装 | 3-5 分钟 | 仅首次 |
| 镜像构建 | 10-15 分钟 | Node 依赖安装 + Vite 构建 |
| 容器启动 | 1-2 分钟 | PostgreSQL 初始化 |
| **总计** | **20-35 分钟** | |

资源使用预期：

| 资源 | 预期使用 | 备注 |
|------|---------|------|
| 磁盘空间 | 3-4 GB | Docker 镜像 + 数据 |
| RAM | 1-1.5 GB | 运行状态 |
| CPU | 低于 20% | 平时（构建时可达 100%） |

---

## 🔒 安全验证

### 凭证安全

- [ ] DB_PASSWORD 已生成（随机 32 字符）
- [ ] .env 文件权限限制（非 root 用户无法读取）
- [ ] 无密码硬编码在源代码中

### 网络安全

- [ ] PostgreSQL 未直接暴露于互联网
  - [ ] 端口 5432 仅在 Docker 网络内开放
  - [ ] 安全组未允许 5432 入站

- [ ] Web 应用受限制
  - [ ] 仅通过 3000 端口访问
  - [ ] 安全组规则已配置

- [ ] SSH 访问受限
  - [ ] 安全组允许 SSH (22) 仅从需要的 IP
  - [ ] 建议使用 Key Pair（已验证）

### 容器安全

- [ ] 使用官方镜像（Node、PostgreSQL）
- [ ] 定期更新镜像（Alpine 轻量级）
- [ ] 无明文密码在容器环境变量中暴露
  - [ ] .env 文件仅在主机上，不进入容器

---

## 🛠 故障排除验证

### 如果 Docker 安装失败

检查清单：
- [ ] 互联网连接正常
- [ ] EC2 实例有 IAM 权限
- [ ] 磁盘空间充足（至少 5GB）

```bash
# 手动安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 如果容器启动失败

检查清单：
- [ ] 查看详细日志：`docker-compose logs`
- [ ] 检查端口是否被占用：`lsof -i :3000`
- [ ] 检查磁盘空间：`df -h`
- [ ] 检查 RAM：`free -h`

### 如果 Web 应用无法访问

检查清单：
- [ ] 容器运行状态：`docker-compose ps`
- [ ] 防火墙规则：AWS 控制台安全组
- [ ] 本地测试：`curl http://localhost:3000`
- [ ] 日志错误：`docker-compose logs web`

### 如果数据库连接失败

检查清单：
- [ ] PostgreSQL 容器运行：`docker-compose ps`
- [ ] 数据库就绪：`docker-compose exec postgres pg_isready`
- [ ] 密码正确：`grep DB_PASSWORD .env`
- [ ] 网络连通：`docker-compose exec web ping postgres`

---

## 🔄 部署后操作

### 首次部署完成后

- [ ] 记录部署时间和任何问题
- [ ] 测试备份流程（可选）
- [ ] 记录管理员密码和其他凭证（保存在安全位置）
- [ ] 配置监控告警（可选）

### 定期维护

每周：
- [ ] 检查容器日志是否有错误
- [ ] 验证磁盘空间使用
- [ ] 检查更新（`docker-compose pull`）

每月：
- [ ] 创建数据库备份
- [ ] 更新 Docker 镜像
- [ ] 检查安全更新

---

## 📝 部署记录

### 部署信息

- **部署日期**：______________________
- **部署人员**：______________________
- **部署环境**：AWS EC2 (eu-north-1)
- **实例 ID**：i-01e820f4497e557ba
- **公网 IP**：16.170.155.138
- **应用 URL**：http://16.170.155.138:3000

### 部署结果

- [ ] 成功 ✓
- [ ] 成功，但有警告
- [ ] 失败

**备注**：
```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

### 访问凭证

| 项目 | 值 | 备注 |
|------|-----|------|
| DB_USER | postgres | 数据库用户 |
| DB_PASSWORD | [自动生成] | 已保存在 .env |
| DB_NAME | greenfield_adventures | 默认数据库 |
| DB_PORT | 5432 | PostgreSQL 端口 |

**重要**：将敏感信息存储在安全位置（如 AWS Secrets Manager）

---

## ✨ 部署完成确认

最终检查清单（全部打勾后部署完成）：

- [ ] 项目文件已上传到 EC2
- [ ] Docker 和 Docker Compose 已安装
- [ ] 所有容器正在运行
- [ ] Web 应用可以访问（http://16.170.155.138:3000）
- [ ] 数据库已就绪
- [ ] 无错误日志
- [ ] 安全组配置正确
- [ ] 凭证已妥善保管
- [ ] 部署记录已填写

---

**部署检查清单版本**：1.0  
**最后更新**：2026-10-14  
**项目**：Greenfield Adventures (ai-write-life-circle) v0.2.0

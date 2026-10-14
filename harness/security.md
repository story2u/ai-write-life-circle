# 安全配置指南

## ⚠️ 重要

本项目在 GitHub 上开源。本文档说明如何在部署时安全地处理敏感信息。

## 🔐 敏感信息清单

**绝对不要提交到 Git 的信息**：

- [ ] `.env` 文件（包含数据库密码）
- [ ] `.env.local` 或任何 `.env.*` 本地文件
- [ ] 私有密钥（`*.pem`、`*.key`）
- [ ] API 密钥和令牌
- [ ] 数据库凭证
- [ ] AWS 访问密钥 ID 和密钥
- [ ] 任何其他凭证或密钥

**安全处理方式**：

| 信息类型 | 示例 | 安全存储位置 |
|---------|------|-----------|
| 数据库密码 | `DB_PASSWORD` | `.env` (本地，已在 .gitignore) |
| API 密钥 | `OPENAI_API_KEY` | `.env` (本地，已在 .gitignore) |
| AWS 凭证 | `AWS_ACCESS_KEY_ID` | `~/.aws/config` (本地) |
| 私有密钥 | `aws.pem` | `~/.ssh/` 或安全存储 |

## 🛡️ 部署前检查清单

### 代码检查

部署前，验证没有提交敏感信息：

```bash
# 1. 检查 Git 历史中的密钥
git log -p | grep -i "password\|secret\|key\|token" | head

# 2. 检查暂存区中的敏感文件
git diff --cached | grep -i "password\|secret"

# 3. 验证 .env 文件未被跟踪
git ls-files | grep ".env"
# 应该仅显示 .env.example

# 4. 检查是否有意外的文件
git status --short
```

### 环境变量配置

**本地开发**：

```bash
# 1. 复制示例文件
cp .env.example .env

# 2. 编辑 .env，填入本地凭证
nano .env

# 3. 验证 .env 在 .gitignore 中
grep "\.env$" .gitignore
```

**生产部署（EC2）**：

在部署脚本中自动生成强密码：

```bash
# deploy-ec2.sh 会自动：
# 1. 生成随机密码
DB_PASSWORD=$(openssl rand -base64 32)

# 2. 写入 .env（仅在服务器上）
# 3. 设置文件权限（600）
chmod 600 .env
```

## 🔑 密码和密钥生成

### 生成强密码

```bash
# 方法 1：使用 openssl（32 字符 Base64）
openssl rand -base64 32

# 方法 2：使用 date 和 sha256
date +%s%N | sha256sum | head -c 32

# 方法 3：使用 pwgen（需要安装）
pwgen -s 32 1
```

### 生成 SSH 密钥

```bash
# 生成新的 EC2 密钥对
ssh-keygen -t ed25519 -f ~/.ssh/greenfield-adventures-key -N ""

# 设置正确的权限
chmod 600 ~/.ssh/greenfield-adventures-key
chmod 644 ~/.ssh/greenfield-adventures-key.pub
```

## 📝 部署时的环境变量注入

### 方法 1：使用 .env 文件（本地开发和部署脚本）

```bash
# 在 EC2 上创建 .env
cat > .env << EOF
DB_NAME=greenfield_adventures
DB_USER=postgres
DB_PASSWORD=$(openssl rand -base64 32)
DB_PORT=5432
WEB_PORT=3000
WRITER_AGENT_MODE=demo
NODE_ENV=production
EOF

# 限制权限
chmod 600 .env
```

### 方法 2：使用 Docker 密钥（推荐生产）

```bash
# 创建 Docker 密钥文件
echo "your_secure_password_here" | docker secret create db_password -

# 更新 docker-compose.yml
services:
  postgres:
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    external: true
```

### 方法 3：使用 AWS Secrets Manager（推荐生产）

```bash
# 存储密码
aws secretsmanager create-secret \
  --name greenfield/db-password \
  --secret-string "your_secure_password_here"

# 在应用中检索
aws secretsmanager get-secret-value \
  --secret-id greenfield/db-password
```

## 🚨 如果凭证被意外提交

### 紧急处理步骤

1. **立即停止**所有部署
2. **撤销提交**（如果未推送到 public）
   ```bash
   git reset --soft HEAD~1
   ```

3. **清理历史记录**（使用 git-filter-branch 或 BFG）
   ```bash
   # 安装 BFG
   brew install bfg
   
   # 移除敏感文件
   bfg --delete-files "{.env,*.pem,secrets.json}" --no-blob-protection
   ```

4. **循环所有凭证**
   - 更改数据库密码
   - 轮换 AWS 访问密钥
   - 重新生成 API 密钥
   - 更新 SSH 密钥

5. **通知团队**关于凭证泄露

## 🔍 扫描敏感信息的工具

### git-secrets（预防性检查）

```bash
# 安装
brew install git-secrets

# 配置
git secrets --install

# 添加模式
git secrets --add-provider -- cat ~/.gitsecrets
git secrets --add 'password\s*=\s*'
git secrets --add 'secret\s*=\s*'
git secrets --add 'token\s*=\s*'

# 检查
git secrets --scan
```

### truffleHog（扫描历史）

```bash
# 安装
pip install truffleHog

# 扫描整个仓库
truffleHog file /path/to/repo

# 扫描特定提交
truffleHog file /path/to/repo --since-commit abc123
```

### detect-secrets（IDE 集成）

```bash
# 安装
pip install detect-secrets

# 扫描
detect-secrets scan

# 审计结果
detect-secrets audit .secrets.baseline
```

## 📦 Docker 相关安全

### 容器中的敏感信息

❌ **不要做**：

```dockerfile
# 错误：在 Dockerfile 中硬编码密钥
ENV DB_PASSWORD=mysecretpassword

# 错误：在构建参数中传递密钥
docker build --build-arg DB_PASSWORD=secret .

# 错误：在容器环境中写入敏感文件
RUN echo "secret_key" > /app/config/secrets.txt
```

✅ **应该做**：

```dockerfile
# 正确：从运行时传递
docker run -e DB_PASSWORD="$(cat .env | grep DB_PASSWORD)" ...

# 正确：使用 Docker 密钥（Swarm 模式）
# 或 AWS Secrets Manager / HashiCorp Vault

# 正确：使用卷挂载敏感文件
docker run -v $PWD/.env:/app/.env:ro ...
```

### Docker 镜像安全扫描

```bash
# 使用 Trivy 扫描镜像
brew install trivy
trivy image node:22-alpine

# 扫描本地构建的镜像
trivy image greenfield-web:latest
```

## 🌐 网络安全

### AWS 安全组配置

```bash
# 创建最小权限安全组
# 入站规则：

# 1. SSH (22) - 仅从你的 IP
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 22 \
  --cidr YOUR_IP/32

# 2. HTTP (80) - 从任何地方（如果使用反向代理）
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 80 \
  --cidr 0.0.0.0/0

# 3. 应用 (3000) - 从需要的地方
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 3000 \
  --cidr 0.0.0.0/0  # 考虑限制这个

# 不要暴露数据库 (5432)
```

### HTTPS 和 SSL/TLS

```bash
# 使用 Let's Encrypt + Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 配置 Nginx 反向代理
# ...指向 localhost:3000，使用 SSL 证书
```

## 📊 审计和监控

### 审计日志

```bash
# 查看 Docker 操作日志
journalctl -u docker.service

# 查看 PostgreSQL 审计日志
docker-compose exec postgres psql -U postgres -c "SHOW log_connections;"

# 启用 PostgreSQL 审计
docker-compose exec postgres psql -U postgres -c "CREATE EXTENSION pgaudit;"
```

### 监控敏感操作

```bash
# 监控文件访问
sudo auditctl -w ~/.env -p wa -k env_changes

# 监控网络连接
netstat -tulpn | grep LISTEN
```

## 🔄 循环凭证

### 定期更新密码

**每季度**：

```bash
# 1. 生成新密码
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. 更新 .env（仅本地）
sed -i '' "s/DB_PASSWORD=.*/DB_PASSWORD=$NEW_PASSWORD/" .env

# 3. 更新数据库
docker-compose exec postgres psql -U postgres -c \
  "ALTER USER postgres WITH PASSWORD '$NEW_PASSWORD';"

# 4. 重启容器
docker-compose restart postgres
```

### 循环 AWS 凭证

```bash
# 1. 创建新的访问密钥
aws iam create-access-key --user-name $USERNAME

# 2. 更新 CLI 配置
aws configure --profile greenfield-adventures

# 3. 测试新密钥
aws sts get-caller-identity --profile greenfield-adventures

# 4. 删除旧密钥
aws iam delete-access-key --user-name $USERNAME --access-key-id $OLD_KEY_ID
```

## 📋 安全检查清单

部署前完成：

- [ ] `.env` 文件在 `.gitignore` 中
- [ ] 没有 `.env` 文件被提交到 Git
- [ ] 所有凭证都是占位符或自动生成
- [ ] 数据库密码是强密码（至少 32 字符）
- [ ] SSH 密钥权限正确（600）
- [ ] `.env.example` 不包含实际密钥
- [ ] 安全组规则遵循最小权限原则
- [ ] Docker 镜像已扫描敏感信息
- [ ] 审计日志已启用
- [ ] 定期备份计划已制定

## 🔗 安全资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS 安全最佳实践](https://aws.amazon.com/security/best-practices/)
- [Docker 安全](https://docs.docker.com/engine/security/)
- [PostgreSQL 安全](https://www.postgresql.org/docs/current/sql-syntax.html)
- [git-secrets](https://github.com/awslabs/git-secrets)
- [truffleHog](https://github.com/trufflesecurity/truffleHog)

---

**最后更新**：2026-10-14  
**版本**：1.0  
**项目**：Greenfield Adventures (开源)

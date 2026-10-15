# 自动部署 - GitHub Webhook

使用 GitHub Webhook 实现推送代码后自动部署到 EC2。

## 🎯 工作原理

```
┌──────────────┐
│ git push     │
│ origin main  │
└──────┬───────┘
       │
       ▼
┌────────────────────────────┐
│ GitHub Actions             │
│ - 构建 Docker 镜像          │
│ - 推送到 ghcr.io           │
└──────┬─────────────────────┘
       │
       │ 触发 Webhook
       ▼
┌────────────────────────────┐
│ EC2 Webhook 服务器          │
│ (Node.js + systemd)        │
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ 自动执行                    │
│ 1. docker-compose pull web │
│ 2. docker-compose up -d    │
│ 3. docker image prune -f   │
└────────────────────────────┘
```

## 📦 组件

1. **webhook-server.js** - Node.js Webhook 接收服务器
2. **webhook.service** - systemd 服务配置
3. **setup-webhook.sh** - 自动安装脚本

## 🚀 安装步骤

### 1. 在 EC2 上安装 Webhook 服务

```bash
# SSH 到 EC2
ssh ubuntu@16.170.155.138

# 进入项目目录
cd ~/greenfield-adventures

# 拉取最新代码
git pull origin main

# 运行安装脚本
chmod +x scripts/deploy/setup-webhook.sh
./scripts/deploy/setup-webhook.sh
```

脚本会自动：
- ✅ 安装 Node.js（如果未安装）
- ✅ 生成 Webhook Secret
- ✅ 配置 systemd 服务
- ✅ 启动 webhook 服务器
- ✅ 配置防火墙规则
- ✅ 输出 GitHub 配置信息

### 2. 在 GitHub 配置 Webhook

安装脚本完成后会输出配置信息，例如：

```
📋 下一步在 GitHub 配置 Webhook：

1️⃣  访问仓库设置：
   https://github.com/story2u/ai-write-life-circle/settings/hooks

2️⃣  点击 'Add webhook' 并填写：

   Payload URL:
   http://16.170.155.138:9000/webhook

   Content type:
   application/json

   Secret:
   a1b2c3d4e5f6... (64 位十六进制)

   Which events:
   ☑ Just the push event

   Active:
   ☑ Active

3️⃣  点击 'Add webhook'
```

### 3. 配置 EC2 安全组

确保 EC2 安全组允许入站流量：

```
Type: Custom TCP
Port: 9000
Source: GitHub Webhook IPs (或 0.0.0.0/0 用于测试)
Description: GitHub Webhook
```

**GitHub Webhook IP 范围**（可选，更安全）:
- 访问: https://api.github.com/meta
- 查看 `hooks` 字段中的 IP 范围

### 4. 测试 Webhook

推送代码到 main 分支：

```bash
# 本地修改
echo "test" >> README.md
git add README.md
git commit -m "test: trigger webhook"
git push origin main
```

查看 EC2 上的日志：

```bash
# 查看 webhook 日志
tail -f ~/greenfield-adventures/webhook.log

# 或查看 systemd 日志
sudo journalctl -u webhook -f
```

**成功的日志示例**：

```
[2026-10-15T00:00:00.000Z] 📨 Received GitHub event: push
[2026-10-15T00:00:00.001Z] 📍 Push to branch: main
[2026-10-15T00:00:00.002Z] 📝 1 commit(s) received
[2026-10-15T00:00:00.003Z]   - test: trigger webhook (abc1234)
[2026-10-15T00:00:00.004Z] 🚀 Starting deployment...
[2026-10-15T00:00:00.005Z] 📦 Pulling latest Docker image...
[2026-10-15T00:00:10.000Z] ♻️  Restarting services...
[2026-10-15T00:00:15.000Z] 🧹 Cleaning up old images...
[2026-10-15T00:00:20.000Z] ✅ Deployment completed successfully
```

## 🔧 管理命令

### 服务管理

```bash
# 查看服务状态
sudo systemctl status webhook

# 启动服务
sudo systemctl start webhook

# 停止服务
sudo systemctl stop webhook

# 重启服务
sudo systemctl restart webhook

# 开机自启
sudo systemctl enable webhook

# 禁用自启
sudo systemctl disable webhook
```

### 日志查看

```bash
# 查看实时日志
sudo journalctl -u webhook -f

# 查看最近 100 行
sudo journalctl -u webhook -n 100

# 查看 webhook 应用日志
tail -f ~/greenfield-adventures/webhook.log

# 清空日志
sudo journalctl --vacuum-time=1d
```

### 手动部署

如果需要手动触发部署：

```bash
cd ~/greenfield-adventures
docker-compose pull web
docker-compose up -d
docker image prune -f
```

## 🔐 安全配置

### 1. 使用 Nginx 反向代理（推荐）

安装 Nginx：

```bash
sudo apt update
sudo apt install -y nginx
```

创建配置文件 `/etc/nginx/sites-available/webhook`:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location /webhook {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhook/health {
        proxy_pass http://localhost:9000/health;
        access_log off;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/webhook /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

更新防火墙：

```bash
sudo ufw allow 80/tcp
sudo ufw delete allow 9000/tcp  # 关闭直接访问
```

### 2. 配置 HTTPS（推荐）

使用 Let's Encrypt：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 限制 GitHub IP

编辑 Nginx 配置添加 IP 白名单：

```nginx
location /webhook {
    # GitHub Webhook IPs
    allow 192.30.252.0/22;
    allow 185.199.108.0/22;
    allow 140.82.112.0/20;
    deny all;

    proxy_pass http://localhost:9000;
    ...
}
```

### 4. 定期轮换 Secret

```bash
# 生成新 secret
NEW_SECRET=$(openssl rand -hex 32)

# 更新 systemd 服务
sudo sed -i "s/WEBHOOK_SECRET=.*/WEBHOOK_SECRET=$NEW_SECRET/" \
  /etc/systemd/system/webhook.service

# 重启服务
sudo systemctl daemon-reload
sudo systemctl restart webhook

# 在 GitHub 更新 secret
echo "New Secret: $NEW_SECRET"
```

## ❗ 故障排查

### 问题 1: Webhook 服务无法启动

```bash
# 查看详细错误
sudo systemctl status webhook -l
sudo journalctl -u webhook -xe

# 检查端口占用
sudo netstat -tlnp | grep 9000
sudo lsof -i :9000

# 手动测试
cd ~/greenfield-adventures
node scripts/deploy/webhook-server.js
```

### 问题 2: GitHub 显示 "Unable to connect"

**检查清单**：
- [ ] EC2 安全组允许 9000 端口入站
- [ ] 防火墙允许 9000 端口
- [ ] webhook 服务正在运行
- [ ] URL 正确（http://IP:9000/webhook）

**测试连接**：

```bash
# 在本地测试
curl -X POST http://16.170.155.138:9000/webhook

# 在 EC2 上测试
curl -X POST http://localhost:9000/webhook
```

### 问题 3: Webhook 触发但部署失败

```bash
# 查看 webhook 日志
tail -n 50 ~/greenfield-adventures/webhook.log

# 检查 Docker
docker ps
docker-compose ps

# 手动测试部署
cd ~/greenfield-adventures
docker-compose pull web
docker-compose up -d
```

### 问题 4: Docker 权限错误

```bash
# 添加用户到 docker 组
sudo usermod -aG docker $USER

# 重新登录或运行
newgrp docker

# 测试权限
docker ps
```

### 问题 5: 镜像拉取失败

```bash
# 检查镜像是否公开
docker pull ghcr.io/story2u/ai-write-life-circle:latest

# 如果私有，需要登录
echo $GITHUB_TOKEN | docker login ghcr.io -u story2u --password-stdin
```

## 📊 监控和告警

### 设置健康检查

创建监控脚本 `scripts/deploy/monitor-webhook.sh`:

```bash
#!/bin/bash

WEBHOOK_URL="http://localhost:9000/health"

if ! curl -sf "$WEBHOOK_URL" > /dev/null; then
  echo "Webhook服务异常，正在重启..."
  sudo systemctl restart webhook
  # 可选：发送告警通知
fi
```

添加到 crontab：

```bash
# 每 5 分钟检查一次
crontab -e
*/5 * * * * /home/ubuntu/greenfield-adventures/scripts/deploy/monitor-webhook.sh
```

### 部署通知（可选）

修改 `webhook-server.js` 在部署完成后发送通知：

```javascript
// 添加在 deploy() 函数成功后
async function sendNotification(message) {
  // Slack Webhook
  await fetch('YOUR_SLACK_WEBHOOK_URL', {
    method: 'POST',
    body: JSON.stringify({ text: message })
  });
}

if (deploySuccess) {
  await sendNotification(`✅ 部署成功！Commit: ${commits[0].id.substring(0, 7)}`);
}
```

## 🎉 完成

现在你的部署流程完全自动化了：

1. ✅ 本地 `git push` → GitHub Actions 构建
2. ✅ GitHub Actions 推送镜像 → 触发 Webhook
3. ✅ EC2 自动拉取镜像并重启服务

无需手动干预！

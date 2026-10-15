#!/bin/bash

# 构建并部署 Greenfield Adventures 到 AWS EC2
# 在本地构建 Docker 镜像，然后部署到 EC2

set -e

echo "=========================================="
echo "Greenfield Adventures - 构建和部署脚本"
echo "=========================================="

EC2_IP=${1:-16.170.155.138}
EC2_USER=${2:-ubuntu}
EC2_KEY=${3:-/Users/bruce/git/story/keys/aws.pem}

echo "EC2 IP: $EC2_IP"
echo "EC2 用户: $EC2_USER"
echo ""

# 步骤 1：验证 Docker 安装
echo "[步骤 1] 检查本地 Docker 环境"
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi
echo "✓ Docker 已安装: $(docker --version)"

# 步骤 2：构建本地镜像
echo ""
echo "[步骤 2] 构建本地 Docker 镜像"
docker build -f Dockerfile.web -t greenfield-web:latest .
echo "✓ 镜像构建完成"

# 步骤 3：保存镜像为 tar 文件
echo ""
echo "[步骤 3] 导出 Docker 镜像"
docker save -o /tmp/greenfield-web.tar greenfield-web:latest
echo "✓ 镜像已导出: /tmp/greenfield-web.tar"

# 步骤 4：上传到 EC2
echo ""
echo "[步骤 4] 上传镜像到 EC2"
scp -i "$EC2_KEY" /tmp/greenfield-web.tar "$EC2_USER@$EC2_IP":~/greenfield-adventures/
echo "✓ 镜像已上传"

# 步骤 5：上传简化的启动脚本
echo ""
echo "[步骤 5] 上传启动脚本"

cat > /tmp/start-docker.sh << 'SCRIPT'
#!/bin/bash
set -e
cd ~/greenfield-adventures

echo "导入 Docker 镜像..."
docker load -i greenfield-web.tar

echo "启动容器..."
docker-compose up -d

echo "等待服务启动..."
sleep 10

echo "检查容器状态..."
docker-compose ps

echo ""
echo "=========================================="
echo "✓ 部署完成！"
echo "=========================================="
echo ""
echo "Web 应用: http://localhost:3000"
echo "查看日志: docker-compose logs -f"
echo ""
SCRIPT

scp -i "$EC2_KEY" /tmp/start-docker.sh "$EC2_USER@$EC2_IP":~/greenfield-adventures/
echo "✓ 启动脚本已上传"

# 步骤 6：在 EC2 上设置并启动
echo ""
echo "[步骤 6] 在 EC2 上启动容器"
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_IP" << 'EOF'
cd ~/greenfield-adventures

# 安装 Docker（如果未安装）
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker ubuntu
    rm get-docker.sh
    newgrp docker
fi

# 安装 Docker Compose（如果未安装）
if ! command -v docker-compose &> /dev/null; then
    echo "安装 Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 导入和启动
chmod +x start-docker.sh
./start-docker.sh
EOF

echo ""
echo "=========================================="
echo "✓ 所有步骤完成！"
echo "=========================================="
echo ""
echo "应用已部署到 EC2!"
echo "地址: http://$EC2_IP:3000"
echo ""
echo "常用命令："
echo "  查看日志:  docker-compose logs -f"
echo "  停止服务: docker-compose stop"
echo "  启动服务: docker-compose start"
echo ""

# 清理本地临时文件
rm /tmp/greenfield-web.tar /tmp/start-docker.sh
echo "✓ 本地临时文件已清理"

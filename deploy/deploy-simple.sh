#!/bin/bash

# Greenfield Adventures - 简化 EC2 部署脚本
# 镜像已在 GitHub Actions 中构建并推送到 AWS ECR
# 此脚本仅负责在 EC2 上拉取镜像和启动容器

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}[步骤]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[信息]${NC} $1"
}

# 配置
PROJECT_DIR="$HOME/greenfield-adventures"
AWS_REGION="eu-north-1"

echo "=========================================="
echo "Greenfield Adventures - EC2 部署"
echo "=========================================="

# 步骤 1: 检查 Docker
print_step "检查 Docker 安装"
if ! command -v docker &> /dev/null; then
    print_info "安装 Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_info "Docker 已安装，请重新登录或运行: newgrp docker"
    newgrp docker
fi
print_info "Docker 版本: $(docker --version)"

# 步骤 2: 检查 Docker Compose
print_step "检查 Docker Compose"
if ! command -v docker-compose &> /dev/null; then
    print_info "安装 Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi
print_info "Docker Compose 版本: $(docker-compose --version)"

# 步骤 3: 检查 AWS CLI
print_step "检查 AWS CLI"
if ! command -v aws &> /dev/null; then
    print_info "安装 AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi
print_info "AWS CLI 版本: $(aws --version)"

# 步骤 4: 创建项目目录
print_step "设置项目目录"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 步骤 5: 创建 .env 文件
print_step "配置环境变量"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    print_info "生成 .env 文件"
    DB_PASSWORD=$(openssl rand -base64 32)
    
    cat > .env << EOF
# PostgreSQL 配置
DB_NAME=greenfield_adventures
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
DB_PORT=5432

# Web 应用配置
WEB_PORT=3000

# Writer Agent 模式
WRITER_AGENT_MODE=demo

# AWS ECR 镜像
AWS_REGION=$AWS_REGION
ECR_REGISTRY_ALIAS=$REGISTRY_ALIAS

# 环境
NODE_ENV=production
EOF
    
    chmod 600 .env
    print_info ".env 文件已创建（权限: 600）"
    echo ""
    echo "⚠️  重要：数据库密码已生成"
    echo "请保存此密码到安全位置："
    echo "Password: $DB_PASSWORD"
    echo ""
    read -p "已确认？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "取消部署"
        exit 1
    fi
else
    print_info ".env 文件已存在"
fi

# 步骤 6: 登录 AWS ECR
print_step "配置 AWS ECR 访问"
print_info "登录 AWS ECR..."
aws ecr-public get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin public.ecr.aws 2>/dev/null || \
    print_info "ECR 登录已配置"

# 步骤 7: 启动容器
print_step "启动容器"
print_info "启动 docker-compose..."
docker-compose up -d

# 步骤 8: 等待服务启动
print_step "等待服务启动"
sleep 10

# 步骤 9: 检查服务状态
print_step "检查服务状态"
docker-compose ps

# 步骤 10: 验证服务
print_step "验证 Web 应用"
if curl -f --silent --connect-timeout 5 http://localhost:3000 > /dev/null; then
    print_info "✓ Web 应用已启动: http://localhost:3000"
else
    print_error "✗ Web 应用无法访问"
fi

print_step "验证 PostgreSQL"
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    print_info "✓ PostgreSQL 已启动"
else
    print_error "✗ PostgreSQL 无法连接"
fi

echo ""
echo "=========================================="
echo "✓ 部署完成！"
echo "=========================================="
echo ""
echo "服务信息："
echo "  Web 应用:  http://localhost:3000"
echo "  PostgreSQL: localhost:5432"
echo "  数据库:    greenfield_adventures"
echo ""
echo "常用命令："
echo "  查看日志:   docker-compose logs -f"
echo "  查看状态:   docker-compose ps"
echo "  停止服务:   docker-compose stop"
echo "  启动服务:   docker-compose start"
echo "  重启服务:   docker-compose restart"
echo ""
echo "安全提示："
echo "  - .env 文件包含敏感凭证（权限: 600）"
echo "  - 不要提交 .env 文件到 Git"
echo "  - 定期更新数据库密码"
echo ""

#!/usr/bin/env node

/**
 * GitHub Webhook 服务器
 * 监听 GitHub push 事件，自动拉取最新镜像并重启服务
 */

const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || '';
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();
const LOG_FILE = path.join(PROJECT_DIR, 'webhook.log');

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// 验证 GitHub 签名
function verifySignature(payload, signature) {
  if (!SECRET) {
    log('⚠️  Warning: WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }

  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// 执行部署
function deploy() {
  log('🚀 Starting deployment...');
  
  try {
    // 1. 拉取最新镜像
    log('📦 Pulling latest Docker image...');
    execSync('docker-compose pull web', {
      cwd: PROJECT_DIR,
      stdio: 'inherit'
    });
    
    // 2. 重启服务
    log('♻️  Restarting services...');
    execSync('docker-compose up -d', {
      cwd: PROJECT_DIR,
      stdio: 'inherit'
    });
    
    // 3. 清理旧镜像
    log('🧹 Cleaning up old images...');
    execSync('docker image prune -f', {
      stdio: 'inherit'
    });
    
    log('✅ Deployment completed successfully');
    return true;
  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`);
    return false;
  }
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // 验证签名
        const signature = req.headers['x-hub-signature-256'];
        if (!verifySignature(body, signature)) {
          log('❌ Invalid signature');
          res.writeHead(401);
          res.end('Invalid signature');
          return;
        }
        
        // 解析 payload
        const payload = JSON.parse(body);
        const event = req.headers['x-github-event'];
        
        log(`📨 Received GitHub event: ${event}`);
        
        // 只处理 push 事件
        if (event === 'push') {
          const ref = payload.ref;
          const branch = ref.split('/').pop();
          
          log(`📍 Push to branch: ${branch}`);
          
          // 只部署 main 分支
          if (branch === 'main') {
            const commits = payload.commits || [];
            log(`📝 ${commits.length} commit(s) received`);
            
            commits.forEach(commit => {
              log(`  - ${commit.message.split('\n')[0]} (${commit.id.substring(0, 7)})`);
            });
            
            // 执行部署
            const success = deploy();
            
            res.writeHead(success ? 200 : 500);
            res.end(JSON.stringify({ 
              status: success ? 'success' : 'failed',
              message: success ? 'Deployment completed' : 'Deployment failed'
            }));
          } else {
            log(`⏭️  Skipping deployment for branch: ${branch}`);
            res.writeHead(200);
            res.end(JSON.stringify({ 
              status: 'skipped',
              message: `Branch ${branch} is not configured for auto-deployment`
            }));
          }
        } else if (event === 'ping') {
          log('🏓 Ping received');
          res.writeHead(200);
          res.end(JSON.stringify({ 
            status: 'ok',
            message: 'Webhook server is running'
          }));
        } else {
          log(`⏭️  Ignoring event: ${event}`);
          res.writeHead(200);
          res.end(JSON.stringify({ 
            status: 'ignored',
            message: `Event ${event} is not handled`
          }));
        }
      } catch (error) {
        log(`❌ Error processing webhook: ${error.message}`);
        res.writeHead(500);
        res.end(JSON.stringify({ 
          status: 'error',
          message: error.message
        }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    // 健康检查端点
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  log(`🚀 Webhook server listening on port ${PORT}`);
  log(`📁 Project directory: ${PROJECT_DIR}`);
  log(`🔐 Secret ${SECRET ? 'configured' : 'NOT configured (insecure!)'}`);
  log(`📝 Logging to: ${LOG_FILE}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  log('📴 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('📴 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    log('✅ Server closed');
    process.exit(0);
  });
});

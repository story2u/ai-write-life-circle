import { spawn } from 'node:child_process'

const projectId = process.env.VITE_WRITER_AGENT_PROJECT_ID?.trim() || process.env.WRITER_AGENT_PROJECT_ID?.trim() || 'local'
const apiPort = process.env.WRITER_AGENT_API_PORT || '8787'
const apiTarget = `http://127.0.0.1:${apiPort}`
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const api = spawn(pnpm, ['--filter', '@writer-agent/api', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', WRITER_AGENT_PROJECT_ID: projectId, WRITER_AGENT_API_PORT: apiPort },
})
const web = spawn(pnpm, ['--filter', '@writer-agent/web', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_WRITER_AGENT_MODE: 'api',
    VITE_WRITER_AGENT_PROJECT_ID: projectId,
    WRITER_AGENT_API_TARGET: apiTarget,
  },
})

let stopping = false
function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  api.kill(signal)
  web.kill(signal)
}

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))
api.once('exit', (code) => {
  if (!stopping) {
    process.stderr.write(`API 服务退出 (${code ?? 'signal'})；正在关闭 Web 服务。\n`)
    stop()
    process.exitCode = code ?? 1
  }
})
web.once('exit', (code) => {
  if (!stopping) {
    process.stderr.write(`Web 服务退出 (${code ?? 'signal'})；正在关闭 API 服务。\n`)
    stop()
    process.exitCode = code ?? 1
  }
})

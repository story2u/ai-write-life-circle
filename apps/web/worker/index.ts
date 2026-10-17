import { handlePublicSite } from './public'
import { publicationRoute } from './publication-route'
import { authConfigured, authorAllowed, createAuth, type Env } from './auth'

function problem(status: number, code: string, detail: string) {
  return Response.json({ type: 'about:blank', title: detail, status, code, detail }, {
    status, headers: { 'cache-control': 'no-store', 'content-type': 'application/problem+json' },
  })
}

function allowedRoute(path: string, method: string, project: string) {
  if(publicationRoute(path,method,project))return true
  const base = `/v1/projects/${encodeURIComponent(project)}`
  if (!path.startsWith(base + '/')) return false
  const suffix = path.slice(base.length)
  const id = '[^/%\\\\]+'
  const routes: [string, string[]][] = [
    ['/workspace', ['GET', 'PATCH']], ['/chapters', ['GET']], ['/notes', ['GET', 'POST']],
    [`/notes/${id}`, ['PATCH']], [`/chapters/${id}`, ['GET']],
    [`/chapters/${id}/revisions`, ['GET', 'POST']],
    [`/chapters/${id}/revisions/${id}`, ['GET']],
    [`/chapters/${id}/review-preview`, ['POST']], [`/chapters/${id}/reviews`, ['GET', 'POST']],
    [`/reviews/${id}`, ['GET']], [`/reviews/${id}/cancel`, ['POST']],
    [`/reviews/${id}/findings/${id}/feedback`, ['POST']],
  ]
  // Decode once, rejecting encoded separators and dot segments rather than forwarding ambiguous paths.
  let decoded: string
  try { decoded = decodeURIComponent(suffix) } catch { return false }
  if (decoded.includes('\\') || decoded.includes('%') || decoded.split('/').some(part => part === '.' || part === '..')) return false
  if (suffix.split('/').length !== decoded.split('/').length) return false
  return routes.some(([pattern, methods]) => methods.includes(method) && new RegExp(`^${pattern}$`).test(decoded))
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (env.BETTER_AUTH_URL && url.origin !== new URL(env.BETTER_AUTH_URL).origin) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return problem(403, 'ORIGIN_FORBIDDEN', '请使用正式作品入口。')
    const canonical = new URL(env.BETTER_AUTH_URL)
    canonical.pathname = url.pathname
    canonical.search = url.search
    return Response.redirect(canonical.href, 308)
  }
  const publicResponse=await handlePublicSite(request,{...env,ASSETS:{fetch:(assetRequest:Request)=>env.ASSETS.fetch(assetRequest as never) as unknown as Promise<Response>},WRITER_AGENT_API_ORIGIN:env.WRITER_AGENT_API_ORIGIN||'https://api.story2u.xyz'})
  if(publicResponse)return publicResponse
  const privateRoute = url.pathname === '/api/session' || url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/v1/')
  if (!privateRoute) {
    const response=await (env.ASSETS.fetch(request as never) as unknown as Promise<Response>)
    if(url.pathname.startsWith('/studio')){const headers=new Headers(response.headers);headers.set('x-robots-tag','noindex,nofollow');headers.set('cache-control','no-store');return new Response(response.body,{status:response.status,headers})}
    return response
  }
  if (!authConfigured(env)) return problem(503, 'AUTH_NOT_CONFIGURED', '登录服务尚未配置完成。')
  if (url.origin !== new URL(env.BETTER_AUTH_URL).origin) return problem(403, 'ORIGIN_FORBIDDEN', '请使用正式作品入口。')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return problem(403, 'ORIGIN_FORBIDDEN', '此请求不是来自作品入口。')
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return problem(415, 'JSON_REQUIRED', '请求须使用 JSON。')
    }
  }
  const auth = createAuth(env)
  if (url.pathname.startsWith('/api/auth/')) {
    const routes: Record<string, string> = {
      '/api/auth/sign-in/social': 'POST', '/api/auth/callback/google': 'GET',
      '/api/auth/google/callback': 'GET',
      '/api/auth/get-session': 'GET', '/api/auth/sign-out': 'POST', '/api/auth/error': 'GET',
    }
    if (routes[url.pathname] !== request.method) return problem(404, 'NOT_FOUND', '接口不存在。')
    if (url.pathname === '/api/auth/sign-in/social') {
      const reader = request.body?.getReader()
      if (!reader) return problem(400, 'INVALID_LOGIN', '登录请求无效。')
      const chunks: Uint8Array[] = []
      let length = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > 16_384) { void reader.cancel(); return problem(413, 'LOGIN_TOO_LARGE', '登录请求过大。') }
        chunks.push(value)
      }
      const bytes = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      let body: Record<string, unknown>
      try { body = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown> }
      catch { return problem(400, 'INVALID_LOGIN', '登录请求无效。') }
      if (!body || body.provider !== 'google' || body.idToken) return problem(400, 'INVALID_LOGIN', '请使用 Google 授权登录。')
      for (const key of ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL']) {
        if (body[key] !== undefined && (typeof body[key] !== 'string' || new URL(body[key], url.origin).origin !== url.origin)) {
          return problem(403, 'RETURN_URL_FORBIDDEN', '登录后仅能返回作品入口。')
        }
      }
      // Only the redirect flow is exposed; client input cannot override scopes or Google parameters.
      const requested=typeof body.callbackURL==='string'?new URL(body.callbackURL,url.origin).pathname:'/'
      const callbackURL=['/','/studio','/studio/publish'].includes(requested)?requested:'/'
      const safeBody = { provider: 'google', callbackURL, errorCallbackURL: callbackURL+'?login=failed' }
      request = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(safeBody) })
    }
    if (url.pathname === '/api/auth/google/callback') {
      // Preserve query/state cookies; Google code exchange uses the configured public redirectURI.
      const internal = new URL('/api/auth/callback/google' + url.search, url.origin)
      request = new Request(internal, { method: 'GET', headers: request.headers })
    }
    const response = await auth.handler(request)
    const headers = new Headers(response.headers)
    headers.set('cache-control', 'no-store')
    return new Response(response.body, { status: response.status, headers })
  }
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true, disableRefresh: true } })
  if (!session) return problem(401, 'SESSION_REQUIRED', '请先使用 Google 登录。')
  // Recheck on every request: changing the allowlist revokes project access immediately.
  if (!authorAllowed(session.user, env)) return problem(403, 'AUTHOR_FORBIDDEN', '此 Google 账号没有作品访问权限。')
  if (url.pathname === '/api/session') {
    if (request.method !== 'GET') return problem(405, 'METHOD_NOT_ALLOWED', '请求方法不支持。')
    return Response.json({ user: { name: session.user.name, email: session.user.email }, projectId: env.WRITER_AGENT_PROJECT_ID || 'local' }, { headers: { 'cache-control': 'no-store' } })
  }
  if (!allowedRoute(url.pathname, request.method, env.WRITER_AGENT_PROJECT_ID || 'local')) return problem(404, 'NOT_FOUND', '接口不存在。')
  if (!env.WRITER_AGENT_API_TOKEN) return problem(503, 'API_NOT_CONFIGURED', '作品服务尚未连接。')
  const target = new URL(env.WRITER_AGENT_API_ORIGIN || 'https://api.story2u.xyz')
  if (target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    return problem(503, 'API_NOT_CONFIGURED', '作品服务地址无效。')
  }
  target.pathname = url.pathname
  target.search = url.search
  const headers = new Headers({ accept: 'application/json, application/problem+json', authorization: `Bearer ${env.WRITER_AGENT_API_TOKEN}` })
  for (const name of ['content-type', 'idempotency-key']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  try {
    const upstream = await fetch(target, { method: request.method, headers, body: request.body, redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    if ((upstream.status >= 300 && upstream.status < 400) || upstream.status === 401 || upstream.status === 403) {
      await upstream.body?.cancel()
      return problem(502, 'API_CONNECTION_FAILED', '作品服务连接失败，请稍后重试。')
    }
    const outgoing = new Headers({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
    for (const name of ['content-type', 'x-request-id']) {
      const value = upstream.headers.get(name)
      if (value) outgoing.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing })
  } catch {
    return problem(502, 'API_CONNECTION_FAILED', '作品服务暂时无法连接，请保留草稿后重试。')
  }
}

export default {
  async fetch(request: Request, env: Env) {
    try { return await handleRequest(request, env) }
    catch { return problem(503, 'AUTH_UNAVAILABLE', '登录服务暂时不可用，请稍后重试。') }
  },
}

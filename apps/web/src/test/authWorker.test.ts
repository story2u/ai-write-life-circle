// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSignature } from 'better-auth/crypto'
import { authorAllowed, createAuth, type Env } from '../../worker/auth'
import worker, { handleRequest } from '../../worker/index'

const origin = 'https://writer.example'
let db: DatabaseSync
let env: Env
let cookie: string
let sessionToken: string

async function signIn(email = 'author@example.com', verified = true, expires = Date.now() + 3600_000) {
  const auth = createAuth(env)
  await auth.options.user.validateUserInfo({ user: { name: 'Author', email, emailVerified: verified }, source: { action: 'create-user', method: 'oauth', oauth: { providerId: 'google' } } })
  const userId = crypto.randomUUID()
  const token = crypto.randomUUID()
  const now = Date.now()
  db.prepare('INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(userId, 'Author', email, verified ? 1 : 0, now, now)
  db.prepare('INSERT INTO session (id,token,userId,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(), token, userId, expires, now, now)
  sessionToken = token
  cookie = `__Secure-better-auth.session_token=${encodeURIComponent(token + '.' + await makeSignature(token, env.BETTER_AUTH_SECRET))}`
}

function request(path: string, method = 'GET', body?: string, headers: Record<string, string> = {}) {
  return new Request(origin + path, { method, headers: { cookie, ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}), ...headers }, body })
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../../migrations/0001_better_auth.sql', import.meta.url), 'utf8'))
  env = {
    AUTH_DB: db as unknown as Env['AUTH_DB'],
    ASSETS: { fetch: vi.fn(async () => new Response('static')) } as unknown as Env['ASSETS'],
    BETTER_AUTH_SECRET: 'fixture-only-secret-with-more-than-32-characters', BETTER_AUTH_URL: origin,
    GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
    WRITER_AGENT_AUTHOR_EMAILS: 'author@example.com,second@example.com',
    WRITER_AGENT_API_TOKEN: 'fixture-backend-bearer', WRITER_AGENT_API_ORIGIN: 'https://api.example', WRITER_AGENT_PROJECT_ID: 'local',
  }
  cookie = ''
})
afterEach(() => { vi.unstubAllGlobals(); db.close() })

describe('Better Auth sessions and single-project authorization', () => {
  it('fails closed without configuration and never proxies an anonymous request', async () => {
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream)
    expect((await handleRequest(request('/v1/projects/local/workspace'), { ...env, BETTER_AUTH_SECRET: '' })).status).toBe(503)
    expect((await handleRequest(request('/v1/projects/local/workspace'), env)).status).toBe(401)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('allows both verified authors and blocks others, including unverified matching emails', async () => {
    expect(authorAllowed({ email: 'SECOND@example.com', emailVerified: true }, env)).toBe(true)
    for (const [email, verified] of [['stranger@example.com', true], ['author@example.com', false]] as const) {
      await expect(signIn(email, verified)).rejects.toThrow()
    }
    expect(db.prepare('SELECT COUNT(*) AS count FROM user').get()?.count).toBe(0)
    await signIn('second@example.com')
    expect((await handleRequest(request('/api/session'), env)).status).toBe(200)
    // Returning OAuth accounts must also pass the fresh provider profile, not just a stored email.
    await expect(createAuth(env).options.user.validateUserInfo({ user: { email: 'stranger@example.com', emailVerified: true }, source: { action: 'sign-in', method: 'oauth', oauth: { providerId: 'google' } } })).rejects.toThrow()
  })
  it('checks a real signed database session, omits tokens, and rejects forged, expired and revoked sessions', async () => {
    await signIn()
    const response = await handleRequest(request('/api/session'), env)
    expect(await response.json()).toEqual({ user: { name: 'Author', email: 'author@example.com' }, projectId: 'local' })
    cookie += 'forged'
    expect((await handleRequest(request('/api/session'), env)).status).toBe(401)
    cookie = `__Secure-better-auth.session_token=${encodeURIComponent(sessionToken + '.' + await makeSignature(sessionToken, env.BETTER_AUTH_SECRET))}`
    db.prepare('UPDATE session SET expiresAt = ?').run(Date.now() - 1000)
    expect((await handleRequest(request('/api/session'), env)).status).toBe(401)
  })
  it('revokes a real session on sign-out, and immediately enforces allowlist changes', async () => {
    await signIn()
    env.WRITER_AGENT_AUTHOR_EMAILS = 'second@example.com'
    expect((await handleRequest(request('/v1/projects/local/workspace'), env)).status).toBe(403)
    env.WRITER_AGENT_AUTHOR_EMAILS = 'author@example.com'
    const response = await handleRequest(request('/api/auth/sign-out', 'POST', '{}'), env)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect((await handleRequest(request('/api/session'), env)).status).toBe(401)
  })
  it('starts Google OAuth with a fixed callback, state cookie, and rejects unsolicited callbacks', async () => {
    const response = await handleRequest(request('/api/auth/sign-in/social', 'POST', JSON.stringify({ provider: 'google', callbackURL: '/' })), env)
    expect(response.status).toBe(200)
    const body = await response.json() as { url: string }
    const target = new URL(body.url)
    expect(target.origin).toBe('https://accounts.google.com')
    expect(target.searchParams.get('redirect_uri')).toBe(origin + '/api/auth/google/callback')
    expect(target.searchParams.get('state')).toBeTruthy()
    expect(target.searchParams.get('code_challenge')).toBeTruthy()
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(response.headers.get('set-cookie')).toMatch(/Secure/i)
    const callback = await handleRequest(request('/api/auth/google/callback?code=unsolicited&state=invalid'), env)
    expect(callback.status).toBe(302)
    expect(callback.headers.get('location')).toContain('error=')
    expect(db.prepare('SELECT COUNT(*) AS count FROM session').get()?.count).toBe(0)
    // The code exchange must use the same custom URI even after routing through Better Auth's internal callback.
    const exchange = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new URLSearchParams(init?.body as string).get('redirect_uri')).toBe(origin + '/api/auth/google/callback')
      return Response.json({ access_token: 'fixture-access-token', token_type: 'Bearer', expires_in: 3600 })
    })
    vi.stubGlobal('fetch', exchange)
    const context = await createAuth(env).$context
    const provider = context.socialProviders.find(item => item.id === 'google')!
    await provider.validateAuthorizationCode({ code: 'fixture-code', codeVerifier: 'fixture-verifier', redirectURI: origin + '/api/auth/callback/google' })
    expect(exchange).toHaveBeenCalledTimes(1)
  })
  it('rejects external OAuth return URLs and cross-site mutations before processing them', async () => {
    expect((await handleRequest(request('/api/auth/sign-in/social', 'POST', '{"provider":"google","callbackURL":"https://evil.example"}'), env)).status).toBe(403)
    await signIn()
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream)
    expect((await handleRequest(request('/v1/projects/local/notes', 'POST', '{}', { origin: 'https://evil.example' }), env)).status).toBe(403)
    expect((await handleRequest(request('/v1/projects/local/notes', 'POST', '{}', { 'content-type': 'text/plain' }), env)).status).toBe(415)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('forwards only approved routes and headers; preserves CAS conflicts and idempotency', async () => {
    await signIn()
    const upstream = vi.fn(async () => new Response('{"code":"REVISION_CONFLICT"}', { status: 409, headers: { 'content-type': 'application/problem+json', 'set-cookie': 'backend-secret=bad', 'access-control-allow-origin': '*' } }))
    vi.stubGlobal('fetch', upstream)
    const response = await handleRequest(request('/v1/projects/local/chapters/CH-001/revisions', 'POST', '{}', { 'Idempotency-Key': 'retry-key', authorization: 'Bearer attacker', 'x-actor-id': 'attacker' }), env)
    expect(response.status).toBe(409)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(response.headers.has('access-control-allow-origin')).toBe(false)
    const [target, options] = upstream.mock.calls[0] as unknown as [URL, RequestInit]
    expect(target.href).toBe('https://api.example/v1/projects/local/chapters/CH-001/revisions')
    const headers = new Headers(options.headers)
    expect(headers.get('authorization')).toBe('Bearer fixture-backend-bearer')
    expect(headers.get('idempotency-key')).toBe('retry-key')
    expect(headers.has('cookie')).toBe(false)
    expect(headers.has('x-actor-id')).toBe(false)
    for (const path of ['/v1/projects/other/workspace', '/v1/projects/local/chapters/a%2fb', '/v1/projects/local/chapters/a%252fb', '/v1/projects/local/internal']) {
      expect((await handleRequest(request(path), env)).status).toBe(404)
    }
    expect(upstream).toHaveBeenCalledTimes(1)
  })
  it('never follows backend redirects or exposes network errors, and leaves assets accessible', async () => {
    await signIn()
    const upstream = vi.fn(async () => new Response(null, { status: 307, headers: { location: 'https://evil.example' } }))
    vi.stubGlobal('fetch', upstream)
    expect((await worker.fetch(request('/v1/projects/local/workspace'), env)).status).toBe(502)
    upstream.mockRejectedValueOnce(new Error('private backend details'))
    const response = await worker.fetch(request('/v1/projects/local/workspace'), env)
    expect(await response.text()).not.toContain('private backend details')
    expect(await (await worker.fetch(request('/'), env)).text()).toBe('static')
    const legacy = await worker.fetch(new Request('https://legacy.example/?from=bookmark'), env)
    expect(legacy.status).toBe(308)
    expect(legacy.headers.get('location')).toBe(origin + '/?from=bookmark')
    const externalPath = await worker.fetch(new Request('https://legacy.example//evil.example/'), env)
    expect(new URL(externalPath.headers.get('location')!).origin).toBe(origin)
  })
})

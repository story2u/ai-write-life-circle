// Compose BEFORE the existing PR #11 auth handler. Returning null delegates to
// that handler; it never creates another identity or proxies private endpoints.
import {
  publicHomeSchema,
  publicCatalogSchema,
  publicBookSchema,
  publicChapterSchema,
  publicAuthorSchema,
  publicCategoriesSchema,
} from '@writer-agent/contracts'
import { publicPath } from '../src/site/api'
import { renderPublic } from '../src/site/server'
export type PublicEnv = {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  WRITER_AGENT_API_ORIGIN: string
  BETTER_AUTH_URL: string
}
export async function handlePublicSite(
  request: Request,
  env: PublicEnv,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  if (!publicPath(url.pathname) && !url.pathname.startsWith('/v1/public/') && url.pathname !== '/sitemap.xml' && url.pathname !== '/robots.txt' && !/^\/og\/books\/[a-z0-9-]+\.svg$/.test(url.pathname)) return null
  let site: URL, apiOrigin: URL
  try {
    site = new URL(env.BETTER_AUTH_URL)
    apiOrigin = new URL(env.WRITER_AGENT_API_ORIGIN)
    if (
      site.protocol !== 'https:' ||
      apiOrigin.protocol !== 'https:' ||
      apiOrigin.username ||
      apiOrigin.password ||
      apiOrigin.pathname !== '/' ||
      apiOrigin.search ||
      apiOrigin.hash
    )
      throw Error()
  } catch {
    return new Response('Site configuration unavailable', {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    })
  }
  if (url.origin !== site.origin) return null // existing canonical auth middleware owns this
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  if (url.pathname.startsWith('/studio')) return null
  const path = url.pathname
  const schema =
    path === '/v1/public/home'
      ? publicHomeSchema
      : path === '/v1/public/books'
        ? publicCatalogSchema
        : path === '/v1/public/categories'
          ? publicCategoriesSchema
          : /^\/v1\/public\/books\/[a-z0-9-]+\/chapters\/[a-z0-9-]+$/.test(path)
            ? publicChapterSchema
            : /^\/v1\/public\/books\/[a-z0-9-]+$/.test(path)
              ? publicBookSchema
              : /^\/v1\/public\/authors\/[a-z0-9-]+$/.test(path)
                ? publicAuthorSchema
                : null
  if (schema) {
    try {
      const api = new URL(env.WRITER_AGENT_API_ORIGIN)
      if (
        api.protocol !== 'https:' ||
        api.username ||
        api.password ||
        api.pathname !== '/' ||
        api.search ||
        api.hash
      )
        throw Error()
      api.pathname = path
      api.search = url.search
      const upstream = await fetch(api, {
        headers: { accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      })
      if (upstream.status === 404)
        return Response.json(
          {
            type: 'about:blank',
            title: 'NOT_FOUND',
            code: 'NOT_FOUND',
            status: 404,
            detail: 'Public content not found.',
          },
          { status: 404, headers: { 'cache-control': 'no-store' } },
        )
      if (!upstream.ok) throw Error()
      const body = schema.parse(await upstream.json())
      return new Response(
        request.method === 'HEAD' ? null : JSON.stringify(body),
        {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        },
      )
    } catch {
      return Response.json(
        {
          type: 'about:blank',
          title: 'PUBLIC_SERVICE_UNAVAILABLE',
          code: 'PUBLIC_SERVICE_UNAVAILABLE',
          status: 503,
          detail: 'Public content is temporarily unavailable.',
        },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      )
    }
  }

  if (
    !publicPath(path) &&
    path !== '/sitemap.xml' &&
    path !== '/robots.txt' &&
    !/^\/og\/books\/[a-z0-9-]+\.svg$/.test(path)
  )
    return null
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url)))
  if (!shell.ok)
    return new Response('Site unavailable', {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    })
  const response = await renderPublic(
    url,
    env.WRITER_AGENT_API_ORIGIN,
    site.origin,
    await shell.text(),
  )
  return response && request.method === 'HEAD'
    ? new Response(null, response)
    : response
}

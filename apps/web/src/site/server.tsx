import { renderToString } from 'react-dom/server'
import { staticPages } from './Book'
import { PublicSite } from './Root'
import { loadSite, publicPath } from './api'
import { allChapters } from './data'
import type { SiteData } from './context'
import { publicCatalogSchema } from '@writer-agent/contracts'
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )
const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
export function pageMeta(data: SiteData, siteOrigin: string) {
  const b = data.books[0],
    parts = data.path.split('/'),
    chapter =
      b && parts[3] === 'chapters'
        ? allChapters(b).find((c) => c.slug === parts[4])
        : undefined,
    author = data.authors[0]
  const title = data.error
    ? `${data.error} · story2u`
    : chapter
      ? `第 ${chapter.no} 章 ${chapter.title} · 《${b.title}》 · story2u`
      : parts[1] === 'books' && b
        ? `《${b.title}》· ${b.penName} · story2u`
        : parts[1] === 'authors' && author
          ? `${author.name} · story2u`
          : parts[1] === 'discover'
            ? '发现作品 · story2u'
            : staticPages[data.path.slice(1)]
              ? `${staticPages[data.path.slice(1)][0]} · story2u`
              : 'story2u · 原创小说'
  const description = chapter
    ? (chapter.markdown ?? '').replace(/[#*_>`]/g, '').slice(0, 80)
    : (b?.hook ??
      author?.bio ??
      'Writer Agent 帮助作者创造故事，story2u 帮助故事遇见读者。')
  const canonical = new URL(data.path, siteOrigin).href
  const structured = chapter
    ? {
        '@context': 'https://schema.org',
        '@type': 'Chapter',
        name: chapter.title,
        datePublished: new Date(chapter.publishedAt).toISOString(),
        url: canonical,
        isPartOf: {
          '@type': 'Book',
          name: b.title,
          url: new URL(`/books/${b.slug}`, siteOrigin).href,
        },
      }
    : parts[1] === 'books' && b
      ? {
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: b.title,
          author: { '@type': 'Person', name: b.penName },
          genre: b.categories,
          description: b.synopsis,
          datePublished: new Date(b.firstPublishedAt).toISOString(),
          dateModified: new Date(b.updatedAt).toISOString(),
          url: canonical,
        }
      : parts[1] === 'authors' && author
        ? {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: author.name,
            description: author.bio,
            url: canonical,
          }
        : undefined
  const image =
    b?.coverUrl ||
    new URL(b ? `/og/books/${b.slug}.svg` : '/og.svg', siteOrigin).href
  return `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="${chapter ? 'article' : parts[1] === 'books' ? 'book' : 'website'}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image">${data.path.startsWith('/discover') || data.status !== 200 ? '<meta name="robots" content="noindex,follow">' : ''}${structured ? `<script type="application/ld+json">${json(structured)}</script>` : ''}`
}
export async function renderPublic(
  url: URL,
  apiOrigin: string,
  siteOrigin: string,
  template: string,
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  if (/^\/og\/books\/[a-z0-9-]+\.svg$/.test(url.pathname)) {
    try {
      const slug = url.pathname.split('/').at(-1)!.slice(0, -4),
        response = await fetcher(`${apiOrigin}/v1/public/books/${slug}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
          cache: 'no-store',
        })
      if (response.status === 404)
        return new Response('Not found', {
          status: 404,
          headers: { 'cache-control': 'no-store' },
        })
      if (!response.ok) throw Error()
      const { publicBookSchema } = await import('@writer-agent/contracts'),
        b = publicBookSchema.parse(await response.json())
      const lines =
        Array.from(b.title)
          .slice(0, 48)
          .join('')
          .match(/.{1,12}/gu) ?? []
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#fbfaf7"/><rect x="840" y="70" width="320" height="480" rx="4" fill="${b.cover?.bg ?? '#efece5'}"/><text x="70" y="100" font-family="Georgia,serif" font-size="30" fill="#5f5a52">story2u</text>${lines.map((line, i) => `<text x="70" y="${230 + i * 70}" font-family="serif" font-size="52" fill="#23211d">${escape(line)}</text>`).join('')}<text x="75" y="550" font-family="serif" font-size="26" fill="#5f5a52">${escape(b.penName.slice(0, 30))}</text></svg>`
      return new Response(svg, {
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'no-store',
          'content-security-policy':
            "default-src 'none'; style-src 'unsafe-inline'",
        },
      })
    } catch {
      return new Response('Cover unavailable', {
        status: 503,
        headers: { 'cache-control': 'no-store' },
      })
    }
  }
  if (url.pathname === '/robots.txt')
    return new Response(
      `User-agent: *\nDisallow: /studio\nDisallow: /api/\nDisallow: /v1/studio/\nDisallow: /search\nSitemap: ${siteOrigin}/sitemap.xml\n`,
      {
        headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
      },
    )
  if (url.pathname === '/sitemap.xml') {
    try {
      const urls = new Map<string, string>()
      let cursor: string | null = '0'
      while (cursor !== null) {
        const response = await fetcher(
          `${apiOrigin}/v1/public/books?limit=100&cursor=${cursor}`,
          {
            redirect: 'manual',
            signal: AbortSignal.timeout(15000),
            cache: 'no-store',
          },
        )
        if (!response.ok) throw Error()
        const page = publicCatalogSchema.parse(await response.json())
        for (const b of page.items) {
          urls.set(`/books/${b.slug}`, b.updatedAt)
          urls.set(`/authors/${b.authorSlug}`, b.updatedAt)
          for (const c of b.chapters)
            urls.set(`/books/${b.slug}/chapters/${c.slug}`, b.updatedAt)
        }
        cursor = page.nextCursor
        if (urls.size > 50000) throw Error()
      }
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(siteOrigin)}/</loc></url>${[...urls].map(([path, at]) => `<url><loc>${escape(new URL(path, siteOrigin).href)}</loc><lastmod>${escape(at)}</lastmod></url>`).join('')}</urlset>`,
        {
          headers: {
            'content-type': 'application/xml',
            'cache-control': 'no-store',
          },
        },
      )
    } catch {
      return new Response('Sitemap unavailable', {
        status: 503,
        headers: { 'cache-control': 'no-store' },
      })
    }
  }
  if (!publicPath(url.pathname)) return null
  const data = await loadSite(url, apiOrigin, fetcher)
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace('</head>', `${pageMeta(data, siteOrigin)}</head>`)
    .replace(
      '<div id="root"></div>',
      () =>
        `<div id="root">${renderToString(<PublicSite data={data} />)}</div><script id="story2u-data" type="application/json">${json(data)}</script>`,
    )
  return new Response(html, {
    status: data.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag':
        data.status === 200 && !data.path.startsWith('/discover')
          ? 'index,follow'
          : 'noindex,follow',
    },
  })
}

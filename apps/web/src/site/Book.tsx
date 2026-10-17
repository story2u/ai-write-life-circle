import { useState } from 'react'
import { Btn } from '../components/vnext/ui'
import { allChapters, latest, when } from './data'
import {
  A,
  BookCard,
  Container,
  Cover,
  DemoMark,
  EmptyState,
  Footer,
  Header,
  Meta,
  useCatalog,
} from './kit'
import { go, progress, useTitle } from './store'

export function BookDetail({ slug }: { slug: string }) {
  const { books, authors } = useCatalog()
  const prog = progress.use()
  const book = books.find((b) => b.slug === slug)
  const [desc, setDesc] = useState(false)
  useTitle(book ? `${book.title} · story2u` : '作品不存在 · story2u')
  if (!book)
    return (
      <>
        <Header />
        <Container>
          <EmptyState
            title="这部作品不存在或已下架"
            action={
              <Btn variant="outline" onClick={() => go('/discover')}>
                发现其他作品
              </Btn>
            }
          >
            作者可能已撤回公开，或链接有误。
          </EmptyState>
        </Container>
        <Footer />
      </>
    )
  const author = authors.find((a) => a.slug === book.authorSlug)
  const chapters = allChapters(book)
  const candidate = prog[book.slug]
  const p = chapters.some((c) => c.slug === candidate?.chapter)
    ? candidate
    : undefined
  return (
    <>
      <Header />
      <main>
        <Container className="grid gap-10 pt-8 md:grid-cols-[16rem_1fr] md:gap-16 md:pt-16 lg:grid-cols-[20rem_1fr]">
          <div className="mx-auto w-40 sm:w-52 md:w-full">
            <Cover book={book} size="lg" className="md:max-w-none" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <DemoMark book={book} />
            </div>
            <h1 className="mt-2 font-prose text-display font-medium text-ink">
              {book.title}
            </h1>
            <div className="mt-3">
              <Meta book={book} author={author} />
            </div>
            <p className="mt-6 font-prose text-ui-lg text-ink">{book.hook}</p>
            <p
              className={`mt-4 max-w-2xl text-ui text-ink-2 ${desc ? '' : 'line-clamp-4'}`}
            >
              {book.synopsis}
            </p>
            {book.synopsis.length > 120 && (
              <Btn
                variant="link"
                className="mt-1 text-ui-sm"
                onClick={() => setDesc(!desc)}
              >
                {desc ? '收起' : '展开简介'}
              </Btn>
            )}
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-ui-sm">
              <div>
                <dt className="inline text-ink-3">已公开 </dt>
                <dd className="inline text-ink">{chapters.length} 章</dd>
              </div>
              <div>
                <dt className="inline text-ink-3">最近更新 </dt>
                <dd className="inline text-ink">
                  {when(latest(book).publishedAt)} · 第 {latest(book).no} 章
                </dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-2">
              {p ? (
                <>
                  <Btn
                    variant="primary"
                    className="h-10 px-5"
                    onClick={() =>
                      go(`/books/${book.slug}/chapters/${p.chapter}`)
                    }
                  >
                    继续阅读 · 第{' '}
                    {chapters.find((c) => c.slug === p.chapter)?.no ?? 1} 章
                  </Btn>
                  <Btn
                    variant="outline"
                    className="h-10 px-5"
                    onClick={() =>
                      go(`/books/${book.slug}/chapters/${chapters[0].slug}`)
                    }
                  >
                    从头开始
                  </Btn>
                </>
              ) : (
                <Btn
                  variant="primary"
                  className="h-10 px-5"
                  onClick={() =>
                    go(`/books/${book.slug}/chapters/${chapters[0].slug}`)
                  }
                >
                  开始阅读
                </Btn>
              )}
              <Btn
                variant="quiet"
                className="h-10"
                onClick={() =>
                  document
                    .getElementById('toc')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                目录
              </Btn>
            </div>
          </div>
        </Container>

        <Container className="mt-20">
          <section
            id="toc"
            aria-label="目录"
            className="mx-auto max-w-3xl scroll-mt-20"
          >
            <div className="flex items-baseline gap-3">
              <h2 className="font-prose text-title font-medium text-ink">
                目录
              </h2>
              <span className="text-ui-sm text-ink-3">
                共 {chapters.length} 章 · {book.status}
              </span>
            </div>
            {book.volumes.map((v) => (
              <div key={v.title} className="mt-8">
                <h3 className="text-ui-sm font-medium text-ink-3">{v.title}</h3>
                <ol className="mt-2 grid sm:grid-cols-2 sm:gap-x-10">
                  {v.chapters.map((c) => (
                    <li key={c.no}>
                      <A
                        to={`/books/${book.slug}/chapters/${c.slug}`}
                        className="flex items-baseline gap-3 border-b border-line-soft py-3 hover:text-accent"
                      >
                        <span className="w-8 shrink-0 text-ui-sm tabular-nums text-ink-3">
                          {c.no}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate font-prose text-ui-lg ${p?.chapter === c.slug ? 'text-accent' : 'text-ink'}`}
                        >
                          {c.title}
                        </span>
                        {p?.chapter === c.slug && (
                          <span className="text-micro text-accent">
                            读到这里
                          </span>
                        )}
                        {c === latest(book) && book.status === '连载中' && (
                          <span className="text-micro text-ok">最新</span>
                        )}
                      </A>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {book.status === '连载中' && (
              <p className="mt-8 text-ui-sm text-ink-3">
                连载中 · 新章节由作者发布后出现在这里。
              </p>
            )}
          </section>
        </Container>

        {author && (
          <Container className="mt-20">
            <div className="mx-auto max-w-3xl border-t border-line-soft pt-10">
              <div className="text-ui-sm text-ink-3">作者</div>
              <A
                to={`/authors/${author.slug}`}
                className="mt-1 inline-block font-prose text-title text-ink hover:underline hover:underline-offset-4"
              >
                {author.name}
              </A>
              <p className="mt-2 text-ui text-ink-2">{author.bio}</p>
            </div>
          </Container>
        )}
      </main>
      <Footer />
    </>
  )
}

export function AuthorPage({ slug }: { slug: string }) {
  const { books, authors } = useCatalog()
  const a = authors.find((x) => x.slug === slug)
  useTitle(a ? `${a.name} · story2u` : '作者 · story2u')
  const works = books.filter((b) => b.authorSlug === slug)
  return (
    <>
      <Header />
      <main>
        <Container className="pt-12 md:pt-20">
          {!a ? (
            <EmptyState title="作者不存在" />
          ) : (
            <>
              <div className="text-ui-sm text-ink-3">
                作者{a.demo && ' · 演示'}
              </div>
              <h1 className="mt-2 font-prose text-display font-medium text-ink">
                {a.name}
              </h1>
              <p className="mt-4 max-w-xl font-prose text-ui-lg text-ink-2">
                {a.bio || '这位作者还没有填写介绍。'}
              </p>
              <h2 className="mt-16 mb-6 text-ui-sm font-medium text-ink-3">
                已发布作品 · {works.length}
              </h2>
              {works.length ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-4 lg:grid-cols-6">
                  {works.map((b) => (
                    <BookCard key={b.slug} book={b} author={a} />
                  ))}
                </div>
              ) : (
                <p className="text-ui text-ink-3">暂无公开作品。</p>
              )}
            </>
          )}
        </Container>
      </main>
      <Footer />
    </>
  )
}

export const staticPages: Record<string, [string, string[]]> = {
  writers: [
    '给写作的人',
    [
      'Writer Studio 是 story2u 的创作工具。你在里面写作、整理设定、记下念头；它替你记住整本书，在你停笔时指出前后不一致的地方。',
      '它不会替你续写或改写正文。发布到 story2u 的，永远只有你明确选择公开的章节。草稿、笔记、人物和世界设定，都只属于你。',
    ],
  ],
  about: [
    '关于 story2u',
    [
      'story2u 是一个原创小说阅读平台，也是作者发布作品的地方。',
      '每一部公开作品都由作者主动选择并确认发布。',
    ],
  ],
  'policy/content': [
    '版权与内容政策',
    [
      '作品版权归作者所有。作者发布即表示确认对所发布内容拥有权利。',
      '正式条款正在完善；发布前请确认对正文拥有完整权利。',
    ],
  ],
  'policy/privacy': [
    '隐私政策',
    [
      '阅读进度在 MVP 中仅保存在你的浏览器中。',
      '正式条款正在完善；发布前请确认对正文拥有完整权利。',
    ],
  ],
  contact: ['联系我们', ['请通过作品作者的公开资料取得联系。']],
}
export function StaticPage({ id }: { id: string }) {
  const [t, ps] = staticPages[id] ?? ['页面不存在', ['请检查链接。']]
  useTitle(`${t} · story2u`)
  return (
    <>
      <Header />
      <main>
        <Container className="pt-16">
          <div className="max-w-read">
            <h1 className="font-prose text-display font-medium text-ink">
              {t}
            </h1>
            <div className="mt-8 space-y-4 font-prose text-ui-lg text-ink-2">
              {ps.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {id === 'writers' && (
              <Btn
                variant="primary"
                className="mt-10"
                onClick={() => go('/studio')}
              >
                进入 Writer Studio
              </Btn>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}

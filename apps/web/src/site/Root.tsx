import { useEffect } from 'react'
import Home from './Home'
import Discover from './Discover'
import { AuthorPage, BookDetail, StaticPage } from './Book'
import Reader from './Reader'
import { Container, EmptyState, Header, Footer } from './kit'
import { SiteContext, type SiteData } from './context'
import { prefs } from './store'
export function PublicSite({ data }: { data: SiteData }) {
  const theme = prefs.use()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme.dark)
  }, [theme.dark])
  useEffect(() => {
    document.documentElement.dataset.siteHydrated = 'true'
    return () => {
      delete document.documentElement.dataset.siteHydrated
    }
  }, [])
  const parts = data.path.split('/').filter(Boolean)
  const page = data.error ? (
    <>
      <Header />
      <main>
        <Container>
          <EmptyState
            title={data.error}
            action={<a href={data.path}>重新加载</a>}
          />
        </Container>
      </main>
      <Footer />
    </>
  ) : parts.length === 0 ? (
    <Home />
  ) : parts[0] === 'discover' ? (
    <Discover mode={parts[1]} />
  ) : parts[0] === 'books' && parts[2] === 'chapters' ? (
    <Reader key={parts[3]} slug={parts[1]} no={parts[3]} />
  ) : parts[0] === 'books' ? (
    <BookDetail slug={parts[1]} />
  ) : parts[0] === 'authors' ? (
    <AuthorPage slug={parts[1]} />
  ) : (
    <StaticPage id={parts.join('/')} />
  )
  return (
    <SiteContext.Provider value={data}>
      <div className="min-h-full bg-page">{page}</div>
    </SiteContext.Provider>
  )
}

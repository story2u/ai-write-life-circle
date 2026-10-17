import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

const isPublic=document.getElementById('story2u-data') || (import.meta.env.VITE_STORY2U_PUBLIC_SITE === 'true' && !location.pathname.startsWith('/studio'))
if(isPublic) {
  void import('./site/mount').then(({mountPublicSite})=>mountPublicSite())
} else if(import.meta.env.VITE_STORY2U_PUBLIC_SITE === 'true' && import.meta.env.PROD) {
  // Fail closed until PR #11 composes its existing AuthGate around /studio.
  ReactDOM.createRoot(document.getElementById('root')!).render(<p>创作者入口暂不可用，请稍后重试。</p>)
} else {
  const App=React.lazy(()=>location.pathname==='/studio/publish'?import('./site/Publish'):import('./app/App'))
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<p>正在加载…</p>}><App/></React.Suspense></React.StrictMode>)
}

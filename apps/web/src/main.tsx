import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

const publicSite=document.getElementById('story2u-data') || (import.meta.env.VITE_STORY2U_PUBLIC_SITE === 'true' && !location.pathname.startsWith('/studio'))
if(publicSite){
  void import('./site/mount').then(({mountPublicSite})=>mountPublicSite())
}else if(import.meta.env.VITE_STORY2U_PUBLIC_SITE === 'true' && import.meta.env.PROD && import.meta.env.VITE_WRITER_AGENT_AUTH !== 'google'){
  ReactDOM.createRoot(document.getElementById('root')!).render(<p>创作者登录尚未配置，请稍后重试。</p>)
}else{
  const Private=React.lazy(()=>import.meta.env.VITE_WRITER_AGENT_AUTH === 'google' ? import('./features/auth/AuthGate') : location.pathname==='/studio/publish' ? import('./site/Publish') : import('./app/App'))
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<p role="status">正在加载写作工作台…</p>}><Private/></React.Suspense></React.StrictMode>)
}

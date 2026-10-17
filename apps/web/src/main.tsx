import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

const Root = React.lazy(() => import.meta.env.VITE_WRITER_AGENT_AUTH === 'google'
  ? import('./features/auth/AuthGate')
  : import('./app/App'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={<div role="status">正在加载写作工作台…</div>}><Root /></React.Suspense>
  </React.StrictMode>,
)

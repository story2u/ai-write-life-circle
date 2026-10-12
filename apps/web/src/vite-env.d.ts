/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WRITER_AGENT_MODE?: 'demo' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

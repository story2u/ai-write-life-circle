import StudioHeader from '../features/vnext/StudioHeader'
import WritingSpace from '../features/workspace/WritingSpace'
import BookSpace from '../features/knowledge/BookSpace'
import { useStudioController } from '../features/vnext/useStudioController'
import ThinkingSpace from '../features/vnext/ThinkingSpace'
import CanonCandidate from '../features/vnext/CanonCandidate'
import SaveConflictDialog from '../features/workspace/SaveConflictDialog'
import { useEffect, useState } from 'react'
import type { WorkspaceSnapshot } from '@writer-agent/contracts'
import type { WriterAgentAdapter } from '../services/writerAgent'
import { createWriterAgentAdapter } from '../services/adapterFactory'
import { ConfirmDialog, Toasts } from '../components/ui'
import { Btn, Proto } from '../components/vnext/ui'
import QuickNote from '../features/notes/QuickNote'
type AppLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; adapter: WriterAgentAdapter; workspace: WorkspaceSnapshot }

export default function App({ adapter: providedAdapter }: { adapter?: WriterAgentAdapter } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<AppLoadState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    setLoad({ status: 'loading' })
    void (async () => {
      const adapter = providedAdapter ?? (await createWriterAgentAdapter())
      const configuredProjectId = import.meta.env.VITE_WRITER_AGENT_PROJECT_ID?.trim()
      if (adapter.mode === 'api' && !configuredProjectId)
        throw new Error(
          'API 模式缺少 VITE_WRITER_AGENT_PROJECT_ID；请使用仓库提供的本地联调命令或配置项目 ID。',
        )
      const projectId = configuredProjectId || 'demo-writer-agent'
      const workspace = await adapter.loadWorkspace(projectId)
      if (active) setLoad({ status: 'ready', adapter, workspace })
    })().catch((cause: unknown) => {
      if (active)
        setLoad({
          status: 'error',
          message: cause instanceof Error ? cause.message : '工作区加载失败。',
        })
    })
    return () => {
      active = false
    }
  }, [providedAdapter, attempt])

  if (load.status === 'loading') return <WorkspaceLoadNotice message="正在加载作品工作区…" />
  if (load.status === 'error')
    return (
      <WorkspaceLoadNotice
        message={`工作区加载失败：${load.message}`}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    )
  return <WriterStudio adapter={load.adapter} initialWorkspace={load.workspace} />
}

function WorkspaceLoadNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] text-sm text-[var(--ink-2)]">
      <p role="status" aria-live="polite">
        {message}
      </p>
      {onRetry && (
        <button type="button" className="btn rounded border px-3 py-2" onClick={onRetry}>
          重试加载
        </button>
      )}
    </div>
  )
}

function WriterStudio({
  adapter,
  initialWorkspace,
}: {
  adapter: WriterAgentAdapter
  initialWorkspace: WorkspaceSnapshot
}) {
  const studio = useStudioController(adapter, initialWorkspace)
  const {
    view,
    setView,
    setBookNav,
    quick,
    setQuick,
    candidateNote,
    setCandidateNote,
    saveDialog,
    setSaveDialog,
    confirm,
    setConfirm,
    toasts,
    typing,
    setTyping,
    workspace,
    current,
    dark,
    editor,
    prototype,
    notes,
    downloadLocalDraft,
  } = studio
  const thinkView = (wide = false) => (
    <ThinkingSpace studio={studio} demo={adapter.mode === 'demo'} wide={wide} />
  )
  return (
    <div
      className={`${dark ? 'dark' : ''} ${typing ? 'is-typing' : ''}`}
      onPointerMove={() => setTyping(false)}
    >
      <div className="flex h-dvh flex-col overflow-hidden bg-page text-ink">
        <StudioHeader studio={studio} />
        <WritingSpace studio={studio} adapter={adapter} />
        <BookSpace studio={studio} adapter={adapter} />
        {view === 'think' && (
          <main className="scroll min-h-0 flex-1 overflow-auto px-6">
            <div className="mx-auto max-w-page pt-6">
              <Btn onClick={() => setView('write')}>← 回到正文</Btn>
              <h1 className="mt-6 font-prose text-title">思考</h1>
            </div>
            {thinkView(true)}
          </main>
        )}
        {adapter.mode === 'demo' && (
          <div className="pointer-events-none fixed bottom-1 left-2">
            <Proto />
          </div>
        )}
      </div>
      {quick && (
        <QuickNote
          notes={notes}
          chapterId={current}
          onClose={() => {
            setQuick(false)
            editor.current?.commands.focus()
          }}
        />
      )}
      {candidateNote && adapter.mode === 'demo' && (
        <CanonCandidate
          note={candidateNote}
          entries={prototype.entries}
          onClose={() => setCandidateNote(null)}
          onCreate={(candidate) => {
            prototype.setChanges((all) => [...all, candidate])
            setCandidateNote(null)
            setView('book')
            setBookNav({ section: 'notes', changeId: candidate.id })
          }}
        />
      )}
      {saveDialog && (
        <SaveConflictDialog
          adapter={adapter}
          projectId={initialWorkspace.projectId}
          chapterId={current}
          localMarkdown={workspace.exportLocalDraft() ?? workspace.markdownByChapter[current] ?? ''}
          onExport={downloadLocalDraft}
          onKeep={() => setSaveDialog(false)}
          onUseServer={() => {
            setSaveDialog(false)
            workspace.reloadServerVersion()
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          key={confirm.title}
          {...confirm}
          requireAcknowledgement={confirm.title === '使用服务器版本？'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.run()
            setConfirm(null)
          }}
        />
      )}
      <Toasts items={toasts} />
    </div>
  )
}

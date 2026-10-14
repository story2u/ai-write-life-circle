import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Evidence } from '../types'
import ChapterNavigator from '../components/ChapterNavigator'
import ManuscriptEditor, { type Annotation, type Flash } from '../components/ManuscriptEditor'
import ReviewPanel from '../components/ReviewPanel'
import AgentChat from '../components/AgentChat'
import ChallengePanel from '../components/ChallengePanel'
import { DecisionHistory, KnowledgeViewer, ProposalDetail } from '../components/Proposals'
import DesignNotes from '../components/DesignNotes'
import { Btn, ConfirmDialog, Empty, Kbd, Toasts } from '../components/ui'
import type { WorkspaceSnapshot } from '@writer-agent/contracts'
import type { WriterAgentAdapter } from '../services/writerAgent'
import { createWriterAgentAdapter } from '../services/adapterFactory'
import { useWorkspaceController, WORKSPACE_STORAGE_KEY, type WorkspaceConfirmAction } from '../features/workspace/useWorkspaceController'
import { createId } from '../lib/id'

type Tab = '审查' | '对话' | '推演' | '决策'

function Resizer({ onDrag, side }: { onDrag: (dx: number) => void; side: 'left' | 'right' }) {
  const down = (e: React.MouseEvent) => {
    e.preventDefault()
    let x = e.clientX
    const move = (ev: MouseEvent) => { onDrag(side === 'left' ? ev.clientX - x : x - ev.clientX); x = ev.clientX }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = '' }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return <div onMouseDown={down} role="separator" aria-orientation="vertical" className="group relative z-10 w-0 cursor-col-resize"><div className="absolute inset-y-0 -left-1 w-2 group-hover:bg-[var(--accent)] group-hover:opacity-30" /></div>
}

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
      const adapter = providedAdapter ?? await createWriterAgentAdapter()
      const configuredProjectId = import.meta.env.VITE_WRITER_AGENT_PROJECT_ID?.trim()
      if (adapter.mode === 'api' && !configuredProjectId) throw new Error('API 模式缺少 VITE_WRITER_AGENT_PROJECT_ID；请使用仓库提供的本地联调命令或配置项目 ID。')
      const projectId = configuredProjectId || 'demo-writer-agent'
      const workspace = await adapter.loadWorkspace(projectId)
      if (active) setLoad({ status: 'ready', adapter, workspace })
    })().catch((cause: unknown) => {
      if (active) setLoad({ status: 'error', message: cause instanceof Error ? cause.message : '工作区加载失败。' })
    })
    return () => { active = false }
  }, [providedAdapter, attempt])

  if (load.status === 'loading') return <WorkspaceLoadNotice message="正在加载作品工作区…" />
  if (load.status === 'error') return <WorkspaceLoadNotice message={`工作区加载失败：${load.message}`} onRetry={() => setAttempt((value) => value + 1)} />
  return <WriterStudio adapter={load.adapter} initialWorkspace={load.workspace} />
}

function WorkspaceLoadNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] text-sm text-[var(--ink-2)]">
      <p role="status" aria-live="polite">{message}</p>
      {onRetry && <button type="button" className="btn rounded border px-3 py-2" onClick={onRetry}>重试加载</button>}
    </div>
  )
}

function WriterStudio({ adapter, initialWorkspace }: { adapter: WriterAgentAdapter; initialWorkspace: WorkspaceSnapshot }) {
  const { chapters, knowledge } = initialWorkspace
  const [view, setView] = useState<'app' | 'spec'>('app')
  const [tab, setTab] = useState<Tab>('审查')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [kb, setKb] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [flash, setFlash] = useState<Flash>(null)
  const [returnTo, setReturnTo] = useState<{ chapterId: string; scroll: number } | null>(null)
  const [selection, setSelection] = useState('')
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([])
  const [confirm, setConfirm] = useState<WorkspaceConfirmAction | null>(null)
  const [challengeSeed, setChallengeSeed] = useState<string | undefined>()
  const [winW, setWinW] = useState(window.innerWidth)

  const editorRef = useRef<Editor | null>(null)
  const editorChapterRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, force] = useState(0)

  const toast = useCallback((text: string) => {
    const id = createId()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400)
  }, [])
  const workspace = useWorkspaceController({ adapter, initialWorkspace, toast, requestConfirm: setConfirm })
  const { doc, markdownByChapter, proposals, decisions, layout, setLayout, chat, challenge, setChallenge, current, dark, setDark,
    task, saveState, flushSave, retrySave, onChange, runReview: runWorkspaceReview, cancelReview, decide, createProposal,
    sendChat, markChatSaved, requestChallenge, chapterLoadState, editorGeneration, recoveryDraft,
    restoreLocalDraft, reloadServerVersion, retryLoadChapter, exportLocalDraft } = workspace
  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
    editorChapterRef.current = editor ? current : null
    editor?.on('transaction', () => force((n) => n + 1))
    force((n) => n + 1)
  }, [current])

  useEffect(() => {
    const r = () => setWinW(window.innerWidth)
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  const switchChapter = (id: string) => {
    if (id === current) return
    workspace.switchChapter(id)
    setSelection('')
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const runReview = () => {
    if (task.state === 'running') return
    setLayout((currentLayout) => ({ ...currentLayout, rightOpen: true, focus: false }))
    setTab('审查')
    runWorkspaceReview()
  }

  // ---------- Locating ----------
  const locate = (chapterId: string, paraIndex: number, quote?: string) => {
    if (chapterId !== current) switchChapter(chapterId)
    setFlash({ paraIndex, quote, nonce: Date.now() })
    setTimeout(() => setFlash(null), 2200)
  }
  const selectIssue = (id: string) => {
    setActiveId(id)
    const p = proposals.find((x) => x.id === id)
    if (!p) return
    setLayout((l) => ({ ...l, rightOpen: true }))
    if (tab !== '审查' && tab !== '决策') setTab('审查')
    if (p.chapterId && p.anchor) locate(p.chapterId, p.anchor.paraIndex, p.anchor.quote)
  }
  const openEvidence = (e: Evidence) => {
    if (e.type === 'knowledge') setKb({ open: true, id: e.entryId })
    else if (e.type === 'chapter') {
      setDetailId(null)
      if (e.chapterId !== current || !returnTo) setReturnTo((r) => r ?? { chapterId: current, scroll: scrollRef.current?.scrollTop ?? 0 })
      locate(e.chapterId, e.paraIndex, e.quote)
    }
  }
  const goBack = () => {
    if (!returnTo) return
    switchChapter(returnTo.chapterId)
    const s = returnTo.scroll
    setTimeout(() => scrollRef.current?.scrollTo({ top: s, behavior: 'smooth' }), 120)
    setReturnTo(null)
  }

  // ---------- Keyboard ----------
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null)
        else if (detailId) setDetailId(null)
        else if (kb.open) setKb({ open: false, id: null })
        else if (layout.focus) setLayout((l) => ({ ...l, focus: false }))
        return
      }
      if (!mod) return
      if (e.key === '\\' && e.shiftKey) { e.preventDefault(); setLayout((l) => ({ ...l, focus: false, leftOpen: !l.leftOpen })) }
      else if (e.key === '\\' || e.key === '|') { e.preventDefault(); setLayout((l) => ({ ...l, focus: false, rightOpen: !l.rightOpen })) }
      else if (e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setLayout((l) => ({ ...l, focus: !l.focus })) }
      else if (e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); runReview() }
      else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flushSave().then((saved) => { if (saved) toast('已保存') })
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  // ---------- Derived ----------
  const chapter = chapters.find((c) => c.id === current) ?? { id: '', volume: '', title: '', meta: '', wordCount: 0 }
  const chProposals = useMemo(() => proposals.filter((p) => p.chapterId === current && p.origin === '审查'), [proposals, current])
  const annotations: Annotation[] = useMemo(
    () => chProposals.filter((p) => p.anchor && (p.status === 'pending' || p.status === 'adopted')).map((p) => ({ id: p.id, kind: p.kind, paraIndex: p.anchor!.paraIndex, quote: p.anchor!.quote, active: p.id === activeId })),
    [chProposals, activeId],
  )
  const pendingByChapter = proposals.reduce<Record<string, number>>((m, p) => { if (p.status === 'pending') m[p.chapterId ?? '_'] = (m[p.chapterId ?? '_'] ?? 0) + 1; return m }, {})
  const detail = proposals.find((p) => p.id === detailId)
  const ed = editorRef.current
  const editorText = editorChapterRef.current === current && ed && !ed.isDestroyed ? ed.getText() : undefined
  const words = editorText !== undefined
    ? editorText.replace(/\s/g, '').length
    : doc[current] ? doc[current].join('').replace(/\s/g, '').length : chapter.wordCount ?? 0

  const narrow = winW < 1180
  const veryNarrow = winW < 900
  const showLeft = !layout.focus && layout.leftOpen
  const showRight = !layout.focus && layout.rightOpen
  const setW = (k: 'leftW' | 'rightW', min: number, max: number) => (dx: number) => setLayout((l) => ({ ...l, [k]: Math.min(max, Math.max(min, l[k] + dx)) }))

  const resetDemo = () => setConfirm({
    title: '重置演示数据？', desc: '将清空本地保存的正文修改、提案、决策记录与对话，恢复初始演示状态。此操作无法撤销。', confirmText: '重置', danger: true,
    run: () => { localStorage.removeItem(WORKSPACE_STORAGE_KEY); location.reload() },
  })

  const downloadLocalDraft = () => {
    const markdown = exportLocalDraft()
    if (markdown === null) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${current || 'chapter'}-local-draft.md`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        {!layout.focus && (
          <div className="flex h-9 shrink-0 items-center gap-1 border-b px-3 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
            {(['app', 'spec'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className="btn ghost rounded px-2 py-1" style={{ color: view === v ? 'var(--ink)' : undefined }}>
                {v === 'app' ? '写作工作台' : '设计说明'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {view === 'app' && !layout.leftOpen && <Btn small onClick={() => setLayout((l) => ({ ...l, leftOpen: true }))}>显示导航</Btn>}
              {view === 'app' && !layout.rightOpen && <Btn small onClick={() => setLayout((l) => ({ ...l, rightOpen: true }))}>Agent 面板 <Kbd>⌘\</Kbd></Btn>}
              {adapter.mode === 'demo' && <Btn small onClick={resetDemo}>重置演示数据</Btn>}
              <Btn small onClick={() => setDark(!dark)}>{dark ? '浅色' : '深色'}主题</Btn>
            </div>
          </div>
        )}
        {view === 'spec' ? (
          <div className="scroll flex-1 overflow-auto"><DesignNotes /></div>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            {showLeft && (
              <>
                <aside className={`shrink-0 border-r ${veryNarrow ? 'absolute inset-y-0 left-0 z-30' : ''}`} style={{ width: layout.leftW, borderColor: 'var(--line)', boxShadow: veryNarrow ? 'var(--shadow)' : undefined }}>
                  <ChapterNavigator chapters={chapters} doc={doc} current={current} onPick={switchChapter} pendingByChapter={pendingByChapter}
                    projectTitle={workspace.projectTitle} adapterMode={adapter.mode}
                    onCollapse={() => setLayout((l) => ({ ...l, leftOpen: false }))}
                    onNav={(k) => { if (k === 'knowledge') setKb({ open: true, id: null }); else { setLayout((l) => ({ ...l, rightOpen: true })); setTab(k === 'decisions' ? '决策' : '对话') } }} />
                </aside>
                {!veryNarrow && <Resizer side="left" onDrag={setW('leftW', 200, 360)} />}
              </>
            )}

            <main className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--surface)' }}>
              <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-xs" style={{ borderColor: layout.focus ? 'transparent' : 'var(--line)', color: 'var(--ink-3)' }}>
                <span className="truncate">{chapter.id ? <>{chapter.volume} / <span style={{ color: 'var(--ink)' }}>{chapter.title}</span></> : '暂无章节'}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <Btn small disabled={!ed?.can().undo()} onClick={() => ed?.chain().focus().undo().run()} title="撤销 ⌘Z">撤销</Btn>
                  <Btn small disabled={!ed?.can().redo()} onClick={() => ed?.chain().focus().redo().run()} title="重做 ⌘⇧Z">重做</Btn>
                  <span className="mx-2 tabular-nums">{words.toLocaleString()} 字</span>
                  <span className="w-[92px] text-right" title={saveState.s === 'error' ? saveState.message : undefined} aria-live="polite">
                    {saveState.s === 'saving' ? '保存中…' : saveState.s === 'dirty' ? '有未保存修改' : saveState.s === 'recovery' ? '有待恢复草稿' : saveState.s === 'error' ? (saveState.conflict ? '版本冲突' : '保存失败') : `已保存 ${new Date(saveState.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                  {saveState.s === 'error' && !saveState.conflict && <button type="button" className="btn ghost rounded px-1" onClick={() => void retrySave()} aria-label="重试保存">重试</button>}
                  {adapter.mode === 'api' && saveState.s === 'error' && !saveState.conflict && exportLocalDraft() !== null && <button type="button" className="btn ghost rounded px-1" onClick={downloadLocalDraft}>导出当前草稿</button>}
                  <Btn small variant={layout.focus ? 'outline' : 'ghost'} onClick={() => setLayout((l) => ({ ...l, focus: !l.focus }))} title="⌘⇧F">{layout.focus ? '退出专注' : '专注'}</Btn>
                </span>
              </div>
              <div ref={scrollRef} className="scroll relative min-h-0 flex-1 overflow-auto">
                {chapters.length === 0 ? (
                  <Empty title="当前 Harness 尚无正式章节" desc="创建符合 Harness 约定、带稳定 CH-* ID 的 Markdown 章节后，这里会显示真实正文。本工作台不会自动创建或填充小说正文。" />
                ) : chapterLoadState.status === 'loading' || chapterLoadState.status === 'idle' ? (
                  <Empty title="正在读取章节原文…" desc="编辑器将在服务端返回 Markdown 与版本标识后开放。" />
                ) : chapterLoadState.status === 'error' ? (
                  <Empty title="章节加载失败" desc={chapterLoadState.message} action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Btn variant="outline" onClick={() => retryLoadChapter()}>重试读取</Btn>
                      {exportLocalDraft() !== null && <Btn onClick={downloadLocalDraft}>导出本地草稿</Btn>}
                    </div>
                  } />
                ) : recoveryDraft ? (
                  <section role="alert" aria-label="本地草稿恢复" className="mx-auto mt-10 max-w-[680px] rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}>
                    <div className="text-[13px] font-medium">发现尚未确认保存的本地草稿</div>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                      {recoveryDraft.conflict
                        ? '本地草稿基于较旧的服务器版本。服务器正文未被覆盖；先导出草稿，再选择如何继续。'
                        : '服务器版本与本地草稿不同。服务器正文未被覆盖；请选择恢复草稿或使用服务器版本。'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="primary" onClick={() => void restoreLocalDraft()}>恢复本地草稿</Btn>
                      <Btn variant="outline" onClick={downloadLocalDraft}>导出本地草稿</Btn>
                      <Btn onClick={() => reloadServerVersion()}>使用服务器版本…</Btn>
                    </div>
                  </section>
                ) : (
                  <article className="mx-auto max-w-[680px] px-8 py-14">
                    <h1 className="font-prose text-[28px] font-semibold">{chapter.title.replace(/第 (\d+) 章 /, '第$1章　')}</h1>
                    <div className="mt-2 mb-10 text-xs" style={{ color: 'var(--ink-3)' }}>{chapter.meta}</div>
                    {saveState.s === 'error' && saveState.conflict && (
                      <section role="alert" className="mb-5 rounded-lg border p-4 text-[12px]" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)', color: 'var(--ink-2)' }}>
                        <div className="font-medium" style={{ color: 'var(--danger)' }}>检测到版本冲突</div>
                        <p className="mt-1">{saveState.message} 本地正文仍保留在编辑器和浏览器恢复草稿中，没有自动重试覆盖。</p>
                        <div className="mt-3 flex gap-2">
                          <Btn small variant="outline" onClick={downloadLocalDraft}>导出本地草稿</Btn>
                          <Btn small onClick={() => reloadServerVersion()}>重新读取服务器版本…</Btn>
                        </div>
                      </section>
                    )}
                    <ManuscriptEditor
                      key={`${current}:${editorGeneration}`} chapterId={current} initial={doc[current] ?? ['']} initialMarkdown={markdownByChapter[current]} annotations={annotations} flash={flash}
                      onChange={onChange} onSelectIssue={selectIssue}
                      onSelection={(t) => setSelection(t.trim())}
                      onReady={handleEditorReady}
                    />
                  </article>
                )}
              </div>
              {returnTo && (
                <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
                  <button type="button" onClick={goBack} className="btn fade-up pointer-events-auto rounded-full border px-4 py-2 text-[12.5px] hover:opacity-90" style={{ background: 'var(--surface)', borderColor: 'var(--line)', boxShadow: 'var(--shadow)' }}>
                    ← 返回原写作位置 · {chapters.find((c) => c.id === returnTo.chapterId)?.title}
                  </button>
                </div>
              )}
            </main>

            {showRight && (
              <>
                {!narrow && <Resizer side="right" onDrag={setW('rightW', 320, 560)} />}
                <aside className={`flex shrink-0 flex-col border-l ${narrow ? 'absolute inset-y-0 right-0 z-30' : ''}`} style={{ width: Math.min(layout.rightW, winW - 40), borderColor: 'var(--line)', background: 'var(--bg)', boxShadow: narrow ? 'var(--shadow)' : undefined }} aria-label="Agent 面板">
                  <div className="flex h-12 shrink-0 items-center gap-0.5 border-b px-3" style={{ borderColor: 'var(--line)' }} role="tablist">
                    {(['审查', '对话', '推演', '决策'] as Tab[]).map((t) => (
                      <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="btn rounded-md px-2.5 py-1 text-[13px]"
                        style={tab === t ? { background: 'var(--surface)', boxShadow: 'var(--shadow)' } : { color: 'var(--ink-3)' }}>
                        {t}{t === '审查' && (pendingByChapter[current] ?? 0) > 0 && <span className="ml-1 text-[11px]" style={{ color: 'var(--warn)' }}>{pendingByChapter[current]}</span>}
                      </button>
                    ))}
                    <button type="button" onClick={() => setLayout((l) => ({ ...l, rightOpen: false }))} className="btn ghost ml-auto rounded px-2 text-sm" style={{ color: 'var(--ink-3)' }} title="折叠 ⌘\" aria-label="折叠 Agent 面板">⟩</button>
                  </div>
                  {adapter.mode === 'api' ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center px-5">
                      <Empty title="Agent 功能尚未接入" desc="当前已连接真实 Workspace 与章节草稿 API。审查、对话、推演和提案仍是独立待实现功能；此模式不会调用演示数据或未实现接口。" />
                    </div>
                  ) : (
                    <>
                      {tab === '审查' && <ReviewPanel task={task} proposals={chProposals} activeId={activeId} onSelect={selectIssue} onDecide={decide} onOpenDetail={setDetailId} onEvidence={openEvidence} onRun={runReview} onCancel={cancelReview} />}
                      {tab === '对话' && (
                        <AgentChat messages={chat} selection={selection} clearSelection={() => setSelection('')} onEvidence={openEvidence} onSend={sendChat}
                          onCommand={(c, arg) => { if (c === 'review') runReview(); else { setChallengeSeed(arg || selection || undefined); setTab('推演') } }}
                          onSave={(m) => {
                            const id = createProposal({ kind: 'suggestion', origin: '对话', title: `对话：${m.text.slice(0, 18)}…`, chapterId: current, analysis: { facts: [], inferences: [m.text], suggestion: '由讨论保存，待你确认是否纳入创作计划。' }, evidence: m.cites ?? [], impact: [chapter.title], options: [] })
                            markChatSaved(m, id)
                          }} />
                      )}
                      {tab === '推演' && (
                        <ChallengePanel key={challengeSeed} rounds={challenge} onChangeRounds={setChallenge} onChallenge={requestChallenge} seed={challengeSeed}
                          onSave={(rs, conclusion) => createProposal({
                            kind: 'suggestion', origin: '推演', title: `推演：${rs[0].intent.slice(0, 18)}`,
                            analysis: { facts: [`作者结论：${conclusion}`], inferences: rs.flatMap((r) => r.understanding.filter((u) => u.speculative).map((u) => u.text)), suggestion: rs.at(-1)!.questions.join(' / ') },
                            evidence: [], impact: ['世界观设定', '人物动机'],
                            options: [{ id: 'a', label: '纳入世界观设定', detail: '确认后由你在知识库中建档' }, { id: 'b', label: '仅作为创作笔记', detail: '不成为作品事实' }],
                          })} />
                      )}
                      {tab === '决策' && <DecisionHistory proposals={proposals} decisions={decisions} onOpen={setDetailId} />}
                    </>
                  )}
                </aside>
              </>
            )}
          </div>
        )}
      </div>
      {detail && <ProposalDetail key={detail.id + detail.status} p={detail} decisions={decisions.filter((d) => d.proposalId === detail.id)} chapters={chapters} onClose={() => setDetailId(null)} onDecide={decide} onEvidence={openEvidence} />}
      {kb.open && <KnowledgeViewer entryId={kb.id} knowledge={knowledge} unavailable={adapter.mode === 'api'} onClose={() => setKb({ open: false, id: null })} onPick={(id) => setKb({ open: true, id })} />}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null) }} />}
      <Toasts items={toasts} />
    </div>
  )
}

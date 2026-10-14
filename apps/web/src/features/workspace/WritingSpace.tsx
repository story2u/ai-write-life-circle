import type { useStudioController } from '../vnext/useStudioController'
import { Empty } from '../../components/ui'
import ChapterDrawer from '../../components/vnext/ChapterDrawer'
import StoryConflictView from '../../components/vnext/StoryConflictView'
import WritingCanvas from '../workspace/WritingCanvas'
import Resume from '../../components/vnext/Resume'
import MarginPanel from '../../components/vnext/MarginPanel'
import { Btn, IconBtn, Icon, Seg } from '../../components/vnext/ui'
import type { WriterAgentAdapter } from '../../services/writerAgent'
import ThinkingSpace from '../vnext/ThinkingSpace'
export default function WritingSpace({
  studio,
  adapter,
}: {
  studio: ReturnType<typeof useStudioController>
  adapter: WriterAgentAdapter
}) {
  const {
    view,
    setView,
    leftTab,
    setLeftTab,
    rightTab,
    setRightTab,
    setBookNav,
    resume,
    setResume,
    setQuick,
    selection,
    setSelection,
    marksHidden,
    setMarksHidden,
    activeMargin,
    setConflictId,
    flash,
    backTo,
    setBackTo,
    setTyping,
    scroll,
    workspace,
    current,
    doc,
    layout,
    setLayout,
    bridge,
    editor,
    ready,
    chapters,
    chapter,
    viewChapters,
    currentViewChapter,
    prototype,
    notesEnabled,
    nextUp,
    conflict,
    openThink,
    switchChapter,
    openSource,
    downloadLocalDraft,
    annotations,
    selectMargin,
    saveNote,
    liveMargins,
    toast,
  } = studio
  const thinkView = (wide = false) => (
    <ThinkingSpace studio={studio} demo={adapter.mode === 'demo'} wide={wide} />
  )
  return (
    <>
      <div
        hidden={view !== 'write'}
        className={view === 'write' ? 'relative flex min-h-0 flex-1' : ''}
      >
        {view === 'write' && layout.leftOpen && !layout.focus && (
          <>
            <button
              aria-label="关闭章节遮罩"
              className="fixed inset-0 top-12 z-20 bg-scrim lg:hidden"
              onClick={() => setLayout((l) => ({ ...l, leftOpen: false }))}
            />
            <aside
              className="fixed inset-y-0 top-12 left-0 z-30 max-w-full shadow-soft lg:static lg:z-auto lg:shadow-none"
              style={{ width: layout.leftW }}
            >
              <ChapterDrawer
                chapters={viewChapters}
                current={current}
                onOpen={switchChapter}
                onClose={() => setLayout((l) => ({ ...l, leftOpen: false }))}
                related={prototype.related}
                tab={leftTab}
                setTab={setLeftTab}
                onEntry={(entryId) => {
                  setView('book')
                  setBookNav({ section: 'chapter', entryId })
                }}
                onAllKnowledge={() => setView('book')}
                unavailable={adapter.mode === 'api'}
              />
            </aside>
          </>
        )}
        <main
          className="flex min-w-0 flex-1 flex-col"
          onKeyDownCapture={(event) => {
            if ((event.target as HTMLElement).closest('.manuscript') && event.key.length === 1)
              setTyping(true)
          }}
        >
          {conflict ? (
            <StoryConflictView
              conflict={conflict}
              onBack={() => setConflictId(null)}
              onSource={openSource}
              onResolve={(resolution) => {
                if (resolution === 'edit-text') {
                  openSource(conflict.a)
                  return
                }
                if (resolution === 'edit-canon') {
                  void import('../../mocks/vnextData').then(({ canonTemplate }) => {
                    const change = canonTemplate('demo-conflict')
                    prototype.setChanges((all) => [
                      ...all.filter((c) => c.id !== change.id),
                      change,
                    ])
                    setBookNav({ section: 'history', changeId: change.id })
                    setView('book')
                  })
                  return
                }
                const done = () => {
                  prototype.setConflicts((all) =>
                    all.map((c) => (c.id === conflict.id ? { ...c, resolution } : c)),
                  )
                  prototype.setIgnored((all) => [
                    ...all,
                    ...prototype.margins
                      .filter((m) => m.conflictId === conflict.id)
                      .map((m) => m.id),
                  ])
                  setConflictId(null)
                }
                if (resolution === 'growth')
                  void saveNote(`作者判断：${conflict.title}是人物成长或认知变化。`)
                    .then(done)
                    .catch((e: unknown) => toast(e instanceof Error ? e.message : '笔记保存失败'))
                else done()
              }}
            />
          ) : (
            <>
              {backTo && (
                <Btn
                  className="self-start"
                  onClick={() => {
                    const target = backTo
                    switchChapter(target.chapterId)
                    setBackTo(null)
                    window.setTimeout(() => scroll.current?.scrollTo({ top: target.scroll }), 100)
                  }}
                >
                  回到正文原位置
                </Btn>
              )}
              <WritingCanvas
                workspace={workspace}
                chapters={chapters}
                chapter={chapter}
                displayTitle={
                  adapter.mode === 'demo' ? currentViewChapter?.title || '未命名' : chapter.title
                }
                chapterNumber={adapter.mode === 'demo' ? currentViewChapter?.no : undefined}
                scrollRef={scroll}
                annotations={annotations}
                flash={flash}
                downloadLocalDraft={downloadLocalDraft}
                selectIssue={selectMargin}
                handleEditorReady={ready}
                setSelection={setSelection}
                resume={
                  resume &&
                  !layout.focus &&
                  currentViewChapter &&
                  (bridge.paragraphs ?? doc[current] ?? []).some(Boolean) ? (
                    <Resume
                      chapter={{ ...currentViewChapter, title: chapter.title }}
                      tail={(bridge.paragraphs ?? doc[current] ?? []).filter(Boolean).slice(-3)}
                      pending={[]}
                      nextUp={
                        nextUp
                          ? {
                              id: nextUp.noteId,
                              text: nextUp.content,
                              origin: 'quick',
                              at: Date.parse(nextUp.updatedAt),
                            }
                          : undefined
                      }
                      onContinue={() => {
                        setResume(false)
                        editor.current?.commands.focus('end')
                      }}
                      onThink={() => openThink(nextUp?.content)}
                      onSkip={() => setResume(false)}
                    />
                  ) : null
                }
              />
            </>
          )}
        </main>
        {view === 'write' && layout.rightOpen && !layout.focus && (
          <>
            <button
              aria-label="关闭辅助遮罩"
              className="fixed inset-0 top-12 z-20 bg-scrim xl:hidden"
              onClick={() => setLayout((l) => ({ ...l, rightOpen: false }))}
            />
            <aside
              aria-label="辅助"
              className="fixed inset-y-0 top-12 right-0 z-30 flex max-w-full flex-col bg-paper shadow-soft xl:static xl:z-auto xl:shadow-none"
              style={{ width: layout.rightW }}
            >
              <div className="flex items-center gap-1 px-4 pt-3 pb-3">
                <Seg
                  size="sm"
                  label="辅助内容"
                  value={rightTab}
                  onChange={setRightTab}
                  options={[
                    ['margin', '注记'],
                    ['think', '思考'],
                  ]}
                />
                <IconBtn
                  icon="expand"
                  label="展开为完整思考空间"
                  onClick={() => setView('think')}
                />
                <IconBtn
                  icon="x"
                  label="收起辅助"
                  className="ml-auto"
                  onClick={() => setLayout((l) => ({ ...l, rightOpen: false }))}
                />
              </div>
              <div className="scroll min-h-0 flex-1 overflow-auto">
                {rightTab === 'think' ? (
                  thinkView()
                ) : adapter.mode === 'api' ? (
                  <Empty
                    title="页边注记尚未接入"
                    desc="当前没有真实审查与注记服务，不会生成演示发现。"
                  />
                ) : (
                  <MarginPanel
                    margins={liveMargins}
                    ignored={prototype.margins.filter((m) => prototype.ignored.includes(m.id))}
                    activeId={activeMargin}
                    onSelect={selectMargin}
                    onSource={openSource}
                    onIgnore={(id) => prototype.setIgnored((all) => [...all, id])}
                    onRestore={(id) => prototype.setIgnored((all) => all.filter((x) => x !== id))}
                    onNote={(m) => {
                      void saveNote(`AI 推断（演示，未确认）：${m.inference}`)
                        .then(() => toast('已保存为创作笔记'))
                        .catch((e: unknown) => toast(e instanceof Error ? e.message : '保存失败'))
                    }}
                    onConflict={(m) => setConflictId(m.conflictId ?? null)}
                    onThink={(m) => openThink(m.question)}
                    marksHidden={marksHidden}
                    setMarksHidden={setMarksHidden}
                    emptyChapter={!(doc[current] ?? []).some(Boolean)}
                  />
                )}
              </div>
            </aside>
          </>
        )}
        <footer className="chrome pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-4">
          <span className="hidden text-micro text-ink-3 sm:inline">
            {bridge.words ?? (doc[current] ?? []).join('').replace(/\s/g, '').length} 字
          </span>
          {!layout.rightOpen && (
            <div className="pointer-events-auto ml-auto flex gap-0.5 rounded-lg bg-page/80 p-0.5 backdrop-blur">
              <Btn size="sm" disabled={!notesEnabled} onClick={() => setQuick(true)}>
                <Icon name="pen" />
                随手记
              </Btn>
              <Btn size="sm" onClick={() => openThink(selection)}>
                思考
              </Btn>
              <Btn
                size="sm"
                onClick={() => {
                  setRightTab('margin')
                  setLayout((l) => ({ ...l, rightOpen: true, focus: false }))
                }}
              >
                注记
              </Btn>
            </div>
          )}
        </footer>
      </div>
    </>
  )
}

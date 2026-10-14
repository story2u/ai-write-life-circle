import type { useStudioController } from '../vnext/useStudioController'
import { Btn, IconBtn, Seg } from '../../components/vnext/ui'
export default function StudioHeader({
  studio,
}: {
  studio: ReturnType<typeof useStudioController>
}) {
  const {
    view,
    setView,
    setSaveDialog,
    workspace,
    layout,
    setLayout,
    dark,
    setDark,
    saveState,
    downloadLocalDraft,
    pinned,
    status,
  } = studio
  return (
    <>
      <header className="relative z-20 flex min-h-12 shrink-0 flex-wrap items-center gap-1 px-2 sm:px-3">
        <div className="chrome flex min-w-0 items-center gap-1">
          {view === 'write' && !layout.focus && (
            <IconBtn
              icon="menu"
              label="目录与本章相关"
              shortcut="⌘⇧E"
              active={layout.leftOpen}
              onClick={() => setLayout((l) => ({ ...l, leftOpen: !l.leftOpen }))}
            />
          )}
          <span className="hidden max-w-40 truncate pl-1 font-prose text-ui text-ink-2 md:inline">
            {workspace.projectTitle}
          </span>
        </div>
        {!layout.focus && (
          <div className="chrome mx-auto md:absolute md:left-1/2 md:mx-0 md:-translate-x-1/2">
            <Seg
              label="主导航"
              value={view}
              onChange={setView}
              options={[
                ['write', '写作'],
                ['book', '书'],
                ['think', '思考'],
              ]}
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span
            className={`${pinned ? 'text-danger' : 'chrome hidden sm:inline'} text-ui-sm`}
            aria-live="polite"
          >
            {status}
          </span>
          {saveState.s === 'error' && saveState.conflict && (
            <Btn size="sm" variant="link" onClick={() => setSaveDialog(true)}>
              处理冲突
            </Btn>
          )}
          <IconBtn
            icon="focus"
            label={layout.focus ? '退出专注' : '专注'}
            active={layout.focus}
            onClick={() => setLayout((l) => ({ ...l, focus: !l.focus }))}
          />
          <IconBtn
            icon={dark ? 'sun' : 'moon'}
            label={dark ? '浅色主题' : '深色主题'}
            onClick={() => setDark(!dark)}
          />
        </div>
      </header>
      {saveState.s === 'error' && !saveState.conflict && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 bg-danger-soft px-4 py-2 text-ui-sm text-danger"
        >
          {saveState.message}
          <Btn size="sm" onClick={() => void workspace.retrySave()}>
            重试保存
          </Btn>
          <Btn size="sm" onClick={downloadLocalDraft}>
            导出当前草稿
          </Btn>
        </div>
      )}
    </>
  )
}

import { useState } from 'react'
import type { Margin, Source } from '../../features/vnext/model'
import { Btn, Dot, Heading, Proto, Quote, Row } from './ui'

const stateCopy: Record<Margin['state'], string | null> = {
  fresh: null,
  stale: '这段正文在分析之后被改动过。以下判断基于旧文本，可能已不成立。',
  'source-missing': '部分来源尚未建档，无法核对。请把相关判断当作未证实。',
}

export default function MarginPanel({
  margins,
  ignored,
  activeId,
  onSelect,
  onSource,
  onIgnore,
  onRestore,
  onNote,
  onConflict,
  onThink,
  marksHidden,
  setMarksHidden,
  emptyChapter,
}: {
  margins: Margin[]
  ignored: Margin[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onSource: (s: Source) => void
  onIgnore: (id: string) => void
  onRestore: (id: string) => void
  onNote: (m: Margin) => void
  onConflict: (m: Margin) => void
  onThink: (m: Margin) => void
  marksHidden: boolean
  setMarksHidden: (v: boolean) => void
  emptyChapter: boolean
}) {
  const [showIgnored, setShowIgnored] = useState(false)
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 pb-3 text-micro text-ink-3">
        <span>按段落顺序 · AI 只指出，不修改正文</span>
        <span className="ml-auto">
          <Proto />
        </span>
      </div>
      <div className="scroll flex-1 overflow-auto px-3 pb-6">
        {margins.length === 0 && (
          <p className="px-2 py-8 text-ui text-ink-3">
            {emptyChapter
              ? '这一章还没有正文。写下之后，你可以在停笔时查看注记。'
              : '这一章目前没有注记。'}
          </p>
        )}
        {margins.map((m) => {
          const open = m.id === activeId
          return (
            <article key={m.id} className={`mb-1 rounded-lg ${open ? 'bg-surface' : ''}`}>
              <Row
                onClick={() => onSelect(open ? null : m.id)}
                className="flex items-start gap-2.5 px-2.5 py-2.5"
              >
                <span className="mt-2">
                  <Dot tone={m.tone} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ui text-ink">{m.title}</span>
                  <span className="block text-micro text-ink-3">
                    第 {m.para + 1} 段
                    {m.state !== 'fresh' && (
                      <span className="text-warn">
                        {' '}
                        · {m.state === 'stale' ? '原文已改动' : '来源不全'}
                      </span>
                    )}
                  </span>
                </span>
              </Row>
              {open && (
                <div className="fade space-y-5 px-3 pt-1 pb-4">
                  {stateCopy[m.state] && (
                    <p className="rounded-md bg-warn-soft px-3 py-2 text-ui-sm text-warn">
                      {stateCopy[m.state]}
                    </p>
                  )}
                  <section>
                    <Heading level={3} className="mb-2">
                      事实 · 有出处
                    </Heading>
                    <div className="space-y-3">
                      {m.facts.map((f, i) => (
                        <Quote
                          key={i}
                          label={f.label}
                          tone={m.tone === 'conflict' && i < 2 ? 'conflict' : 'quiet'}
                          state={f.state}
                          onOpen={f.chapterId || f.entryId ? () => onSource(f) : undefined}
                        >
                          {f.quote}
                        </Quote>
                      ))}
                    </div>
                  </section>
                  <section>
                    <Heading level={3} className="mb-1.5">
                      <span className="text-ai">推断 · AI 的理解，未经确认</span>
                    </Heading>
                    <p className="border-l-2 border-dashed border-ai pl-3 text-ui text-ink-2">
                      {m.inference}
                    </p>
                  </section>
                  <section>
                    <Heading level={3} className="mb-1.5">
                      问题 · 留给你
                    </Heading>
                    <p className="font-prose text-ui-lg text-ink">{m.question}</p>
                  </section>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.conflictId && (
                      <Btn size="sm" variant="outline" onClick={() => onConflict(m)}>
                        进入冲突对照
                      </Btn>
                    )}
                    <Btn size="sm" variant="quiet" onClick={() => onNote(m)}>
                      记为创作笔记
                    </Btn>
                    <Btn size="sm" variant="quiet" onClick={() => onThink(m)}>
                      就此思考
                    </Btn>
                    <Btn size="sm" variant="quiet" onClick={() => onIgnore(m.id)}>
                      暂时忽略
                    </Btn>
                  </div>
                </div>
              )}
            </article>
          )
        })}
        {ignored.length > 0 && (
          <div className="mt-4 px-2">
            <Btn variant="link" className="text-ui-sm" onClick={() => setShowIgnored(!showIgnored)}>
              {showIgnored ? '收起' : '查看'}本章已忽略的注记（{ignored.length}）
            </Btn>
            {showIgnored &&
              ignored.map((m) => (
                <div key={m.id} className="mt-2 flex items-center gap-2 text-ui-sm text-ink-3">
                  <Dot tone="quiet" />
                  <span className="flex-1 truncate">{m.title}</span>
                  <Btn size="sm" onClick={() => onRestore(m.id)}>
                    恢复
                  </Btn>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="px-5 py-3 text-ui-sm text-ink-3">
        <Btn
          size="sm"
          variant="quiet"
          className="-ml-2"
          pressed={marksHidden}
          onClick={() => setMarksHidden(!marksHidden)}
        >
          {marksHidden ? '在正文边缘显示标记' : '本次写作不在正文边缘显示标记'}
        </Btn>
      </div>
    </div>
  )
}

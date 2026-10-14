import ThinkingSession from '../../components/vnext/ThinkingSession'
import { Empty } from '../../components/ui'
import { Btn } from '../../components/vnext/ui'
import type { useStudioController } from './useStudioController'
export default function ThinkingSpace({
  studio,
  demo,
  wide,
}: {
  studio: ReturnType<typeof useStudioController>
  demo: boolean
  wide: boolean
}) {
  const {
    prototype,
    thinkingSeed,
    selection,
    composer,
    setComposer,
    current,
    saveNote,
    openNotes,
  } = studio
  const agent = prototype.thinkingAgent
  if (!demo)
    return (
      <Empty
        title="思考 Agent 尚未接入"
        desc="理解、挑战与有出处的研究需要真实 Agent Runtime。你可以先把自己的想法保存为创作笔记。"
        action={<Btn onClick={openNotes}>记录自己的想法</Btn>}
      />
    )
  if (!agent)
    return (
      <p role="status" className="px-5 text-ui text-ink-3">
        正在读取思考演示…
      </p>
    )
  return (
    <ThinkingSession
      agent={agent}
      composer={composer}
      setComposer={setComposer}
      session={prototype.session}
      seedQuote={thinkingSeed || selection}
      wide={wide}
      onStart={(idea, quote) =>
        prototype.setSession({
          id: crypto.randomUUID(),
          topic: idea,
          at: Date.now(),
          chapterId: current,
          blocks: [{ kind: 'idea', text: idea, quote }, agent.understand(idea, quote)],
        })
      }
      onBlocks={(blocks) =>
        prototype.setSession((session) => (session ? { ...session, blocks } : session))
      }
      onConclude={saveNote}
      onOpenNote={openNotes}
    />
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeRound, ChatMessage, Decision, DecisionAction, Document, Proposal } from '@writer-agent/contracts'
import type { AgentTask, Layout } from '../../types'
import type { WriterAgentAdapter } from '../../services/writerAgent'
import { useWorkspaceActions } from './useWorkspaceActions'
import { createId } from '../../lib/id'

export const WORKSPACE_STORAGE_KEY = 'writer-agent.v2'

export type WorkspaceConfirmAction = {
  title: string
  desc: string
  confirmText: string
  danger?: boolean
  run: () => void
}

type PersistedWorkspace = {
  doc: Document
  proposals: Proposal[]
  decisions: Decision[]
  layout: Layout
  chat: ChatMessage[]
  challenge: ChallengeRound[]
  seq: number
  current: string
  dark: boolean
}

const defaultLayout: Layout = { leftOpen: true, rightOpen: true, leftW: 248, rightW: 380, focus: false }

function loadWorkspace(document: Document): PersistedWorkspace {
  const defaults: PersistedWorkspace = {
    doc: document, proposals: [], decisions: [], chat: [], challenge: [], seq: 0, current: 'c12', dark: false,
    layout: defaultLayout,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) || 'null') as Partial<PersistedWorkspace> | null
    return saved ? { ...defaults, ...saved, layout: { ...defaultLayout, ...saved.layout } } : defaults
  } catch {
    return defaults
  }
}

export function useWorkspaceController({ adapter, toast, requestConfirm }: {
  adapter: WriterAgentAdapter
  toast: (message: string) => void
  requestConfirm: (action: WorkspaceConfirmAction) => void
}) {
  const actions = useWorkspaceActions(adapter)
  const defaults = useMemo(() => loadWorkspace(adapter.seed.document), [adapter.seed.document])
  const [doc, setDoc] = useState(defaults.doc)
  const [proposals, setProposals] = useState(defaults.proposals)
  const [decisions, setDecisions] = useState(defaults.decisions)
  const [layout, setLayout] = useState(defaults.layout)
  const [chat, setChat] = useState(defaults.chat)
  const [challenge, setChallenge] = useState(defaults.challenge)
  const [seq, setSeq] = useState(defaults.seq)
  const [current, setCurrent] = useState(defaults.current)
  const [dark, setDark] = useState(defaults.dark)
  const [task, setTask] = useState<AgentTask>({ state: 'idle' })
  const [saveState, setSaveState] = useState<{ s: 'saved' | 'saving'; at: number }>({ s: 'saved', at: Date.now() })

  const docRef = useRef(doc)
  docRef.current = doc
  const proposalsRef = useRef(proposals)
  proposalsRef.current = proposals
  const reviewTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)
  const reviewGeneration = useRef(0)

  const persist = useCallback(() => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ doc: docRef.current, proposals, decisions, layout, chat, challenge, seq, current, dark }))
  }, [proposals, decisions, layout, chat, challenge, seq, current, dark])
  useEffect(persist, [persist])

  const flushSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    const chapterId = current
    void actions.saveChapter(chapterId, docRef.current[chapterId] ?? [])
      .then((result) => { persist(); setSaveState({ s: 'saved', at: result.savedAt }) })
      .catch((cause: unknown) => { setSaveState({ s: 'saved', at: Date.now() }); toast(cause instanceof Error ? cause.message : '保存失败') })
  }, [actions, current, persist, toast])

  const onChange = useCallback((paragraphs: string[]) => {
    const chapterId = current
    setDoc((existing) => ({ ...existing, [chapterId]: paragraphs }))
    setSaveState((existing) => ({ ...existing, s: 'saving' }))
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void actions.saveChapter(chapterId, paragraphs)
        .then((result) => { persist(); setSaveState({ s: 'saved', at: result.savedAt }) })
        .catch((cause: unknown) => { setSaveState({ s: 'saved', at: Date.now() }); toast(cause instanceof Error ? cause.message : '保存失败') })
    }, 700)
  }, [actions, current, persist, toast])

  const switchChapter = useCallback((chapterId: string) => {
    if (chapterId === current) return
    flushSave()
    setCurrent(chapterId)
  }, [current, flushSave])

  const addDecision = (proposalId: string, action: DecisionAction, by: Decision['by'] = '作者', note?: string): Decision => ({
    id: createId(), proposalId, action, by, note, at: Date.now(),
  })

  const runReview = () => {
    if (task.state === 'running') return
    flushSave()
    const runId = ++reviewGeneration.current
    const chapterId = current
    const steps = ['读取本章正文', '比对时间线', '检索人物档案', '核对伏笔库', '整理证据与分析']
    let index = 0
    setTask({ state: 'running', name: `连续性审查 · ${adapter.seed.chapters.find((chapter) => chapter.id === chapterId)?.title}`, step: steps[0], progress: 8 })
    reviewTimer.current = window.setInterval(() => {
      index++
      if (index < steps.length) {
        setTask((currentTask) => currentTask.state === 'running' ? { ...currentTask, step: steps[index], progress: 8 + (index * 84) / steps.length } : currentTask)
        return
      }
      clearInterval(reviewTimer.current)
      const paragraphs = docRef.current[chapterId] ?? []
      if (paragraphs.join('').replace(/\s/g, '').length < 20) {
        setTask({ state: 'failed', error: '本章正文不足 20 字，无法进行有意义的比对。请先写一些内容。' })
        return
      }
      void actions.reviewChapter(chapterId, paragraphs, seq).then(({ proposals: results }) => {
        if (runId !== reviewGeneration.current) return
        setSeq((value) => value + 3)
        let created = 0
        let resolved = 0
        let kept = 0
        const newDecisions: Decision[] = []
        const next = proposalsRef.current.map((proposal) => ({ ...proposal }))
        for (const result of results) {
          const existing = next.find((proposal) => proposal.ruleKey === result.ruleKey)
          if (!existing) { next.push(result); created++; continue }
          existing.anchor = result.anchor
          if (existing.status === 'resolved') {
            existing.status = 'pending'
            existing.updatedAt = Date.now()
            newDecisions.push(addDecision(existing.id, '复审：再次出现', '系统复审'))
            created++
          } else kept++
        }
        for (const proposal of next) {
          if (proposal.chapterId === chapterId && proposal.origin === '审查' && !results.some((result) => result.ruleKey === proposal.ruleKey) && ['pending', 'adopted', 'deferred'].includes(proposal.status)) {
            proposal.status = 'resolved'
            proposal.updatedAt = Date.now()
            resolved++
            newDecisions.push(addDecision(proposal.id, '复审：已解决', '系统复审', '正文中已不再出现该问题'))
          }
        }
        setProposals(next)
        setDecisions((existing) => [...existing, ...newDecisions])
        const summary = results.length === 0 && resolved === 0 ? '未发现问题' : `新发现 ${created} 项${kept ? ` · 保留 ${kept} 项` : ''}${resolved ? ` · ${resolved} 项已解决` : ''}`
        setTask({ state: 'done', summary, at: Date.now() })
        toast(`审查完成：${summary}`)
      }).catch((cause: unknown) => {
        if (runId === reviewGeneration.current) setTask({ state: 'failed', error: cause instanceof Error ? cause.message : '审查请求失败。' })
      })
    }, 520)
  }

  const cancelReview = () => {
    reviewGeneration.current++
    clearInterval(reviewTimer.current)
    setTask({ state: 'idle' })
    toast('已取消审查')
  }

  const decide = (id: string, action: 'adopt' | 'reject' | 'defer' | 'note' | 'reopen', optionId?: string) => {
    const proposal = proposals.find((value) => value.id === id)
    if (!proposal) return
    const apply = () => {
      const map = { adopt: ['adopted', '采纳'], reject: ['rejected', '拒绝'], defer: ['deferred', '暂缓'], note: ['noted', '收录参考'], reopen: ['pending', '重新打开'] } as const
      const [status, label] = map[action]
      setProposals((all) => all.map((value) => value.id === id ? {
        ...value, status, chosenOption: action === 'adopt' ? optionId : action === 'reopen' ? undefined : value.chosenOption, updatedAt: Date.now(),
      } : value))
      setDecisions((all) => [...all, addDecision(id, label, '作者', action === 'adopt' ? proposal.options.find((option) => option.id === optionId)?.label : undefined)])
      toast(action === 'adopt' ? '已采纳 · 正文保持不变，等待你修改' : action === 'note' ? '已收录至研究笔记（不写入作品设定）' : `提案 ${id} 已${label}`)
    }
    if (action === 'reject') requestConfirm({
      title: proposal.kind === 'research' ? '忽略这条研究参考？' : '拒绝这条建议？',
      desc: '拒绝后，同一问题在复审中不会再次提醒。你可以随时在「决策」中撤回。',
      confirmText: '确认拒绝', danger: true, run: apply,
    })
    else apply()
  }

  const createProposal = (proposal: Omit<Proposal, 'id' | 'ruleKey' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const id = `P-D${String(proposals.filter((value) => value.origin !== '审查').length + 1).padStart(3, '0')}`
    const now = Date.now()
    setProposals((all) => [...all, { ...proposal, id, ruleKey: id, status: 'pending', createdAt: now, updatedAt: now }])
    setDecisions((all) => [...all, addDecision(id, '创建提案')])
    toast(`已保存为候选提案 ${id} · 见「决策」`)
    return id
  }

  const sendChat = async (text: string, quote?: string) => {
    const author: ChatMessage = { id: createId(), role: 'author', text, quote }
    setChat((messages) => [...messages, author])
    const reply = await actions.sendMessage(current, text, quote)
    setChat((messages) => [...messages, { id: createId(), role: 'agent', ...reply }])
  }

  const markChatSaved = (message: ChatMessage, proposalId: string) => {
    setChat((messages) => messages.map((value) => value.id === message.id ? { ...value, savedAs: proposalId } : value))
  }
  const requestChallenge = (intent: string, previousRounds: ChallengeRound[]) => actions.challenge(intent, previousRounds)

  return {
    doc, proposals, decisions, layout, setLayout, chat, challenge, setChallenge, seq,
    current, dark, setDark, task, saveState, flushSave, onChange, switchChapter,
    runReview, cancelReview, decide, createProposal, sendChat, markChatSaved, requestChallenge,
  }
}

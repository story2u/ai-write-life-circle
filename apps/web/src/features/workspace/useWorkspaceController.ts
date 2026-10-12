import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeRound, ChatMessage, ChapterVersion, Decision, DecisionAction, Document, Proposal, WorkspaceSnapshot } from '@writer-agent/contracts'
import type { AgentTask, Layout } from '../../types'
import { ChapterRevisionConflictError, type WriterAgentAdapter } from '../../services/writerAgent'
import { useWorkspaceActions } from './useWorkspaceActions'
import { createId } from '../../lib/id'
import { hashParagraphs } from '../../lib/sourceHash'

export const WORKSPACE_STORAGE_KEY = 'writer-agent.v2'

export type WorkspaceConfirmAction = {
  title: string
  desc: string
  confirmText: string
  danger?: boolean
  run: () => void
}

export type SaveState =
  | { s: 'dirty' }
  | { s: 'saving' }
  | { s: 'saved'; at: number }
  | { s: 'error'; message: string; conflict: boolean }

type PersistedWorkspace = {
  doc: Document
  proposals: Proposal[]
  decisions: Decision[]
  chapterVersions: Record<string, ChapterVersion>
  layout: Layout
  chat: ChatMessage[]
  challenge: ChallengeRound[]
  seq: number
  current: string
  dark: boolean
}

const defaultLayout: Layout = { leftOpen: true, rightOpen: true, leftW: 248, rightW: 380, focus: false }

function getDemoPreferences() {
  if (typeof localStorage === 'undefined') return { layout: defaultLayout, dark: false }
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) || 'null') as Partial<PersistedWorkspace> | null
    return saved ? { layout: { ...defaultLayout, ...saved.layout }, dark: saved.dark ?? false } : { layout: defaultLayout, dark: false }
  } catch {
    return { layout: defaultLayout, dark: false }
  }
}

export function useWorkspaceController({ adapter, initialWorkspace, toast, requestConfirm }: {
  adapter: WriterAgentAdapter
  initialWorkspace: WorkspaceSnapshot
  toast: (message: string) => void
  requestConfirm: (action: WorkspaceConfirmAction) => void
}) {
  const actions = useWorkspaceActions(adapter)
  const preferences = useMemo(() => adapter.mode === 'demo' ? getDemoPreferences() : { layout: defaultLayout, dark: false }, [adapter.mode])
  const chapterIds = useMemo(() => new Set(initialWorkspace.chapters.map((chapter) => chapter.id)), [initialWorkspace])
  const [doc, setDoc] = useState(initialWorkspace.document)
  const [proposals, setProposals] = useState(initialWorkspace.proposals)
  const [decisions, setDecisions] = useState(initialWorkspace.decisions)
  const [chapterVersions, setChapterVersions] = useState(initialWorkspace.chapterVersions)
  const [layout, setLayout] = useState(preferences.layout)
  const [chat, setChat] = useState(initialWorkspace.chat)
  const [challenge, setChallenge] = useState(initialWorkspace.challenge)
  const [seq, setSeq] = useState(initialWorkspace.sequence)
  const [current, setCurrent] = useState(chapterIds.has(initialWorkspace.currentChapterId) ? initialWorkspace.currentChapterId : initialWorkspace.chapters[0]?.id ?? '')
  const [dark, setDark] = useState(preferences.dark)
  const [task, setTask] = useState<AgentTask>({ state: 'idle' })
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>(() => Object.fromEntries(
    initialWorkspace.chapters.map((chapter) => [chapter.id, { s: 'saved', at: Date.now() } satisfies SaveState]),
  ))

  const docRef = useRef(doc)
  docRef.current = doc
  const proposalsRef = useRef(proposals)
  proposalsRef.current = proposals
  const chapterVersionsRef = useRef(chapterVersions)
  const editVersionsRef = useRef(new Map(initialWorkspace.chapters.map((chapter) => [chapter.id, 0])))
  const savedEditVersionsRef = useRef(new Map(initialWorkspace.chapters.map((chapter) => [chapter.id, 0])))
  const saveTimersRef = useRef(new Map<string, number>())
  const saveQueuesRef = useRef(new Map<string, Promise<boolean>>())
  const saveAttemptsRef = useRef(new Map<string, Promise<boolean>>())
  const reviewTimer = useRef<number | undefined>(undefined)
  const reviewGeneration = useRef(0)
  const reviewInFlight = useRef(false)

  const persist = useCallback(() => {
    if (adapter.mode !== 'demo' || typeof localStorage === 'undefined') return
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({
      doc, proposals, decisions, chapterVersions,
      layout, chat, challenge, seq, current, dark,
    } satisfies PersistedWorkspace))
  }, [adapter.mode, doc, proposals, decisions, chapterVersions, layout, chat, challenge, seq, current, dark])
  useEffect(persist, [persist])

  const setChapterSaveState = useCallback((chapterId: string, state: SaveState) => {
    setSaveStates((states) => ({ ...states, [chapterId]: state }))
  }, [])

  const enqueueSave = useCallback((chapterId: string, paragraphs: string[], editVersion: number): Promise<boolean> => {
    const attemptKey = `${chapterId}:${editVersion}`
    const existingAttempt = saveAttemptsRef.current.get(attemptKey)
    if (existingAttempt) return existingAttempt

    const prior = saveQueuesRef.current.get(chapterId) ?? Promise.resolve(true)
    const attempt = prior.catch(() => false).then(async () => {
      const baseVersion = chapterVersionsRef.current[chapterId]
      if (!baseVersion) throw new Error('缺少章节版本信息，无法安全保存。')
      const sourceHash = await hashParagraphs(paragraphs)
      const result = await actions.saveChapter({
        projectId: initialWorkspace.projectId,
        chapterId,
        paragraphs,
        revision: baseVersion.revision,
        sourceHash,
      })
      if (result.projectId !== initialWorkspace.projectId || result.chapterId !== chapterId || result.sourceHash !== sourceHash || result.revision <= baseVersion.revision) {
        throw new Error('保存响应与当前章节版本不匹配，草稿仍保留在本地。')
      }

      const nextVersion = { revision: result.revision, sourceHash: result.sourceHash }
      chapterVersionsRef.current = { ...chapterVersionsRef.current, [chapterId]: nextVersion }
      setChapterVersions(chapterVersionsRef.current)
      savedEditVersionsRef.current.set(chapterId, editVersion)
      if (editVersionsRef.current.get(chapterId) === editVersion) setChapterSaveState(chapterId, { s: 'saved', at: result.savedAt })
      return true
    }).catch((cause: unknown) => {
      if (editVersionsRef.current.get(chapterId) === editVersion) {
        const conflict = cause instanceof ChapterRevisionConflictError
        const message = cause instanceof Error ? cause.message : '保存失败。'
        setChapterSaveState(chapterId, { s: 'error', message, conflict })
        toast(message)
      }
      return false
    })

    saveAttemptsRef.current.set(attemptKey, attempt)
    saveQueuesRef.current.set(chapterId, attempt)
    void attempt.then(() => {
      if (saveAttemptsRef.current.get(attemptKey) === attempt) saveAttemptsRef.current.delete(attemptKey)
      if (saveQueuesRef.current.get(chapterId) === attempt) saveQueuesRef.current.delete(chapterId)
    })
    return attempt
  }, [actions, initialWorkspace.projectId, setChapterSaveState, toast])

  const flushSave = useCallback(async (chapterId = current): Promise<boolean> => {
    const timer = saveTimersRef.current.get(chapterId)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      saveTimersRef.current.delete(chapterId)
    }
    const editVersion = editVersionsRef.current.get(chapterId) ?? 0
    if (editVersion === (savedEditVersionsRef.current.get(chapterId) ?? 0)) return true
    setChapterSaveState(chapterId, { s: 'saving' })
    return enqueueSave(chapterId, docRef.current[chapterId] ?? [], editVersion)
  }, [current, enqueueSave, setChapterSaveState])

  const onChange = useCallback((paragraphs: string[]) => {
    const chapterId = current
    const editVersion = (editVersionsRef.current.get(chapterId) ?? 0) + 1
    editVersionsRef.current.set(chapterId, editVersion)
    const nextDocument = { ...docRef.current, [chapterId]: paragraphs }
    docRef.current = nextDocument
    setDoc(nextDocument)
    setChapterSaveState(chapterId, { s: 'dirty' })

    const previousTimer = saveTimersRef.current.get(chapterId)
    if (previousTimer !== undefined) window.clearTimeout(previousTimer)
    const timer = window.setTimeout(() => {
      saveTimersRef.current.delete(chapterId)
      setChapterSaveState(chapterId, { s: 'saving' })
      void enqueueSave(chapterId, paragraphs, editVersion)
    }, 700)
    saveTimersRef.current.set(chapterId, timer)
  }, [current, enqueueSave, setChapterSaveState])

  const retrySave = useCallback(() => flushSave(current), [current, flushSave])

  useEffect(() => {
    const hasUnsavedChanges = Object.values(saveStates).some((state) => state.s === 'dirty' || state.s === 'saving' || state.s === 'error')
    if (!hasUnsavedChanges) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [saveStates])

  useEffect(() => () => {
    for (const timer of saveTimersRef.current.values()) window.clearTimeout(timer)
    if (reviewTimer.current !== undefined) window.clearInterval(reviewTimer.current)
  }, [])

  const switchChapter = useCallback((chapterId: string) => {
    if (chapterId === current || !chapterIds.has(chapterId)) return
    void flushSave(current)
    setCurrent(chapterId)
  }, [chapterIds, current, flushSave])

  const addDecision = (proposalId: string, action: DecisionAction, by: Decision['by'] = '作者', note?: string): Decision => ({
    id: createId(), proposalId, action, by, note, at: Date.now(),
  })

  const runReview = useCallback(async () => {
    if (reviewInFlight.current) return
    reviewInFlight.current = true
    const runId = ++reviewGeneration.current
    const chapterId = current
    const saveOk = await flushSave(chapterId)
    if (runId !== reviewGeneration.current) {
      reviewInFlight.current = false
      return
    }
    if (!saveOk) {
      reviewInFlight.current = false
      setTask({ state: 'failed', error: '章节尚未保存，审查已暂停。修复保存问题后可重试。' })
      return
    }

    const reviewRunId = createId()
    const paragraphs = docRef.current[chapterId] ?? []
    const baseVersion = chapterVersionsRef.current[chapterId]
    const sourceHash = await hashParagraphs(paragraphs)
    const steps = ['读取本章正文', '比对时间线', '检索人物档案', '核对伏笔库', '整理证据与分析']
    let index = 0
    setTask({ state: 'running', name: `连续性审查 · ${initialWorkspace.chapters.find((chapter) => chapter.id === chapterId)?.title}`, step: steps[0], progress: 8 })
    reviewTimer.current = window.setInterval(() => {
      index++
      if (index < steps.length) {
        setTask((currentTask) => currentTask.state === 'running' ? { ...currentTask, step: steps[index], progress: 8 + (index * 84) / steps.length } : currentTask)
        return
      }
      if (reviewTimer.current !== undefined) window.clearInterval(reviewTimer.current)
      const currentParagraphs = docRef.current[chapterId] ?? []
      if (currentParagraphs.join('').replace(/\s/g, '').length < 20) {
        reviewInFlight.current = false
        setTask({ state: 'failed', error: '本章正文不足 20 字，无法进行有意义的比对。请先写一些内容。' })
        return
      }
      void actions.reviewChapter({
        projectId: initialWorkspace.projectId,
        chapterId,
        paragraphs,
        revision: baseVersion.revision,
        sourceHash,
        reviewRunId,
        scope: ['timeline', 'characters', 'foreshadowing', 'worldbuilding'],
        sequence: seq,
      }).then(async (result) => {
        if (runId !== reviewGeneration.current) return
        const liveHash = await hashParagraphs(docRef.current[chapterId] ?? [])
        const liveVersion = chapterVersionsRef.current[chapterId]
        if (liveHash !== sourceHash || liveVersion?.revision !== baseVersion.revision) {
          reviewInFlight.current = false
          setTask({ state: 'failed', error: '审查期间正文版本发生变化，旧结果已丢弃。请重新审查。' })
          return
        }
        if (result.projectId !== initialWorkspace.projectId || result.chapterId !== chapterId || result.reviewRunId !== reviewRunId || result.revision !== baseVersion.revision || result.sourceHash !== sourceHash) {
          reviewInFlight.current = false
          setTask({ state: 'failed', error: '审查结果与提交的正文版本不匹配，已丢弃。' })
          return
        }
        if (result.evidenceValidation.status === 'invalid') {
          reviewInFlight.current = false
          setTask({ state: 'failed', error: '审查证据校验失败，结果未写入提案。' })
          return
        }

        setSeq((value) => value + Math.max(result.proposals.length, 1))
        let created = 0
        let reopened = 0
        let kept = 0
        const newDecisions: Decision[] = []
        const next = proposalsRef.current.map((proposal) => ({ ...proposal }))
        for (const resultProposal of result.proposals) {
          if (resultProposal.projectId !== initialWorkspace.projectId || resultProposal.reviewRunId !== reviewRunId || resultProposal.chapterRevision !== baseVersion.revision || resultProposal.sourceHash !== sourceHash) {
            reviewInFlight.current = false
            setTask({ state: 'failed', error: '提案缺少当前审查版本信息，结果未写入。' })
            return
          }
          const existing = next.find((proposal) => proposal.chapterId === chapterId && proposal.ruleKey === resultProposal.ruleKey)
          if (!existing) { next.push(resultProposal); created++; continue }
          existing.anchor = resultProposal.anchor
          existing.projectId = resultProposal.projectId
          existing.reviewRunId = resultProposal.reviewRunId
          existing.chapterRevision = resultProposal.chapterRevision
          existing.sourceHash = resultProposal.sourceHash
          existing.evidenceRefs = resultProposal.evidenceRefs
          existing.evidence = resultProposal.evidence
          existing.updatedAt = Date.now()
          if (existing.status === 'resolved') {
            existing.status = 'pending'
            newDecisions.push(addDecision(existing.id, '复审：再次出现', '系统复审'))
            reopened++
          } else kept++
        }
        setProposals(next)
        setDecisions((existing) => [...existing, ...newDecisions])
        const notices = [
          result.coverage.complete ? '' : '覆盖不完整',
          result.evidenceValidation.status === 'partial' ? '部分证据未核验' : '',
        ].filter(Boolean)
        const summary = result.proposals.length === 0 && kept === 0 && reopened === 0
          ? '未发现问题'
          : `新发现 ${created} 项${kept ? ` · 保留 ${kept} 项` : ''}${reopened ? ` · 重开 ${reopened} 项` : ''}`
        reviewInFlight.current = false
        setTask({ state: 'done', summary: [summary, ...notices].join(' · '), at: Date.now() })
        toast(`审查完成：${[summary, ...notices].join(' · ')}`)
      }).catch((cause: unknown) => {
        if (runId === reviewGeneration.current) {
          reviewInFlight.current = false
          setTask({ state: 'failed', error: cause instanceof Error ? cause.message : '审查请求失败。' })
        }
      })
    }, 520)
  }, [actions, current, flushSave, initialWorkspace.chapters, initialWorkspace.projectId, seq, toast])

  const cancelReview = useCallback(() => {
    reviewGeneration.current++
    reviewInFlight.current = false
    if (reviewTimer.current !== undefined) window.clearInterval(reviewTimer.current)
    setTask({ state: 'idle' })
    toast('已取消审查')
  }, [toast])

  const decide = useCallback(async (id: string, action: 'adopt' | 'reject' | 'defer' | 'note' | 'reopen', optionId?: string) => {
    const proposal = proposalsRef.current.find((value) => value.id === id)
    if (!proposal) return
    if (action === 'adopt' && proposal.origin === '审查') {
      const chapterId = proposal.chapterId
      if (!chapterId || !proposal.sourceHash || proposal.chapterRevision === undefined) {
        toast('这条旧提案没有正文版本信息，请先重新审查后再采纳。')
        return
      }
      const liveHash = await hashParagraphs(docRef.current[chapterId] ?? [])
      if (proposal.projectId !== initialWorkspace.projectId || proposal.sourceHash !== liveHash || proposal.chapterRevision !== chapterVersionsRef.current[chapterId]?.revision) {
        toast('这条提案对应的正文版本已变化，已阻止采纳。请重新审查后再决定。')
        return
      }
    }
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
  }, [initialWorkspace.projectId, requestConfirm, toast])

  const createProposal = useCallback((proposal: Omit<Proposal, 'id' | 'ruleKey' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const id = `P-D${String(proposalsRef.current.filter((value) => value.origin !== '审查').length + 1).padStart(3, '0')}`
    const now = Date.now()
    setProposals((all) => [...all, { ...proposal, id, ruleKey: id, status: 'pending', createdAt: now, updatedAt: now }])
    setDecisions((all) => [...all, addDecision(id, '创建提案')])
    toast(`已保存为候选提案 ${id} · 见「决策」`)
    return id
  }, [toast])

  const sendChat = useCallback(async (text: string, quote?: string) => {
    const author: ChatMessage = { id: createId(), role: 'author', text, quote }
    setChat((messages) => [...messages, author])
    try {
      const reply = await actions.sendMessage({ projectId: initialWorkspace.projectId, chapterId: current, text, quote })
      setChat((messages) => [...messages, { id: createId(), role: 'agent', ...reply }])
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : '对话请求失败。')
    }
  }, [actions, current, initialWorkspace.projectId, toast])

  const markChatSaved = useCallback((message: ChatMessage, proposalId: string) => {
    setChat((messages) => messages.map((value) => value.id === message.id ? { ...value, savedAs: proposalId } : value))
  }, [])
  const requestChallenge = useCallback((intent: string, previousRounds: ChallengeRound[]) =>
    actions.challenge({ projectId: initialWorkspace.projectId, intent, previousRounds }), [actions, initialWorkspace.projectId])

  return {
    chapters: initialWorkspace.chapters,
    knowledge: initialWorkspace.knowledge,
    projectId: initialWorkspace.projectId,
    doc, proposals, decisions, layout, setLayout, chat, challenge, setChallenge, seq,
    current, dark, setDark, task, saveState: saveStates[current] ?? { s: 'saved', at: Date.now() },
    flushSave, retrySave, onChange, switchChapter, runReview, cancelReview, decide,
    createProposal, sendChat, markChatSaved, requestChallenge,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReviewFinding, ReviewPlan, ReviewRun, ReviewType, ReviewFeedbackInput } from '@writer-agent/contracts'
import type { WriterAgentAdapter } from '../../services/writerAgent'
import type { useWorkspaceController } from '../workspace/useWorkspaceController'

const message = (e: unknown) => e instanceof Error ? e.message : '审查请求失败，请重试。'
export function useReviewController({ adapter, workspace, available, paneOpen, toast }: {
  adapter: WriterAgentAdapter; workspace: ReturnType<typeof useWorkspaceController>; available: boolean;
  paneOpen: boolean; toast: (text: string) => void;
}) {
  const client = adapter.mode === 'api' ? adapter.reviews : undefined
  const { projectId, current, markdownByChapter, chapterVersions, prepareReview } = workspace
  const [runs, setRuns] = useState<ReviewRun[]>([])
  const [selected, setSelected] = useState<ReviewRun | null>(null)
  const [plan, setPlan] = useState<ReviewPlan | null>(null)
  const [types, setTypes] = useState<ReviewType[]>(['character_consistency', 'timeline_consistency'])
  const [busy, setBusy] = useState<'preview' | 'start' | 'feedback' | 'cancel' | 'loading' | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const chapterRef = useRef(current)
  chapterRef.current = current
  const notified = useRef(new Set<string>())
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = selected?.chapterId === current ? selected : null
  const target = run?.sources.find((source) => source.kind === 'target')
  const version = chapterVersions[current]
  const latest = useRef({ current, markdown: markdownByChapter[current], version })
  latest.current = { current, markdown: markdownByChapter[current], version }
  const runId = run?.runId
  const runStatus = run?.status
  const stale = !!run && (run.stale || target?.excerpt !== markdownByChapter[current]
    || version?.mode !== 'api' || version.revisionId !== run.revisionId || version.contentHash !== run.contentHash)

  const accept = useCallback((value: ReviewRun) => {
    setSelected((prior) => prior?.runId === value.runId && prior.version > value.version ? prior : value)
    setRuns((all) => {
      const prior = all.find((item) => item.runId === value.runId)
      const next = prior && prior.version > value.version ? prior : value
      return [next, ...all.filter((item) => item.runId !== value.runId)]
    })
  }, [])
  useEffect(() => {
    if (!client || !paneOpen || !current) return
    const controller = new AbortController()
    const request = ++generation.current
    void client.list(projectId, current, controller.signal).then((items) => {
      if (controller.signal.aborted || request !== generation.current) return
      setRuns(items)
      setSelected((prior) => items.find((item) => item.runId === prior?.runId) ?? items[0] ?? null)
      setError('')
    }).catch((e: unknown) => { if (!controller.signal.aborted && request === generation.current) setError(message(e)) })
    return () => controller.abort()
  }, [client, projectId, current, paneOpen, refresh])

  useEffect(() => {
    if (!client || !runId || runStatus !== 'running') return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const value = await client.get(projectId, runId, controller.signal)
        if (controller.signal.aborted) return
        accept(value)
        if (value.status === 'running') timer = setTimeout(() => void poll(), 1000)
        else if (!notified.current.has(value.runId)) {
          notified.current.add(value.runId)
          toast(value.status === 'completed' ? '审查已完成，可按需查看注记。' : '审查已结束，可查看状态。')
        }
      } catch (e) { if (!controller.signal.aborted) setError(`${message(e)} 没有确认结果已保存，请刷新核对。`) }
    }
    timer = setTimeout(() => void poll(), 400)
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [client, projectId, runId, runStatus, accept, toast, refresh]) // Poll only accepted work; never invoke a model from an effect.

  const prepare = async (nextTypes = types) => {
    if (!client || !available) { toast('服务端尚未配置可用模型，真实审查不可用。'); return }
    if (nextTypes.length === 0) { toast('至少选择一种审查类型。'); return }
    if (busy) return
    setBusy('preview'); setError(''); setTypes(nextTypes)
    const chapter = current
    const request = ++generation.current
    try {
      const snapshot = await prepareReview(chapter)
      const value = await client.preview(projectId, chapter, { revisionId: snapshot.revisionId, contentHash: snapshot.contentHash, reviewTypes: nextTypes })
      if (mounted.current && chapterRef.current === chapter && request === generation.current) setPlan(value)
    } catch (e) { if (mounted.current) { setError(message(e)); toast(message(e)) } }
    finally { if (mounted.current) setBusy(null) }
  }
  const start = async () => {
    if (!client || !plan || busy) return false
    setBusy('start'); setError('')
    try {
      const snapshot = await prepareReview(plan.chapterId)
      if (chapterRef.current !== plan.chapterId || snapshot.revisionId !== plan.revisionId || snapshot.contentHash !== plan.contentHash) throw new Error('正文已变化，请重新预览并确认审查范围。')
      const value = await client.start(projectId, plan.chapterId, {
        revisionId: plan.revisionId, contentHash: plan.contentHash, reviewTypes: plan.reviewTypes,
        consent: { confirmed: true, planHash: plan.planHash },
      }, crypto.randomUUID())
      generation.current++
      if (mounted.current) { accept(value); setPlan(null); setActiveId(null) }
      return true
    } catch (e) { if (mounted.current) { setError(message(e)); toast(message(e)) }; return false }
    finally { if (mounted.current) setBusy(null) }
  }
  const cancel = async () => {
    if (!client || !run || busy) return
    setBusy('cancel')
    try { const value = await client.cancel(projectId, run.runId, crypto.randomUUID()); generation.current++; if (mounted.current) accept(value) }
    catch (e) { if (mounted.current) setError(message(e)) }
    finally { if (mounted.current) setBusy(null) }
  }
  const feedback = async (findingId: string, choice: ReviewFeedbackInput['choice']) => {
    if (!client || !run || busy) return
    setBusy('feedback'); setError('')
    try {
      const value = await client.feedback(projectId, run.runId, findingId, { choice, baseVersion: run.version }, crypto.randomUUID())
      generation.current++; if (mounted.current) { accept(value); toast('作者反馈已保存。') }
    } catch (e) { if (mounted.current) { setError(`${message(e)} 请刷新后核对反馈状态。`); setRefresh((value) => value + 1) } }
    finally { if (mounted.current) setBusy(null) }
  }
  const choose = async (id: string) => {
    if (!client || busy) return
    setBusy('loading')
    const request = ++generation.current
    try { const value = await client.get(projectId, id); if (mounted.current && request === generation.current) { accept(value); setActiveId(null) } }
    catch (e) { if (mounted.current) setError(message(e)) }
    finally { if (mounted.current) setBusy(null) }
  }
  const revalidate = async (id: string): Promise<ReviewRun | null> => {
    if (!client || !run) return null
    const request = ++generation.current
    try {
      const value = await client.get(projectId, run.runId)
      if (!mounted.current || request !== generation.current) return null
      accept(value)
      const local = latest.current
      const target = value.sources.find((source) => source.kind === 'target')
      if (value.stale || value.chapterId !== local.current || local.version?.mode !== 'api' || local.version.revisionId !== value.revisionId || local.version.contentHash !== value.contentHash || target?.excerpt !== local.markdown || !value.findings.some((finding) => finding.findingId === id)) {
        toast('正文或证据已变化，旧注记不能定位到当前正文。'); return null
      }
      return value
    } catch (e) { if (mounted.current) setError(message(e)); return null }
  }
  const finding = (id: string): ReviewFinding | undefined => run?.findings.find((item) => item.findingId === id)
  return { available: available && !!client, runs: runs.filter((item) => item.chapterId === current), run, plan: plan?.chapterId === current ? plan : null,
    closePlan: () => { if (busy !== 'start') { generation.current++; setPlan(null) } }, types, busy, error, stale, prepare, start, cancel, feedback,
    activeId, setActiveId, choose, finding, revalidate, refresh: () => setRefresh((value) => value + 1),
  }
}

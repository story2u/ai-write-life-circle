import { useCallback, useMemo } from 'react'
import type { ChallengeRound } from '@writer-agent/contracts'
import type { WriterAgentAdapter } from '../../services/writerAgent'

/** Application workflow boundary between UI events and whichever API adapter is active. */
export function useWorkspaceActions(adapter: WriterAgentAdapter) {
  const saveChapter = useCallback((chapterId: string, paragraphs: string[]) =>
    adapter.saveChapter({ chapterId, paragraphs }), [adapter])

  const reviewChapter = useCallback((chapterId: string, paragraphs: string[], sequence: number) =>
    adapter.runReview({ chapterId, paragraphs, sequence }), [adapter])

  const sendMessage = useCallback((chapterId: string, text: string, quote?: string) =>
    adapter.sendMessage({ chapterId, text, quote }), [adapter])

  const challenge = useCallback((intent: string, previousRounds: ChallengeRound[]) =>
    adapter.challenge({ intent, previousRounds }), [adapter])

  return useMemo(() => ({ saveChapter, reviewChapter, sendMessage, challenge }), [saveChapter, reviewChapter, sendMessage, challenge])
}

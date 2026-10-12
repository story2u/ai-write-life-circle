import { useMemo } from 'react'
import { createWriterAgentAdapter } from '../services/adapterFactory'

export function useWriterAgentAdapter() {
  return useMemo(createWriterAgentAdapter, [])
}

import { chapters, initialDoc, knowledge } from '../mocks/demoData'
import { createDemoWriterAgentAdapter } from '../mocks/demoWriterAgent'
import { createHttpWriterAgentAdapter } from './httpWriterAgent'
import type { WriterAgentAdapter } from './writerAgent'

export function createWriterAgentAdapter(): WriterAgentAdapter {
  const seed = { chapters, knowledge, document: initialDoc }
  return import.meta.env.VITE_WRITER_AGENT_MODE === 'api'
    ? createHttpWriterAgentAdapter(seed)
    : createDemoWriterAgentAdapter(seed)
}

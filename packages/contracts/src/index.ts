import { z } from 'zod'

export const chapterSchema = z.object({
  id: z.string(), volume: z.string(), title: z.string(), meta: z.string(),
})
export type Chapter = z.infer<typeof chapterSchema>

/** Manuscript paragraphs are plain text; annotations never live in this value. */
export const documentSchema = z.record(z.string(), z.array(z.string()))
export type Document = z.infer<typeof documentSchema>

export const knowledgeKindSchema = z.enum(['时间线', '人物档案', '伏笔', '世界观'])
export type KnowledgeKind = z.infer<typeof knowledgeKindSchema>
export const knowledgeEntrySchema = z.object({
  id: z.string(), kind: knowledgeKindSchema, title: z.string(), body: z.string(),
  fields: z.array(z.tuple([z.string(), z.string()])).optional(),
})
export type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>

export const evidenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chapter'), chapterId: z.string(), paraIndex: z.number().int().nonnegative(), quote: z.string(), label: z.string() }),
  z.object({ type: z.literal('knowledge'), entryId: z.string(), label: z.string(), quote: z.string() }),
  z.object({ type: z.literal('unavailable'), label: z.string(), quote: z.string().optional() }),
])
export type Evidence = z.infer<typeof evidenceSchema>

export const proposalKindSchema = z.enum(['fact', 'suggestion', 'research'])
export type ProposalKind = z.infer<typeof proposalKindSchema>
export const proposalStatusSchema = z.enum(['pending', 'adopted', 'rejected', 'deferred', 'resolved', 'noted'])
export type ProposalStatus = z.infer<typeof proposalStatusSchema>
export const optionSchema = z.object({ id: z.string(), label: z.string(), detail: z.string() })
export type Option = z.infer<typeof optionSchema>
export const analysisSchema = z.object({ facts: z.array(z.string()), inferences: z.array(z.string()), suggestion: z.string() })
export type Analysis = z.infer<typeof analysisSchema>
export const proposalSchema = z.object({
  id: z.string(), ruleKey: z.string(), kind: proposalKindSchema,
  title: z.string(), chapterId: z.string().optional(),
  anchor: z.object({ paraIndex: z.number().int().nonnegative(), quote: z.string() }).optional(),
  analysis: analysisSchema, evidence: z.array(evidenceSchema), impact: z.array(z.string()),
  options: z.array(optionSchema), chosenOption: z.string().optional(), status: proposalStatusSchema,
  createdAt: z.number(), updatedAt: z.number(), origin: z.enum(['审查', '推演', '对话']),
})
export type Proposal = z.infer<typeof proposalSchema>

export const decisionActionSchema = z.enum(['采纳', '拒绝', '暂缓', '收录参考', '复审：已解决', '复审：再次出现', '重新打开', '创建提案'])
export type DecisionAction = z.infer<typeof decisionActionSchema>
export const decisionSchema = z.object({
  id: z.string(), proposalId: z.string(), action: decisionActionSchema,
  by: z.enum(['作者', '系统复审']), note: z.string().optional(), at: z.number(),
})
export type Decision = z.infer<typeof decisionSchema>

export const chatMessageSchema = z.object({
  id: z.string(), role: z.enum(['author', 'agent']), text: z.string(), quote: z.string().optional(),
  cites: z.array(evidenceSchema).optional(), demo: z.boolean().optional(), savedAs: z.string().optional(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const challengeRoundSchema = z.object({
  id: z.string(), intent: z.string(),
  understanding: z.array(z.object({ text: z.string(), speculative: z.boolean() })),
  critique: z.array(z.object({ tag: z.enum(['逻辑漏洞', '反例', '不同立场', '人物合理性', '主题距离']), text: z.string() })),
  questions: z.array(z.string()),
})
export type ChallengeRound = z.infer<typeof challengeRoundSchema>

export const workspaceSnapshotSchema = z.object({
  chapters: z.array(chapterSchema), knowledge: z.array(knowledgeEntrySchema), document: documentSchema,
  proposals: z.array(proposalSchema), decisions: z.array(decisionSchema),
  chat: z.array(chatMessageSchema), challenge: z.array(challengeRoundSchema), sequence: z.number().int().nonnegative(),
  currentChapterId: z.string(), dark: z.boolean(),
})
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>

export const saveChapterRequestSchema = z.object({ chapterId: z.string(), paragraphs: z.array(z.string()) })
export type SaveChapterRequest = z.infer<typeof saveChapterRequestSchema>
export const saveChapterResponseSchema = z.object({ chapterId: z.string(), savedAt: z.number() })
export type SaveChapterResponse = z.infer<typeof saveChapterResponseSchema>

export const runReviewRequestSchema = z.object({ chapterId: z.string(), paragraphs: z.array(z.string()), sequence: z.number().int().nonnegative() })
export type RunReviewRequest = z.infer<typeof runReviewRequestSchema>
export const runReviewResponseSchema = z.object({ proposals: z.array(proposalSchema), demo: z.boolean() })
export type RunReviewResponse = z.infer<typeof runReviewResponseSchema>

export const chatRequestSchema = z.object({ chapterId: z.string(), text: z.string().min(1), quote: z.string().optional() })
export type ChatRequest = z.infer<typeof chatRequestSchema>
export const chatResponseSchema = z.object({ text: z.string(), cites: z.array(evidenceSchema).optional(), demo: z.boolean() })
export type ChatResponse = z.infer<typeof chatResponseSchema>

export const challengeRequestSchema = z.object({ intent: z.string().min(1), previousRounds: z.array(challengeRoundSchema) })
export type ChallengeRequest = z.infer<typeof challengeRequestSchema>
export const challengeResponseSchema = challengeRoundSchema.extend({ demo: z.boolean() })
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>

export const workspaceStateSchema = z.object({
  proposals: z.array(proposalSchema), decisions: z.array(decisionSchema), chat: z.array(chatMessageSchema),
  challenge: z.array(challengeRoundSchema), sequence: z.number().int().nonnegative(),
})
export type WorkspaceState = z.infer<typeof workspaceStateSchema>

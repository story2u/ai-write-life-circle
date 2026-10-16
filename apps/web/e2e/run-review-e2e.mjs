import { spawn } from 'node:child_process'
import { createReviewFixture } from '../../../scripts/lib/review-fixture.mjs'
const fixture=await createReviewFixture()
try {
  const child=spawn('pnpm',['exec','playwright','test','--config','playwright.review.config.ts'],{stdio:'inherit',env:{...process.env,WRITER_AGENT_E2E_STATE_DIR:fixture.state,WRITER_AGENT_E2E_HARNESS_ROOT:fixture.harness,WRITER_AGENT_E2E_MODEL_ORIGIN:fixture.origin}})
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>child.kill(signal))
  process.exitCode=await new Promise((resolve)=>{child.once('error',()=>resolve(1));child.once('exit',(code)=>resolve(code??1))})
} finally { await fixture.close() }

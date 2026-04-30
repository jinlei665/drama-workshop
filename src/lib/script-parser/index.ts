/**
 * 两阶段剧本解析器
 *
 * 用法：
 *   import { runPhase1, runPhase2All } from '@/lib/script-parser'
 *
 *   const phase1 = await runPhase1(scriptContent, styleDescription)
 *   // 展示 preview 给用户，用户确认后：
 *   const { allScenes, errors } = await runPhase2All(chunks, context)
 */

export { runPhase1 } from './phase1-scanner'
export type { Phase1Output } from './phase1-scanner'

export { runPhase2Chunk, runPhase2All } from './phase2-detail'
export type { Phase2Context, Phase2Output } from './phase2-detail'

export { chunkScript, generateChunkPlan, findSceneBoundaries, buildChunks } from './chunker'
export type { Chunk } from './chunker'

export {
  buildPhase1Prompt,
  buildPhase2Prompt,
} from './prompts'
export type {
  Phase1Character,
  Phase1SceneOutline,
  Phase1Result,
  Phase2Scene,
  Phase2Result,
  ChunkPlan,
  Phase2PromptParams,
} from './prompts'

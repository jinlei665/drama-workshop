# Two-Phase Script Parsing - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-pass script analysis with a two-phase system: Phase 1 scans the full script for overview (characters, scenes, estimates), Phase 2 processes in scene-boundary-aware chunks with full context from Phase 1.

**Architecture:** 5 new files under `src/lib/script-parser/` (prompts, chunker, phase1, phase2, index) + refactor of existing `analyze/route.ts`. Uses existing `invokeLLM()` / `parseLLMJson()` from `@/lib/ai` — no changes to AI layer. Backward compatible via `phase` query parameter.

**Tech Stack:** TypeScript, Next.js App Router, coze-coding-dev-sdk (invokeLLM)

---

## File Responsibility Map

| File | Responsibility |
|------|---------------|
| `src/lib/script-parser/prompts.ts` | All prompt templates for Phase 1 & Phase 2 |
| `src/lib/script-parser/chunker.ts` | Scene-boundary detection + smart chunk splitting |
| `src/lib/script-parser/phase1-scanner.ts` | Phase 1: full-script scan → character outlines + scene outlines + chunk plan |
| `src/lib/script-parser/phase2-detail.ts` | Phase 2: single-chunk detail with context → detailed storyboard |
| `src/lib/script-parser/index.ts` | Re-export public API |
| `src/app/api/scripts/analyze/route.ts` | Refactor: route dispatches to phase1 or phase2 based on query param |

---

### Task 1: Create `src/lib/script-parser/prompts.ts` - All Prompt Templates

**Files:**
- Create: `src/lib/script-parser/prompts.ts`

- [ ] **Step 1: Write the prompts module**

```typescript
/**
 * 两阶段剧本解析 - 提示词模板
 */

// ==================== 第一阶段：全局扫描 ====================

export function buildPhase1Prompt(scriptContent: string, styleDescription: string): string {
  return `你是一个专业的影视剧本分析专家。请快速扫描以下剧本，提取概要信息。

## 画面风格
${styleDescription || '无特定风格要求'}

## 完整剧本
${scriptContent}

## 输出要求

请严格按照以下 JSON 格式输出（不要输出 markdown 代码块，只输出纯 JSON）：

{
  "scriptType": "剧本类型（如：古风玄幻、现代都市、悬疑推理、科幻末世 等）",
  "tone": "整体基调（如：温馨治愈、紧张悬疑、悲壮史诗、轻松搞笑 等）",
  "estimatedTotalDurationSec": 数字（预估总视频时长秒数，按每1000字≈60秒估算）,
  "characters": [
    {
      "name": "角色名称",
      "role": "主角/配角/反派/路人",
      "summary": "角色一句话概要（20字以内）",
      "appearanceBrief": "外貌关键特征（30字以内，如：黑发束髻、白色中衣、清秀面容）",
      "importance": "高/中/低"
    }
  ],
  "sceneOutline": [
    {
      "index": 1,
      "location": "场景地点",
      "timeOfDay": "时间（清晨/上午/下午/傍晚/深夜/不明确）",
      "summary": "该场景一句话概要（30字以内）",
      "estimatedShots": 数字（该场景预计需要几个分镜来表现，1-4个）,
      "charactersInScene": ["出场角色名称"]
    }
  ]
}

## 角色提取规则
1. 只提取有台词、有重要动作或对剧情有影响的角色
2. 路人/龙套如果只是背景板（如"街上行人"），不要列出
3. appearanceBrief 只写最核心的视觉特征，便于后续图像生成
4. 按重要性排序：主角 > 重要配角 > 次要配角

## 场景划分规则
1. 地点变化 = 新场景开始
2. 时间明显跳跃（过了几个小时、第二天）= 新场景开始
3. 同一地点但情绪/事件发生重大转折 = 可考虑新场景
4. 每个场景的 estimatedShots 根据内容复杂度估算（简单对话1-2个，复杂动作/情绪转折3-4个）

## 重要
- 只输出 JSON，不要任何解释文字
- 确保 JSON 格式完整，所有字符串正确闭合
- 这是快速扫描，不需要详细描述，关键信息准确即可`
}

// ==================== 第二阶段：分段详解 ====================

export function buildPhase2Prompt(params: {
  chunkContent: string
  chunkId: number
  totalChunks: number
  characters: Array<{ name: string; role: string; summary: string; appearanceBrief: string }>
  currentSceneIndex: number
  currentSceneLocation: string
  maxDurationPerShotSec: number
  previousShotSummary: string | null
  styleDescription: string
}): string {
  const {
    chunkContent, chunkId, totalChunks, characters,
    currentSceneIndex, currentSceneLocation, maxDurationPerShotSec,
    previousShotSummary, styleDescription
  } = params

  const characterList = characters.map(c =>
    `- ${c.name}（${c.role}）：${c.appearanceBrief}。${c.summary}`
  ).join('\n')

  const prevContext = previousShotSummary
    ? `\n## 前一个分镜摘要（请保持连贯）\n上一个分镜的画面：${previousShotSummary}\n请确保当前分镜在情绪、时间、空间上与上一个分镜自然衔接。`
    : ''

  return `你是一个专业的影视分镜师。请将以下剧本片段拆分为详细的视频分镜。

## 项目信息
- 画面风格：${styleDescription || '无特定'}
- 当前处理：第 ${chunkId}/${totalChunks} 块
- 起始场景编号：${currentSceneIndex}

## 已知角色列表（所有出场角色必须从以下列表中选取）
${characterList}

## 当前场景
地点：${currentSceneLocation}
${prevContext}

## 剧本片段
${chunkContent}

## 分镜输出格式

请严格按照以下 JSON 格式输出（只输出 JSON，不要 markdown 代码块）：

{
  "scenes": [
    {
      "sceneNumber": ${currentSceneIndex},
      "title": "分镜标题（5-10字）",
      "location": "场景地点",
      "timeOfDay": "时间",
      "durationSec": 数字,
      "description": "详细画面描述（50-120字），包含环境、光影、构图、氛围。用于后续视频生成参考图，必须包含具体视觉元素",
      "dialogue": "对白内容（如有），格式：角色名：\"对白内容\"",
      "action": "动作/表演描述（20-60字），描述角色的具体动作、表情、走位",
      "emotion": "情绪氛围（如：温馨、紧张、悲伤、欢乐、悬疑）",
      "characters": ["出场角色名称"],
      "shotType": "景别（远景/全景/中景/近景/特写）",
      "cameraMovement": "镜头运动（固定/推镜/拉镜/摇镜/跟拍/升降）",
      "durationNote": "时长说明（为什么是这个时长，如'对白25字≈7.5s+缓冲2.5s=10s' 或 '纯空镜建立氛围6s'）"
    }
  ]
}

## 分镜拆分核心规则

### 时长规则（重要！视频模型限制单分镜≤${maxDurationPerShotSec}秒）
1. 纯空镜/简单动作：6-8秒
2. 有台词：台词字数×0.3秒 + 2秒缓冲，向下取整
3. 复杂动作链：8-12秒
4. **绝对不超过 ${maxDurationPerShotSec} 秒**
5. 如果内容超过 ${maxDurationPerShotSec} 秒能承载的量，拆分为多个分镜
6. 在 durationNote 字段中简要说明时长计算依据

### 叙事规则
1. 环境的建立（开篇、地点切换）必须单独设立分镜
2. 人物的关键内心活动应通过表情、动作、闪回来视觉化
3. 连续的日常动作可拆为多个分镜，避免流水账
4. 每次与重要配角的互动视为独立叙事单元，包含2-3个分镜
5. 每个分镜有清晰的视觉焦点，不要把所有内容塞进同一个分镜
6. 也不要过度拆分——一个简单的对话来回可以在同一个分镜内完成

### 角色规则
1. characters 字段中的角色名必须来自上面"已知角色列表"
2. 不要创造新角色
3. 如果剧本中出现未在列表中的路人，统一用"路人"表示，不要创造新名字

### 画面规则
1. description 必须包含：环境细节 + 光线条件 + 构图参考 + 视觉重点
2. 景别要符合影视拍摄规范
3. 镜头运动要与情绪匹配（紧张→手持跟拍，温馨→固定或缓慢推进）

### 编号规则
1. sceneNumber 必须从 ${currentSceneIndex} 开始，连续递增

## 重要
- 只输出 JSON，不要任何解释文字
- 确保 JSON 完整、可解析
- description 要足够详细，能直接用于视频生成参考图的 prompt`
}

// ==================== 类型定义 ====================

export interface Phase1Character {
  name: string
  role: string
  summary: string
  appearanceBrief: string
  importance: string
}

export interface Phase1SceneOutline {
  index: number
  location: string
  timeOfDay: string
  summary: string
  estimatedShots: number
  charactersInScene: string[]
}

export interface Phase1Result {
  scriptType: string
  tone: string
  estimatedTotalDurationSec: number
  characters: Phase1Character[]
  sceneOutline: Phase1SceneOutline[]
}

export interface Phase2Scene {
  sceneNumber: number
  title: string
  location: string
  timeOfDay: string
  durationSec: number
  description: string
  dialogue: string
  action: string
  emotion: string
  characters: string[]
  shotType: string
  cameraMovement: string
  durationNote: string
}

export interface Phase2Result {
  scenes: Phase2Scene[]
}

export interface ChunkPlan {
  chunkId: number
  sceneRange: [number, number]
  charCount: number
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
npx tsc --noEmit --pretty src/lib/script-parser/prompts.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/script-parser/prompts.ts
git commit -m "feat: add two-phase script parsing prompt templates"
```

---

### Task 2: Create `src/lib/script-parser/chunker.ts` - Smart Scene-Boundary Chunking

**Files:**
- Create: `src/lib/script-parser/chunker.ts`

- [ ] **Step 1: Write the chunker module**

```typescript
/**
 * 智能分块器 - 按场景边界分割剧本
 *
 * 检测场景边界标记：
 * - 时间标记：第二天、深夜、清晨、数日后、X天后、X月后、X年后
 * - 地点切换：XX城、XX阁、XX殿、XX市、XX镇、XX村
 * - 章节/分隔标记：第X章、---、***、___、分割线
 * - 空行：连续的空行通常表示场景切换
 */

export interface Chunk {
  chunkId: number
  text: string
  sceneIndices: number[]
  charCount: number
  startCharIndex: number
  endCharIndex: number
}

const MAX_CHUNK_SIZE = 6000

// 场景边界标记正则
const TIME_MARKERS = /(?:第[一二三四五六七八九十\d]+[天日月年]|[数几]+\s*(?:天|日|月|年|个?时辰|周)\s*(?:后|过去了|过去了之后|前))|(?:第二天|次日|翌日|清晨|早晨|早上|上午|中午|下午|傍晚|黄昏|夜幕降临|深夜|半夜|午夜|黎明|拂晓|午后|入夜|夜[里晚]|天亮|天黑|隔天|转天|又?过了?\s*(?:一会|一阵|许久|很久|一段?时间|半晌))/;

const LOCATION_MARKERS = /(?:[来到去了到走进入出离达至返][\u4e00-\u9fff]{2,8}(?:城|市|镇|村|阁|殿|楼|府|院|巷|街|路|道|庙|寺|观|洞|谷|山|林|原|湖|海|河|江|店|铺|馆|堂|厅|室|房|宫|塔|桥|亭))/

const CHAPTER_MARKERS = /^(?:第[\u4e00-\u9fff\d]+[章节回]|序章|楔子|尾声|番外|前言|后记|引子|终章)/m

const SEPARATOR_MARKERS = /^(?:[-*=_]{3,}|[─═━]{3,}|\.{3,}|～{3,})$/m

/**
 * 识别场景边界位置
 * 返回所有场景起始位置的字符索引
 */
export function findSceneBoundaries(text: string): number[] {
  const boundaries: number[] = [0] // 第一个场景从0开始
  const lines = text.split('\n')

  let charIndex = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 跳过行首字符后检查
    const isTimeMarker = TIME_MARKERS.test(trimmed)
    const isLocationMarker = !isTimeMarker && trimmed.length >= 4 && trimmed.length <= 30 && LOCATION_MARKERS.test(trimmed)
    const isChapterMarker = CHAPTER_MARKERS.test(trimmed)
    const isSeparator = SEPARATOR_MARKERS.test(trimmed)

    // 空行后紧跟场景描述也视为可能边界（但不是每次空行都切）
    const isEmptyLine = trimmed === ''

    // 场景切换检测
    const isBoundary =
      isChapterMarker ||
      isSeparator ||
      (isTimeMarker && trimmed.length <= 20) ||
      (isLocationMarker && !trimmed.includes('。') && !trimmed.includes('，'))

    if (isBoundary && charIndex > 0) {
      // 避免重复添加过近的边界（至少间隔200字符）
      const lastBoundary = boundaries[boundaries.length - 1]
      if (charIndex - lastBoundary > 200) {
        boundaries.push(charIndex)
      }
    }

    // 连续两个空行视为软边界
    if (isEmptyLine && i > 0 && lines[i - 1]?.trim() === '' && charIndex > 0) {
      const lastBoundary = boundaries[boundaries.length - 1]
      if (charIndex - lastBoundary > 500) {
        boundaries.push(charIndex)
      }
    }

    charIndex += line.length + 1 // +1 for \n
  }

  // 确保最后一个边界不超过文本长度
  if (boundaries[boundaries.length - 1] >= text.length) {
    boundaries.pop()
  }

  return boundaries
}

/**
 * 从场景边界索引生成 chunk 列表
 * 每个 chunk 包含 1-N 个完整场景
 * - 如果单个场景超过 MAX_CHUNK_SIZE，在段落边界拆分
 * - 每个 chunk ≤ MAX_CHUNK_SIZE
 */
export function buildChunks(text: string, boundaries: number[]): Chunk[] {
  const chunks: Chunk[] = []
  let chunkId = 1
  let currentText = ''
  let currentSceneIndices: number[] = []
  let currentStartChar = 0

  // 为每个边界范围构建场景段
  const segments: Array<{ text: string; sceneIndex: number; startChar: number }> = []

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : text.length
    const segmentText = text.slice(start, end).trim()
    if (segmentText) {
      segments.push({ text: segmentText, sceneIndex: segments.length + 1, startChar: start })
    }
  }

  for (const seg of segments) {
    const segLen = seg.text.length

    // 情况1：当前chunk为空或是seg可以并入当前chunk
    if (currentText === '' || (currentText.length + segLen <= MAX_CHUNK_SIZE)) {
      currentText = currentText ? currentText + '\n\n' + seg.text : seg.text
      currentSceneIndices.push(seg.sceneIndex)
      if (currentText === seg.text) {
        currentStartChar = seg.startChar
      }
    } else {
      // 情况2：当前chunk已满，保存并开始新chunk
      chunks.push({
        chunkId: chunkId++,
        text: currentText,
        sceneIndices: [...currentSceneIndices],
        charCount: currentText.length,
        startCharIndex: currentStartChar,
        endCharIndex: currentStartChar + currentText.length,
      })
      currentText = seg.text
      currentSceneIndices = [seg.sceneIndex]
      currentStartChar = seg.startChar
    }
  }

  // 保存最后一个chunk
  if (currentText) {
    chunks.push({
      chunkId: chunkId,
      text: currentText,
      sceneIndices: [...currentSceneIndices],
      charCount: currentText.length,
      startCharIndex: currentStartChar,
      endCharIndex: currentStartChar + currentText.length,
    })
  }

  return chunks
}

/**
 * 主入口：对剧本进行智能分块
 * @param text 完整剧本
 * @returns 分块列表
 */
export function chunkScript(text: string): Chunk[] {
  const boundaries = findSceneBoundaries(text)
  const chunks = buildChunks(text, boundaries)
  return chunks
}

/**
 * 生成分块计划摘要（用于返回给前端展示）
 */
export function generateChunkPlan(chunks: Chunk[]): Array<{
  chunkId: number
  sceneRange: [number, number]
  charCount: number
}> {
  return chunks.map(c => ({
    chunkId: c.chunkId,
    sceneRange: [c.sceneIndices[0], c.sceneIndices[c.sceneIndices.length - 1]] as [number, number],
    charCount: c.charCount,
  }))
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
npx tsc --noEmit --pretty src/lib/script-parser/chunker.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/script-parser/chunker.ts
git commit -m "feat: add smart scene-boundary chunker for script parsing"
```

---

### Task 3: Create `src/lib/script-parser/phase1-scanner.ts` - Phase 1 Global Scanner

**Files:**
- Create: `src/lib/script-parser/phase1-scanner.ts`

- [ ] **Step 1: Write the Phase 1 scanner**

```typescript
/**
 * 阶段一：全局扫描
 * 输入完整剧本 → 输出角色概要 + 场景列表 + 预估分镜数 + 分块方案
 */

import { invokeLLM, parseLLMJson } from '@/lib/ai'
import { buildPhase1Prompt, type Phase1Result, type ChunkPlan } from './prompts'
import { chunkScript, generateChunkPlan } from './chunker'

export interface Phase1Output {
  success: boolean
  preview?: {
    scriptType: string
    tone: string
    estimatedTotalDurationSec: number
    totalEstimatedScenes: number
    characters: Phase1Result['characters']
    sceneOutline: Phase1Result['sceneOutline']
  }
  chunkPlan?: ChunkPlan[]
  rawPhase1Result?: Phase1Result
  error?: string
}

/**
 * 执行阶段一：全局扫描
 */
export async function runPhase1(
  scriptContent: string,
  styleDescription: string
): Promise<Phase1Output> {
  // 1. 构建 prompt 并调用 LLM
  const prompt = buildPhase1Prompt(scriptContent, styleDescription)

  let result: Phase1Result
  try {
    const response = await invokeLLM(
      [{ role: 'user', content: prompt }],
      { thinking: 'disabled' }
    )
    result = parseLLMJson<Phase1Result>(response)
  } catch (err) {
    console.error('[Phase1] LLM call failed:', err)
    return {
      success: false,
      error: `第一阶段扫描失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // 2. 验证必要字段
  if (!result.characters || !result.sceneOutline) {
    return {
      success: false,
      error: '第一阶段返回数据缺少必要字段（characters 或 sceneOutline）',
      rawPhase1Result: result,
    }
  }

  // 3. 用分块器对剧本做智能分块
  const chunks = chunkScript(scriptContent)
  const chunkPlan = generateChunkPlan(chunks)

  // 4. 计算总预估分镜数
  const totalEstimatedScenes = result.sceneOutline.reduce(
    (sum, s) => sum + (s.estimatedShots || 1),
    0
  )

  return {
    success: true,
    preview: {
      scriptType: result.scriptType || '未知',
      tone: result.tone || '未知',
      estimatedTotalDurationSec: result.estimatedTotalDurationSec || 0,
      totalEstimatedScenes,
      characters: result.characters,
      sceneOutline: result.sceneOutline,
    },
    chunkPlan,
    rawPhase1Result: result,
  }
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
npx tsc --noEmit --pretty src/lib/script-parser/phase1-scanner.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/script-parser/phase1-scanner.ts
git commit -m "feat: add phase 1 global script scanner"
```

---

### Task 4: Create `src/lib/script-parser/phase2-detail.ts` - Phase 2 Detail Parser

**Files:**
- Create: `src/lib/script-parser/phase2-detail.ts`

- [ ] **Step 1: Write the Phase 2 detail parser**

```typescript
/**
 * 阶段二：分段详解
 * 输入单个 chunk + 上下文 → 输出详细分镜列表
 */

import { invokeLLM, parseLLMJson } from '@/lib/ai'
import { buildPhase2Prompt, type Phase1Character, type Phase2Scene, type Phase2Result } from './prompts'
import type { Chunk } from './chunker'

export interface Phase2Context {
  styleDescription: string
  characters: Phase1Character[]
  currentSceneIndex: number
  currentSceneLocation: string
  previousShotSummary: string | null
  maxDurationPerShotSec: number
}

export interface Phase2Output {
  success: boolean
  scenes?: Phase2Scene[]
  lastShotSummary?: string
  error?: string
}

/**
 * 执行单个 chunk 的阶段二解析
 */
export async function runPhase2Chunk(
  chunk: Chunk,
  context: Phase2Context
): Promise<Phase2Output> {
  const prompt = buildPhase2Prompt({
    chunkContent: chunk.text,
    chunkId: chunk.chunkId,
    totalChunks: 0, // 将在外部设置后覆盖
    characters: context.characters,
    currentSceneIndex: context.currentSceneIndex,
    currentSceneLocation: context.currentSceneLocation,
    maxDurationPerShotSec: context.maxDurationPerShotSec,
    previousShotSummary: context.previousShotSummary,
    styleDescription: context.styleDescription,
  })

  let result: Phase2Result
  try {
    const response = await invokeLLM(
      [{ role: 'user', content: prompt }],
      { thinking: 'disabled' }
    )
    result = parseLLMJson<Phase2Result>(response)
  } catch (err) {
    console.error(`[Phase2] Chunk ${chunk.chunkId} LLM call failed:`, err)
    return {
      success: false,
      error: `第 ${chunk.chunkId} 块解析失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!result.scenes || result.scenes.length === 0) {
    return {
      success: false,
      error: `第 ${chunk.chunkId} 块解析返回了空的分镜列表`,
    }
  }

  // 生成最后一个分镜的摘要，用于传递到下一个 chunk
  const lastScene = result.scenes[result.scenes.length - 1]
  const lastShotSummary =
    `[分镜${lastScene.sceneNumber}] ${lastScene.title}：${lastScene.location}，${lastScene.timeOfDay}，` +
    `${lastScene.shotType}，${lastScene.action || lastScene.description.slice(0, 50)}，情绪：${lastScene.emotion}`

  return {
    success: true,
    scenes: result.scenes,
    lastShotSummary,
  }
}

/**
 * 批量执行阶段二：逐个处理所有 chunks
 * @param chunks 分块列表
 * @param context 上下文信息
 * @param onProgress 进度回调
 */
export async function runPhase2All(
  chunks: Chunk[],
  context: Omit<Phase2Context, 'previousShotSummary' | 'currentSceneIndex' | 'currentSceneLocation'> & {
    sceneLocations: Array<{ index: number; location: string }>
  },
  onProgress?: (current: number, total: number, chunkResult: Phase2Output) => void
): Promise<{ allScenes: Phase2Scene[]; errors: string[] }> {
  const allScenes: Phase2Scene[] = []
  const errors: string[] = []
  let previousSummary: string | null = null
  let sceneNumberOffset = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const firstSceneIdx = chunk.sceneIndices[0]
    const locationInfo = context.sceneLocations.find(l => l.index === firstSceneIdx)
    const currentLocation = locationInfo?.location || '未知场景'

    const result = await runPhase2Chunk(chunk, {
      styleDescription: context.styleDescription,
      characters: context.characters,
      currentSceneIndex: sceneNumberOffset + 1,
      currentSceneLocation: currentLocation,
      previousShotSummary: previousSummary,
      maxDurationPerShotSec: context.maxDurationPerShotSec,
    })

    if (result.success && result.scenes) {
      allScenes.push(...result.scenes)
      previousSummary = result.lastShotSummary || null
      sceneNumberOffset += result.scenes.length
    } else {
      errors.push(`Chunk ${chunk.chunkId}: ${result.error || '未知错误'}`)
      // 即使失败也保留 previousSummary，避免丢失上下文
    }

    onProgress?.(i + 1, chunks.length, result)
  }

  return { allScenes, errors }
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
npx tsc --noEmit --pretty src/lib/script-parser/phase2-detail.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/script-parser/phase2-detail.ts
git commit -m "feat: add phase 2 chunked detail parser"
```

---

### Task 5: Create `src/lib/script-parser/index.ts` - Public API

**Files:**
- Create: `src/lib/script-parser/index.ts`

- [ ] **Step 1: Write the barrel export**

```typescript
/**
 * 两阶段剧本解析器
 *
 * 用法：
 *   import { runPhase1, runPhase2All } from '@/lib/script-parser'
 *
 *   const phase1 = await runPhase1(scriptContent, styleDescription)
 *   // 展示 preview 给用户，用户确认后：
 *   const { allScenes } = await runPhase2All(chunks, context)
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
} from './prompts'
```

- [ ] **Step 2: Verify no compile errors**

```bash
npx tsc --noEmit --pretty src/lib/script-parser/index.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/script-parser/index.ts
git commit -m "feat: add script-parser public API barrel export"
```

---

### Task 6: Refactor `src/app/api/scripts/analyze/route.ts` - Support Two-Phase

**Files:**
- Modify: `src/app/api/scripts/analyze/route.ts`

- [ ] **Step 1: Read current file to confirm content**

Verify the file content matches what we read earlier (lines 1-316). We already have the full content.

- [ ] **Step 2: Rewrite route to support phase=1|2**

Replace the entire file content:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/storage/database/pg-client"
import { getStylePrompt } from "@/lib/styles"
import { runPhase1, runPhase2All } from "@/lib/script-parser"
import { chunkScript } from "@/lib/script-parser"
import type { Phase1Character } from "@/lib/script-parser"

// 风格描述映射
const styleDescriptions: Record<string, string> = {
  realistic_cinema: '电影级写实风格，专业影视剧质感，电影级光影',
  realistic_drama: '短剧写实风格，现代短剧风格，自然光线',
  realistic_period: '古装写实风格，古风影视质感，唯美画面',
  realistic_idol: '偶像剧风格，韩剧/偶像剧风格，柔美滤镜',
  anime_3d_cn: '国漫3D动画风格，国产3D动画如斗罗大陆',
  anime_2d_cn: '国风2D动画风格，如魔道祖师',
  anime_jp: '日本动漫风格，如鬼灭之刃',
  anime_chibi: 'Q版萌系风格，可爱大头小身',
  art_watercolor: '水彩插画风格，柔和淡雅',
  art_ink: '中国传统水墨画风格',
  art_oil: '油画风格，厚重笔触',
  art_comic: '美式漫画风格，强对比',
}

const MAX_DURATION_PER_SHOT_SEC = 12 // Seedance 1.5 Pro 限制

function getStyleDescription(project: any): string {
  const style = project?.style || "realistic_drama"
  const customStylePrompt = project?.custom_style_prompt || project?.customStylePrompt || ''
  if (customStylePrompt) return customStylePrompt
  return style !== 'custom' ? (styleDescriptions[style] || '') : ''
}

// POST /api/scripts/analyze
// ?phase=1  → 第一阶段：全局扫描
// ?phase=2  → 第二阶段：分段详解（需要传入 chunk 和 context）
// 无参数    → 兼容旧版：单次全量解析
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phase = searchParams.get('phase')

    const body = await request.json()
    const { scriptId, projectId, scriptContent, existingCharacters } = body

    if (!scriptId && !scriptContent) {
      return NextResponse.json(
        { error: "缺少脚本ID或脚本内容" },
        { status: 400 }
      )
    }

    // 获取项目信息
    let project = null
    if (projectId) {
      try {
        const pool = await getPool()
        const result = await pool.query(
          `SELECT * FROM projects WHERE id = $1`,
          [projectId]
        )
        if (result.rows.length > 0) {
          project = result.rows[0]
        }
      } catch (dbErr) {
        console.warn("获取项目信息失败，使用默认风格:", dbErr)
      }
    }

    const style = project?.style || "realistic_drama"
    const stylePrompt = getStylePrompt(style)
    const styleDescription = getStyleDescription(project)

    // ==================== 阶段一：全局扫描 ====================
    if (phase === '1') {
      console.log('[Analyze] Phase 1: 全局扫描开始, 剧本长度:', scriptContent?.length)

      const result = await runPhase1(scriptContent, styleDescription)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      console.log('[Analyze] Phase 1 完成:', {
        characters: result.preview?.characters.length,
        scenes: result.preview?.sceneOutline.length,
        estimated: result.preview?.totalEstimatedScenes,
        chunks: result.chunkPlan?.length,
      })

      return NextResponse.json({
        phase: 1,
        success: true,
        preview: result.preview,
        chunkPlan: result.chunkPlan,
      })
    }

    // ==================== 阶段二：分段详解 ====================
    if (phase === '2') {
      const { chunkId, chunkContent, context } = body

      if (!chunkContent) {
        return NextResponse.json({ error: "缺少 chunkContent" }, { status: 400 })
      }

      console.log(`[Analyze] Phase 2: chunk ${chunkId} 解析开始, 长度:`, chunkContent?.length)

      // 获取分块信息
      const chunks = chunkScript(scriptContent)
      const totalChunks = chunks.length

      const { runPhase2Chunk } = await import('@/lib/script-parser/phase2-detail')
      const result = await runPhase2Chunk(
        {
          chunkId: chunkId || 1,
          text: chunkContent,
          sceneIndices: context?.sceneIndices || [chunkId || 1],
          charCount: chunkContent.length,
          startCharIndex: 0,
          endCharIndex: chunkContent.length,
        },
        {
          styleDescription: styleDescription || '',
          characters: (context?.characters || []) as Phase1Character[],
          currentSceneIndex: context?.currentSceneIndex || 1,
          currentSceneLocation: context?.currentSceneLocation || '未知',
          previousShotSummary: context?.previousShotSummary || null,
          maxDurationPerShotSec: MAX_DURATION_PER_SHOT_SEC,
        }
      )

      if (!result.success) {
        return NextResponse.json({
          phase: 2,
          chunkId,
          success: false,
          error: result.error,
        }, { status: 500 })
      }

      console.log(`[Analyze] Phase 2 chunk ${chunkId} 完成, 分镜数:`, result.scenes?.length)

      return NextResponse.json({
        phase: 2,
        chunkId,
        totalChunks,
        success: true,
        scenes: result.scenes,
        lastShotSummary: result.lastShotSummary,
      })
    }

    // ==================== 兼容旧版：单次全量解析 ====================
    console.log('[Analyze] 使用兼容模式（单次全量解析）')

    const { invokeLLM } = await import('@/lib/ai')

    const styleContext = styleDescription
      ? `\n\n## 画面风格要求\n你生成的所有画面描述必须严格遵循以下风格：\n**${styleDescription}**\n\n请在描述场景、人物外貌、动作时，都融入这种风格特征。`
      : ''

    const analyzePrompt = `你是一个专业的短剧视频创作助手。你的任务是分析小说或脚本内容，提取出人物信息和视频分镜信息。

## 项目风格
${stylePrompt}

## 脚本内容
${scriptContent}

## 已有角色（如果有）
${existingCharacters?.length > 0
  ? existingCharacters.map((c: any) => `- ${c.name}: ${c.description || c.appearance || '无描述'}`).join('\n')
  : '暂无已有角色'
}

请严格按照以下 JSON 格式输出，不要输出任何其他内容：

{
  "newCharacters": [
    {
      "name": "人物名称",
      "description": "人物简介（50字以内）",
      "appearance": "外貌特征描述（包括发型、眼睛、体型、服装风格等，用于生成角色造型参考图）",
      "personality": "性格特点",
      "tags": ["主角", "配角", "反派"]
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "分镜标题",
      "description": "场景画面描述（详细描述环境，光线、构图，用于生成视频分镜参考图）",
      "dialogue": "对白内容",
      "action": "动作/表演描述",
      "emotion": "情绪氛围",
      "shotType": "景别（远景、全景、中景、近景、特写）",
      "cameraMovement": "镜头运动（固定、推镜、拉镜、摇镜、跟拍）",
      "characterNames": ["出场人物名称"]
    }
  ]
}

## 分镜拆分核心原则

### 1. 基于内容适配的分镜策略
- 内容决定数量，分镜数量由剧情密度、情感层次和场景转换频率决定
- 单个分镜时长3-12秒，视频模型限制单分镜≤12秒

### 2. 环境与氛围独立成镜
- 开篇环境描写必须单独设立分镜，建立故事基调
- 重要时间节点画面应作为独立分镜

### 3. 心理活动视觉化
- 人物关键回忆和深度思考应转化为闪回片段或通过表演体现

### 4. 日常动作合理分解
- 连续日常动作可拆分为多个分镜，避免流水账仓促感

### 5. 每个叙事相遇独立呈现
- 与每个配角的关键互动应视为独立叙事单元

### 6. 优先保障叙事连贯性
- 为氛围镜头、情感高潮和复杂对话允许延长单镜时长（不超过12秒）

注意：
1. 分镜数量根据内容合理拆分
2. 每个场景应该是一个独立的视频分镜
3. 场景描述要详细，包含视觉元素、光影效果
4. 人物外貌描述要具体，便于生成角色造型图
5. 景别和镜头运动要符合影视剧拍摄规范${styleContext}`

    const aiResult = await invokeLLM(
      [{ role: "user", content: analyzePrompt }],
      { thinking: "disabled" }
    )

    let analysisResult: any = null
    try {
      const text = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      }
    } catch (parseErr) {
      console.error("解析 AI 返回结果失败:", parseErr)
      return NextResponse.json({
        error: "AI 返回格式解析失败",
        rawResult: aiResult,
      }, { status: 500 })
    }

    if (!analysisResult) {
      return NextResponse.json({
        error: "AI 分析失败，未返回有效结果",
      }, { status: 500 })
    }

    // 保存角色和分镜到数据库
    const characterNameToId = new Map<string, string>()
    const savedCharacterIds: string[] = []

    // 获取已有角色
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      if (isDatabaseConfigured()) {
        const supabase = getSupabaseClient()
        const { data: existingChars } = await supabase
          .from("characters")
          .select("id, name")
          .eq("project_id", projectId)
        if (existingChars) {
          existingChars.forEach((c: { id: string; name: string }) =>
            characterNameToId.set(c.name, c.id)
          )
        }
      }
    } catch (dbError) {
      console.warn("Failed to fetch characters from database:", dbError)
    }

    // 保存新角色
    if (analysisResult.newCharacters?.length > 0) {
      for (const char of analysisResult.newCharacters) {
        const characterId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        try {
          const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
          if (isDatabaseConfigured()) {
            const supabase = getAdminClient()
            const insertData = {
              id: characterId,
              project_id: projectId,
              name: char.name,
              description: char.description || "",
              appearance: char.description || "",
              personality: char.personality || "",
              tags: char.tags || [],
              status: 'pending',
            }
            const { error } = await supabase.from("characters").insert(insertData)
            if (error) {
              console.error(`Failed to save character "${char.name}":`, error.message)
            } else {
              savedCharacterIds.push(characterId)
              characterNameToId.set(char.name, characterId)
            }
          }
        } catch (dbError) {
          console.error(`Exception saving character "${char.name}":`, dbError)
        }
      }
    }

    // 保存分镜
    if (analysisResult.scenes?.length > 0) {
      for (let index = 0; index < analysisResult.scenes.length; index++) {
        const scene = analysisResult.scenes[index]
        const sceneId = `scene_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`
        const characterIds: string[] = (scene.characterNames || [])
          .map((name: string) => characterNameToId.get(name))
          .filter((id: string | undefined): id is string => id !== undefined)
        try {
          const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
          if (isDatabaseConfigured()) {
            const supabase = getAdminClient()
            const insertData = {
              id: sceneId,
              project_id: projectId,
              script_id: scriptId,
              scene_number: index + 1,
              title: scene.title,
              description: scene.description,
              dialogue: scene.dialogue || "",
              action: scene.action || "",
              emotion: scene.emotion,
              character_ids: characterIds,
              metadata: {
                shotType: scene.shotType || "",
                cameraMovement: scene.cameraMovement || "",
              },
              status: 'pending',
            }
            const { error } = await supabase.from("scenes").insert(insertData)
            if (error) {
              console.error(`Failed to save scene "${scene.title}":`, error.message)
            }
          }
        } catch (dbError) {
          console.error(`Exception saving scene "${scene.title}":`, dbError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'legacy',
      charactersCount: savedCharacterIds.length,
      scenesCount: analysisResult.scenes?.length || 0,
    })
  } catch (err: any) {
    console.error("脚本分析异常:", err)
    return NextResponse.json({
      error: err.message || "脚本分析失败"
    }, { status: 500 })
  }
}

// GET /api/scripts/analyze?phase=1&scriptId=xxx
// 如果前端用 GET 也可以触发阶段一
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phase = searchParams.get('phase')
  const scriptId = searchParams.get('scriptId')
  const projectId = searchParams.get('projectId')

  if (phase === '1' && (scriptId || projectId)) {
    // 转发到 POST 处理
    try {
      let scriptContent = ''
      if (scriptId) {
        const pool = await getPool()
        const result = await pool.query(
          `SELECT * FROM scripts WHERE id = $1`,
          [scriptId]
        )
        if (result.rows.length > 0) {
          scriptContent = result.rows[0].content
        } else {
          return NextResponse.json({ error: "脚本不存在" }, { status: 404 })
        }
      }

      const body = { scriptId, projectId, scriptContent }
      const mockRequest = new NextRequest(new URL(request.url), {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return POST(mockRequest)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    message: "剧本分析 API",
    usage: {
      phase1: "POST /api/scripts/analyze?phase=1  (body: {scriptContent, projectId})",
      phase2: "POST /api/scripts/analyze?phase=2  (body: {chunkId, chunkContent, context})",
      legacy: "POST /api/scripts/analyze  (body: {scriptContent, projectId, scriptId, existingCharacters})",
    }
  })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: No new errors introduced (existing project errors are OK)

- [ ] **Step 3: Run the dev server to confirm API starts**

```bash
# Check that route compiles and loads without error
npx next build 2>&1 | tail -5
```

Expected: Build succeeds (or fails only on pre-existing issues)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scripts/analyze/route.ts
git commit -m "feat: refactor script analyze route to support two-phase parsing"
```

---

### Task 7: Set Up Module Directory & Final Verification

**Files:**
- Create: (none — directory already exists from previous tasks)

- [ ] **Step 1: Ensure script-parser directory exists**

```bash
ls -la src/lib/script-parser/
```

Expected: 5 files (prompts.ts, chunker.ts, phase1-scanner.ts, phase2-detail.ts, index.ts)

- [ ] **Step 2: Full TypeScript check on new files only**

```bash
npx tsc --noEmit --pretty src/lib/script-parser/index.ts
```

Expected: No errors

- [ ] **Step 3: Verify the route file references compile**

```bash
npx tsc --noEmit --pretty src/app/api/scripts/analyze/route.ts
```

Expected: No errors

- [ ] **Step 4: Final commit if all checks pass**

```bash
git status
```

---

## Completion Checklist

- [ ] Task 1: Prompt templates created
- [ ] Task 2: Smart chunker created
- [ ] Task 3: Phase 1 scanner created
- [ ] Task 4: Phase 2 detail parser created
- [ ] Task 5: Public API barrel export created
- [ ] Task 6: Analyze route refactored with `?phase=1|2` support
- [ ] Task 7: Final verification passed

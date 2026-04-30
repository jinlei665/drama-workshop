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
const MIN_BOUNDARY_INTERVAL = 200
const SOFT_BOUNDARY_INTERVAL = 500

// 场景边界标记正则
const TIME_MARKERS = /(?:第[一二三四五六七八九十\d]+[天日月年]|[数几]+\s*(?:天|日|月|年|个?时辰|周)\s*(?:后|过去了|过去了之后|前))|(?:第二天|次日|翌日|清晨|早晨|早上|上午|中午|下午|傍晚|黄昏|夜幕降临|深夜|半夜|午夜|黎明|拂晓|午后|入夜|夜[里晚]|天亮|天黑|隔天|转天|又?过了?\s*(?:一会|一阵|许久|很久|一段?时间|半晌))/

const LOCATION_MARKERS = /[来到去了到走进入出离达至返][\u4e00-\u9fff]{2,8}(?:城|市|镇|村|阁|殿|楼|府|院|巷|街|路|道|庙|寺|观|洞|谷|山|林|原|湖|海|河|江|店|铺|馆|堂|厅|室|房|宫|塔|桥|亭)/

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

    const isEmptyLine = trimmed === ''

    // 场景切换检测
    const isBoundary =
      isChapterMarker ||
      isSeparator ||
      (isTimeMarker && trimmed.length <= 20) ||
      (isLocationMarker && !trimmed.includes('。') && !trimmed.includes('，'))

    if (isBoundary && charIndex > 0) {
      // 避免重复添加过近的边界（至少间隔 MIN_BOUNDARY_INTERVAL 字符）
      const lastBoundary = boundaries[boundaries.length - 1]
      if (charIndex - lastBoundary > MIN_BOUNDARY_INTERVAL) {
        boundaries.push(charIndex)
      }
    }

    // 连续两个空行视为软边界
    if (isEmptyLine && i > 0 && lines[i - 1]?.trim() === '' && charIndex > 0) {
      const lastBoundary = boundaries[boundaries.length - 1]
      if (charIndex - lastBoundary > SOFT_BOUNDARY_INTERVAL) {
        boundaries.push(charIndex)
      }
    }

    charIndex += line.length + 1 // +1 for \n
  }

  // 确保最后一个边界不超过文本长度
  if (boundaries.length > 1 && boundaries[boundaries.length - 1] >= text.length) {
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

    // 单个场景超过上限 → 在段落边界拆分
    if (segLen > MAX_CHUNK_SIZE) {
      // 先保存当前 chunk
      if (currentText) {
        chunks.push({
          chunkId: chunkId++,
          text: currentText,
          sceneIndices: [...currentSceneIndices],
          charCount: currentText.length,
          startCharIndex: currentStartChar,
          endCharIndex: currentStartChar + currentText.length,
        })
        currentText = ''
        currentSceneIndices = []
      }

      // 按段落边界拆分过长场景
      const paragraphs = seg.text.split(/\n\n+/)
      let paraChunk = ''
      for (const para of paragraphs) {
        if (paraChunk && paraChunk.length + para.length + 2 > MAX_CHUNK_SIZE) {
          chunks.push({
            chunkId: chunkId++,
            text: paraChunk,
            sceneIndices: [seg.sceneIndex],
            charCount: paraChunk.length,
            startCharIndex: seg.startChar,
            endCharIndex: seg.startChar + seg.text.length,
          })
          paraChunk = para
        } else {
          paraChunk = paraChunk ? paraChunk + '\n\n' + para : para
        }
      }
      if (paraChunk) {
        currentText = paraChunk
        currentSceneIndices = [seg.sceneIndex]
        currentStartChar = seg.startChar
      }
      continue
    }

    // 正常情况：尝试合并到当前 chunk
    if (currentText === '' || (currentText.length + segLen <= MAX_CHUNK_SIZE)) {
      currentText = currentText ? currentText + '\n\n' + seg.text : seg.text
      currentSceneIndices.push(seg.sceneIndex)
      if (currentText === seg.text) {
        currentStartChar = seg.startChar
      }
    } else {
      // 当前 chunk 已满，保存并开始新的
      const actualEnd = seg.startChar // end of previous chunk is start of this one
      chunks.push({
        chunkId: chunkId++,
        text: currentText,
        sceneIndices: [...currentSceneIndices],
        charCount: currentText.length,
        startCharIndex: currentStartChar,
        endCharIndex: actualEnd,
      })
      currentText = seg.text
      currentSceneIndices = [seg.sceneIndex]
      currentStartChar = seg.startChar
    }
  }

  // 保存最后一个 chunk，使用文本总长度作为 endCharIndex
  if (currentText) {
    chunks.push({
      chunkId: chunkId,
      text: currentText,
      sceneIndices: [...currentSceneIndices],
      charCount: currentText.length,
      startCharIndex: currentStartChar,
      endCharIndex: text.length,
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

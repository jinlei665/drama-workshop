/**
 * 剧本解析工具函数
 */

/**
 * 将长内容分割成多个段落（简化版，用于单阶段解析）
 */
export function splitContentIntoSimpleChunks(content: string, maxChunkLength: number): string[] {
  if (content.length <= maxChunkLength) {
    return [content]
  }

  const chunks: string[] = []
  let startIdx = 0
  let chunkNum = 1

  while (startIdx < content.length) {
    let endIdx = Math.min(startIdx + maxChunkLength, content.length)

    // 如果不是最后一段，尝试找到自然分段点
    if (endIdx < content.length) {
      const chunk = content.substring(startIdx, endIdx)
      // 向前查找最后一个换行或句号
      const lastNewline = chunk.lastIndexOf('\n')
      const lastPeriod = chunk.lastIndexOf('。')
      const lastPunctuation = Math.max(lastNewline, lastPeriod)

      // 如果在合理位置找到分段点，使用它
      if (lastPunctuation > maxChunkLength * 0.6) {
        endIdx = startIdx + lastPunctuation + 1
      }
    }

    const chunkContent = content.substring(startIdx, endIdx)
    chunks.push(chunkContent)
    console.log(`[Utils] Chunk ${chunkNum}: ${chunkContent.length} chars (${startIdx}-${endIdx})`)

    startIdx = endIdx
    chunkNum++
  }

  return chunks
}

/**
 * 估算分镜数量（基于内容特征）
 */
export function estimateScenesCount(
  content: string,
  options?: {
    dialogueDensity?: number  // 对话密度（每千字对话数）
    sceneComplexity?: number   // 场景复杂度系数
  }
): number {
  const { dialogueDensity = 5, sceneComplexity = 1.2 } = options || {}

  // 简单估算：基于字数和对话密度
  const wordCount = content.length
  const dialogueCount = (content.match(/[：:][^。.]*[。.]/g) || []).length
  const sceneCountEstimate = Math.ceil((wordCount / 1000) * dialogueDensity * sceneComplexity)

  // 限制在合理范围内
  return Math.max(5, Math.min(100, sceneCountEstimate))
}

/**
 * 判断剧本类型
 */
export function detectScriptType(content: string): 'dialogue' | 'narration' | 'mixed' {
  // 简单判断：统计对话和叙述的比重
  const dialogueMatches = content.match(/[：:][^。\n]*[。\n]/g) || []
  const dialogueRatio = dialogueMatches.length / (content.length / 500) // 每500字统计

  if (dialogueRatio > 2) return 'dialogue'
  if (dialogueRatio < 0.5) return 'narration'
  return 'mixed'
}

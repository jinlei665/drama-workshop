/**
 * Quick test: chunker + phase1 type validation
 * Does not require a running server or LLM credentials
 *
 * Run: npx tsx __tests__/chunker-test.ts
 */

// Since we can't do module imports easily without the Next.js env,
// let's test the chunker logic inline

// Copy of the chunker logic for standalone testing:
const MAX_CHUNK_SIZE = 6000
const MIN_BOUNDARY_INTERVAL = 200
const SOFT_BOUNDARY_INTERVAL = 500

const TIME_MARKERS = /(?:第[一二三四五六七八九十\d]+[天日月年]|[数几]+\s*(?:天|日|月|年|个?时辰|周)\s*(?:后|过去了|过去了之后|前))|(?:第二天|次日|翌日|清晨|早晨|早上|上午|中午|下午|傍晚|黄昏|夜幕降临|深夜|半夜|午夜|黎明|拂晓|午后|入夜|夜[里晚]|天亮|天黑|隔天|转天|又?过了?\s*(?:一会|一阵|许久|很久|一段?时间|半晌))/

const CHAPTER_MARKERS = /^(?:第[\u4e00-\u9fff\d]+[章节回]|序章|楔子|尾声|番外|前言|后记|引子|终章)/m

const SEPARATOR_MARKERS = /^(?:[-*=_]{3,}|[─═━]{3,}|\.{3,}|～{3,})$/m

function findSceneBoundaries(text: string): number[] {
  const boundaries: number[] = [0]
  const lines = text.split('\n')

  let charIndex = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    const isTimeMarker = TIME_MARKERS.test(trimmed)
    const isChapterMarker = CHAPTER_MARKERS.test(trimmed)
    const isSeparator = SEPARATOR_MARKERS.test(trimmed)
    const isEmptyLine = trimmed === ''

    const isBoundary =
      isChapterMarker ||
      isSeparator ||
      (isTimeMarker && trimmed.length <= 20)

    if (isBoundary && charIndex > 0) {
      const lastBoundary = boundaries[boundaries.length - 1]
      if (charIndex - lastBoundary > MIN_BOUNDARY_INTERVAL) {
        boundaries.push(charIndex)
      }
    }

    if (isEmptyLine && i > 0 && lines[i - 1]?.trim() === '' && charIndex > 0) {
      const lastBoundary = boundaries[boundaries.length - 1]
      if (charIndex - lastBoundary > SOFT_BOUNDARY_INTERVAL) {
        boundaries.push(charIndex)
      }
    }

    charIndex += line.length + 1
  }

  if (boundaries.length > 1 && boundaries[boundaries.length - 1] >= text.length) {
    boundaries.pop()
  }

  return boundaries
}

function buildChunks(text: string, boundaries: number[]) {
  // Simplified version for testing
  const chunks: Array<{chunkId: number; text: string; sceneCount: number; charCount: number}> = []
  let chunkId = 1
  let currentText = ''
  let sceneCount = 0

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : text.length
    const segText = text.slice(start, end).trim()
    if (!segText) continue

    if (currentText === '' || (currentText.length + segText.length <= MAX_CHUNK_SIZE)) {
      currentText = currentText ? currentText + '\n\n' + segText : segText
      sceneCount++
    } else {
      chunks.push({ chunkId: chunkId++, text: currentText, sceneCount, charCount: currentText.length })
      currentText = segText
      sceneCount = 1
    }
  }

  if (currentText) {
    chunks.push({ chunkId: chunkId, text: currentText, sceneCount, charCount: currentText.length })
  }

  return chunks
}

// ============ TEST ============
const fs = require('fs')
const path = require('path')

const scriptPath = path.join(__dirname, 'test-script.txt')
const scriptContent = fs.readFileSync(scriptPath, 'utf-8')

console.log('='.repeat(60))
console.log('Phase 1 模拟测试 (chunker + 剧本分析)')
console.log('='.repeat(60))
console.log()
console.log(`剧本长度: ${scriptContent.length} 字符`)
console.log(`预估时长: ~${Math.round(scriptContent.length / 1000 * 60)} 秒 (按1000字≈60秒)`)
console.log()

// Test chunker
const boundaries = findSceneBoundaries(scriptContent)
console.log(`检测到 ${boundaries.length} 个场景边界:`)
boundaries.forEach((pos, i) => {
  const preview = scriptContent.slice(pos, pos + 40).replace(/\n/g, ' ')
  console.log(`  [${i + 1}] char ${pos}: "${preview}..."`)
})

const chunks = buildChunks(scriptContent, boundaries)
console.log()
console.log(`分块结果: ${chunks.length} 块`)
chunks.forEach(c => {
  const preview = c.text.slice(0, 50).replace(/\n/g, ' ')
  console.log(`  Chunk ${c.chunkId}: ${c.charCount}字符, ${c.sceneCount}个场景, 开头: "${preview}..."`)
})

// Simulate character extraction (regex-based, not LLM)
console.log()
console.log('基于规则的角色预提取（非 LLM）:')
const namePattern = /[\u4e00-\u9fff]{2,3}(?:老爷子|婆婆|姑娘|大[爷哥]|小[姐妹]|夫人|先生|师傅)?(?=[，。\s]|(?:\s*(?:说|道|问|喊|叫|笑|想|看|走|来|去|推|拿|坐|站|跑|回|点|摇|叹|告诉|问道|笑了笑|摇摇头|点点头|喊道|笑了笑|推开门|探过头|走出来|摆摆手|蹲下来|穿过|背[着起]|接过|推开|转过头)))/g
const found = new Set<string>()
let match
while ((match = namePattern.exec(scriptContent)) !== null) {
  found.add(match[0])
}
console.log(`检测到 ${found.size} 个潜在角色: ${[...found].join(', ')}`)

console.log()
console.log('='.repeat(60))
console.log('Phase 1 测试完成！如果服务器运行，可调用 API 获取 LLM 分析结果。')
console.log('调用方式: POST http://localhost:5000/api/scripts/analyze?phase=1')
console.log('Body: { "scriptContent": "...", "projectId": "..." }')
console.log('='.repeat(60))

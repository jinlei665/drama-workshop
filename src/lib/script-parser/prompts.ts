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
      "dialogue": "对白内容（如有），格式：角色名：\\"对白内容\\"",
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

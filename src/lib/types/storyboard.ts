/**
 * 剧本分镜增强类型定义
 * 支持 Shot 数量规划、时长估算、Seedance 提示词优化和首尾帧模式
 */

/**
 * 分镜段落（一个分镜可能包含多个时序段落）
 */
export interface ShotSegment {
  /** 段落起始时间（毫秒） */
  startTimeMs: number
  /** 段落结束时间（毫秒） */
  endTimeMs: number
  /** 镜头类型 */
  shotType: string
  /** 段落描述 */
  description: string
  /** 首帧图片 URL（可选） */
  firstFrameImage?: string
  /** 尾帧图片 URL（可选） */
  lastFrameImage?: string
}

/**
 * 分镜 V2 版本（扩展原有 Scene 类型）
 */
export interface SceneV2 {
  /** 分镜编号 */
  sceneNumber: number
  /** Shot ID */
  shotId: number
  /** 分镜标题 */
  title: string
  /** 时长（毫秒） */
  durationMs: number
  /** 场景描述 */
  description: string
  /** Seedance 视频生成提示词 */
  videoPrompt: string
  /** 对话（可选） */
  dialogue?: string
  /** 动作描述（可选） */
  action?: string
  /** 情绪氛围（可选） */
  emotion?: string
  /** 出场人物列表 */
  characters: string[]
  /** 镜头类型 */
  shotType: string
  /** 分镜段落列表 */
  shotSegments: ShotSegment[]
  /** 是否需要生成首帧 */
  firstFrameNeeded: boolean
  /** 是否需要生成尾帧 */
  lastFrameNeeded: boolean
  /** 首帧描述 */
  firstFrameDescription?: string
  /** 尾帧描述 */
  lastFrameDescription?: string
  /** 转场效果 */
  transition?: string
}

/**
 * Shot 规划结果
 */
export interface ShotPlan {
  /** 场景审计信息 */
  sceneAudit: {
    totalScenes: number
    estimatedDurationMs: number
    sceneBreakdown: Array<{
      sceneNumber: number
      estimatedDurationMs: number
      complexity: 'low' | 'medium' | 'high'
    }>
  }
  /** Shot 规划列表 */
  shotPlan: Array<{
    sceneNumber: number
    shotCount: number
    totalDurationMs: number
    shotTypes: string[]
  }>
  /** 特殊说明 */
  specialNotes: string[]
}

/**
 * 计算分镜时长
 * @param scene 分镜对象
 * @returns 时长（毫秒）
 */
export function calculateSceneDuration(scene: { dialogue?: string; shotSegments?: ShotSegment[] }): number {
  // 如果有 shotSegments，使用段落信息计算
  if (scene.shotSegments && scene.shotSegments.length > 0) {
    return scene.shotSegments.reduce((total, seg) => total + (seg.endTimeMs - seg.startTimeMs), 0)
  }

  // 如果有对话，按字数估算（每秒约 5 个字）
  if (scene.dialogue) {
    return Math.max(3000, scene.dialogue.length * 200) // 最少 3 秒
  }

  // 默认 5 秒
  return 5000
}

/**
 * 生成 Seedance 视频提示词
 * @param description 场景描述
 * @param style 画面风格
 * @param characters 出场人物（可选）
 * @returns 优化后的 Seedance 提示词
 */
export function generateSeedancePrompt(
  description: string,
  style: string,
  characters?: string[]
): string {
  const characterContext = characters && characters.length > 0
    ? `人物：${characters.join('、')}。`
    : ''

  const styleMapping: Record<string, string> = {
    // 真人类
    realistic_cinema: '电影级写实风格，专业影视剧质感，电影级光影，高动态范围',
    realistic_drama: '短剧写实风格，现代短剧风格，自然光线，柔和色调',
    realistic_period: '古装写实风格，古风影视质感，唯美画面，古典氛围',
    realistic_idol: '偶像剧风格，韩剧/偶像剧风格，柔美滤镜，梦幻光效',
    // 动漫类
    anime_3d_cn: '国漫3D动画风格，国产3D动画如斗罗大陆，流畅动作',
    anime_2d_cn: '国风2D动画风格，如魔道祖师，古典美学',
    anime_jp: '日本动漫风格，如鬼灭之刃，强烈动效，细腻情感',
    anime_chibi: 'Q版萌系风格，可爱大头小身，明亮色彩',
    // 艺术类
    art_watercolor: '水彩插画风格，柔和淡雅，透明质感',
    art_ink: '中国传统水墨画风格，留白意境，浓淡变化',
    art_oil: '油画风格，厚重笔触，暖色调，戏剧性光影',
    art_comic: '美式漫画风格，强对比，网点质感',
    // 默认
    default: '电影质感，构图精美，氛围感强',
  }

  const styleContext = styleMapping[style] || styleMapping['default']

  // 构建 Seedance 提示词模板
  return `${characterContext}场景：${description}。${styleContext}。视频时长 5-8 秒，运动自然，节奏流畅，镜头语言丰富。`
}

/**
 * 估算总视频时长
 * @param scenes 分镜列表
 * @returns 总时长（毫秒）
 */
export function estimateTotalDuration(scenes: SceneV2[]): number {
  return scenes.reduce((total, scene) => total + scene.durationMs, 0)
}

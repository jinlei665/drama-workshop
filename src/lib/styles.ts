/**
 * 画面风格配置
 * 用于图像和视频生成时的风格提示词
 */

// 风格分类配置
export const VISUAL_STYLE_CATEGORIES = {
  realistic: {
    label: '真人类',
    styles: [
      { value: 'realistic_cinema', label: '电影级写实', description: '专业影视剧质感，电影级光影' },
      { value: 'realistic_drama', label: '短剧写实', description: '现代短剧风格，自然光线' },
      { value: 'realistic_period', label: '古装写实', description: '古风影视质感，唯美画面' },
      { value: 'realistic_idol', label: '偶像剧', description: '韩剧/偶像剧风格，柔美滤镜' },
    ]
  },
  anime: {
    label: '动漫类',
    styles: [
      { value: 'anime_3d_cn', label: '国漫3D', description: '国产3D动画风格，如斗罗大陆' },
      { value: 'anime_2d_cn', label: '国风2D', description: '国风2D动画，如魔道祖师' },
      { value: 'anime_jp', label: '日漫风格', description: '日本动漫风格，如鬼灭之刃' },
      { value: 'anime_chibi', label: 'Q版萌系', description: '可爱Q版风格，大头小身' },
    ]
  },
  artistic: {
    label: '艺术类',
    styles: [
      { value: 'art_watercolor', label: '水彩插画', description: '水彩画风格，柔和淡雅' },
      { value: 'art_ink', label: '水墨国风', description: '中国传统水墨画风格' },
      { value: 'art_oil', label: '油画质感', description: '油画风格，厚重笔触' },
      { value: 'art_comic', label: '美漫风格', description: '美式漫画风格，强对比' },
    ]
  }
} as const

// 获取所有风格列表（扁平化）
export function getAllStyles() {
  const styles: Array<{ value: string; label: string; description: string; category: string }> = []
  for (const [category, config] of Object.entries(VISUAL_STYLE_CATEGORIES)) {
    for (const style of config.styles) {
      styles.push({ ...style, category })
    }
  }
  return styles
}

// 根据值获取风格配置
export function getStyleByValue(value: string) {
  return getAllStyles().find(s => s.value === value)
}

/**
 * 获取风格提示词（用于图像生成）
 */
export function getStylePrompt(style: string): string {
  const stylePrompts: Record<string, string> = {
    // 真人类
    'realistic_cinema': '真人实拍风格，电影级质感，专业摄影，电影级光影，4K画质，景深效果，胶片质感',
    'realistic_drama': '真人实拍风格，现代短剧风格，自然光线，高清摄影，都市剧质感',
    'realistic_period': '真人实拍风格，古装影视剧质感，唯美古风，考究服装道具，电影级画面',
    'realistic_idol': '真人实拍风格，韩剧偶像剧风格，柔美滤镜，浪漫氛围，精修人像',
    // 动漫类
    'anime_3d_cn': '国产3D动画风格，精致建模，玄幻场景，如斗罗大陆、完美世界风格',
    'anime_2d_cn': '国风2D动画风格，精美国风，如魔道祖师、天官赐福风格',
    'anime_jp': '日本动漫风格，精良作画，如鬼灭之刃、咒术回战风格',
    'anime_chibi': 'Q版萌系风格，可爱大头小身，圆润线条，明亮配色',
    // 艺术类
    'art_watercolor': '水彩插画风格，柔和淡雅，水彩晕染效果，文艺清新',
    'art_ink': '中国传统水墨画风格，写意山水，墨色渲染，东方美学',
    'art_oil': '油画风格，厚重笔触，浓郁色彩，艺术质感',
    'art_comic': '美式漫画风格，强对比色彩，粗线条勾勒，动态感',
  }
  return stylePrompts[style] || stylePrompts['realistic_cinema']
}

/**
 * 获取角色风格提示词（用于人物三视图生成）
 */
export function getCharacterStylePrompt(style: string): string {
  const stylePrompts: Record<string, string> = {
    // 真人类
    'realistic_cinema': '真人演员风格，电影级角色造型，专业化妆造型，影视级质感',
    'realistic_drama': '真人演员风格，现代短剧造型，自然妆容，都市时尚感',
    'realistic_period': '真人演员风格，古装影视剧造型，古风妆发，考究服饰',
    'realistic_idol': '真人演员风格，韩剧偶像造型，精致妆容，时尚穿搭',
    // 动漫类
    'anime_3d_cn': '国产3D动画角色，精致建模，玄幻风格角色设计',
    'anime_2d_cn': '国风2D动画角色，精美国风角色设计',
    'anime_jp': '日本动漫角色风格，精美角色设计',
    'anime_chibi': 'Q版萌系角色设计，可爱大头小身',
    // 艺术类
    'art_watercolor': '水彩插画风格角色，柔和淡雅的人物描绘',
    'art_ink': '水墨画风格人物，写意人物造型',
    'art_oil': '油画风格人物肖像',
    'art_comic': '美漫风格角色设计',
  }
  return stylePrompts[style] || stylePrompts['realistic_cinema']
}

/**
 * 获取视频风格提示词（用于视频生成）
 */
export function getVideoStylePrompt(style: string): string {
  const stylePrompts: Record<string, string> = {
    // 真人类
    'realistic_cinema': '电影级画面，专业摄影，电影级光影，景深效果',
    'realistic_drama': '现代短剧画面，自然光线，都市剧质感',
    'realistic_period': '古装影视剧画面，唯美古风，考究场景',
    'realistic_idol': '韩剧偶像剧画面，柔美滤镜，浪漫氛围',
    // 动漫类
    'anime_3d_cn': '国产3D动画画面，精致渲染，玄幻场景',
    'anime_2d_cn': '国风2D动画画面，精美背景',
    'anime_jp': '日本动漫画面，精良作画',
    'anime_chibi': 'Q版萌系动画，可爱风格',
    // 艺术类
    'art_watercolor': '水彩画风格动态效果',
    'art_ink': '水墨画动态效果',
    'art_oil': '油画风格动态效果',
    'art_comic': '美漫风格动态效果',
  }
  return stylePrompts[style] || stylePrompts['realistic_cinema']
}

/**
 * 判断是否为真人风格
 */
export function isRealisticStyle(style: string): boolean {
  return style.startsWith('realistic_')
}

/**
 * 判断是否为动漫风格
 */
export function isAnimeStyle(style: string): boolean {
  return style.startsWith('anime_')
}

/**
 * 判断是否为艺术风格
 */
export function isArtisticStyle(style: string): boolean {
  return style.startsWith('art_')
}

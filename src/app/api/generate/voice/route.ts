import { NextRequest, NextResponse } from "next/server"
import { TTSClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryCharacters } from "@/lib/memory-storage"
import { getCozeConfigFromMemory } from "@/lib/memory-store"
import axios from "axios"

// 禁用代理工具函数
function disableProxy(): { http?: string; https?: string } | null {
  const proxy = {
    http: process.env.HTTP_PROXY,
    https: process.env.HTTPS_PROXY,
  }
  if (proxy.http || proxy.https) {
    delete process.env.HTTP_PROXY
    delete process.env.HTTPS_PROXY
    delete process.env.http_proxy
    delete process.env.https_proxy
    return proxy
  }
  return null
}

function restoreProxy(proxy: { http?: string; https?: string } | null): void {
  if (!proxy) return
  if (proxy.http) process.env.HTTP_PROXY = proxy.http
  if (proxy.https) process.env.HTTPS_PROXY = proxy.https
}

// 语音风格映射到 speaker ID
const VOICE_STYLE_MAP: Record<string, string> = {
  // 通用风格
  "natural": "zh_female_xiaohe_uranus_bigtts",      // 默认女声
  "female": "zh_female_xiaohe_uranus_bigtts",       // 女声
  "male": "zh_male_m191_uranus_bigtts",             // 男声
  
  // 有声书/朗读
  "audiobook": "zh_female_xueayi_saturn_bigtts",    // 儿童有声书
  
  // 视频配音
  "narration": "zh_male_dayi_saturn_bigtts",        // 大益（男声）
  "female_soft": "zh_female_mizai_saturn_bigtts",   // 米仔（女声）
  "motivational": "zh_female_jitangnv_saturn_bigtts", // 激励女声
  "charming": "zh_female_meilinvyou_saturn_bigtts", // 迷人女友
  
  // 角色扮演
  "cute_girl": "saturn_zh_female_keainvsheng_tob",
  "playful_princess": "saturn_zh_female_tiaopigongzhu_tob",
  "cheerful_boy": "saturn_zh_male_shuanglangshaonian_tob",
  "genius_classmate": "saturn_zh_male_tiancaitongzhuo_tob",
}

// 根据角色性别获取默认语音
function getDefaultVoiceByGender(gender?: string): string {
  if (gender === "male" || gender === "男") {
    return "zh_male_m191_uranus_bigtts"
  }
  return "zh_female_xiaohe_uranus_bigtts"
}

/**
 * POST /api/generate/voice
 * 生成角色配音
 * 
 * Body: {
 *   characterId: string,      // 角色ID
 *   text?: string,            // 要转换的文本（可选，默认使用角色描述）
 *   style?: string,           // 语音风格（可选，默认使用角色配置或系统默认）
 * }
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { characterId, text, style } = body

  if (!characterId) {
    return NextResponse.json({ error: "缺少角色ID" }, { status: 400 })
  }

  let character: any = null

  // 尝试从数据库获取角色
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseClient()
    const { data, error: charError } = await supabase
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .single()

    if (!charError && data) {
      character = data
    }
  }

  // 如果数据库中没有，从内存获取
  if (!character) {
    character = memoryCharacters.find(c => c.id === characterId)
  }

  if (!character) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 })
  }

  // 获取用户配置
  const userConfig = getCozeConfigFromMemory()
  const defaultBaseUrl = process.env.COZE_BASE_URL || "https://api.coze.cn"

  // 确定语音风格
  const voiceStyle = style || character.voice_style || "natural"
  const speaker = VOICE_STYLE_MAP[voiceStyle] || getDefaultVoiceByGender(character.gender)

  // 使用提供的文本或角色描述
  const textContent = text || character.description || character.personality || `我是${character.name}。`

  // 禁用代理，避免本地代理干扰
  const savedProxy = disableProxy()
  
  try {
    // 初始化 TTS 客户端
    const config = new Config({
      apiKey: userConfig?.apiKey || undefined,
      baseUrl: userConfig?.baseUrl || defaultBaseUrl,
      timeout: 60000,
    })
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
    const ttsClient = new TTSClient(config, customHeaders)

    console.log(`Generating voice for character ${character.name} with style ${voiceStyle}`)

    // 调用 TTS API
    const response = await ttsClient.synthesize({
      uid: characterId,
      text: textContent,
      speaker: speaker,
      audioFormat: "mp3",
      sampleRate: 24000,
    })

    const voiceUrl = response.audioUri
    const voiceSize = response.audioSize

    console.log(`Voice generated: ${voiceUrl}, size: ${voiceSize} bytes`)

    // 更新数据库中的角色配音信息
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      const { error: updateError } = await supabase
        .from("characters")
        .update({
          voice_url: voiceUrl,
          voice_style: voiceStyle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", characterId)

      if (updateError) {
        console.error("更新角色配音信息失败:", updateError)
      }
    }

    // 更新内存中的角色配音信息
    const memIndex = memoryCharacters.findIndex(c => c.id === characterId)
    if (memIndex !== -1) {
      (memoryCharacters[memIndex] as any).voiceUrl = voiceUrl
      ;(memoryCharacters[memIndex] as any).voiceStyle = voiceStyle
    }

    return NextResponse.json({
      success: true,
      voiceUrl: voiceUrl,
      voiceSize: voiceSize,
      voiceId: `voice_${characterId}_${Date.now()}`,
      voiceStyle: voiceStyle,
      speaker: speaker,
      textContent: textContent,
      characterName: character.name,
    })
  } catch (error) {
    console.error("语音生成失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "语音生成失败" },
      { status: 500 }
    )
  } finally {
    // 恢复代理设置
    restoreProxy(savedProxy)
  }
}

/**
 * 人物库 - 生成人物图像（文生图）
 * 根据人物描述生成正面视图图像
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils, S3Storage } from "coze-coding-dev-sdk"
import { generateImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"

// 获取人物库专用的数据库客户端（与人物库 API 保持一致）
function getCharacterLibraryClient() {
  const userUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (userUrl && serviceKey) {
    console.log('[Character Image] Using user Supabase with service_role:', userUrl)
    // eslint-disable-next-line no-eval
    const createClient = eval("require('@supabase/supabase-js')").createClient
    return createClient(userUrl, serviceKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  // 回退到沙箱环境或默认客户端
  const cozeUrl = process.env.COZE_SUPABASE_URL
  const cozeKey = process.env.COZE_SUPABASE_ANON_KEY

  if (cozeUrl && cozeKey) {
    console.log('[Character Image] Using sandbox Supabase:', cozeUrl)
    // eslint-disable-next-line no-eval
    const createClient = eval("require('@supabase/supabase-js')").createClient
    return createClient(cozeUrl, cozeKey, {
      db: { timeout: 60000 },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  // 回退到默认客户端
  return getSupabaseClient()
}

// POST /api/generate/character-image - 根据人物描述生成图像
export async function POST(request: NextRequest) {
  const { characterId, characterName, appearance, personality, style, gender, description } = await request.json()

  if (!characterId) {
    return NextResponse.json(
      { error: "缺少必要参数：characterId" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Character Image] Starting generation for:', characterId, 'with data:', { characterName, appearance, style, gender })

  try {
    // 检查必要参数
    if (!appearance) {
      console.error('[Character Image] Missing appearance parameter')
      return NextResponse.json(
        { error: "缺少外貌描述参数" },
        { status: 400 }
      )
    }
    // 构建图像生成提示词
    const name = characterName || '角色'
    const genderText = gender ? (gender === 'male' ? '男性' : gender === 'female' ? '女性' : '人物') : '人物'
    const desc = appearance || '角色形象'

    // 构建详细的提示词
    let prompt = `生成${name}的角色设定图，${genderText}，${desc}`

    // 添加性格特征
    if (personality) {
      prompt += `，性格${personality}`
    }

    // 添加风格
    const stylePrompt = getStylePrompt(style || 'realistic')
    prompt += `，${stylePrompt}`

    // 添加背景和质量要求
    prompt += '，正面视图，白色背景，高质量，细节丰富，用于角色设定参考'

    console.log('Generating character image with prompt:', prompt.substring(0, 150))

    // 使用文生图功能生成图像
    let imageUrl: string
    try {
      const result = await generateImage(prompt, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      imageUrl = result.urls[0]
      console.log('[Character Image] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Character Image] Generate error:', genError)
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : '图像生成失败' },
        { status: 500 }
      )
    }

    // 下载图片
    const imageBuffer = await downloadFile(imageUrl)

    // 尝试上传到对象存储（使用 S3Storage）
    let fileKey: string | null = null
    let viewUrl: string = imageUrl

    try {
      // 使用 ali-oss SDK 上传（支持设置 ACL）
      const OSS = await import('ali-oss')
      const ossClient = new OSS.default({
        region: process.env.S3_REGION || 'oss-cn-chengdu',
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        accessKeySecret: process.env.S3_SECRET_KEY || '',
        bucket: process.env.S3_BUCKET || 'drama-studio',
        secure: true,
      })

      // 上传到 OSS
      fileKey = `character-library/${characterId}/image_${Date.now()}.png`
      await ossClient.put(fileKey, imageBuffer)

      // 设置为公开读取
      await ossClient.putACL(fileKey, 'public-read')

      // 生成公网 URL
      const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
      viewUrl = `${endpoint}/${fileKey}`

      console.log("Image uploaded to OSS:", fileKey)
    } catch (ossError) {
      console.warn("Failed to upload to OSS, saving to local:", ossError)

      // 对象存储不可用，保存到本地 public 目录
      try {
        const fs = await import('fs')
        const path = await import('path')

        // 确保目录存在
        const publicDir = path.join(process.cwd(), 'public', 'character-library', characterId)
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }

        // 保存图片
        const localFileName = `image_${Date.now()}.png`
        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)

        // 使用本地相对路径作为 URL
        fileKey = `${characterId}/${localFileName}`
        viewUrl = `/character-library/${fileKey}`

        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

    // 更新数据库（使用 Supabase 客户端）
    let updatedCharacter: any = null
    try {
      console.log('[Character Image] Updating database for character:', characterId, 'with URL:', viewUrl)
      const supabase = getCharacterLibraryClient()
      const { data, error } = await supabase
        .from('character_library')
        .update({
          image_url: viewUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', characterId)
        .select()
        .single()

      if (error) {
        console.error('[Character Image] Failed to update database:', error)
      } else if (data) {
        console.log('[Character Image] Database updated successfully')
        updatedCharacter = {
          id: data.id,
          name: data.name,
          description: data.description,
          appearance: data.appearance,
          personality: data.personality,
          tags: data.tags || [],
          imageUrl: data.image_url,
          frontViewKey: data.front_view_key,
          style: data.style,
          createdAt: data.created_at,
        }
      }
    } catch (dbError) {
      console.error('[Character Image] Failed to update database:', dbError)
    }

    return NextResponse.json({
      success: true,
      imageUrl: viewUrl,
      fileKey,
      character: updatedCharacter // 返回更新后的完整数据
    })
  } catch (error) {
    console.error("Generate character image error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成人物图像失败" },
      { status: 500 }
    )
  }
}

/**
 * 根据风格获取提示词
 */
function getStylePrompt(style: string): string {
  const styleMap: Record<string, string> = {
    'realistic': '写实风格，真实感，细腻的皮肤纹理，光影效果自然',
    'anime': '动漫风格，二次元，精美的线条，明亮的色彩',
    'cartoon': '卡通风格，可爱，活泼，圆润的线条',
    'oil_painting': '油画风格，厚重的笔触，丰富的色彩层次',
  }
  return styleMap[style] || '写实风格，真实感，细腻的皮肤纹理，光影效果自然'
}

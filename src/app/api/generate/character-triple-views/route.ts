/**
 * 人物库 - 根据参考图片生成三视图
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils, S3Storage } from "coze-coding-dev-sdk"
import { generateImageFromImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"

// 获取人物库专用的数据库客户端（与人物库 API 保持一致）
function getCharacterLibraryClient() {
  const userUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (userUrl && serviceKey) {
    console.log('[Character Triple Views] Using user Supabase with service_role:', userUrl)
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
    console.log('[Character Triple Views] Using sandbox Supabase:', cozeUrl)
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

// POST /api/generate/character-triple-views - 根据参考图片生成三视图
export async function POST(request: NextRequest) {
  const { referenceImageUrl, characterId, characterName, appearance } = await request.json()

  if (!referenceImageUrl || !characterId) {
    return NextResponse.json(
      { error: "缺少必要参数：referenceImageUrl 和 characterId" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Character Triple Views] Starting generation for:', characterId, 'from reference image:', referenceImageUrl)

  try {
    // 构建三视图生成提示词
    const name = characterName || '角色'
    const desc = appearance || '角色形象'
    const basePrompt = `根据提供的参考图片，生成${name}的三视图（正面、侧面、背面），保持人物形象一致，${desc}，白色背景，用于角色设定参考，高质量，细节丰富`

    console.log('Generating triple views with prompt:', basePrompt.substring(0, 100))

    // 使用图生图功能生成三视图
    let imageUrl: string
    try {
      const result = await generateImageFromImage(basePrompt, referenceImageUrl, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      imageUrl = result.urls[0]
      console.log('[Character Triple Views] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Character Triple Views] Generate error:', genError)
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
      fileKey = `character-library/${characterId}/triple-views_${Date.now()}.png`
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
        const publicDir = path.join(process.cwd(), 'public', 'characters', characterId)
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }

        // 保存图片
        const localFileName = `triple-views_${Date.now()}.png`
        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)

        // 使用本地相对路径作为 URL
        fileKey = `${characterId}/${localFileName}`
        viewUrl = `/characters/${fileKey}`

        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

    // 更新数据库（使用 Supabase 客户端，与人物库 API 保持一致）
    try {
      console.log('[Character Triple Views] Updating database for character:', characterId, 'with URL:', viewUrl)
      const supabase = getCharacterLibraryClient()
      const { error } = await supabase
        .from('character_library')
        .update({
          front_view_key: fileKey,
          image_url: viewUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', characterId)

      if (error) {
        console.error('[Character Triple Views] Failed to update database:', error)
      } else {
        console.log('[Character Triple Views] Database updated successfully')
      }
    } catch (dbError) {
      console.error('[Character Triple Views] Failed to update database:', dbError)
    }

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
    })
  } catch (error) {
    console.error("Generate character triple views error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成人物三视图失败" },
      { status: 500 }
    )
  }
}

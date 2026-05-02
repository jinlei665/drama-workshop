/**
 * 项目人物 - 根据旧形象和文字描述生成新形象（图生图）
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils, S3Storage } from "coze-coding-dev-sdk"
import { generateImageFromImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"

// POST /api/generate/appearance-from-text - 根据旧形象和文字描述生成新形象（图生图）
export async function POST(request: NextRequest) {
  const { characterId, characterName, appearance, changeDescription, referenceImage } = await request.json()

  if (!characterId || !changeDescription) {
    return NextResponse.json(
      { error: "缺少必要参数：characterId 和 changeDescription" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Generate Appearance from Text] Starting generation for:', characterId, 'with description:', changeDescription)

  try {
    // 获取参考图片（优先使用传入的参考图片，否则从角色的主形象获取）
    let refImageUrl: string | undefined = referenceImage

    // 如果没有传入参考图片，从角色的主形象获取
    if (!refImageUrl && isDatabaseConfigured()) {
      try {
        const supabase = getSupabaseClient()

        // 先从 appearances 表获取主形象
        const { data: primaryAppearance } = await supabase
          .from('character_appearances')
          .select('image_url, image_key')
          .eq('character_id', characterId)
          .eq('is_primary', true)
          .maybeSingle()

        if (primaryAppearance?.image_url) {
          refImageUrl = primaryAppearance.image_url
          console.log('[Generate Appearance from Text] Using primary appearance image:', refImageUrl)
        } else if (primaryAppearance?.image_key) {
          // 如果只有 image_key，需要构造 URL
          const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
          refImageUrl = `${domain}/api/images?key=${primaryAppearance.image_key}`
          console.log('[Generate Appearance from Text] Using primary appearance image_key:', refImageUrl)
        }

        // 如果没有主形象，尝试从 characters 表获取 front_view_key 或 image_url
        if (!refImageUrl) {
          const { data: character } = await supabase
            .from('characters')
            .select('front_view_key, image_url')
            .eq('id', characterId)
            .single()

          if (character?.image_url) {
            refImageUrl = character.image_url
          } else if (character?.front_view_key) {
            const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
            refImageUrl = `${domain}/api/images?key=${character.front_view_key}`
          }
        }
      } catch (dbError) {
        console.warn('[Generate Appearance from Text] Failed to get reference image from database:', dbError)
      }
    }

    if (!refImageUrl) {
      console.warn('[Generate Appearance from Text] No reference image found, falling back to text-to-image')
      // 如果没有参考图片，回退到文生图
      const name = characterName || '角色'
      const change = changeDescription
      const basePrompt = `${name}的角色形象图：${change}，高质量，细节丰富`
      console.log('[Generate Appearance from Text] Falling back to text-to-image with prompt:', basePrompt.substring(0, 100))

      const { generateImage } = await import('@/lib/ai')
      const result = await generateImage(basePrompt, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      const imageUrl = result.urls[0]
      const imageBuffer = await downloadFile(imageUrl)
      const { fileKey, viewUrl } = await uploadImage(imageBuffer, characterId)

      return NextResponse.json({
        success: true,
        viewUrl,
        fileKey,
      })
    }

    // 检查参考图片 URL 是否需要转换为公网 URL
    // 外部 AI API 只能访问公网 HTTPS URL，不能访问 localhost、相对路径或内网地址
    const isPublicUrl = refImageUrl.startsWith('https://') &&
                        !refImageUrl.includes('localhost') &&
                        !refImageUrl.includes('127.0.0.1')

    if (!isPublicUrl) {
      console.log('[Generate Appearance from Text] Reference image is not a public URL, converting...')
      try {
        // 如果是相对路径（以 / 开头），先构造完整 URL 才能下载
        let downloadUrl = refImageUrl
        if (refImageUrl.startsWith('/')) {
          // 使用环境变量中的域名或默认 localhost 来构造下载 URL
          const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
          downloadUrl = `${domain}${refImageUrl}`
          console.log('[Generate Appearance from Text] Resolved relative path to:', downloadUrl)
        }

        // 下载图片
        const refImageBuffer = await downloadFile(downloadUrl)

        // 上传到 OSS 获取公网 URL
        const { fileKey: refFileKey, viewUrl: refPublicUrl } = await uploadImage(refImageBuffer, `${characterId}_ref`)

        if (refPublicUrl) {
          refImageUrl = refPublicUrl
          console.log('[Generate Appearance from Text] Reference image converted to public URL:', refImageUrl)
        }
      } catch (error) {
        console.warn('[Generate Appearance from Text] Failed to convert reference image to public URL, falling back to text-to-image:', error)

        // 转换失败，回退到文生图
        const name = characterName || '角色'
        const change = changeDescription
        const basePrompt = `${name}的角色形象图：${change}，高质量，细节丰富`

        const { generateImage } = await import('@/lib/ai')
        const result = await generateImage(basePrompt, {
          size: '2K',
          watermark: false,
        }, undefined, customHeaders)

        const imageUrl = result.urls[0]
        const imageBuffer = await downloadFile(imageUrl)
        const { fileKey, viewUrl } = await uploadImage(imageBuffer, characterId)

        return NextResponse.json({
          success: true,
          viewUrl,
          fileKey,
        })
      }
    }

    // 使用图生图功能生成新形象
    const name = characterName || '角色'
    const change = changeDescription

    // 提示词：参考图片已包含原始形象，这里只描述目标变更
    // 避免混入原始外貌描述导致 AI 困惑，确保 AI 基于参考图做定向修改
    const basePrompt = `请根据参考图片，将人物${name}的形象改变为：${change}。必须保持人物面部特征与参考图一致，不要改变五官和脸型。更换服装、发型、姿态和整体气质以匹配新的形象描述。高质量，细节丰富。`

    console.log('[Generate Appearance from Text] Generating new appearance with prompt:', basePrompt.substring(0, 100))
    console.log('[Generate Appearance from Text] Using reference image:', refImageUrl)

    let imageUrl: string
    try {
      const result = await generateImageFromImage(basePrompt, refImageUrl, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      imageUrl = result.urls[0]
      console.log('[Generate Appearance from Text] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Generate Appearance from Text] Generate error:', genError)
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : '图像生成失败' },
        { status: 500 }
      )
    }

    // 下载图片
    const imageBuffer = await downloadFile(imageUrl)

    // 上传图片
    const { fileKey, viewUrl } = await uploadImage(imageBuffer, characterId)

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
    })
  } catch (error) {
    console.error("Generate new appearance error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成新形象失败" },
      { status: 500 }
    )
  }
}

/**
 * 上传图片到存储
 */
async function uploadImage(imageBuffer: Buffer, characterId: string): Promise<{ fileKey: string | null; viewUrl: string }> {
  // 尝试使用 ali-oss SDK 上传
  try {
    const OSS = await import('ali-oss')
    const ossClient = new OSS.default({
      region: process.env.S3_REGION || 'oss-cn-chengdu',
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      accessKeySecret: process.env.S3_SECRET_KEY || '',
      bucket: process.env.S3_BUCKET || 'drama-studio',
      secure: true,
    })

    const timestamp = Date.now()
    const fileKey = `character-appearances/${characterId}/appearance_${timestamp}.png`
    await ossClient.put(fileKey, imageBuffer)

    // 设置为公开读取
    await ossClient.putACL(fileKey, 'public-read')

    // 生成公网 URL
    const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
    const viewUrl = `${endpoint}/${fileKey}`

    console.log("Image uploaded to OSS:", fileKey)
    return { fileKey, viewUrl }
  } catch (ossError) {
    console.warn("Failed to upload to OSS, saving to local:", ossError)

    // 对象存储不可用，保存到本地 public 目录
    try {
      const fs = await import('fs')
      const path = await import('path')

      const publicDir = path.join(process.cwd(), 'public', 'character-appearances', characterId)
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }

      const timestamp = Date.now()
      const localFileName = `appearance_${timestamp}.png`
      const localFilePath = path.join(publicDir, localFileName)
      fs.writeFileSync(localFilePath, imageBuffer)

      const fileKey = `character-appearances/${characterId}/${localFileName}`
      const viewUrl = `/character-appearances/${characterId}/${localFileName}`

      console.log("Image saved to local:", localFilePath)
      return { fileKey, viewUrl }
    } catch (localError) {
      console.warn("Failed to save to local:", localError)
      return { fileKey: null, viewUrl: '' }
    }
  }
}

/**
 * 项目人物 - 根据参考图生成新形象
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils, S3Storage } from "coze-coding-dev-sdk"
import { generateImageFromImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/appearance-from-image - 根据参考图生成新形象
export async function POST(request: NextRequest) {
  const { referenceImageUrl, characterId, characterName, appearance, changeDescription } = await request.json()

  if (!referenceImageUrl || !characterId) {
    return NextResponse.json(
      { error: "缺少必要参数：referenceImageUrl 和 characterId" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Generate Appearance] Starting generation for:', characterId, 'from reference image:', referenceImageUrl)

  try {
    // 检查参考图片 URL 是否需要转换为公网 URL
    // 外部 AI API 只能访问公网 HTTPS URL
    let refImageUrl = referenceImageUrl
    const isPublicUrl = refImageUrl.startsWith('https://') &&
                        !refImageUrl.includes('localhost') &&
                        !refImageUrl.includes('127.0.0.1')

    if (!isPublicUrl) {
      console.log('[Generate Appearance from Image] Reference image is not a public URL, converting...')
      try {
        // 如果是相对路径（以 / 开头），先构造完整 URL 才能下载
        let downloadUrl = refImageUrl
        if (refImageUrl.startsWith('/')) {
          const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
          downloadUrl = `${domain}${refImageUrl}`
          console.log('[Generate Appearance from Image] Resolved relative path to:', downloadUrl)
        }

        // 下载图片
        const refImageBuffer = await downloadFile(downloadUrl)

        // 上传到 OSS 获取公网 URL
        const { fileKey: refFileKey, viewUrl: refPublicUrl } = await uploadImage(refImageBuffer, `${characterId}_ref`)

        if (refPublicUrl) {
          refImageUrl = refPublicUrl
          console.log('[Generate Appearance from Image] Reference image converted to public URL:', refImageUrl)
        }
      } catch (error) {
        console.warn('[Generate Appearance from Image] Failed to convert reference image, falling back to text-to-image:', error)

        // 转换失败，回退到文生图
        const fallbackPrompt = `${characterName || '角色'}的角色形象图：${changeDescription || '新形象'}，高质量，细节丰富`
        const { generateImage } = await import('@/lib/ai')
        const result = await generateImage(fallbackPrompt, {
          size: '2K',
          watermark: false,
        }, undefined, customHeaders)

        const fallbackImageUrl = result.urls[0]
        const fallbackBuffer = await downloadFile(fallbackImageUrl)

        let fallbackFileKey: string | null = null
        let fallbackViewUrl: string = fallbackImageUrl

        try {
          const OSS = await import('ali-oss')
          const ossClient = new OSS.default({
            region: process.env.S3_REGION || 'oss-cn-chengdu',
            accessKeyId: process.env.S3_ACCESS_KEY || '',
            accessKeySecret: process.env.S3_SECRET_KEY || '',
            bucket: process.env.S3_BUCKET || 'drama-studio',
            secure: true,
          })
          fallbackFileKey = `character-appearances/${characterId}/appearance_${Date.now()}.png`
          await ossClient.put(fallbackFileKey, fallbackBuffer)
          await ossClient.putACL(fallbackFileKey, 'public-read')
          const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
          fallbackViewUrl = `${endpoint}/${fallbackFileKey}`
        } catch (ossError) {
          console.warn('Failed to upload fallback image to OSS:', ossError)
          const fs = await import('fs')
          const path = await import('path')
          const publicDir = path.join(process.cwd(), 'public', 'character-appearances', characterId)
          if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true })
          }
          const localFileName = `appearance_${Date.now()}.png`
          const localFilePath = path.join(publicDir, localFileName)
          fs.writeFileSync(localFilePath, fallbackBuffer)
          fallbackFileKey = `${characterId}/${localFileName}`
          fallbackViewUrl = `/character-appearances/${fallbackFileKey}`
        }

        return NextResponse.json({
          success: true,
          viewUrl: fallbackViewUrl,
          fileKey: fallbackFileKey,
        })
      }
    }

    // 构建生成新形象的提示词
    const name = characterName || '角色'
    const change = changeDescription || '保持原风格'
    // 提示词：参考图片已包含原始形象，这里只描述目标变更
    const basePrompt = `请根据参考图片，将人物${name}的形象改变为：${change}。必须保持人物面部特征与参考图一致，不要改变五官和脸型。更换服装、发型、姿态和整体气质以匹配新的形象描述。高质量，细节丰富。`

    console.log('Generating new appearance with prompt:', basePrompt.substring(0, 100))

    // 使用图生图功能生成新形象
    let imageUrl: string
    try {
      const result = await generateImageFromImage(basePrompt, referenceImageUrl, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)

      imageUrl = result.urls[0]
      console.log('[Generate Appearance] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Generate Appearance] Generate error:', genError)
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
      fileKey = `character-appearances/${characterId}/appearance_${Date.now()}.png`
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
        const publicDir = path.join(process.cwd(), 'public', 'character-appearances', characterId)
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }

        // 保存图片
        const localFileName = `appearance_${Date.now()}.png`
        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)

        // 使用本地相对路径作为 URL
        fileKey = `${characterId}/${localFileName}`
        viewUrl = `/character-appearances/${fileKey}`

        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

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

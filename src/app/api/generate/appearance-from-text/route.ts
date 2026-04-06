/**
 * 项目人物 - 根据文字描述生成新形象
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils } from "coze-coding-dev-sdk"
import { generateImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/appearance-from-text - 根据文字描述生成新形象
export async function POST(request: NextRequest) {
  const { characterId, characterName, appearance, changeDescription } = await request.json()

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
    // 构建生成新形象的提示词
    const name = characterName || '角色'
    const desc = appearance || '角色形象'
    const change = changeDescription

    // 提示词：根据文字描述生成新形象
    const basePrompt = `${name}，${desc}，人物形象变成${change}，保持人物面部特征一致，高质量，细节丰富`

    console.log('Generating new appearance with prompt:', basePrompt.substring(0, 100))

    // 使用文生图功能生成新形象
    let imageUrl: string
    try {
      const result = await generateImage(basePrompt, {
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

    // 尝试上传到对象存储
    let fileKey: string | null = null
    let viewUrl: string = imageUrl

    try {
      const { S3Storage } = await import("coze-coding-dev-sdk")
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: "",
        secretKey: "",
        bucketName: process.env.COZE_BUCKET_NAME,
        region: "cn-beijing",
      })

      // 上传到对象存储
      const timestamp = Date.now()
      const fileName = `character-appearances/${characterId}/appearance_${timestamp}.png`
      fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: fileName,
        contentType: "image/png",
      })

      // 生成访问 URL
      viewUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 86400 * 7, // 7天有效
      })

      console.log("Image uploaded to storage:", fileKey)
    } catch (storageError) {
      console.warn("Failed to upload to storage, saving to local:", storageError)

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
        const timestamp = Date.now()
        const localFileName = `appearance_${timestamp}.png`
        const localFilePath = path.join(publicDir, localFileName)
        fs.writeFileSync(localFilePath, imageBuffer)

        // 使用本地相对路径作为 URL
        fileKey = `character-appearances/${characterId}/${localFileName}`
        viewUrl = `/character-appearances/${characterId}/${localFileName}`

        console.log("Image saved to local:", localFilePath)
      } catch (localError) {
        console.warn("Failed to save to local:", localError)
      }
    }

    // 如果 fileKey 仍然为 null，使用原始 URL 作为 fallback
    if (!fileKey) {
      fileKey = imageUrl
      console.warn("Using original URL as fileKey fallback")
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

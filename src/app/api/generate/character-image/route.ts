/**
 * 人物库 - 生成人物图像（文生图）
 * 根据人物描述生成正面视图图像
 */

import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils } from "coze-coding-dev-sdk"
import { generateImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"
import { Pool } from 'pg'

// PostgreSQL 连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

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

  console.log('[Character Image] Starting generation for:', characterId)

  try {
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
      fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `character-library/${characterId}/image_${Date.now()}.png`,
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

    // 更新数据库（使用 pg 直连）
    try {
      await pool.query(
        `UPDATE character_library
         SET image_url = $1, updated_at = NOW()
         WHERE id = $2`,
        [viewUrl, characterId]
      )
      console.log("Database updated with image_url:", viewUrl)
    } catch (dbError) {
      console.warn("Failed to update database:", dbError)
    }

    return NextResponse.json({
      success: true,
      imageUrl: viewUrl,
      fileKey,
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

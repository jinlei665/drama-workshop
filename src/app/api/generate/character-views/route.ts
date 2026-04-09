import { NextRequest, NextResponse } from "next/server"
import { HeaderUtils, S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"
import { memoryCharacters, memoryProjects } from "@/lib/memory-storage"
import { getCharacterStylePrompt } from "@/lib/styles"
import { generateImage } from "@/lib/ai"
import { downloadFile } from "@/lib/utils"

// POST /api/generate/character-views - 生成人物三视图（短剧角色设定）
export async function POST(request: NextRequest) {
  const { characterId, appearance } = await request.json()

  if (!characterId || !appearance) {
    return NextResponse.json(
      { error: "缺少必要参数" },
      { status: 400 }
    )
  }

  // 提取请求头用于转发
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)

  console.log('[Character Views] Starting generation for:', characterId)

  try {
    // 获取项目风格
    let style = 'realistic_cinema'
    let customStylePrompt = ''
    
    // 从内存获取
    const charIndex = memoryCharacters.findIndex(c => c.id === characterId)
    if (charIndex !== -1) {
      const projectId = memoryCharacters[charIndex].projectId
      const project = memoryProjects.find(p => p.id === projectId)
      if (project?.style) {
        style = project.style
      }
      if (project?.customStylePrompt) {
        customStylePrompt = project.customStylePrompt
      }
    }
    
    // 从数据库获取
    if (isDatabaseConfigured()) {
      const supabase = getSupabaseClient()
      
      const { data: charData } = await supabase
        .from('characters')
        .select('project_id')
        .eq('id', characterId)
        .single()
      
      if (charData?.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('style, custom_style_prompt')
          .eq('id', charData.project_id)
          .single()
        
        if (projectData?.style) {
          style = projectData.style
        }
        if (projectData?.custom_style_prompt) {
          customStylePrompt = projectData.custom_style_prompt
        }
      }
    }

    // 获取角色风格提示词
    // 如果是自定义风格，使用用户输入的自定义提示词
    let stylePrompt: string
    if (style === 'custom' && customStylePrompt) {
      stylePrompt = customStylePrompt
    } else {
      stylePrompt = getCharacterStylePrompt(style)
    }

    // 生成角色设定图
    const basePrompt = `${stylePrompt}，${appearance}，角色三视图包含正面、侧面、背面三个角度，白色背景，用于角色设定参考`

    console.log(`Generating character views for ${characterId} with style ${style}:`, basePrompt.substring(0, 100))

    // 使用统一的图像生成接口（使用沙箱环境内置凭证）
    let imageUrl: string
    try {
      const result = await generateImage(basePrompt, {
        size: '2K',
        watermark: false,
      }, undefined, customHeaders)
      
      imageUrl = result.urls[0]
      console.log('[Character Views] Image generated successfully:', imageUrl)
    } catch (genError) {
      console.error('[Character Views] Generate error:', genError)
      return NextResponse.json(
        { error: genError instanceof Error ? genError.message : '图像生成失败' },
        { status: 500 }
      )
    }

    // 下载图片（禁用代理）
    const imageBuffer = await downloadFile(imageUrl)

    // 尝试上传到对象存储（使用 S3Storage）
    let fileKey: string | null = null
    let viewUrl: string = imageUrl // 默认使用原始 URL

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
      fileKey = `${characterId}/views_${Date.now()}.png`
      await ossClient.put(fileKey, imageBuffer)

      // 设置为公开读取
      await ossClient.putACL(fileKey, 'public-read')

      // 生成公网 URL
      // 注意：S3_ENDPOINT 已经包含了 bucket 名称（如 https://bucket.oss-region.aliyuncs.com）
      // 所以只需要拼接 key 即可
      const endpoint = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL
      viewUrl = `${endpoint}/${fileKey}`

      console.log("Image uploaded to OSS:", fileKey)
      console.log("Image URL:", viewUrl)
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
        const localFileName = `views_${Date.now()}.png`
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

    // 更新数据库
    if (isDatabaseConfigured()) {
      try {
        const supabase = getSupabaseClient()
        
        // 先只更新 front_view_key（确保至少能更新这个字段）
        const { error } = await supabase
          .from("characters")
          .update({
            front_view_key: fileKey,  // 存储相对路径，更短
            updated_at: new Date().toISOString(),
          })
          .eq("id", characterId)

        if (error) {
          console.warn("Database update error:", error.message)
        } else {
          console.log("Database updated with front_view_key:", fileKey)
          
          // 尝试更新 image_url（如果 schema cache 已刷新）
          try {
            const { error: imageError } = await supabase
              .from("characters")
              .update({ image_url: viewUrl })
              .eq("id", characterId)
            
            if (imageError) {
              console.warn("Failed to update image_url (schema cache may need refresh):", imageError.message)
            } else {
              console.log("Database updated with image_url:", viewUrl)
            }
          } catch (imageErr) {
            console.warn("Failed to update image_url:", imageErr)
          }
        }
      } catch (dbError) {
        console.warn("Failed to update database:", dbError)
      }
    }

    // 更新内存存储
    if (charIndex !== -1) {
      memoryCharacters[charIndex].frontViewKey = fileKey || undefined
      memoryCharacters[charIndex].imageUrl = viewUrl  // 使用 OSS 完整 URL 或本地路径
    }

    return NextResponse.json({
      success: true,
      viewUrl,
      fileKey,
      style,
    })
  } catch (error) {
    console.error("Generate character views error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成人物视图失败" },
      { status: 500 }
    )
  }
}

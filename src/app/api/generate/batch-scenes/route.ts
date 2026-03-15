import { NextRequest, NextResponse } from "next/server"
import { S3Storage } from "coze-coding-dev-sdk"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { ImageGenerationClient, Config, HeaderUtils } from "coze-coding-dev-sdk"
import axios from "axios"

// POST /api/generate/batch-scenes - 批量生成分镜图片
export async function POST(request: NextRequest) {
  const { projectId } = await request.json()

  if (!projectId) {
    return NextResponse.json(
      { error: "缺少项目ID" },
      { status: 400 }
    )
  }

  const supabase = getSupabaseClient()

  // 获取项目和分镜数据
  const { data: scenes, error: scenesError } = await supabase
    .from("scenes")
    .select("*")
    .eq("project_id", projectId)
    .order("scene_number", { ascending: true })

  if (scenesError || !scenes || scenes.length === 0) {
    return NextResponse.json(
      { error: "未找到分镜数据" },
      { status: 404 }
    )
  }

  // 获取人物数据
  const { data: characters } = await supabase
    .from("characters")
    .select("*")
    .eq("project_id", projectId)

  const characterMap = new Map(
    (characters || []).map((c: any) => [c.id, c])
  )

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers)
  const config = new Config()
  const imageClient = new ImageGenerationClient(config, customHeaders)

  const storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: "",
    secretKey: "",
    bucketName: process.env.COZE_BUCKET_NAME,
    region: "cn-beijing",
  })

  const results = []

  for (const scene of scenes) {
    // 跳过已完成的
    if (scene.status === "completed") {
      results.push({ sceneId: scene.id, status: "skipped", message: "已完成" })
      continue
    }

    try {
      // 更新状态为生成中
      await supabase
        .from("scenes")
        .update({ status: "generating" })
        .eq("id", scene.id)

      // 获取出场人物描述
      const charDescriptions = (scene.character_ids || [])
        .map((id: string) => characterMap.get(id)?.appearance)
        .filter(Boolean)

      // 构建真人实拍风格提示词
      let prompt = `真人实拍风格，短剧视频分镜画面，${scene.description}`

      if (scene.emotion) {
        prompt += `，${scene.emotion}的氛围`
      }

      if (charDescriptions.length > 0) {
        prompt += `，画面中的角色：${charDescriptions.join("、")}`
      }

      prompt += "，专业影视剧画面，电影级构图，高清摄影，4K画质，细节丰富"

      // 生成图片
      const response = await imageClient.generate({
        prompt,
        size: "2K",
        watermark: false,
      })

      const helper = imageClient.getResponseHelper(response)

      if (!helper.success) {
        await supabase
          .from("scenes")
          .update({ status: "failed" })
          .eq("id", scene.id)

        results.push({
          sceneId: scene.id,
          status: "failed",
          error: helper.errorMessages.join(", "),
        })
        continue
      }

      // 下载并上传
      const imageUrl = helper.imageUrls[0]
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      })
      const imageBuffer = Buffer.from(imageResponse.data)

      const fileKey = await storage.uploadFile({
        fileContent: imageBuffer,
        fileName: `scenes/${scene.id}/image_${Date.now()}.png`,
        contentType: "image/png",
      })

      // 更新数据库
      await supabase
        .from("scenes")
        .update({
          image_key: fileKey,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", scene.id)

      results.push({
        sceneId: scene.id,
        status: "completed",
        imageKey: fileKey,
      })
    } catch (error) {
      console.error(`Scene ${scene.id} generation error:`, error)

      await supabase
        .from("scenes")
        .update({ status: "failed" })
        .eq("id", scene.id)

      results.push({
        sceneId: scene.id,
        status: "failed",
        error: String(error),
      })
    }
  }

  return NextResponse.json({
    success: true,
    total: scenes.length,
    results,
  })
}

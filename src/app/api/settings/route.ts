import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { updateUserSettingsSchema } from "@/storage/database/shared/schema"

// GET /api/settings - 获取用户配置
export async function GET() {
  const client = getSupabaseClient()

  const { data: settings, error } = await client
    .from("user_settings")
    .select("*")
    .eq("id", "default")
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 如果没有配置，返回默认值
  if (!settings) {
    return NextResponse.json({
      settings: {
        id: "default",
        llm_provider: "doubao",
        llm_model: "doubao-seed-2-0-pro",
        llm_api_key: null,
        llm_base_url: null,
        image_provider: "doubao",
        image_model: "doubao-seed-3-0",
        image_api_key: null,
        image_base_url: null,
        image_size: "2K",
        video_provider: "doubao",
        video_model: "doubao-seedance-1-5-pro-251215",
        video_api_key: null,
        video_base_url: null,
        video_resolution: "720p",
        video_ratio: "16:9",
      }
    })
  }

  return NextResponse.json({ settings })
}

// PUT /api/settings - 更新用户配置
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = updateUserSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 转换字段名为数据库格式（snake_case）
  const dbData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  
  if (parsed.data.llmProvider !== undefined) dbData.llm_provider = parsed.data.llmProvider
  if (parsed.data.llmModel !== undefined) dbData.llm_model = parsed.data.llmModel
  if (parsed.data.llmApiKey !== undefined) dbData.llm_api_key = parsed.data.llmApiKey
  if (parsed.data.llmBaseUrl !== undefined) dbData.llm_base_url = parsed.data.llmBaseUrl
  if (parsed.data.imageProvider !== undefined) dbData.image_provider = parsed.data.imageProvider
  if (parsed.data.imageModel !== undefined) dbData.image_model = parsed.data.imageModel
  if (parsed.data.imageApiKey !== undefined) dbData.image_api_key = parsed.data.imageApiKey
  if (parsed.data.imageBaseUrl !== undefined) dbData.image_base_url = parsed.data.imageBaseUrl
  if (parsed.data.imageSize !== undefined) dbData.image_size = parsed.data.imageSize
  if (parsed.data.videoProvider !== undefined) dbData.video_provider = parsed.data.videoProvider
  if (parsed.data.videoModel !== undefined) dbData.video_model = parsed.data.videoModel
  if (parsed.data.videoApiKey !== undefined) dbData.video_api_key = parsed.data.videoApiKey
  if (parsed.data.videoBaseUrl !== undefined) dbData.video_base_url = parsed.data.videoBaseUrl
  if (parsed.data.videoResolution !== undefined) dbData.video_resolution = parsed.data.videoResolution
  if (parsed.data.videoRatio !== undefined) dbData.video_ratio = parsed.data.videoRatio

  // 使用 upsert 确保配置存在
  const { data, error } = await client
    .from("user_settings")
    .upsert({
      id: "default",
      ...dbData,
    }, { onConflict: "id" })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}

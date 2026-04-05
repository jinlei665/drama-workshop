import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { updateSceneSchema } from "@/storage/database/shared/schema"

// GET /api/scenes/[id] - 获取分镜详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  const { data, error } = await client
    .from("scenes")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ scene: data })
}

// PUT /api/scenes/[id] - 更新分镜
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = updateSceneSchema.safeParse(body)
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

  if (parsed.data.sceneNumber !== undefined) dbData.scene_number = parsed.data.sceneNumber
  if (parsed.data.title !== undefined) dbData.title = parsed.data.title
  if (parsed.data.description !== undefined) dbData.description = parsed.data.description
  if (parsed.data.dialogue !== undefined) dbData.dialogue = parsed.data.dialogue
  if (parsed.data.action !== undefined) dbData.action = parsed.data.action
  if (parsed.data.emotion !== undefined) dbData.emotion = parsed.data.emotion
  if (parsed.data.characterIds !== undefined) dbData.character_ids = parsed.data.characterIds
  if (parsed.data.imageKey !== undefined) dbData.image_key = parsed.data.imageKey
  if (parsed.data.imageUrl !== undefined) dbData.image_url = parsed.data.imageUrl
  if (parsed.data.videoUrl !== undefined) dbData.video_url = parsed.data.videoUrl
  if (parsed.data.videoStatus !== undefined) dbData.video_status = parsed.data.videoStatus
  if (parsed.data.lastFrameUrl !== undefined) dbData.last_frame_url = parsed.data.lastFrameUrl
  if (parsed.data.status !== undefined) dbData.status = parsed.data.status
  if (parsed.data.metadata !== undefined) dbData.metadata = parsed.data.metadata
  if (parsed.data.episodeId !== undefined) dbData.episode_id = parsed.data.episodeId

  const { data, error } = await client
    .from("scenes")
    .update(dbData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ scene: data })
}

// DELETE /api/scenes/[id] - 删除分镜
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  const { error } = await client.from("scenes").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

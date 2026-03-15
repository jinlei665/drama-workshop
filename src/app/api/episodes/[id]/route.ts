import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { updateEpisodeSchema } from "@/storage/database/shared/schema"

// GET /api/episodes/[id] - 获取单个剧集详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  const { data: episode, error } = await client
    .from("episodes")
    .select(`
      *,
      scenes:scenes(
        id,
        scene_number,
        title,
        status,
        video_status
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!episode) {
    return NextResponse.json({ error: "剧集不存在" }, { status: 404 })
  }

  return NextResponse.json({ episode })
}

// PUT /api/episodes/[id] - 更新剧集
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = updateEpisodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.seasonNumber !== undefined) updateData.season_number = parsed.data.seasonNumber
  if (parsed.data.episodeNumber !== undefined) updateData.episode_number = parsed.data.episodeNumber
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description
  if (parsed.data.mergedVideoUrl !== undefined) updateData.merged_video_url = parsed.data.mergedVideoUrl
  if (parsed.data.mergedVideoStatus !== undefined) updateData.merged_video_status = parsed.data.mergedVideoStatus
  if (parsed.data.mergedVideoKey !== undefined) updateData.merged_video_key = parsed.data.mergedVideoKey

  const { data: episode, error } = await client
    .from("episodes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ episode })
}

// DELETE /api/episodes/[id] - 删除剧集
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  // 先删除该剧集下的所有分镜
  const { error: scenesError } = await client
    .from("scenes")
    .delete()
    .eq("episode_id", id)

  if (scenesError) {
    return NextResponse.json({ error: scenesError.message }, { status: 500 })
  }

  // 再删除剧集
  const { error } = await client
    .from("episodes")
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

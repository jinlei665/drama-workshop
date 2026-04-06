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

  try {
    // 先获取剧集信息
    const { data: episode, error } = await client
      .from("episodes")
      .select("*")
      .eq("id", id)

    // 处理查询结果
    if (error) {
      console.error("获取剧集失败:", error)
      return NextResponse.json({ 
        error: error.message || "获取剧集失败",
        episode: null 
      }, { status: 200 })
    }

    // 检查是否有结果
    if (!episode || episode.length === 0) {
      return NextResponse.json({ 
        error: "剧集不存在",
        episode: null 
      }, { status: 404 })
    }

    const episodeData = episode[0]

    // 获取该剧集关联的分镜
    let scenesData: any[] = []
    try {
      const { data: scenes, error: scenesError } = await client
        .from("scenes")
        .select("id, scene_number, title, description, image_url, video_url, video_status, status")
        .eq("episode_id", id)
        .order("scene_number", { ascending: true })

      if (!scenesError && scenes) {
        scenesData = scenes
      }
    } catch (err) {
      console.error("获取分镜失败:", err)
    }

    return NextResponse.json({ 
      episode: { ...episodeData, scenes: scenesData } 
    })
  } catch (err) {
    console.error("获取剧集详情异常:", err)
    return NextResponse.json({ 
      error: "获取剧集详情失败",
      episode: null 
    }, { status: 200 })
  }
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

  const { data: episodes, error } = await client
    .from("episodes")
    .update(updateData)
    .eq("id", id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const episode = episodes?.[0] || null
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

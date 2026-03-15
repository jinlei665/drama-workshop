import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { insertEpisodeSchema, updateEpisodeSchema } from "@/storage/database/shared/schema"

// GET /api/episodes - 获取项目的剧集列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
  }

  const client = getSupabaseClient()

  // 获取剧集列表，按季数和集数排序
  const { data: episodes, error } = await client
    .from("episodes")
    .select(`
      *,
      scenes:scenes(count)
    `)
    .eq("project_id", projectId)
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 转换数据格式
  const formattedEpisodes = (episodes || []).map((ep: any) => ({
    ...ep,
    sceneCount: ep.scenes?.[0]?.count || 0,
    scenes: undefined,
  }))

  return NextResponse.json({ episodes: formattedEpisodes })
}

// POST /api/episodes - 创建新剧集
export async function POST(request: NextRequest) {
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = insertEpisodeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 检查同一项目下是否已存在相同季数和集数的剧集
  const { data: existing } = await client
    .from("episodes")
    .select("id")
    .eq("project_id", parsed.data.projectId)
    .eq("season_number", parsed.data.seasonNumber || 1)
    .eq("episode_number", parsed.data.episodeNumber)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: "该季数和集数已存在" },
      { status: 400 }
    )
  }

  const { data: episode, error } = await client
    .from("episodes")
    .insert({
      project_id: parsed.data.projectId,
      season_number: parsed.data.seasonNumber || 1,
      episode_number: parsed.data.episodeNumber,
      title: parsed.data.title,
      description: parsed.data.description,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ episode })
}

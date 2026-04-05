import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { insertEpisodeSchema, updateEpisodeSchema } from "@/storage/database/shared/schema"
import { memoryEpisodes, memoryScenes, generateId } from "@/lib/memory-storage"

// GET /api/episodes - 获取项目的剧集列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
  }

  // 尝试从数据库获取
  try {
    const client = getSupabaseClient()

    // 获取剧集列表，按季数和集数排序
    const { data: episodes, error } = await client
      .from("episodes")
      .select("*")
      .eq("project_id", projectId)
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true })

    if (error) {
      console.warn("数据库查询剧集失败，回退到内存存储:", error.message)
      // 回退到内存存储
      const episodes = memoryEpisodes
        .filter(e => e.projectId === projectId)
        .sort((a, b) => {
          if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber
          return a.episodeNumber - b.episodeNumber
        })
        .map(ep => ({
          ...ep,
          sceneCount: memoryScenes.filter(s => s.episodeId === ep.id).length
        }))
      return NextResponse.json({ episodes })
    }

    // 获取所有分镜，按 episode_id 分组计数
    const { data: scenes, error: scenesError } = await client
      .from("scenes")
      .select("episode_id")
      .eq("project_id", projectId)

    if (scenesError) {
      console.warn("获取分镜失败:", scenesError.message)
    }

    // 计算每个剧集的分镜数量
    const sceneCounts: Record<string, number> = {}
    ;(scenes || []).forEach((scene: any) => {
      if (scene.episode_id) {
        sceneCounts[scene.episode_id] = (sceneCounts[scene.episode_id] || 0) + 1
      }
    })

    // 转换数据格式
    const formattedEpisodes = (episodes || []).map((ep: any) => ({
      ...ep,
      sceneCount: sceneCounts[ep.id] || 0,
    }))

    return NextResponse.json({ episodes: formattedEpisodes })
  } catch (err) {
    console.warn("数据库连接失败，回退到内存存储:", err)
    // 回退到内存存储
    const episodes = memoryEpisodes
      .filter(e => e.projectId === projectId)
      .sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber
        return a.episodeNumber - b.episodeNumber
      })
      .map(ep => ({
        ...ep,
        sceneCount: memoryScenes.filter(s => s.episodeId === ep.id).length
      }))
    return NextResponse.json({ episodes })
  }
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
      id: generateId('ep'),  // 添加 id 字段
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

  // 如果指定了分镜范围，分配分镜到该剧集
  let sceneCount = 0
  if (body.sceneStart !== undefined && body.sceneEnd !== undefined) {
    const sceneStart = Math.max(1, body.sceneStart)
    const sceneEnd = Math.max(sceneStart, body.sceneEnd)

    // 获取未分配的分镜（按序号排序）
    const { data: unassignedScenes } = await client
      .from("scenes")
      .select("id")
      .eq("project_id", parsed.data.projectId)
      .is("episode_id", null)
      .order("scene_number", { ascending: true })

    if (unassignedScenes && unassignedScenes.length > 0) {
      // 提取指定范围的分镜
      const scenesToAssign = unassignedScenes.slice(sceneStart - 1, sceneEnd)
      
      // 更新这些分镜的 episode_id
      if (scenesToAssign.length > 0) {
        const sceneIds = scenesToAssign.map((s: any) => s.id)
        await client
          .from("scenes")
          .update({ episode_id: episode.id, updated_at: new Date().toISOString() })
          .in("id", sceneIds)
        
        sceneCount = sceneIds.length
      }
    }
  }

  return NextResponse.json({ episode, sceneCount })
}

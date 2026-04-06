import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { Pool } from 'pg'

function getPgDirectUrl(): string | null {
  return process.env.PGDATABASE_URL || null
}

// 使用 pg 客户端执行 SQL
async function updateEpisodeWithPg(id: string, updateData: Record<string, any>) {
  const pgUrl = getPgDirectUrl()
  if (!pgUrl) {
    console.log("No pgUrl, skipping pg direct update")
    return null
  }
  
  try {
    const pool = new Pool({ connectionString: pgUrl })
    const setClauses: string[] = []
    const values: any[] = []
    let i = 1
    
    for (const [key, val] of Object.entries(updateData)) {
      if (val !== undefined && key !== 'updated_at') {
        setClauses.push(`${key} = $${i}`)
        values.push(val)
        i++
      }
    }
    // 始终更新 updated_at
    setClauses.push(`updated_at = NOW()`)
    values.push(id)
    
    const res = await pool.query(
      `UPDATE episodes SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    await pool.end()
    
    return res.rows[0] || null
  } catch (err: any) {
    console.error("pg update failed:", err.message)
    return null
  }
}

// 检查是否为 Supabase 云数据库
function isSupabaseCloud(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return url.includes('supabase.co') && !url.includes('localhost')
}
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

  // 手动解析和验证更新数据（避免 schema 问题）
  const updateData: Record<string, any> = {}

  if (body.seasonNumber !== undefined) updateData.season_number = body.seasonNumber
  if (body.episodeNumber !== undefined) updateData.episode_number = body.episodeNumber
  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description
  if (body.mergedVideoUrl !== undefined) updateData.merged_video_url = body.mergedVideoUrl
  if (body.mergedVideoStatus !== undefined) updateData.merged_video_status = body.mergedVideoStatus
  if (body.mergedVideoKey !== undefined) updateData.merged_video_key = body.mergedVideoKey

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  // 使用 Supabase JavaScript 客户端
  const { error } = await client
    .from("episodes")
    .update(updateData)
    .eq("id", id)

  if (error) {
    console.error("更新剧集失败:", error)
    return NextResponse.json({ 
      error: error.message,
      hint: "如果遇到 schema 缓存问题，请在 Supabase Dashboard 的 SQL Editor 中执行: NOTIFY pgrst, 'reload'"
    }, { status: 500 })
  }

  // 获取更新后的剧集
  const { data: episodes } = await client
    .from("episodes")
    .select("*")
    .eq("id", id)

  return NextResponse.json({ episode: episodes?.[0] || null })
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

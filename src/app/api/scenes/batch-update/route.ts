import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// PUT /api/scenes/batch-update - 批量更新分镜
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { sceneIds, episodeId } = body

  if (!sceneIds || !Array.isArray(sceneIds) || sceneIds.length === 0) {
    return NextResponse.json({ error: "缺少分镜ID列表" }, { status: 400 })
  }

  try {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from("scenes")
      .update({ 
        episode_id: episodeId,
        updated_at: new Date().toISOString()
      })
      .in("id", sceneIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: sceneIds.length })
  } catch (err) {
    console.error("批量更新失败:", err)
    return NextResponse.json({ error: "批量更新失败" }, { status: 500 })
  }
}

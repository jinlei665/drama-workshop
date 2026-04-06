import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { generateId } from "@/lib/memory-storage"

// POST /api/episodes/reorder - 交换两个剧集的编号
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { episodeId1, episodeId2 } = body

  if (!episodeId1 || !episodeId2) {
    return NextResponse.json({ error: "缺少剧集ID" }, { status: 400 })
  }

  if (episodeId1 === episodeId2) {
    return NextResponse.json({ error: "不能与自己交换" }, { status: 400 })
  }

  try {
    const client = getSupabaseClient()

    // 获取两个剧集的信息
    const { data: episode1, error: error1 } = await client
      .from("episodes")
      .select("episode_number, season_number")
      .eq("id", episodeId1)
      .single()

    const { data: episode2, error: error2 } = await client
      .from("episodes")
      .select("episode_number, season_number")
      .eq("id", episodeId2)
      .single()

    if (error1 || error2 || !episode1 || !episode2) {
      return NextResponse.json({ error: "剧集不存在" }, { status: 404 })
    }

    // 交换编号
    const { error: updateError1 } = await client
      .from("episodes")
      .update({ 
        episode_number: episode2.episode_number,
        updated_at: new Date().toISOString()
      })
      .eq("id", episodeId1)

    const { error: updateError2 } = await client
      .from("episodes")
      .update({ 
        episode_number: episode1.episode_number,
        updated_at: new Date().toISOString()
      })
      .eq("id", episodeId2)

    if (updateError1 || updateError2) {
      return NextResponse.json({ error: "排序失败" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("排序失败:", err)
    return NextResponse.json({ error: "排序失败" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

export async function POST() {
  const client = getSupabaseClient()

  try {
    // 添加缺失的列
    await client.from("episodes").select("id").limit(1)
    
    // 尝试更新一条记录来触发 schema cache 刷新
    const { error } = await client
      .from("episodes")
      .update({ merged_video_status: 'pending' })
      .eq("id", "dummy_id_that_does_not_exist")
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows affected，这是预期的
      console.error("Schema refresh error:", error)
    }

    return NextResponse.json({ success: true, message: "Schema cache should be refreshed" })
  } catch (err) {
    console.error("Schema refresh failed:", err)
    return NextResponse.json({ error: "Failed to refresh schema" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { getAdminClient, isDatabaseConfigured } = await import("@/storage/database/supabase-client")
    
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 })
    }

    const supabase = getAdminClient()

    // 1. 检查 scenes 表是否有 script_id 字段
    // 由于 Supabase 不支持直接查询 information_schema，我们需要通过其他方式
    // 我们尝试插入一个测试场景，如果失败说明没有 script_id 字段
    
    const testSceneId = `test_scene_${Date.now()}`
    const testScriptId = `test_script_${Date.now()}`

    // 尝试插入带有 script_id 的场景
    const { error: insertError } = await supabase
      .from("scenes")
      .insert({
        id: testSceneId,
        project_id: "test_project",
        scene_number: 999,
        title: "Test Scene",
        description: "Test",
        status: "pending",
        script_id: testScriptId,
      })

    if (insertError && insertError.message.includes('script_id')) {
      // 没有 script_id 字段，需要添加
      console.log("[Refresh Schema] script_id column not found, need to add it")
      
      // 使用 RPC 执行 SQL
      // 注意：Supabase 需要在 SQL Editor 中手动执行 ALTER TABLE，或者通过 RPC
      // 这里我们返回需要手动执行的 SQL
      
      return NextResponse.json({ 
        success: false,
        needsManualSQL: true,
        sql: `
-- 添加 script_id 字段到 scenes 表
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS script_id TEXT REFERENCES scripts(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_scenes_script_id ON scenes(script_id);

-- 刷新 schema cache
NOTIFY pgrst, 'reload';
        `,
        message: "需要在 Supabase SQL Editor 中手动执行以下 SQL"
      })
    } else if (insertError) {
      console.error("[Refresh Schema] Insert error:", insertError)
      return NextResponse.json({ 
        error: insertError.message 
      }, { status: 500 })
    } else {
      // 插入成功，删除测试数据
      await supabase
        .from("scenes")
        .delete()
        .eq("id", testSceneId)
      
      console.log("[Refresh Schema] script_id column already exists")
      
      return NextResponse.json({ 
        success: true,
        scriptIdColumnExists: true,
        message: "script_id 字段已存在"
      })
    }
  } catch (err: any) {
    console.error("[Refresh Schema] Error:", err)
    return NextResponse.json({ 
      error: err.message 
    }, { status: 500 })
  }
}

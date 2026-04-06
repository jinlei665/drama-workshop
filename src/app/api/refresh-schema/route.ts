import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { getPool } = await import("@/storage/database/pg-client")
    const pool = await getPool()

    // 检查 scripts 表是否存在
    const scriptsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'scripts'
      );
    `)

    const scriptsTableExists = scriptsTableCheck.rows[0].exists
    console.log("[Refresh Schema] Scripts table exists:", scriptsTableExists)

    if (!scriptsTableExists) {
      // 创建 scripts 表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scripts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_scripts_project_id ON scripts(project_id);
        CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at);
      `)
      console.log("[Refresh Schema] Created scripts table")
    }

    // 检查 scenes 表是否有 script_id 字段
    const scriptIdColumnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'scenes'
        AND column_name = 'script_id'
      );
    `)

    const scriptIdColumnExists = scriptIdColumnCheck.rows[0].exists
    console.log("[Refresh Schema] script_id column exists in scenes:", scriptIdColumnExists)

    if (!scriptIdColumnExists) {
      // 添加 script_id 字段到 scenes 表
      await pool.query(`
        ALTER TABLE scenes ADD COLUMN IF NOT EXISTS script_id TEXT REFERENCES scripts(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_scenes_script_id ON scenes(script_id);
      `)
      console.log("[Refresh Schema] Added script_id column to scenes table")
    }

    // 刷新 PostgREST schema cache
    await pool.query("NOTIFY pgrst, 'reload'")
    console.log("[Refresh Schema] Schema cache refreshed")

    return NextResponse.json({ 
      success: true, 
      scriptsTableExists,
      scriptIdColumnExists,
      message: "Schema cache refreshed successfully" 
    })
  } catch (err: any) {
    console.error("[Refresh Schema] Error:", err)
    return NextResponse.json({ 
      error: err.message || "Failed to refresh schema cache" 
    }, { status: 500 })
  }
}

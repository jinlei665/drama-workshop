import { NextRequest, NextResponse } from "next/server"

// GET /api/scripts - 获取项目的脚本列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
  }

  try {
    // 优先使用 Supabase
    const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const supabase = getAdminClient()
        const { data, error } = await supabase
          .from("scripts")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true })
        
        if (!error && data) {
          return NextResponse.json({ scripts: data || [] })
        }
        
        if (error) {
          console.warn("[Scripts API] Supabase GET error:", error.message)
        }
      } catch (supabaseError: any) {
        console.warn("[Scripts API] Supabase GET failed, falling back to pg:", supabaseError.message)
      }
    }
    
    // Fallback to pg
    const { getPool } = await import("@/storage/database/pg-client")
    const pool = await getPool()
    const result = await pool.query(
      `SELECT * FROM scripts WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId]
    )

    return NextResponse.json({ scripts: result.rows || [] })
  } catch (err: any) {
    console.error("获取脚本异常:", err)
    return NextResponse.json({ error: err.message || "获取脚本失败" }, { status: 500 })
  }
}

// POST /api/scripts - 创建脚本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, title, content, description } = body

    console.log('[Scripts API] POST received:', { projectId, title, content: content?.substring(0, 50) })

    if (!projectId || !title || !content) {
      return NextResponse.json(
        { error: "缺少必要参数: projectId, title, content" },
        { status: 400 }
      )
    }

    const id = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 优先使用 Supabase
    const { getSupabaseClient, isDatabaseConfigured, getAdminClient } = await import('@/storage/database/supabase-client')
    
    if (isDatabaseConfigured()) {
      try {
        const supabase = getAdminClient()
        console.log('[Scripts API] Inserting script via Supabase:', { id, projectId, title })
        
        const { data, error } = await supabase
          .from("scripts")
          .insert({
            id,
            project_id: projectId,
            title,
            content,
            description: description || "",
            status: "active",
          })
          .select()
          .single()
        
        if (!error && data) {
          console.log('[Scripts API] Insert success via Supabase:', { scriptId: data.id })
          return NextResponse.json({ script: data })
        }
        
        if (error) {
          console.warn("[Scripts API] Supabase insert error:", error.message)
        }
      } catch (supabaseError: any) {
        console.warn("[Scripts API] Supabase insert failed, falling back to pg:", supabaseError.message)
      }
    }
    
    // Fallback to pg
    const { getPool } = await import("@/storage/database/pg-client")
    const pool = await getPool()

    console.log('[Scripts API] Inserting script via PG:', { id, projectId, title })

    const result = await pool.query(
      `INSERT INTO scripts (id, project_id, title, content, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, projectId, title, content, description || "", "active"]
    )

    console.log('[Scripts API] Insert success via PG:', { rowCount: result.rowCount, scriptId: result.rows[0]?.id })

    return NextResponse.json({ script: result.rows[0] })
  } catch (err: any) {
    console.error("创建脚本异常:", err)
    return NextResponse.json({ error: err.message || "创建脚本失败" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/storage/database/pg-client"

// GET /api/scripts - 获取项目的脚本列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
  }

  try {
    const pool = await getPool()
    const result = await pool.query(
      `SELECT * FROM scripts WHERE project_id = $1 ORDER BY created_at ASC`,
      [projectId]
    )

    return NextResponse.json({ scripts: result.rows || [] })
  } catch (err) {
    console.error("获取脚本异常:", err)
    return NextResponse.json({ error: "获取脚本失败" }, { status: 500 })
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

    const pool = await getPool()
    const id = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log('[Scripts API] Inserting script:', { id, projectId, title })

    const result = await pool.query(
      `INSERT INTO scripts (id, project_id, title, content, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, projectId, title, content, description || "", "active"]
    )

    console.log('[Scripts API] Insert result:', { rowCount: result.rowCount, rows: result.rows })

    return NextResponse.json({ script: result.rows[0] })
  } catch (err: any) {
    console.error("创建脚本异常:", err)
    return NextResponse.json({ error: err.message || "创建脚本失败" }, { status: 500 })
  }
}

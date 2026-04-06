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
      `SELECT id, project_id, title, content, description, status, created_at, updated_at
       FROM scripts 
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [projectId]
    )
    
    return NextResponse.json({ scripts: result.rows })
  } catch (err: any) {
    console.error("获取脚本失败:", err)
    // 优雅降级：连接失败时返回空数组
    return NextResponse.json({ 
      scripts: [], 
      error: "database_connection_failed",
      message: err.message 
    }, { status: 200 }) // 返回 200 而不是 500，避免前端报错
  }
}

// POST /api/scripts - 创建脚本
export async function POST(request: NextRequest) {
  let body: any = null
  
  try {
    body = await request.json()
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
      `INSERT INTO scripts (id, project_id, title, content, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, project_id, title, content, description, status, created_at, updated_at`,
      [id, projectId, title, content, description || "", "active"]
    )

    console.log('[Scripts API] Insert result:', result.rows[0])

    return NextResponse.json({ script: result.rows[0] })
  } catch (err: any) {
    console.error("创建脚本异常:", err)
    // 优雅降级：返回本地生成的 ID
    const fallbackId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return NextResponse.json({ 
      script: {
        id: fallbackId,
        project_id: body?.projectId,
        title: body?.title,
        content: body?.content,
        description: body?.description || "",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      warning: "database_connection_failed",
      message: err.message 
    }, { status: 200 })
  }
}

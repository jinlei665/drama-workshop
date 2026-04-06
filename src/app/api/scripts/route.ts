import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient, isDatabaseConfigured } from "@/storage/database/supabase-client"

// GET /api/scripts - 获取项目的脚本列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
  }

  try {
    if (isDatabaseConfigured()) {
      const db = getSupabaseClient()
      
      // 尝试直接查询，如果失败则返回空数组
      const { data, error } = await db
        .from('scripts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error("获取脚本失败:", error)
        // 返回空数组而不是错误，避免阻塞前端
        return NextResponse.json({ scripts: [], warning: "schema_cache_error" })
      }
      
      return NextResponse.json({ scripts: data || [] })
    }
    
    return NextResponse.json({ scripts: [] })
  } catch (err) {
    console.error("获取脚本异常:", err)
    return NextResponse.json({ scripts: [], warning: "connection_error" })
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

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 })
    }

    const db = getSupabaseClient()
    const id = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log('[Scripts API] Inserting script:', { id, projectId, title })

    const { data, error } = await db
      .from('scripts')
      .insert({
        id,
        project_id: projectId,
        title,
        content,
        description: description || "",
        status: "active"
      })
      .select()
      .single()

    if (error) {
      console.error("创建脚本失败:", error)
      return NextResponse.json({ error: error.message || "创建脚本失败" }, { status: 500 })
    }

    console.log('[Scripts API] Insert result:', data)

    return NextResponse.json({ script: data })
  } catch (err: any) {
    console.error("创建脚本异常:", err)
    return NextResponse.json({ error: err.message || "创建脚本失败" }, { status: 500 })
  }
}

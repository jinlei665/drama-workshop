import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// GET /api/scripts - 获取项目的脚本列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
  }

  try {
    const client = getSupabaseClient()
    const { data: scripts, error } = await client
      .from("scripts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("获取脚本失败:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ scripts: scripts || [] })
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

    if (!projectId || !title || !content) {
      return NextResponse.json(
        { error: "缺少必要参数: projectId, title, content" },
        { status: 400 }
      )
    }

    const client = getSupabaseClient()
    const id = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const { data: script, error } = await client
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

    if (error) {
      console.error("创建脚本失败:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ script })
  } catch (err) {
    console.error("创建脚本异常:", err)
    return NextResponse.json({ error: "创建脚本失败" }, { status: 500 })
  }
}

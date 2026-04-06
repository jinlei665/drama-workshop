import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// GET /api/scripts/[id] - 获取单个脚本
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const client = getSupabaseClient()
    const { data: script, error } = await client
      .from("scripts")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("获取脚本失败:", error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ script })
  } catch (err) {
    console.error("获取脚本异常:", err)
    return NextResponse.json({ error: "获取脚本失败" }, { status: 500 })
  }
}

// PUT /api/scripts/[id] - 更新脚本
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { title, content, description } = body

    const client = getSupabaseClient()
    const updateData: Record<string, any> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (description !== undefined) updateData.description = description
    updateData.updated_at = new Date().toISOString()

    const { data: script, error } = await client
      .from("scripts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("更新脚本失败:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ script })
  } catch (err) {
    console.error("更新脚本异常:", err)
    return NextResponse.json({ error: "更新脚本失败" }, { status: 500 })
  }
}

// DELETE /api/scripts/[id] - 删除脚本
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const client = getSupabaseClient()

    // 先将该脚本关联的分镜解除关联（script_id 设为 null）
    await client
      .from("scenes")
      .update({ script_id: null })
      .eq("script_id", id)

    // 删除脚本
    const { error } = await client
      .from("scripts")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("删除脚本失败:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("删除脚本异常:", err)
    return NextResponse.json({ error: "删除脚本失败" }, { status: 500 })
  }
}

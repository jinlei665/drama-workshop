import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { updateProjectSchema } from "@/storage/database/shared/schema"

// GET /api/projects/[id] - 获取项目详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  const { data: project, error } = await client
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  // 获取关联的人物
  const { data: characters } = await client
    .from("characters")
    .select("*")
    .eq("project_id", id)

  // 获取关联的分镜
  const { data: scenes } = await client
    .from("scenes")
    .select("*")
    .eq("project_id", id)
    .order("scene_number", { ascending: true })

  return NextResponse.json({
    project,
    characters: characters || [],
    scenes: scenes || [],
  })
}

// PUT /api/projects/[id] - 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 转换字段名为数据库格式（snake_case）
  const dbData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  
  if (parsed.data.name !== undefined) dbData.name = parsed.data.name
  if (parsed.data.description !== undefined) dbData.description = parsed.data.description
  if (parsed.data.sourceContent !== undefined) dbData.source_content = parsed.data.sourceContent
  if (parsed.data.sourceType !== undefined) dbData.source_type = parsed.data.sourceType
  if (parsed.data.status !== undefined) dbData.status = parsed.data.status

  const { data, error } = await client
    .from("projects")
    .update(dbData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project: data })
}

// DELETE /api/projects/[id] - 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  // 删除关联的人物
  await client.from("characters").delete().eq("project_id", id)

  // 删除关联的分镜
  await client.from("scenes").delete().eq("project_id", id)

  // 删除项目
  const { error } = await client.from("projects").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

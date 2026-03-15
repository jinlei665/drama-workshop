import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { insertProjectSchema } from "@/storage/database/shared/schema"

// GET /api/projects - 获取项目列表
export async function GET(request: NextRequest) {
  const client = getSupabaseClient()
  
  const { data, error } = await client
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ projects: data })
}

// POST /api/projects - 创建新项目
export async function POST(request: NextRequest) {
  const body = await request.json()
  const client = getSupabaseClient()

  // 验证输入
  const parsed = insertProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 转换字段名为数据库格式（snake_case）
  const dbData = {
    name: parsed.data.name,
    description: parsed.data.description,
    source_content: parsed.data.sourceContent,
    source_type: parsed.data.sourceType || "novel",
    status: "draft",
  }

  const { data, error } = await client
    .from("projects")
    .insert(dbData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project: data })
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { insertCharacterSchema } from "@/storage/database/shared/schema"
import { memoryCharacters, generateId } from "@/lib/memory-storage"

// GET /api/projects/[id]/characters - 获取项目人物列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  // 尝试从数据库获取
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("characters")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      console.warn('数据库查询人物失败，回退到内存存储:', error.message)
      // 回退到内存存储
      const characters = memoryCharacters.filter(c => c.projectId === id)
      return NextResponse.json({ characters })
    }

    return NextResponse.json({ characters: data })
  } catch (err) {
    console.warn('数据库连接失败，回退到内存存储:', err)
    // 回退到内存存储
    const characters = memoryCharacters.filter(c => c.projectId === id)
    return NextResponse.json({ characters })
  }
}

// POST /api/projects/[id]/characters - 创建人物
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = insertCharacterSchema.safeParse({
    ...body,
    projectId: id,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 转换字段名为数据库格式（snake_case），并添加 id
  const dbData = {
    id: generateId('char'),
    project_id: parsed.data.projectId,
    name: parsed.data.name,
    description: parsed.data.description,
    appearance: parsed.data.appearance,
    personality: parsed.data.personality,
    tags: parsed.data.tags || [],
    // 如果有图片URL，也保存
    front_view_key: body.frontViewKey || body.imageUrl || null,
  }

  const { data, error } = await client
    .from("characters")
    .insert(dbData)
    .select()
    .single()

  if (error) {
    console.error('[Characters API] Insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ character: data })
}

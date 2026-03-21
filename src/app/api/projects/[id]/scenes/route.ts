import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { insertSceneSchema } from "@/storage/database/shared/schema"
import { memoryScenes, generateId } from "@/lib/memory-storage"

// GET /api/projects/[id]/scenes - 获取项目分镜列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  // 尝试从数据库获取
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("scenes")
      .select("*")
      .eq("project_id", id)
      .order("scene_number", { ascending: true })

    if (error) {
      console.warn('数据库查询分镜失败，回退到内存存储:', error.message)
      // 回退到内存存储
      const scenes = memoryScenes
        .filter(s => s.projectId === id)
        .sort((a, b) => a.sceneNumber - b.sceneNumber)
      return NextResponse.json({ scenes })
    }

    return NextResponse.json({ scenes: data })
  } catch (err) {
    console.warn('数据库连接失败，回退到内存存储:', err)
    // 回退到内存存储
    const scenes = memoryScenes
      .filter(s => s.projectId === id)
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
    return NextResponse.json({ scenes })
  }
}

// POST /api/projects/[id]/scenes - 创建分镜
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = insertSceneSchema.safeParse({
    ...body,
    projectId: id,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    )
  }

  // 转换字段名为数据库格式（snake_case）
  const dbData = {
    project_id: parsed.data.projectId,
    scene_number: parsed.data.sceneNumber,
    title: parsed.data.title,
    description: parsed.data.description,
    dialogue: parsed.data.dialogue,
    action: parsed.data.action,
    emotion: parsed.data.emotion,
    character_ids: parsed.data.characterIds || [],
    metadata: parsed.data.metadata,
  }

  const { data, error } = await client
    .from("scenes")
    .insert(dbData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ scene: data })
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"
import { updateCharacterSchema } from "@/storage/database/shared/schema"

// GET /api/characters/[id] - 获取人物详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  const { data, error } = await client
    .from("characters")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ character: data })
}

// PUT /api/characters/[id] - 更新人物
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const client = getSupabaseClient()

  const parsed = updateCharacterSchema.safeParse(body)
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
  if (parsed.data.appearance !== undefined) dbData.appearance = parsed.data.appearance
  if (parsed.data.personality !== undefined) dbData.personality = parsed.data.personality
  if (parsed.data.frontViewKey !== undefined) dbData.front_view_key = parsed.data.frontViewKey
  if (parsed.data.sideViewKey !== undefined) dbData.side_view_key = parsed.data.sideViewKey
  if (parsed.data.backViewKey !== undefined) dbData.back_view_key = parsed.data.backViewKey
  if (parsed.data.referenceImageKey !== undefined) dbData.reference_image_key = parsed.data.referenceImageKey
  if (parsed.data.tags !== undefined) dbData.tags = parsed.data.tags

  const { data, error } = await client
    .from("characters")
    .update(dbData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ character: data })
}

// DELETE /api/characters/[id] - 删除人物
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const client = getSupabaseClient()

  const { error } = await client.from("characters").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

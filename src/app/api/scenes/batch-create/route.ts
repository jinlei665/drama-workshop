import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "@/storage/database/supabase-client"

// POST /api/scenes/batch-create - 批量创建角色和分镜
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, scriptId, characters, scenes } = body

    if (!projectId) {
      return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
    }

    const client = getSupabaseClient()
    const results: { characters: any[], scenes: any[] } = { characters: [], scenes: [] }

    // 批量创建角色
    if (characters && characters.length > 0) {
      const charactersToInsert = characters.map((c: any) => ({
        id: c.id,
        project_id: projectId,
        name: c.name,
        description: c.description || "",
        appearance: c.appearance || c.description || "",
        gender: c.gender || "other",
        age: c.age || "",
        tags: c.tags || [],
        status: c.status || "pending",
        created_at: new Date().toISOString(),
      }))

      const { data: createdCharacters, error: charactersError } = await client
        .from("characters")
        .insert(charactersToInsert)
        .select()

      if (charactersError) {
        console.error("批量创建角色失败:", charactersError)
      } else {
        results.characters = createdCharacters || []
      }
    }

    // 批量创建分镜
    if (scenes && scenes.length > 0) {
      const scenesToInsert = scenes.map((s: any, index: number) => ({
        id: s.id,
        project_id: projectId,
        script_id: scriptId || null,
        scene_number: s.sceneNumber || (index + 1),
        title: s.title || "",
        description: s.description || "",
        dialogue: s.dialogue || "",
        action: s.action || "",
        emotion: s.emotion || "",
        status: s.status || "pending",
        created_at: new Date().toISOString(),
      }))

      const { data: createdScenes, error: scenesError } = await client
        .from("scenes")
        .insert(scenesToInsert)
        .select()

      if (scenesError) {
        console.error("批量创建分镜失败:", scenesError)
        return NextResponse.json({ error: scenesError.message }, { status: 500 })
      } else {
        results.scenes = createdScenes || []
      }
    }

    return NextResponse.json({
      success: true,
      charactersCount: results.characters.length,
      scenesCount: results.scenes.length,
      results,
    })
  } catch (err: any) {
    console.error("批量创建异常:", err)
    return NextResponse.json({ error: err.message || "批量创建失败" }, { status: 500 })
  }
}

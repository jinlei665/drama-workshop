import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/storage/database/pg-client"

// POST /api/scenes/batch-create - 批量创建角色和分镜
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, scriptId, characters, scenes, episodeId } = body

    if (!projectId) {
      return NextResponse.json({ error: "缺少项目ID" }, { status: 400 })
    }

    const pool = await getPool()
    const results: { characters: any[], scenes: any[] } = { characters: [], scenes: [] }

    // 批量创建角色
    if (characters && characters.length > 0) {
      const values: any[] = []
      const placeholders: string[] = []
      
      characters.forEach((c: any, index: number) => {
        const offset = index * 8
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
        )
        values.push(
          c.id,
          projectId,
          c.name,
          c.description || "",
          c.appearance || c.description || "",
          c.gender || "other",
          c.age || "",
          JSON.stringify(c.tags || [])
        )
      })

      const result = await pool.query(
        `INSERT INTO characters (id, project_id, name, description, appearance, gender, age, tags)
         VALUES ${placeholders.join(", ")}
         RETURNING *`,
        values
      )

      results.characters = result.rows || []
    }

    // 批量创建分镜
    if (scenes && scenes.length > 0) {
      const values: any[] = []
      const placeholders: string[] = []
      
      scenes.forEach((s: any, index: number) => {
        const offset = index * 11
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`
        )
        values.push(
          s.id,
          projectId,
          scriptId || null,
          episodeId || null,
          s.sceneNumber || (index + 1),
          s.title || "",
          s.description || "",
          s.dialogue || "",
          s.action || "",
          s.emotion || "",
          s.status || "pending"
        )
      })

      const result = await pool.query(
        `INSERT INTO scenes (id, project_id, script_id, episode_id, scene_number, title, description, dialogue, action, emotion, status)
         VALUES ${placeholders.join(", ")}
         RETURNING *`,
        values
      )

      results.scenes = result.rows || []
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

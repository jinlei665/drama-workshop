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
      for (const c of characters) {
        try {
          const result = await pool.query(
            `INSERT INTO characters (id, project_id, name, appearance, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [c.id, projectId, c.name, c.appearance || c.description || "", "pending"]
          )
          results.characters.push(result.rows[0])
        } catch (charErr) {
          console.error("创建角色失败:", c.name, charErr)
        }
      }
    }

    // 批量创建分镜
    if (scenes && scenes.length > 0) {
      for (const s of scenes) {
        try {
          const result = await pool.query(
            `INSERT INTO scenes (id, project_id, script_id, episode_id, scene_number, title, description, dialogue, action, emotion, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              s.id,
              projectId,
              scriptId || null,
              episodeId || null,
              s.sceneNumber || s.scene_number || 1,
              s.title || "",
              s.description || "",
              s.dialogue || "",
              s.action || "",
              s.emotion || "",
              s.status || "pending"
            ]
          )
          results.scenes.push(result.rows[0])
        } catch (sceneErr) {
          console.error("创建分镜失败:", s.title, sceneErr)
        }
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

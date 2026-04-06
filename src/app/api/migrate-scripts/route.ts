import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { getAdminClient, isDatabaseConfigured } = await import("@/storage/database/supabase-client")

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 })
    }

    const supabase = getAdminClient()

    // 1. 尝试使用 pg 直连查询所有未关联脚本的分镜
    let projectIds: string[] = []
    let usePg = false

    try {
      const { getPool } = await import("@/storage/database/pg-client")
      const pool = await getPool()
      const result = await pool.query(
        `SELECT project_id FROM scenes WHERE script_id IS NULL GROUP BY project_id`
      )
      projectIds = result.rows.map(r => r.project_id)
      usePg = true
      console.log(`[Migrate Scripts] Found ${projectIds.length} projects with unassigned scenes (via pg):`, projectIds)
    } catch (pgError) {
      console.warn("[Migrate Scripts] PG connection failed, falling back to Supabase:", pgError)

      // Fallback to Supabase
      const { data: unassignedScenes, error: queryError } = await supabase
        .from("scenes")
        .select("project_id")
        .is("script_id", null)

      if (queryError) {
        throw queryError
      }

      if (!unassignedScenes || unassignedScenes.length === 0) {
        return NextResponse.json({ success: true, totalUpdated: 0, message: "没有未关联脚本的分镜" })
      }

      // 去重获取所有有未关联分镜的项目 ID
      projectIds = Array.from(new Set(unassignedScenes.map((s: any) => s.project_id)))
      console.log(`[Migrate Scripts] Found ${projectIds.length} projects with unassigned scenes (via Supabase):`, projectIds)
    }

    if (projectIds.length === 0) {
      return NextResponse.json({ success: true, totalUpdated: 0, message: "没有未关联脚本的分镜" })
    }

    let totalUpdated = 0
    const results: any[] = []

    // 2. 遍历每个项目，为其创建或查找"默认脚本"
    for (const projectId of projectIds) {
      const defaultScriptId = `script_default_${projectId}`

      // 检查该项目的"默认脚本"是否已存在
      const { data: existingDefaultScript } = await supabase
        .from("scripts")
        .select("id")
        .eq("id", defaultScriptId)
        .single()

      if (!existingDefaultScript) {
        // 检查项目是否存在（为了提供项目名称）
        const { data: project } = await supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .maybeSingle()

        // 创建"默认脚本"
        const { error: insertError } = await supabase
          .from("scripts")
          .insert({
            id: defaultScriptId,
            project_id: projectId,
            title: "默认脚本",
            content: "自动生成的默认脚本，用于存放未关联脚本的分镜",
            description: project?.name ? `项目「${project.name}」的默认脚本` : "项目创建时自动生成",
            status: "active",
          })

        if (insertError) {
          console.error(`[Migrate Scripts] Failed to create default script for project ${projectId}:`, insertError)
          results.push({ projectId, error: insertError.message })
          continue
        }

        console.log(`[Migrate Scripts] Created default script ${defaultScriptId} for project ${projectId}`)
      } else {
        console.log(`[Migrate Scripts] Found existing default script ${defaultScriptId} for project ${projectId}`)
      }

      // 更新该项目下所有未关联脚本的分镜
      let updateCount = 0

      if (usePg) {
        // 使用 pg 直连更新
        try {
          const { getPool } = await import("@/storage/database/pg-client")
          const pool = await getPool()
          const updateResult = await pool.query(
            `UPDATE scenes SET script_id = $1 WHERE project_id = $2 AND script_id IS NULL RETURNING id`,
            [defaultScriptId, projectId]
          )
          updateCount = updateResult.rowCount || 0
          console.log(`[Migrate Scripts] Updated ${updateCount} scenes for project ${projectId} (via pg)`)
        } catch (pgError) {
          console.warn(`[Migrate Scripts] PG update failed for project ${projectId}, falling back to Supabase:`, pgError)

          // Fallback to Supabase
          const { data: scenesToUpdate, error: countError } = await supabase
            .from("scenes")
            .select("id")
            .eq("project_id", projectId)
            .is("script_id", null)

          if (countError) {
            console.error(`[Migrate Scripts] Failed to query scenes for project ${projectId}:`, countError)
            results.push({ projectId, error: countError.message })
            continue
          }

          if (scenesToUpdate && scenesToUpdate.length > 0) {
            const { error: updateError } = await supabase
              .from("scenes")
              .update({ script_id: defaultScriptId })
              .eq("project_id", projectId)
              .is("script_id", null)

            if (updateError) {
              console.error(`[Migrate Scripts] Failed to update scenes for project ${projectId}:`, updateError)
              results.push({ projectId, error: updateError.message })
              continue
            }

            updateCount = scenesToUpdate.length
            console.log(`[Migrate Scripts] Updated ${updateCount} scenes for project ${projectId} (via Supabase)`)
          }
        }
      } else {
        // 使用 Supabase 更新
        const { data: scenesToUpdate, error: countError } = await supabase
          .from("scenes")
          .select("id")
          .eq("project_id", projectId)
          .is("script_id", null)

        if (countError) {
          console.error(`[Migrate Scripts] Failed to query scenes for project ${projectId}:`, countError)
          results.push({ projectId, error: countError.message })
          continue
        }

        if (scenesToUpdate && scenesToUpdate.length > 0) {
          const { error: updateError } = await supabase
            .from("scenes")
            .update({ script_id: defaultScriptId })
            .eq("project_id", projectId)
            .is("script_id", null)

          if (updateError) {
            console.error(`[Migrate Scripts] Failed to update scenes for project ${projectId}:`, updateError)
            results.push({ projectId, error: updateError.message })
            continue
          }

          updateCount = scenesToUpdate.length
          console.log(`[Migrate Scripts] Updated ${updateCount} scenes for project ${projectId} (via Supabase)`)
        }
      }

      totalUpdated += updateCount
      results.push({ projectId, defaultScriptId, updatedCount: updateCount })
    }

    return NextResponse.json({
      success: true,
      totalProjects: projectIds.length,
      totalUpdated,
      results,
      message: `成功将 ${totalUpdated} 个未关联脚本的分镜归类到'默认脚本'`
    })
  } catch (err: any) {
    console.error("[Migrate Scripts] Error:", err)
    return NextResponse.json({
      error: err.message
    }, { status: 500 })
  }
}

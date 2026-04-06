import { NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "缺少 projectId 参数" }, { status: 400 })
    }

    // 使用 Supabase admin 客户端查询
    const { getAdminClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
    
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 })
    }

    const supabase = getAdminClient()

    // 查询所有脚本
    const { data: scripts, error: scriptsError } = await supabase
      .from("scripts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (scriptsError) {
      console.error("[Debug] Scripts query error:", scriptsError)
    }

    // 查询所有分镜
    const { data: scenes, error: scenesError } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (scenesError) {
      console.error("[Debug] Scenes query error:", scenesError)
    }

    // 查询所有角色
    const { data: characters, error: charactersError } = await supabase
      .from("characters")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (charactersError) {
      console.error("[Debug] Characters query error:", charactersError)
    }

    // 统计每个脚本下的分镜数量
    const scriptsWithSceneCount = scripts?.map(script => ({
      ...script,
      sceneCount: scenes?.filter(scene => scene.script_id === script.id).length || 0
    })) || []

    return NextResponse.json({
      projectId,
      scripts: scriptsWithSceneCount,
      scenesCount: scenes?.length || 0,
      charactersCount: characters?.length || 0,
      scenes: scenes?.slice(0, 10), // 只返回前10个分镜
      characters: characters?.slice(0, 10), // 只返回前10个角色
      latestScriptId: scripts?.[0]?.id,
    })
  } catch (err: any) {
    console.error("[Debug] Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

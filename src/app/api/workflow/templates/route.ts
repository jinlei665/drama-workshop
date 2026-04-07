import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflow/templates
 * 创建工作流模板
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      projectId,
      nodes,
      edges,
      category,
      tags,
    } = body

    if (!name || !nodes || !edges) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const db = getSupabaseClient()

    const templateId = `template-${Date.now()}`

    await db.execute(
      `
      INSERT INTO workflow_templates
      (id, name, description, project_id, nodes, edges, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        templateId,
        name,
        description || null,
        projectId || null,
        JSON.stringify(nodes),
        JSON.stringify(edges),
        category || null,
        tags ? JSON.stringify(tags) : null,
      ]
    )

    return NextResponse.json({
      success: true,
      data: { templateId },
    })
  } catch (error) {
    console.error('❌ 创建模板失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workflow/templates
 * 查询工作流模板
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')
    const category = url.searchParams.get('category')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    const db = getSupabaseClient()

    let query = 'SELECT * FROM workflow_templates WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (projectId) {
      query += ` AND project_id = $${paramIndex}`
      params.push(projectId)
      paramIndex++
    }

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    query += ` ORDER BY updated_at DESC LIMIT $${paramIndex}`
    params.push(limit)

    const result = await db.query(query, params)

    // 解析 JSON 字段
    const templates = result.rows.map((row: any) => ({
      ...row,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    }))

    return NextResponse.json({
      success: true,
      data: { templates },
    })
  } catch (error) {
    console.error('❌ 查询模板失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflow/templates/from-history
 * 从执行历史创建模板
 */
export async function POST_FROM_HISTORY(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      executionId,
      name,
      description,
      category,
      tags,
    } = body

    if (!executionId || !name) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const db = getSupabaseClient()

    // 查询执行历史
    const result = await db.query(
      'SELECT * FROM workflow_executions WHERE id = $1',
      [executionId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '执行记录不存在' },
        { status: 404 }
      )
    }

    const history = result.rows[0]

    // 创建模板
    const templateId = `template-${Date.now()}`

    await db.execute(
      `
      INSERT INTO workflow_templates
      (id, name, description, project_id, nodes, edges, category, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        templateId,
        name,
        description || `从执行历史 ${executionId} 创建`,
        history.project_id,
        history.nodes,
        history.edges,
        category || null,
        tags ? JSON.stringify(tags) : null,
      ]
    )

    return NextResponse.json({
      success: true,
      data: { templateId },
    })
  } catch (error) {
    console.error('❌ 从历史创建模板失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

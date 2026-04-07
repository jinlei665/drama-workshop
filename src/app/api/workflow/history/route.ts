import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflow/history
 * 保存工作流执行历史
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      executionId,
      workflowId,
      projectId,
      nodes,
      edges,
      status,
      startTime,
      endTime,
      results,
      error,
    } = body

    if (!executionId || !workflowId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const db = getSupabaseClient()

    // 检查表是否存在，不存在则创建
    await db.execute(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id VARCHAR(255) PRIMARY KEY,
        workflow_id VARCHAR(255) NOT NULL,
        project_id VARCHAR(255) NOT NULL,
        nodes JSONB NOT NULL,
        edges JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        results JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 保存执行历史
    await db.execute(
      `
      INSERT INTO workflow_executions
      (id, workflow_id, project_id, nodes, edges, status, start_time, end_time, results, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        end_time = EXCLUDED.end_time,
        results = EXCLUDED.results,
        error = EXCLUDED.error,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        executionId,
        workflowId,
        projectId,
        JSON.stringify(nodes),
        JSON.stringify(edges),
        status,
        new Date(startTime),
        endTime ? new Date(endTime) : null,
        results ? JSON.stringify(results) : null,
        error || null,
      ]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ 保存执行历史失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workflow/history
 * 查询工作流执行历史
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const workflowId = url.searchParams.get('workflowId')
    const projectId = url.searchParams.get('projectId')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const db = getSupabaseClient()

    let query = 'SELECT * FROM workflow_executions WHERE 1=1'
    const params: any[] = []
    let paramIndex = 1

    if (workflowId) {
      query += ` AND workflow_id = $${paramIndex}`
      params.push(workflowId)
      paramIndex++
    }

    if (projectId) {
      query += ` AND project_id = $${paramIndex}`
      params.push(projectId)
      paramIndex++
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // 解析 JSON 字段
    const executions = result.rows.map((row: any) => ({
      ...row,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
      results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results,
    }))

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM workflow_executions WHERE 1=1'
    const countParams: any[] = []
    let countParamIndex = 1

    if (workflowId) {
      countQuery += ` AND workflow_id = $${countParamIndex}`
      countParams.push(workflowId)
      countParamIndex++
    }

    if (projectId) {
      countQuery += ` AND project_id = $${countParamIndex}`
      countParams.push(projectId)
      countParamIndex++
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      success: true,
      data: {
        executions,
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('❌ 查询执行历史失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

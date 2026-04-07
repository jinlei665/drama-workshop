/**
 * 工作流模板 API 路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkflowBuilder } from '@/lib/workflow/agent/WorkflowBuilder'

const workflowBuilder = new WorkflowBuilder()

/**
 * GET - 获取工作流模板
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const templates = category
      ? workflowBuilder.getTemplatesByCategory(category)
      : workflowBuilder.getTemplates()

    return NextResponse.json({
      success: true,
      data: { templates }
    })
  } catch (error) {
    console.error('获取模板失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * POST - 应用模板到项目
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, projectId } = body

    if (!templateId || !projectId) {
      return NextResponse.json(
        { error: '缺少 templateId 或 projectId 参数' },
        { status: 400 }
      )
    }

    const templates = workflowBuilder.getTemplates()
    const template = templates.find(t => t.id === templateId)

    if (!template) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      )
    }

    // 生成工作流
    const workflow = {
      id: `workflow_${Date.now()}`,
      name: template.name,
      description: template.description,
      projectId,
      status: 'draft',
      version: 1,
      nodes: template.nodes.map((node: any) => ({
        ...node,
        id: `${node.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })),
      edges: template.edges.map((edge: any) => ({
        ...edge,
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: { workflow }
    })
  } catch (error) {
    console.error('应用模板失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

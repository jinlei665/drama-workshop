/**
 * Agent API 路由
 * 提供智能共创功能
 */

import { NextRequest, NextResponse } from 'next/server'
import { WorkflowAgent } from '@/lib/workflow/agent/WorkflowAgent'

const agent = new WorkflowAgent()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userInput, projectId, context } = body

    if (!userInput || !projectId) {
      return NextResponse.json(
        { error: '缺少必要参数: userInput 或 projectId' },
        { status: 400 }
      )
    }

    // 处理用户请求
    const response = await agent.processRequest({
      userInput,
      projectId,
      context
    })

    return NextResponse.json({
      success: true,
      data: response
    })
  } catch (error) {
    console.error('Agent 处理失败:', error)
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
 * 优化工作流
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { workflow } = body

    if (!workflow) {
      return NextResponse.json(
        { error: '缺少 workflow 参数' },
        { status: 400 }
      )
    }

    // 优化工作流
    const suggestions = await agent.optimizeWorkflow(workflow)

    return NextResponse.json({
      success: true,
      data: { suggestions }
    })
  } catch (error) {
    console.error('工作流优化失败:', error)
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
 * 智能补全工作流
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { workflow, context } = body

    if (!workflow) {
      return NextResponse.json(
        { error: '缺少 workflow 参数' },
        { status: 400 }
      )
    }

    // 智能补全
    const completedWorkflow = await agent.autocompleteWorkflow(workflow, context)

    return NextResponse.json({
      success: true,
      data: { workflow: completedWorkflow }
    })
  } catch (error) {
    console.error('智能补全失败:', error)
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
 * 获取工作流模板
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const templates = category
      ? agent.getTemplatesByCategory(category)
      : agent.getTemplates()

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

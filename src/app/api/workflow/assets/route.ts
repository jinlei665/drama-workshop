/**
 * 资产管理 API 路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { AssetManager, AssetFilter } from '@/lib/workflow/assets/AssetManager'

const assetManager = new AssetManager()

/**
 * GET - 列出资产
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filter: AssetFilter = {
      projectId: searchParams.get('projectId') || undefined,
      workflowId: searchParams.get('workflowId') || undefined,
      type: searchParams.get('type') as any || undefined,
      status: searchParams.get('status') as any || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      searchQuery: searchParams.get('searchQuery') || undefined
    }

    const assets = assetManager.listAssets(filter)

    // 如果请求标签，返回所有标签
    if (searchParams.get('action') === 'tags') {
      const projectId = searchParams.get('projectId')
      if (!projectId) {
        return NextResponse.json(
          { error: '缺少 projectId 参数' },
          { status: 400 }
        )
      }
      const tags = assetManager.getAllTags(projectId)
      return NextResponse.json({
        success: true,
        data: { tags }
      })
    }

    return NextResponse.json({
      success: true,
      data: { assets, total: assets.length }
    })
  } catch (error) {
    console.error('获取资产列表失败:', error)
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
 * POST - 上传资产
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const workflowId = formData.get('workflowId') as string | undefined
    const nodeId = formData.get('nodeId') as string | undefined
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const tags = formData.get('tags') as string | undefined

    if (!file || !projectId || !name || !type) {
      return NextResponse.json(
        { error: '缺少必要参数: file, projectId, name 或 type' },
        { status: 400 }
      )
    }

    const asset = await assetManager.uploadAsset({
      projectId,
      workflowId,
      nodeId,
      name,
      type: type as any,
      file,
      tags: tags ? tags.split(',') : []
    })

    return NextResponse.json({
      success: true,
      data: { asset }
    })
  } catch (error) {
    console.error('上传资产失败:', error)
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
 * PUT - 更新资产
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { assetId, name, tags, metadata } = body

    if (!assetId) {
      return NextResponse.json(
        { error: '缺少 assetId 参数' },
        { status: 400 }
      )
    }

    const asset = await assetManager.updateAsset(assetId, {
      name,
      tags,
      metadata
    })

    if (!asset) {
      return NextResponse.json(
        { error: '资产不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { asset }
    })
  } catch (error) {
    console.error('更新资产失败:', error)
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
 * DELETE - 删除资产
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')

    if (!assetId) {
      return NextResponse.json(
        { error: '缺少 assetId 参数' },
        { status: 400 }
      )
    }

    const success = await assetManager.deleteAsset(assetId)

    if (!success) {
      return NextResponse.json(
        { error: '资产不存在或删除失败' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { message: '资产已删除' }
    })
  } catch (error) {
    console.error('删除资产失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

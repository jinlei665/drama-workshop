/**
 * 资产批量操作 API 路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { AssetManager } from '@/lib/workflow/assets/AssetManager'

const assetManager = new AssetManager()

/**
 * POST - 批量删除资产
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, assetIds } = body

    if (action !== 'delete') {
      return NextResponse.json(
        { error: '不支持的操作' },
        { status: 400 }
      )
    }

    if (!assetIds || !Array.isArray(assetIds)) {
      return NextResponse.json(
        { error: '缺少 assetIds 参数或格式错误' },
        { status: 400 }
      )
    }

    const result = await assetManager.batchDelete(assetIds)

    return NextResponse.json({
      success: true,
      data: {
        message: `成功删除 ${result.success.length} 个资产，失败 ${result.failed.length} 个`,
        success: result.success,
        failed: result.failed
      }
    })
  } catch (error) {
    console.error('批量操作失败:', error)
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
 * PUT - 批量更新标签
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, assetIds, tags } = body

    if (action !== 'addTags' && action !== 'removeTags') {
      return NextResponse.json(
        { error: '不支持的操作' },
        { status: 400 }
      )
    }

    if (!assetIds || !Array.isArray(assetIds)) {
      return NextResponse.json(
        { error: '缺少 assetIds 参数或格式错误' },
        { status: 400 }
      )
    }

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: '缺少 tags 参数或格式错误' },
        { status: 400 }
      )
    }

    const updatedAssets: any[] = []

    for (const assetId of assetIds) {
      const asset =
        action === 'addTags'
          ? assetManager.addTags(assetId, tags)
          : assetManager.removeTags(assetId, tags)
      if (asset) {
        updatedAssets.push(asset)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `成功更新 ${updatedAssets.length} 个资产的标签`,
        assets: updatedAssets
      }
    })
  } catch (error) {
    console.error('批量更新标签失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

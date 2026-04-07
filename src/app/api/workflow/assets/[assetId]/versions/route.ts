/**
 * 资产版本管理 API 路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { AssetManager } from '@/lib/workflow/assets/AssetManager'

const assetManager = new AssetManager()

/**
 * GET - 获取版本历史
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params

    const versions = assetManager.getVersionHistory(assetId)

    return NextResponse.json({
      success: true,
      data: { versions }
    })
  } catch (error) {
    console.error('获取版本历史失败:', error)
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
 * POST - 创建新版本
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '缺少 file 参数' },
        { status: 400 }
      )
    }

    const newVersion = await assetManager.createVersion(assetId, file)

    return NextResponse.json({
      success: true,
      data: { asset: newVersion }
    })
  } catch (error) {
    console.error('创建新版本失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

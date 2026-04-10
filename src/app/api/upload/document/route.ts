/**
 * 文档上传和解析 API
 * 支持 txt, pdf, docx 等格式的文档上传和内容提取
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from 'fs'
import * as path from 'path'
import { HeaderUtils, FetchClient, Config } from "coze-coding-dev-sdk"

// 支持的文件类型
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.text']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/upload/document
 * 上传并解析文档
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: '请上传文件' },
        { status: 400 }
      )
    }

    // 检查文件扩展名
    const ext = path.extname(file.name).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式。仅支持: ${SUPPORTED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件过大，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer())
    let content = ''

    if (ext === '.txt' || ext === '.md' || ext === '.text') {
      // 纯文本文件直接读取
      content = buffer.toString('utf-8')
    } else {
      return NextResponse.json(
        { error: `暂不支持 ${ext} 格式，请转换为 txt 或 md 格式` },
        { status: 400 }
      )
    }

    // 检查内容是否为空
    if (!content.trim()) {
      return NextResponse.json(
        { error: '文档内容为空' },
        { status: 400 }
      )
    }

    // 截取前 50000 字符（防止内容过长）
    const maxLength = 50000
    const truncated = content.length > maxLength
    const truncatedContent = content.slice(0, maxLength)

    console.log(`[Document Upload] File: ${file.name}, Size: ${file.size}, Content length: ${content.length}`)

    return NextResponse.json({
      success: true,
      fileName: file.name,
      content: truncatedContent,
      originalLength: content.length,
      truncated,
      message: truncated ? `内容已截取至 ${maxLength} 字符（原文件 ${content.length} 字符）` : null
    })
  } catch (error) {
    console.error('[Document Upload] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '文档上传失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/upload/document
 * 返回支持的格式说明
 */
export async function GET() {
  return NextResponse.json({
    supportedFormats: SUPPORTED_EXTENSIONS,
    maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
    description: '支持上传 txt、md 格式的纯文本文件'
  })
}

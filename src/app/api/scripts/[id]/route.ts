import { NextRequest, NextResponse } from "next/server"
import { getPool } from "@/storage/database/pg-client"

// GET /api/scripts/[id] - 获取单个脚本
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const pool = await getPool()
    const result = await pool.query(
      `SELECT * FROM scripts WHERE id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "脚本不存在" }, { status: 404 })
    }

    return NextResponse.json({ script: result.rows[0] })
  } catch (err) {
    console.error("获取脚本异常:", err)
    return NextResponse.json({ error: "获取脚本失败" }, { status: 500 })
  }
}

// PUT /api/scripts/[id] - 更新脚本
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { title, content, description } = body

    const pool = await getPool()
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(title)
    }
    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`)
      values.push(content)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(description)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 })
    }

    updates.push(`updated_at = $${paramIndex++}`)
    values.push(new Date().toISOString())
    values.push(id)

    const result = await pool.query(
      `UPDATE scripts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "脚本不存在或更新失败" }, { status: 404 })
    }

    return NextResponse.json({ script: result.rows[0] })
  } catch (err: any) {
    console.error("更新脚本异常:", err)
    return NextResponse.json({ error: err.message || "更新脚本失败" }, { status: 500 })
  }
}

// DELETE /api/scripts/[id] - 删除脚本
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const pool = await getPool()

    // 先将该脚本关联的分镜解除关联（script_id 设为 null）
    await pool.query(
      `UPDATE scenes SET script_id = NULL WHERE script_id = $1`,
      [id]
    )

    // 删除脚本
    const result = await pool.query(
      `DELETE FROM scripts WHERE id = $1 RETURNING *`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "脚本不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true, script: result.rows[0] })
  } catch (err: any) {
    console.error("删除脚本异常:", err)
    return NextResponse.json({ error: err.message || "删除脚本失败" }, { status: 500 })
  }
}

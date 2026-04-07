import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 导入节点注册器（确保在服务器端注册所有节点）
import '@/lib/workflow/register-nodes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 初始化工作流执行相关表结构
 */
export async function POST(request: NextRequest) {
  try {
    const db = getSupabaseClient()

    // 创建执行日志表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id SERIAL PRIMARY KEY,
        execution_id VARCHAR(255) NOT NULL,
        level VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        node_id VARCHAR(255),
        FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
      )
    `)

    // 创建索引优化查询
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id ON workflow_execution_logs(execution_id)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON workflow_execution_logs(timestamp DESC)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_execution_logs_level ON workflow_execution_logs(level)
    `)

    // 创建工作流模板表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        project_id VARCHAR(255),
        nodes JSONB NOT NULL,
        edges JSONB NOT NULL,
        category VARCHAR(100),
        tags JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_system BOOLEAN DEFAULT FALSE
      )
    `)

    // 创建索引
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_templates_project_id ON workflow_templates(project_id)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_templates_category ON workflow_templates(category)
    `)

    return NextResponse.json({
      success: true,
      message: '表结构初始化成功',
    })
  } catch (error) {
    console.error('❌ 初始化表结构失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

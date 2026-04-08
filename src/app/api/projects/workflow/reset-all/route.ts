/**
 * 批量重置项目工作流 API
 * 将所有项目的工作流重置为新的系统工作流格式
 * 
 * 注意：这个 API 会清除所有项目存储的 workflow 数据，
 * 下次访问工作流页面时会自动生成新的系统工作流
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { memoryProjects } from '@/lib/memory-storage'

// 内存工作流存储
const memoryWorkflows: Record<string, unknown> = {}

/**
 * POST /api/projects/workflow/reset-all
 * 批量清除所有项目的工作流数据（强制重新生成）
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ 开始清除所有项目的工作流数据...')
    
    let affected = 0
    
    // 清除数据库中的工作流数据
    try {
      const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
      
      if (isDatabaseConfigured()) {
        const db = getSupabaseClient()
        
        // 获取所有项目
        const { data: projects, error } = await db
          .from('projects')
          .select('id, metadata')
          .limit(100)
        
        if (!error && projects) {
          console.log(`📊 找到 ${projects.length} 个项目需要处理`)
          
          for (const project of projects) {
            const metadata = (project.metadata as Record<string, unknown>) || {}
            if (metadata.workflow) {
              delete metadata.workflow
              delete metadata.workflowUpdatedAt
              
              await db
                .from('projects')
                .update({ metadata })
                .eq('id', project.id)
              
              console.log(`✅ 清除项目 ${project.id} 的工作流数据`)
              affected++
            }
          }
        }
      } else {
        console.log('📊 数据库未配置，使用内存存储')
      }
    } catch (dbError) {
      console.warn('⚠️ 数据库操作失败:', dbError)
    }
    
    // 清除内存中的工作流数据
    memoryProjects.forEach(p => {
      if (p.metadata?.workflow) {
        delete (p.metadata as Record<string, unknown>).workflow
        delete (p.metadata as Record<string, unknown>).workflowUpdatedAt
        affected++
        console.log(`✅ 清除内存项目 ${p.id} 的工作流数据`)
      }
    })
    
    // 清空工作流存储
    Object.keys(memoryWorkflows).forEach(key => {
      delete memoryWorkflows[key]
    })
    
    console.log(`✅ 清除完成: 影响了 ${affected} 个项目`)
    
    return successResponse({
      message: `成功清除 ${affected} 个项目的工作流数据，下次访问时会自动生成新的系统工作流`,
      affected
    })
    
  } catch (error) {
    console.error('❌ 清除工作流数据失败:', error)
    return errorResponse(error)
  }
}

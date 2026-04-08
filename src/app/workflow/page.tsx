/**
 * 工作流页面 - 使用 React Flow 版本
 */

'use client'

import WorkflowEditorRF from '@/components/workflow/WorkflowEditorRF'
import { AppShell } from '@/components/layout'
import { useEffect } from 'react'

export default function WorkflowPage() {
  // 在客户端加载时，通过 API 调用来确保节点已注册
  useEffect(() => {
    // 这里可以添加初始化逻辑
    console.log('Workflow page loaded')
  }, [])

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)]">
        <WorkflowEditorRF />
      </div>
    </AppShell>
  )
}

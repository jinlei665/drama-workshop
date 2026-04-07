/**
 * 工作流页面 - 使用新的 WorkflowEditorV2
 */

'use client'

import WorkflowEditorV2 from '@/components/workflow/workflow-editor-v2'
import { AppShell } from '@/components/layout'

export default function WorkflowPage() {
  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)]">
        <WorkflowEditorV2 />
      </div>
    </AppShell>
  )
}

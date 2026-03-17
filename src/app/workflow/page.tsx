/**
 * 工作流页面
 */

'use client'

import { useParams } from 'next/navigation'
import { WorkflowEditor } from '@/components/workflow'
import { AppShell } from '@/components/layout'

export default function WorkflowPage() {
  const params = useParams()
  const projectId = params.projectId as string || 'default'

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)]">
        <WorkflowEditor projectId={projectId} />
      </div>
    </AppShell>
  )
}

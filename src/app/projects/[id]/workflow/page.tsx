/**
 * 项目工作流页面
 * 显示项目的默认工作流编辑器
 */

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Workflow } from 'lucide-react'
import { WorkflowEditorV2 } from '@/components/workflow/workflow-editor-v2'

export default function ProjectWorkflowPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const paramsData = useParams()
  const id = paramsData.id as string

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Workflow className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">工作流编辑器</h1>
                <p className="text-xs text-muted-foreground">可视化节点式工作流设计</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 工作流编辑器 */}
      <div className="h-[calc(100vh-73px)]">
        <WorkflowEditorV2 projectId={id} />
      </div>
    </div>
  )
}

"use client"

import { WorkflowEditorV2 } from "@/components/workflow/workflow-editor-v2"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function WorkflowTestPage() {
  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b border-border bg-card/50 flex items-center px-4 gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold">工作流编辑器测试页面</h1>
          <p className="text-xs text-muted-foreground">
            测试节点拖拽、参数配置、工作流执行等功能
          </p>
        </div>
      </header>
      <div className="flex-1">
        <WorkflowEditorV2 projectId="test-project" />
      </div>
    </div>
  )
}

/**
 * 项目工作流页面
 * 显示项目的系统工作流（只读）或自定义工作流
 */

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Workflow, Plus, Sparkles, RefreshCw } from 'lucide-react'
import { WorkflowEditorV2 } from '@/components/workflow/workflow-editor-v2'
import type { BaseNode, Edge } from '@/lib/workflow/types'
import { toast } from 'sonner'

type WorkflowMode = 'system' | 'custom' | 'empty'

export default function ProjectWorkflowPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const paramsData = useParams()
  const id = paramsData.id as string
  const [mode, setMode] = useState<WorkflowMode>('empty')
  const [systemWorkflow, setSystemWorkflow] = useState<{ nodes: BaseNode[], edges: Edge[] } | null>(null)
  const [isSystemReadonly, setIsSystemReadonly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [needsSystemWorkflow, setNeedsSystemWorkflow] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadSystemWorkflow()
  }, [id])

  const loadSystemWorkflow = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${id}/workflow`)
      const data = await response.json()

      if (data.success) {
        if (data.needsSystemWorkflow) {
          // 项目没有系统工作流，显示提示界面
          setNeedsSystemWorkflow(true)
          setMode('empty')
        } else if (data.workflow) {
          // 项目有工作流
          setSystemWorkflow({
            nodes: data.workflow.nodes || [],
            edges: data.workflow.edges || []
          })
          setIsSystemReadonly(data.workflow.readonly !== false)
          setMode('system')
        }
      }
    } catch (error) {
      console.error('加载系统工作流失败:', error)
      toast.error('加载工作流失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSystemWorkflow = async () => {
    try {
      setGenerating(true)
      const response = await fetch(`/api/projects/${id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true }),
      })

      const data = await response.json()

      console.log('生成系统工作流响应:', data)

      if (data.success && data.workflow) {
        toast.success(data.message || '系统工作流生成成功')
        setNeedsSystemWorkflow(false)
        setSystemWorkflow({
          nodes: data.workflow.nodes || [],
          edges: data.workflow.edges || []
        })
        setIsSystemReadonly(data.workflow.readonly !== false)
        setMode('system')
      } else {
        toast.error(data.error || '生成失败')
        console.error('生成失败:', data)
      }
    } catch (error) {
      console.error('生成系统工作流失败:', error)
      toast.error('生成系统工作流失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleCreateCustomWorkflow = () => {
    setMode('custom')
    // 自定义工作流模式，不传递任何初始节点，用户可以自己创建
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">加载工作流...</p>
          </div>
        </div>
      </div>
    )
  }

  // 需要生成系统工作流时的提示界面
  if (needsSystemWorkflow) {
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
                  <p className="text-xs text-muted-foreground">初始化工作流</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 提示界面 */}
        <div className="flex items-center justify-center h-[calc(100vh-73px)]">
          <div className="max-w-lg w-full mx-6">
            <div className="bg-card rounded-xl border border-border/50 shadow-lg p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-500" />
              </div>

              <h2 className="text-2xl font-semibold mb-3">初始化工作流</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                该项目还没有配置工作流。系统可以为您自动生成一个系统工作流，展示项目内容如何转换为视频。
              </p>

              <div className="space-y-4">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleGenerateSystemWorkflow}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      生成系统工作流
                    </>
                  )}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateCustomWorkflow}
                  disabled={generating}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  从空白开始创建
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-6">
                系统工作流是只读的，仅用于查看工作原理。自定义工作流可以自由编辑和修改。
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* 头部 */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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
                  <p className="text-xs text-muted-foreground">
                    {mode === 'system' ? '系统工作流（只读）' : '自定义工作流'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={mode === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('system')}
                disabled={loading || mode === 'system'}
              >
                系统工作流
              </Button>
              <Button
                variant={mode === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={handleCreateCustomWorkflow}
                disabled={loading || mode === 'custom'}
              >
                <Plus className="w-4 h-4 mr-1" />
                新建工作流
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 工作流编辑器 */}
      <div className="h-[calc(100vh-73px)]">
        {mode === 'system' ? (
          <WorkflowEditorV2
            projectId={id}
            initialNodes={systemWorkflow?.nodes || []}
            initialEdges={systemWorkflow?.edges || []}
            readonly={isSystemReadonly}
            isSystem={true}
          />
        ) : (
          <WorkflowEditorV2
            projectId={id}
            readonly={false}
            isSystem={false}
          />
        )}
      </div>
    </div>
  )
}

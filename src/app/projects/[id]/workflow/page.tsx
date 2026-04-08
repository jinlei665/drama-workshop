/**
 * 项目工作流页面
 * 显示项目的系统工作流（只读）或自定义工作流
 */

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Workflow, Plus, Sparkles, RefreshCw } from 'lucide-react'
import WorkflowEditorRF from '@/components/workflow/WorkflowEditorRF'
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

  const loadSystemWorkflow = useCallback(async () => {
    try {
      console.log('📥 开始加载系统工作流，项目ID:', id)
      setLoading(true)
      
      // 同时获取工作流和项目详情
      const [workflowResponse, projectResponse] = await Promise.all([
        fetch(`/api/projects/${id}/workflow`),
        fetch(`/api/projects/${id}`)
      ])
      
      console.log('📡 加载响应状态:', workflowResponse.status)

      if (workflowResponse.status === 404) {
        console.error('❌ 项目不存在')
        toast.error('项目不存在，请返回项目列表')
        setLoading(false)
        return
      }

      const data = await workflowResponse.json()
      const projectData = await projectResponse.json()
      console.log('📦 加载响应数据:', data)
      console.log('📦 项目详情:', projectData)

      // 从项目详情中提取可用于填充工作流的内容
      let projectContent = ''
      let projectCharacters: string[] = []
      
      if (projectData.success && projectData.data) {
        const project = projectData.data.project
        if (project) {
          // 优先使用 sourceContent，其次使用 description
          projectContent = project.sourceContent || project.description || ''
        }
        // 提取角色描述
        if (projectData.data.characters && projectData.data.characters.length > 0) {
          projectCharacters = projectData.data.characters.map((c: any) => 
            `${c.name}: ${c.description || c.appearance || ''}`
          )
        }
      }

      // 填充工作流参数的函数
      const fillNodeParams = (nodes: any[]) => {
        return nodes.map((node: any) => {
          const newParams = { ...node.params }
          
          switch (node.type) {
            case 'text-input':
              // 如果文本输入为空且有项目内容，使用项目内容填充
              if (!newParams.text && projectContent) {
                newParams.text = projectContent
              }
              break
            case 'text-to-character':
              // 如果角色描述为空且有角色列表，使用第一个角色填充
              if (!newParams.description && projectCharacters.length > 0) {
                newParams.description = projectCharacters[0]
              }
              break
            case 'text-to-image':
            case 'image-to-video':
              // 如果提示词为空且有项目内容，使用项目内容作为基础提示词
              if (!newParams.prompt && projectContent) {
                newParams.prompt = projectContent
              }
              break
            case 'script-to-scenes':
              // 如果脚本为空且有项目内容，使用项目内容作为脚本
              if (!newParams.script && projectContent) {
                newParams.script = projectContent
              }
              break
          }
          
          return { ...node, params: newParams }
        })
      }

      if (data.success) {
        // 检查是否有工作流数据
        const hasWorkflow = data.data?.workflow &&
                            Array.isArray(data.data.workflow.nodes) &&
                            data.data.workflow.nodes.length > 0

        // 检查是否是默认/系统工作流
        const isSystem = data.data?.isSystem === true ||
                         data.data?.isDefault === true ||
                         (data.data?.workflow?.system === true)

        if (hasWorkflow && !isSystem) {
          // 项目有自定义工作流
          console.log('✅ 项目有自定义工作流')
          const filledNodes = fillNodeParams(data.data.workflow.nodes || [])
          setSystemWorkflow({
            nodes: filledNodes,
            edges: data.data.workflow.edges || []
          })
          setIsSystemReadonly(data.data.workflow.readonly !== false)
          setMode('system')
        } else if (hasWorkflow && isSystem) {
          // 项目有系统工作流
          console.log('✅ 项目有系统工作流')
          const filledNodes = fillNodeParams(data.data.workflow.nodes || [])
          setSystemWorkflow({
            nodes: filledNodes,
            edges: data.data.workflow.edges || []
          })
          setIsSystemReadonly(true)
          setMode('system')
        } else {
          // 项目没有工作流，显示提示界面
          console.log('⚠️ 项目需要初始化工作流')
          setNeedsSystemWorkflow(true)
          setMode('empty')
        }
      } else {
        console.error('❌ 加载工作流失败:', data.error)
        toast.error(data.error || '加载工作流失败')
      }
    } catch (error) {
      console.error('❌ 加载系统工作流失败:', error)
      toast.error('加载工作流失败')
    } finally {
      setLoading(false)
      console.log('✨ 加载流程完成')
    }
  }, [id])

  useEffect(() => {
    console.log('🎬 Workflow 页面组件已挂载，项目ID:', id)
    loadSystemWorkflow()
  }, [id, loadSystemWorkflow])

  const handleGenerateSystemWorkflow = async () => {
    console.log('🎯 开始生成系统工作流，项目ID:', id)
    try {
      setGenerating(true)
      console.log('⏳ 正在发送请求...')

      const response = await fetch(`/api/projects/${id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true }),
      })

      console.log('📡 收到响应，状态码:', response.status)

      if (response.status === 404) {
        console.error('❌ 项目不存在')
        toast.error('项目不存在，请返回项目列表')
        return
      }

      const data = await response.json()

      console.log('✅ 生成系统工作流响应:', data)

      if (data.success && data.workflow) {
        console.log('🎉 工作流生成成功，节点数:', data.workflow.nodes?.length, '连接数:', data.workflow.edges?.length)
        toast.success(data.message || '系统工作流生成成功')
        setNeedsSystemWorkflow(false)
        setSystemWorkflow({
          nodes: data.workflow.nodes || [],
          edges: data.workflow.edges || []
        })
        setIsSystemReadonly(data.workflow.readonly !== false)
        setMode('system')
        console.log('✨ 已切换到系统工作流模式')
      } else {
        console.error('❌ 生成失败，响应数据:', data)
        toast.error(data.error?.message || data.error || '生成失败')
      }
    } catch (error) {
      console.error('💥 生成系统工作流异常:', error)
      toast.error(`生成系统工作流失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      console.log('🏁 生成流程结束，设置 generating 为 false')
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
                onClick={() => {
                  if (!systemWorkflow || systemWorkflow.nodes.length === 0) {
                    toast.warning('请先生成系统工作流')
                    setNeedsSystemWorkflow(true)
                    setMode('empty')
                  } else {
                    setMode('system')
                  }
                }}
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
          <WorkflowEditorRF
            initialNodes={systemWorkflow?.nodes || []}
            initialEdges={systemWorkflow?.edges || []}
            readOnly={isSystemReadonly}
          />
        ) : (
          <WorkflowEditorRF
            readOnly={false}
          />
        )}
      </div>
    </div>
  )
}

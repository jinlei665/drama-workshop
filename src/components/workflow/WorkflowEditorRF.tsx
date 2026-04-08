'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Connection,
} from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Trash2,
  Play,
  Save,
  Loader2,
  Image,
  Video,
  Users,
  FileText,
  Wand2,
  Layers,
  Brain,
  Clapperboard,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

// 节点数据类型
interface WorkflowNodeData extends Record<string, unknown> {
  type: string
  fieldValues?: Record<string, unknown>
  status?: string
  onDelete?: (id: string) => void
  onFieldChange?: (key: string, value: unknown) => void
}

// 节点颜色映射
const nodeColors: Record<string, string> = {
  'script-input': '#2563eb',
  'text-input': '#2563eb',
  'image-input': '#16a34a',
  'text-to-image': '#ec4899',
  'image-to-video': '#ea580c',
  'text-to-character': '#16a34a',
  'script-to-scenes': '#9333ea',
  'llm-process': '#ca8a04',
  'video-compose': '#ea580c',
}

const nodeNames: Record<string, string> = {
  'script-input': '脚本输入',
  'text-input': '文本输入',
  'image-input': '图片输入',
  'text-to-image': '生成图像',
  'image-to-video': '生成视频',
  'text-to-character': '创建角色',
  'script-to-scenes': '分镜分析',
  'llm-process': 'LLM 处理',
  'video-compose': '视频合成',
}

// 节点图标
const nodeIcons: Record<string, React.ReactNode> = {
  'script-input': <FileText className="w-4 h-4" />,
  'text-input': <FileText className="w-4 h-4" />,
  'image-input': <Image className="w-4 h-4" />,
  'text-to-image': <Wand2 className="w-4 h-4" />,
  'image-to-video': <Video className="w-4 h-4" />,
  'text-to-character': <Users className="w-4 h-4" />,
  'script-to-scenes': <Layers className="w-4 h-4" />,
  'llm-process': <Brain className="w-4 h-4" />,
  'video-compose': <Clapperboard className="w-4 h-4" />,
}

// 输入端口配置
const inputPorts: Record<string, { id: string; name: string }[]> = {
  'script-input': [],
  'text-input': [],
  'image-input': [],
  'text-to-image': [{ id: 'prompt', name: '提示词' }],
  'image-to-video': [
    { id: 'prompt', name: '提示词' },
    { id: 'firstFrame', name: '首帧图像' },
    { id: 'lastFrame', name: '尾帧图像' },
  ],
  'text-to-character': [{ id: 'description', name: '角色描述' }],
  'script-to-scenes': [{ id: 'script', name: '脚本' }],
  'llm-process': [{ id: 'input', name: '输入' }],
  'video-compose': [{ id: 'videos', name: '视频列表' }],
}

// 输出端口配置
const outputPorts: Record<string, { id: string; name: string }[]> = {
  'script-input': [{ id: 'script', name: '脚本' }],
  'text-input': [{ id: 'text', name: '文本' }],
  'image-input': [{ id: 'image', name: '图像' }],
  'text-to-image': [{ id: 'image', name: '图像' }],
  'image-to-video': [{ id: 'video', name: '视频' }],
  'text-to-character': [
    { id: 'character', name: '角色' },
    { id: 'image', name: '图像' },
  ],
  'script-to-scenes': [{ id: 'scenes', name: '分镜' }],
  'llm-process': [{ id: 'output', name: '输出' }],
  'video-compose': [{ id: 'video', name: '视频' }],
}

// 自定义节点组件
function WorkflowNode({ data, selected, id }: NodeProps<Node<WorkflowNodeData>>) {
  const nodeType = String(data.type)
  const nodeColor = nodeColors[nodeType] || '#6b7280'
  const inputs = inputPorts[nodeType] || []
  const outputs = outputPorts[nodeType] || []

  return (
    <div
      className={`rounded-lg border-2 bg-card shadow-lg min-w-[260px] ${
        selected ? 'border-primary' : 'border-border'
      }`}
      style={{ borderTopWidth: 4, borderTopColor: nodeColor }}
    >
      {/* 节点头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: nodeColor, color: 'white' }}
          >
            <>{nodeIcons[nodeType] ?? <FileText className="w-4 h-4" />}</>
          </div>
          <span className="font-medium text-sm">{nodeNames[nodeType] || nodeType}</span>
        </div>
        {typeof data.onDelete === 'function' && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={(e) => {
              e.stopPropagation()
              ;(data.onDelete as (id: string) => void)(id)
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}
      </div>

      {/* 节点参数内容 */}
      <div className="p-3 space-y-3">
        {/* 输入端口 */}
        {inputs.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {inputs.map((port: { id: string; name: string }) => (
              <div key={`input-${port.id}`} className="flex items-center gap-2">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={port.id}
                  className="!w-4 !h-4 !bg-background !border-2 !border-primary hover:!bg-primary transition-colors"
                />
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border-l-2 border-primary">
                  {port.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {renderNodeFields(data)}

        {/* 输出端口 */}
        {outputs.length > 0 && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t">
            {outputs.map((port: { id: string; name: string }) => (
              <div key={`output-${port.id}`} className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border-r-2 border-primary">
                  {port.name}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.id}
                  className="!w-4 !h-4 !bg-background !border-2 !border-primary hover:!bg-primary transition-colors"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 执行状态 */}
      {data.status && typeof data.status === 'string' && (
        <div className={`px-3 py-2 border-t text-xs flex items-center gap-1 ${
          data.status === 'completed' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
          data.status === 'failed' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
          'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {data.status === 'completed' && <><span className="w-2 h-2 rounded-full bg-green-500"></span> 已完成</>}
          {data.status === 'failed' && <><span className="w-2 h-2 rounded-full bg-red-500"></span> 失败</>}
          {data.status === 'running' && <><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> 运行中</>}
          {data.status === 'pending' && <><span className="w-2 h-2 rounded-full bg-gray-400"></span> 等待</>}
        </div>
      )}
    </div>
  )
}

// 根据节点类型渲染参数字段
function renderNodeFields(data: any) {
  const type = data.type as string
  const values = data.fieldValues || {}

  const updateField = (key: string, value: any) => {
    if (data.onFieldChange) {
      data.onFieldChange(key, value)
    }
  }

  switch (type) {
    case 'script-input':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">脚本内容</Label>
          <Textarea
            value={values.script || ''}
            onChange={(e) => updateField('script', e.target.value)}
            placeholder="在此输入脚本内容..."
            className="text-sm min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            输出脚本内容供后续节点使用
          </p>
        </div>
      )

    case 'text-input':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">文本内容</Label>
          <Textarea
            value={values.text || ''}
            onChange={(e) => updateField('text', e.target.value)}
            placeholder="在此输入文本内容..."
            className="text-sm min-h-[80px] resize-none"
          />
        </div>
      )

    case 'image-input':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">图片 URL</Label>
          <Input
            value={values.imageUrl || ''}
            onChange={(e) => updateField('imageUrl', e.target.value)}
            placeholder="输入图片地址或上传图片"
            className="text-sm"
          />
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
            <Upload className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">点击上传或拖拽图片</p>
          </div>
        </div>
      )

    case 'text-to-image':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">图像描述</Label>
            <Textarea
              value={values.prompt || ''}
              onChange={(e) => updateField('prompt', e.target.value)}
              placeholder="描述你想要的图像内容..."
              className="text-sm min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">图像风格</Label>
            <select
              value={values.style || 'realistic'}
              onChange={(e) => updateField('style', e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
            >
              <option value="realistic">写实风格</option>
              <option value="anime">动漫风格</option>
              <option value="cartoon">卡通风格</option>
              <option value="oil_painting">油画风格</option>
            </select>
          </div>
        </div>
      )

    case 'image-to-video':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">视频描述</Label>
            <Textarea
              value={values.prompt || ''}
              onChange={(e) => updateField('prompt', e.target.value)}
              placeholder="描述视频内容或动作..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">时长(秒)</Label>
              <Input
                type="number"
                value={values.duration || 5}
                onChange={(e) => updateField('duration', parseInt(e.target.value))}
                min={4}
                max={15}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">比例</Label>
              <select
                value={values.aspectRatio || '16:9'}
                onChange={(e) => updateField('aspectRatio', e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
              >
                <option value="16:9">横屏 16:9</option>
                <option value="9:16">竖屏 9:16</option>
              </select>
            </div>
          </div>
        </div>
      )

    case 'text-to-character':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">角色名称</Label>
            <Input
              value={values.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="输入角色名称"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">角色描述</Label>
            <Textarea
              value={values.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="描述角色的外貌特征..."
              className="text-sm min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">性格特点</Label>
            <Input
              value={values.personality || ''}
              onChange={(e) => updateField('personality', e.target.value)}
              placeholder="描述角色性格"
              className="text-sm"
            />
          </div>
        </div>
      )

    case 'script-to-scenes':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">分镜数量</Label>
            <Input
              type="number"
              value={values.numScenes || 5}
              onChange={(e) => updateField('numScenes', parseInt(e.target.value))}
              min={1}
              max={20}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">场景风格</Label>
            <select
              value={values.sceneStyle || 'cinematic'}
              onChange={(e) => updateField('sceneStyle', e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
            >
              <option value="cinematic">电影感</option>
              <option value="dramatic">戏剧感</option>
              <option value="documentary">纪录片风格</option>
            </select>
          </div>
        </div>
      )

    case 'llm-process':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">系统提示词</Label>
            <Textarea
              value={values.systemPrompt || ''}
              onChange={(e) => updateField('systemPrompt', e.target.value)}
              placeholder="设置 AI 的角色或行为..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">用户提示词</Label>
            <Textarea
              value={values.userPrompt || ''}
              onChange={(e) => updateField('userPrompt', e.target.value)}
              placeholder="输入要处理的内容..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>
        </div>
      )

    case 'video-compose':
      return (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">合并设置</Label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">过渡效果</Label>
            <select
              value={values.transition || 'none'}
              onChange={(e) => updateField('transition', e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
            >
              <option value="none">无过渡</option>
              <option value="fade">淡入淡出</option>
              <option value="slide">滑动</option>
              <option value="dissolve">溶解</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            连接多个视频节点以合并视频
          </p>
        </div>
      )

    default:
      return (
        <div className="text-xs text-muted-foreground">
          未知节点类型: {type}
        </div>
      )
  }
}

// 节点类型注册
const nodeTypes = {
  workflowNode: WorkflowNode,
}

export interface WorkflowEditorRFProps {
  initialNodes?: any[]
  initialEdges?: any[]
  onSave?: (workflow: { nodes: any[]; edges: any[] }) => void
  onExecute?: () => void
  readOnly?: boolean
}

export default function WorkflowEditorRF({
  initialNodes = [],
  initialEdges = [],
  onSave,
  onExecute,
  readOnly = false,
}: WorkflowEditorRFProps) {
  const [isRunning, setIsRunning] = useState(false)

  // 转换初始节点
  const convertNode = (node: any) => ({
    id: node.id,
    type: 'workflowNode',
    position: node.position || { x: 0, y: 0 },
    data: {
      type: node.type,
      fieldValues: node.params || {},
    },
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map(convertNode)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges.map((e: any) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle: e.fromPort,
      targetHandle: e.toPort,
    }))
  )

  // Refs for execution
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }, [setNodes, setEdges])

  // 更新节点字段
  const updateNodeField = useCallback((nodeId: string, key: string, value: any) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            fieldValues: {
              ...n.data.fieldValues,
              [key]: value,
            },
          },
        }
      }
      return n
    }))
  }, [setNodes])

  // 设置节点删除回调
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onDelete: readOnly ? undefined : deleteNode,
        onFieldChange: (key: string, value: any) => updateNodeField(n.id, key, value),
      },
    })))
  }, [setNodes, deleteNode, updateNodeField, readOnly])

  // 处理连接
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        id: `edge-${Date.now()}`,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        label: '',
      } as any, eds))
    },
    [setEdges]
  )

  // 添加节点
  const addNode = useCallback((type: string) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'workflowNode',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        type,
        fieldValues: {},
        onDelete: deleteNode,
        onFieldChange: (key: string, value: any) => updateNodeField(`node-${Date.now()}`, key, value),
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes, deleteNode, updateNodeField])

  // 保存工作流
  const handleSave = () => {
    const workflow = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.type,
        position: n.position,
        inputs: inputPorts[n.data.type] || [],
        outputs: outputPorts[n.data.type] || [],
        params: n.data.fieldValues,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        from: e.source,
        to: e.target,
        fromPort: e.sourceHandle,
        toPort: e.targetHandle,
      })),
    }
    onSave?.(workflow)
    toast.success('工作流已保存')
  }

  // 执行工作流
  const handleExecute = async () => {
    if (isRunning) return
    setIsRunning(true)

    const executionId = `exec-${Date.now()}`

    // 构建节点数据
    const workflowNodes = nodesRef.current.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: nodeNames[n.data.type] || n.data.type,
      inputs: (inputPorts[n.data.type] || []).map((p) => ({ id: p.id, name: p.name })),
      outputs: (outputPorts[n.data.type] || []).map((p) => ({ id: p.id, name: p.name })),
      params: n.data.fieldValues || {},
    }))

    const workflowEdges = edgesRef.current.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      fromPort: e.sourceHandle,
      toPort: e.targetHandle,
    }))

    // 设置节点状态
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, status: 'pending' },
    })))

    try {
      const eventSource = new EventSource(`/api/workflow/ws?executionId=${executionId}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'node:started') {
            setNodes((nds) => nds.map((n) =>
              n.id === data.data.nodeId
                ? { ...n, data: { ...n.data, status: 'running' } }
                : n
            ))
          } else if (data.type === 'node:completed') {
            setNodes((nds) => nds.map((n) =>
              n.id === data.data.nodeId
                ? { ...n, data: { ...n.data, status: 'completed' } }
                : n
            ))
          } else if (data.type === 'node:failed') {
            setNodes((nds) => nds.map((n) =>
              n.id === data.data.nodeId
                ? { ...n, data: { ...n.data, status: 'failed' } }
                : n
            ))
          } else if (data.type === 'execution:completed' || data.type === 'execution:failed') {
            toast.success('工作流执行完成')
            setIsRunning(false)
            setTimeout(() => eventSource.close(), 1000)
          }
        } catch (e) {
          console.error('解析事件失败:', e)
        }
      }

      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: workflowNodes,
          edges: workflowEdges,
          workflowId: `workflow-${Date.now()}`,
          projectId: 'temp',
          executionId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '执行失败')
      }
    } catch (error) {
      console.error('执行失败:', error)
      toast.error('执行失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
      setNodes((nds) => nds.map((n) => ({
        ...n,
        data: { ...n.data, status: 'failed' },
      })))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">工作流编辑器</h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">React Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            保存
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                运行中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                运行
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 */}
        {!readOnly && (
          <div className="w-72 border-r bg-background/95 backdrop-blur overflow-y-auto p-4">
            <h4 className="font-semibold mb-4">添加节点</h4>
            <div className="space-y-3">
              {/* 输入节点 */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">输入</p>
                <div className="space-y-2">
                  <NodeButton type="script-input" name="脚本输入" icon={<FileText className="w-4 h-4" />} onClick={addNode} color={nodeColors['script-input']} />
                  <NodeButton type="text-input" name="文本输入" icon={<FileText className="w-4 h-4" />} onClick={addNode} color={nodeColors['text-input']} />
                  <NodeButton type="image-input" name="图片输入" icon={<Image className="w-4 h-4" />} onClick={addNode} color={nodeColors['image-input']} />
                </div>
              </div>

              {/* AI 节点 */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">AI 生成</p>
                <div className="space-y-2">
                  <NodeButton type="text-to-image" name="生成图像" icon={<Wand2 className="w-4 h-4" />} onClick={addNode} color={nodeColors['text-to-image']} />
                  <NodeButton type="image-to-video" name="生成视频" icon={<Video className="w-4 h-4" />} onClick={addNode} color={nodeColors['image-to-video']} />
                  <NodeButton type="text-to-character" name="创建角色" icon={<Users className="w-4 h-4" />} onClick={addNode} color={nodeColors['text-to-character']} />
                  <NodeButton type="script-to-scenes" name="分镜分析" icon={<Layers className="w-4 h-4" />} onClick={addNode} color={nodeColors['script-to-scenes']} />
                  <NodeButton type="llm-process" name="LLM 处理" icon={<Brain className="w-4 h-4" />} onClick={addNode} color={nodeColors['llm-process']} />
                </div>
              </div>

              {/* 合成节点 */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">合成</p>
                <div className="space-y-2">
                  <NodeButton type="video-compose" name="视频合成" icon={<Clapperboard className="w-4 h-4" />} onClick={addNode} color={nodeColors['video-compose']} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 画布 */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={readOnly ? null : 'Delete'}
            className="bg-muted/30"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
              labelStyle: { display: 'none' },
              label: '',
            }}
          >
            <Background gap={20} color="hsl(var(--border))" />
            <Controls />
            <MiniMap
              nodeColor={(node) => nodeColors[(node.data as any)?.type] || '#6b7280'}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

// 节点按钮组件
function NodeButton({ type, name, icon, onClick, color }: {
  type: string
  name: string
  icon: React.ReactNode
  onClick: (type: string) => void
  color: string
}) {
  return (
    <div
      className="p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all cursor-pointer group"
      onClick={() => onClick(type)}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded flex items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm group-hover:text-primary transition-colors">{name}</p>
          <p className="text-xs text-muted-foreground">{nodeNames[type]}</p>
        </div>
      </div>
    </div>
  )
}

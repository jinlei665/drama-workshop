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
  NodeProps,
  Connection,
  Edge,
  Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  Play,
  Save,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// 节点颜色映射
const nodeColors: Record<string, string> = {
  'script-input': '#2563eb',    // blue-600
  'text-input': '#2563eb',      // blue-600
  'image-input': '#16a34a',      // green-600
  'text-to-image': '#ec4899',    // pink-500
  'image-to-video': '#ea580c',   // orange-500
  'text-to-character': '#16a34a', // green-600
  'script-to-scenes': '#9333ea', // purple-600
  'llm-process': '#ca8a04',     // yellow-600
  'video-compose': '#ea580c',    // orange-500
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

// 自定义节点组件
function WorkflowNode({ data, selected, id }: NodeProps) {
  const nodeColor = nodeColors[data.type] || '#6b7280'
  
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card shadow-lg min-w-[200px] ${
        selected ? 'border-primary' : 'border-border'
      }`}
    >
      {/* 节点头部 */}
      <div 
        className="flex items-center justify-between mb-2 pb-2 border-b"
        style={{ borderColor: nodeColor }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: nodeColor }} 
          />
          <span className="font-medium text-sm">{nodeNames[data.type] || data.type}</span>
        </div>
        {data.onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={(e) => {
              e.stopPropagation()
              data.onDelete(id)
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}
      </div>

      {/* 输入端口 */}
      {data.inputs?.map((input: any, index: number) => (
        <Handle
          key={`input-${index}`}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{ top: `${48 + index * 32}px` }}
          className="!w-3 !h-3 !bg-background !border-2 !border-primary"
        />
      ))}

      {/* 节点内容 */}
      <div className="space-y-2">
        {data.fields?.map((field: any) => (
          <div key={field.key}>
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            {field.type === 'textarea' ? (
              <Textarea
                value={field.value || ''}
                onChange={(e) => field.onChange?.(e.target.value)}
                className="text-xs min-h-[60px]"
                placeholder={field.placeholder}
              />
            ) : (
              <Input
                value={field.value || ''}
                onChange={(e) => field.onChange?.(e.target.value)}
                className="text-xs h-8"
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
        
        {/* 执行状态 */}
        {data.status && (
          <div className={`text-xs flex items-center gap-1 ${
            data.status === 'completed' ? 'text-green-600' :
            data.status === 'failed' ? 'text-red-600' : 'text-blue-600'
          }`}>
            {data.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
            {data.status === 'failed' && <XCircle className="w-3 h-3" />}
            <span>{data.status === 'completed' ? '已完成' : data.status === 'failed' ? '失败' : '运行中...'}</span>
          </div>
        )}
      </div>

      {/* 输出端口 */}
      {data.outputs?.map((output: any, index: number) => (
        <Handle
          key={`output-${index}`}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{ top: `${48 + index * 32}px` }}
          className="!w-3 !h-3 !bg-background !border-2 !border-primary"
        />
      ))}
    </div>
  )
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
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null)
  
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map((node: any) => ({
      id: node.id,
      type: 'workflowNode',
      position: node.position || { x: 0, y: 0 },
      data: {
        ...node.data,
        inputs: node.inputs || [],
        outputs: node.outputs || [],
      },
    }))
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
  
  // 节点 refs 用于执行时获取最新数据
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }, [setNodes, setEdges])

  // 更新节点数据
  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    )
  }, [setNodes])

  // 处理连接
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({
        ...connection,
        id: `edge-${Date.now()}`,
      }, eds))
    },
    [setEdges]
  )

  // 添加节点
  const addNode = useCallback((type: string) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'workflowNode',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      data: {
        type,
        inputs: getNodeInputs(type),
        outputs: getNodeOutputs(type),
        fields: getNodeFields(type),
        onDelete: deleteNode,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes, deleteNode])

  // 保存工作流
  const handleSave = () => {
    const workflow = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.data.type,
        position: n.position,
        inputs: n.data.inputs,
        outputs: n.data.outputs,
        data: n.data,
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
  }

  // 执行工作流
  const handleExecute = async () => {
    if (isRunning) return
    
    setIsRunning(true)
    const executionId = `exec-${Date.now()}`
    
    // 构建执行数据
    const workflowNodes = nodesRef.current.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.type,
      inputs: n.data.inputs?.map((i: any) => ({ ...i, value: undefined })) || [],
      outputs: n.data.outputs?.map((o: any) => ({ ...o, value: undefined })) || [],
      params: buildNodeParams(n.data),
    }))
    
    const workflowEdges = edgesRef.current.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      fromPort: e.sourceHandle,
      toPort: e.targetHandle,
    }))

    // 设置所有节点为待执行状态
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'pending' } })))

    try {
      // 启动 SSE 连接监听执行状态
      const eventSource = new EventSource(`/api/workflow/ws?executionId=${executionId}`)
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 收到事件:', data.type, data.data)
          
          if (data.type === 'node:started') {
            setRunningNodeId(data.data.nodeId)
            setNodes((nds) => nds.map((n) => 
              n.id === data.data.nodeId 
                ? { ...n, data: { ...n.data, status: 'running' } }
                : n
            ))
          } else if (data.type === 'node:completed') {
            setNodes((nds) => nds.map((n) => 
              n.id === data.data.nodeId 
                ? { ...n, data: { ...n.data, status: 'completed', result: data.data.result?.data } }
                : n
            ))
          } else if (data.type === 'node:failed') {
            setNodes((nds) => nds.map((n) => 
              n.id === data.data.nodeId 
                ? { ...n, data: { ...n.data, status: 'failed', error: data.data.error } }
                : n
            ))
          } else if (data.type === 'execution:completed') {
            toast.success('工作流执行完成')
            setIsRunning(false)
            setRunningNodeId(null)
            setTimeout(() => eventSource.close(), 1000)
          } else if (data.type === 'execution:failed') {
            toast.error('工作流执行失败')
            setIsRunning(false)
            setRunningNodeId(null)
            setTimeout(() => eventSource.close(), 1000)
          }
        } catch (e) {
          console.error('解析事件失败:', e)
        }
      }

      // 发送执行请求
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
      
      const result = await response.json()
      console.log('执行结果:', result)
      
      // 如果没有 SSE 事件，使用 API 返回的结果
      if (result.data?.results) {
        result.data.results.forEach((r: any) => {
          setNodes((nds) => nds.map((n) => 
            n.id === r.nodeId 
              ? { ...n, data: { ...n.data, status: 'completed', result: r.result?.data } }
              : n
          ))
        })
      }
      
    } catch (error) {
      console.error('执行失败:', error)
      toast.error('执行失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
      // 标记所有节点为失败
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'failed' } })))
    } finally {
      setIsRunning(false)
      setRunningNodeId(null)
    }
  }

  // 根据节点类型构建参数字典
  const buildNodeParams = (data: any) => {
    const params: Record<string, any> = {}
    if (data.fields) {
      data.fields.forEach((field: any) => {
        params[field.key] = field.value
      })
    }
    return params
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">工作流编辑器</h3>
          <span className="text-sm text-muted-foreground">React Flow</span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            disabled={readOnly || isRunning}
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
        {/* 左侧面板 - 节点列表 */}
        {!readOnly && (
          <div className="w-64 border-r bg-background/95 backdrop-blur overflow-y-auto p-4">
            <h4 className="font-semibold mb-4">添加节点</h4>
            <div className="space-y-2">
              {Object.entries(nodeNames).map(([type, name]) => (
                <div
                  key={type}
                  className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => addNode(type)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: nodeColors[type] }} 
                    />
                    <span className="font-medium text-sm">{name}</span>
                  </div>
                </div>
              ))}
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
          >
            <Background />
            <Controls />
            <MiniMap 
              nodeColor={(node) => nodeColors[node.data?.type] || '#6b7280'}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

// 获取节点输入端口
function getNodeInputs(type: string) {
  const inputsMap: Record<string, any[]> = {
    'text-to-image': [{ id: 'prompt', name: '提示词' }],
    'image-to-video': [
      { id: 'prompt', name: '提示词' },
      { id: 'firstFrame', name: '首帧图像' },
    ],
    'text-to-character': [{ id: 'description', name: '描述' }],
    'script-to-scenes': [{ id: 'script', name: '脚本' }],
    'llm-process': [{ id: 'input', name: '输入' }],
    'video-compose': [{ id: 'videos', name: '视频列表' }],
  }
  return inputsMap[type] || []
}

// 获取节点输出端口
function getNodeOutputs(type: string) {
  const outputsMap: Record<string, any[]> = {
    'script-input': [{ id: 'script', name: '脚本' }],
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
  return outputsMap[type] || []
}

// 获取节点字段
function getNodeFields(type: string) {
  const fieldsMap: Record<string, any[]> = {
    'script-input': [
      { key: 'script', label: '脚本内容', type: 'textarea', placeholder: '输入脚本内容...' },
    ],
    'text-to-image': [
      { key: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述要生成的图像...' },
      { key: 'style', label: '风格', type: 'input', placeholder: 'realistic, anime...' },
    ],
    'image-to-video': [
      { key: 'prompt', label: '提示词', type: 'textarea', placeholder: '描述视频内容...' },
      { key: 'duration', label: '时长(秒)', type: 'input', placeholder: '5' },
    ],
    'text-to-character': [
      { key: 'description', label: '角色描述', type: 'textarea', placeholder: '描述角色外貌...' },
      { key: 'name', label: '角色名称', type: 'input', placeholder: '角色名称' },
    ],
    'script-to-scenes': [
      { key: 'numScenes', label: '分镜数量', type: 'input', placeholder: '5' },
    ],
  }
  return fieldsMap[type] || []
}

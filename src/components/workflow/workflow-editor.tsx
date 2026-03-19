/**
 * 工作流编辑器组件
 * 参考 ComfyUI 的节点式设计
 * 支持节点拖拽、连接、执行
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play,
  Pause,
  Save,
  ZoomIn,
  ZoomOut,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

interface WorkflowEditorProps {
  projectId: string
  initialNodes?: WorkflowNode[]
  initialEdges?: WorkflowEdge[]
  className?: string
}

// 节点类型配置（中文）
const NODE_CONFIG: Record<string, {
  category: string
  color: string
  label: string
  description: string
  inputs: { name: string; label: string }[]
  outputs: { name: string; label: string }[]
}> = {
  analyze_content: {
    category: 'analysis',
    color: '#3b82f6',
    label: '内容分析',
    description: '分析小说/剧本内容，提取故事结构',
    inputs: [
      { name: 'content', label: '文本内容' }
    ],
    outputs: [
      { name: 'summary', label: '故事摘要' },
      { name: 'themes', label: '主题标签' },
      { name: 'tone', label: '整体基调' },
      { name: 'structure', label: '故事结构' }
    ],
  },
  extract_characters: {
    category: 'analysis',
    color: '#3b82f6',
    label: '人物提取',
    description: '从内容中提取人物信息',
    inputs: [
      { name: 'content', label: '文本内容' },
      { name: 'existingCharacters', label: '已有人物' }
    ],
    outputs: [
      { name: 'characters', label: '人物列表' }
    ],
  },
  generate_storyboard: {
    category: 'generation',
    color: '#10b981',
    label: '分镜生成',
    description: '将故事拆分为分镜脚本',
    inputs: [
      { name: 'content', label: '文本内容' },
      { name: 'characters', label: '人物列表' },
      { name: 'style', label: '分镜风格' },
      { name: 'episodeCount', label: '集数' }
    ],
    outputs: [
      { name: 'scenes', label: '分镜列表' }
    ],
  },
  generate_character_image: {
    category: 'generation',
    color: '#10b981',
    label: '人物图像生成',
    description: '生成人物参考图像',
    inputs: [
      { name: 'character', label: '人物信息' },
      { name: 'style', label: '图像风格' }
    ],
    outputs: [
      { name: 'imageUrl', label: '图像URL' },
      { name: 'characterId', label: '人物ID' }
    ],
  },
  generate_scene_image: {
    category: 'generation',
    color: '#10b981',
    label: '分镜图像生成',
    description: '生成分镜场景图像',
    inputs: [
      { name: 'scene', label: '分镜信息' },
      { name: 'characters', label: '人物列表' },
      { name: 'style', label: '图像风格' }
    ],
    outputs: [
      { name: 'imageUrl', label: '图像URL' },
      { name: 'sceneId', label: '分镜ID' }
    ],
  },
  generate_video: {
    category: 'generation',
    color: '#10b981',
    label: '视频生成',
    description: '从图像生成视频',
    inputs: [
      { name: 'imageUrl', label: '图像URL' },
      { name: 'prompt', label: '动作提示' },
      { name: 'duration', label: '视频时长' }
    ],
    outputs: [
      { name: 'videoUrl', label: '视频URL' }
    ],
  },
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  analysis: { label: '分析节点', color: 'bg-blue-500/20 border-blue-500/50' },
  generation: { label: '生成节点', color: 'bg-green-500/20 border-green-500/50' },
}

// 节点状态类型
type NodeStatus = 'idle' | 'pending' | 'running' | 'success' | 'error'

export function WorkflowEditor({
  projectId,
  initialNodes = [],
  initialEdges = [],
  className,
}: WorkflowEditorProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes)
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({})
  const [isExecuting, setIsExecuting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  
  // 连接状态
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string
    handle: string
    type: 'output' | 'input'
  } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })

  // 添加节点
  const addNode = useCallback((type: string, x: number, y: number) => {
    const id = `${type}_${Date.now()}`
    
    const newNode: WorkflowNode = {
      id,
      type,
      position: { x, y },
      data: {},
    }
    
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeId(id)
    return newNode
  }, [])

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
    setNodeStatuses((prev) => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
  }, [])

  // 更新节点位置
  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, position: { x, y } } : n
      )
    )
  }, [])

  // 开始连接
  const startConnection = useCallback((
    nodeId: string,
    handle: string,
    type: 'output' | 'input',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    e.preventDefault()
    setConnectingFrom({ nodeId, handle, type })
    
    // 获取起始点位置
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      })
    }
  }, [pan, zoom])

  // 完成连接
  const finishConnection = useCallback((
    targetNodeId: string,
    targetHandle: string,
    type: 'output' | 'input'
  ) => {
    if (!connectingFrom) return
    
    // 确保连接方向正确：output -> input
    let sourceId: string, sourceHandle: string, targetId: string, targetHandleFinal: string
    
    if (connectingFrom.type === 'output' && type === 'input') {
      sourceId = connectingFrom.nodeId
      sourceHandle = connectingFrom.handle
      targetId = targetNodeId
      targetHandleFinal = targetHandle
    } else if (connectingFrom.type === 'input' && type === 'output') {
      sourceId = targetNodeId
      sourceHandle = targetHandle
      targetId = connectingFrom.nodeId
      targetHandleFinal = connectingFrom.handle
    } else {
      // 同类型端口不能连接
      setConnectingFrom(null)
      return
    }
    
    // 不能连接自己
    if (sourceId === targetId) {
      setConnectingFrom(null)
      return
    }
    
    // 检查是否已存在连接到同一输入端口
    const exists = edges.some(
      (e) => e.target === targetId && e.targetHandle === targetHandleFinal
    )
    
    if (!exists) {
      const edgeId = `edge_${sourceId}_${sourceHandle}_${targetId}_${targetHandleFinal}`
      const newEdge: WorkflowEdge = {
        id: edgeId,
        source: sourceId,
        sourceHandle,
        target: targetId,
        targetHandle: targetHandleFinal,
      }
      setEdges((prev) => [...prev, newEdge])
    }
    
    setConnectingFrom(null)
  }, [connectingFrom, edges])

  // 删除连接
  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId))
  }, [])

  // 执行工作流
  const executeWorkflow = useCallback(async () => {
    if (isExecuting) return
    
    // 重置所有节点状态
    const newStatuses: Record<string, NodeStatus> = {}
    nodes.forEach(n => {
      newStatuses[n.id] = 'pending'
    })
    setNodeStatuses(newStatuses)
    setIsExecuting(true)
    
    try {
      // 按拓扑顺序执行
      const executed = new Set<string>()
      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      const inDegree = new Map<string, number>()
      
      // 计算入度
      nodes.forEach(n => inDegree.set(n.id, 0))
      edges.forEach(e => {
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
      })
      
      // 拓扑排序执行
      const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id)
      const results: Record<string, unknown> = {}
      
      while (queue.length > 0) {
        const nodeId = queue.shift()!
        const node = nodeMap.get(nodeId)
        if (!node) continue
        
        // 更新状态为运行中
        setNodeStatuses(prev => ({ ...prev, [nodeId]: 'running' }))
        
        try {
          // 准备输入数据
          const inputs: Record<string, unknown> = {}
          edges
            .filter(e => e.target === nodeId)
            .forEach(e => {
              const sourceResult = results[e.source]
              if (sourceResult && typeof sourceResult === 'object') {
                inputs[e.targetHandle!] = (sourceResult as Record<string, unknown>)[e.sourceHandle!]
              }
            })
          
          // 调用执行 API
          const response = await fetch('/api/workflow/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              nodeType: node.type,
              nodeId: node.id,
              inputs,
            }),
          })
          
          const result = await response.json()
          
          if (result.success) {
            results[nodeId] = result.data?.output || {}
            setNodeStatuses(prev => ({ ...prev, [nodeId]: 'success' }))
          } else {
            setNodeStatuses(prev => ({ ...prev, [nodeId]: 'error' }))
            console.error(`Node ${nodeId} failed:`, result.error)
          }
        } catch (err) {
          setNodeStatuses(prev => ({ ...prev, [nodeId]: 'error' }))
          console.error(`Node ${nodeId} error:`, err)
        }
        
        executed.add(nodeId)
        
        // 更新后续节点的入度
        edges
          .filter(e => e.source === nodeId)
          .forEach(e => {
            const newDegree = (inDegree.get(e.target) || 1) - 1
            inDegree.set(e.target, newDegree)
            if (newDegree === 0 && !executed.has(e.target)) {
              queue.push(e.target)
            }
          })
        
        // 添加短暂延迟，让 UI 更新
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (err) {
      console.error('Workflow execution error:', err)
    } finally {
      setIsExecuting(false)
    }
  }, [projectId, nodes, edges, isExecuting])

  // 处理缩放
  const handleZoom = useCallback((delta: number) => {
    setZoom((prev) => Math.min(2, Math.max(0.5, prev + delta)))
  }, [])

  // 处理平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom
      })
    }
    
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x
      const dy = e.clientY - lastMousePos.current.y
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }
  }, [isPanning, pan, zoom])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    if (connectingFrom) {
      setConnectingFrom(null)
    }
  }, [connectingFrom])

  // 获取节点端口位置
  const getNodePortPosition = useCallback((
    node: WorkflowNode,
    handleName: string,
    type: 'input' | 'output'
  ): { x: number; y: number } | null => {
    if (!node.position) return null
    const config = NODE_CONFIG[node.type]
    if (!config) return null
    
    const portList = type === 'input' ? config.inputs : config.outputs
    const index = portList.findIndex(p => p.name === handleName)
    if (index === -1) return null
    
    // 节点尺寸常量（精确测量）
    const NODE_WIDTH = 208       // w-52 = 13rem = 208px
    const HEADER_HEIGHT = 40     // 节点头部高度
    const PORT_ROW_HEIGHT = 24   // 每个端口行高度
    const PORT_PADDING_Y = 8     // 端口区域内边距垂直方向 (py-2)
    const PORT_PADDING_X = 12    // 端口区域内边距水平方向 (px-3)
    const DIVIDER_HEIGHT = 1     // 分隔线高度 (border-t)
    const PORT_DOT_RADIUS = 6    // 端口圆点半径
    
    // 计算输入端口区域高度
    const inputCount = config.inputs?.length || 0
    const inputSectionHeight = inputCount > 0 
      ? inputCount * PORT_ROW_HEIGHT + PORT_PADDING_Y * 2 
      : 0
    
    if (type === 'input') {
      // 输入端口在头部下方，左侧
      return {
        x: node.position.x + PORT_PADDING_X + PORT_DOT_RADIUS,
        y: node.position.y + HEADER_HEIGHT + PORT_PADDING_Y + index * PORT_ROW_HEIGHT + 2
      }
    } else {
      // 输出端口在输入端口下方，有分隔线，右侧
      return {
        x: node.position.x + NODE_WIDTH - PORT_PADDING_X - PORT_DOT_RADIUS,
        y: node.position.y + HEADER_HEIGHT + inputSectionHeight + DIVIDER_HEIGHT + PORT_PADDING_Y + index * PORT_ROW_HEIGHT + 8
      }
    }
  }, [])

  // 渲染连接线
  const renderEdge = useCallback((edge: WorkflowEdge) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!sourceNode?.position || !targetNode?.position) return null

    const startPos = getNodePortPosition(sourceNode, edge.sourceHandle || '', 'output')
    const endPos = getNodePortPosition(targetNode, edge.targetHandle || '', 'input')
    if (!startPos || !endPos) return null

    const midX = (startPos.x + endPos.x) / 2
    
    // 获取源节点的颜色
    const sourceConfig = NODE_CONFIG[sourceNode.type]
    const edgeColor = sourceConfig?.color || '#3b82f6'

    return (
      <g key={edge.id} className="group cursor-pointer" style={{ pointerEvents: 'stroke' }}>
        {/* 更宽的透明路径用于点击 */}
        <path
          d={`M ${startPos.x} ${startPos.y} C ${midX} ${startPos.y}, ${midX} ${endPos.y}, ${endPos.x} ${endPos.y}`}
          fill="none"
          stroke="transparent"
          strokeWidth="16"
          style={{ pointerEvents: 'stroke' }}
          onClick={() => deleteEdge(edge.id)}
        />
        {/* 可见的连接线 */}
        <path
          d={`M ${startPos.x} ${startPos.y} C ${midX} ${startPos.y}, ${midX} ${endPos.y}, ${endPos.x} ${endPos.y}`}
          fill="none"
          stroke={edgeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="transition-all duration-200"
          style={{ pointerEvents: 'none' }}
        />
        {/* 连接点动画效果 */}
        <circle
          cx={startPos.x}
          cy={startPos.y}
          r="4"
          fill={edgeColor}
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={endPos.x}
          cy={endPos.y}
          r="4"
          fill={edgeColor}
          style={{ pointerEvents: 'none' }}
        />
      </g>
    )
  }, [nodes, getNodePortPosition, deleteEdge])

  // 渲染连接预览线
  const renderConnectingLine = useCallback(() => {
    if (!connectingFrom) return null
    
    const sourceNode = nodes.find(n => n.id === connectingFrom.nodeId)
    if (!sourceNode?.position) return null
    
    const startPos = getNodePortPosition(
      sourceNode, 
      connectingFrom.handle, 
      connectingFrom.type
    )
    if (!startPos) return null

    const midX = (startPos.x + mousePos.x) / 2
    
    // 获取源节点的颜色
    const sourceConfig = NODE_CONFIG[sourceNode.type]
    const edgeColor = sourceConfig?.color || '#3b82f6'

    return (
      <g style={{ pointerEvents: 'none' }}>
        <path
          d={`M ${startPos.x} ${startPos.y} C ${midX} ${startPos.y}, ${midX} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
          fill="none"
          stroke={edgeColor}
          strokeWidth="2.5"
          strokeDasharray="8,4"
          strokeLinecap="round"
        />
        <circle
          cx={startPos.x}
          cy={startPos.y}
          r="5"
          fill={edgeColor}
        />
      </g>
    )
  }, [connectingFrom, nodes, mousePos, getNodePortPosition])

  return (
    <div className={cn('flex h-full', className)}>
      {/* 节点面板 */}
      <div className="w-64 border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium">节点库</h3>
          <p className="text-xs text-muted-foreground mt-1">拖拽节点到画布</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {Object.entries(CATEGORY_CONFIG).map(([category, catConfig]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 px-1">
                  {catConfig.label}
                </h4>
                <div className="space-y-1">
                  {Object.entries(NODE_CONFIG)
                    .filter(([, config]) => config.category === category)
                    .map(([type, config]) => (
                      <div
                        key={type}
                        className="p-3 rounded-lg border border-border bg-card/50 cursor-grab hover:bg-accent/50 hover:border-primary/50 transition-all active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('nodeType', type)
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {config.description}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 编辑器主区域 */}
      <div className="flex-1 flex flex-col">
        {/* 工具栏 */}
        <div className="h-12 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoom(-0.1)}
              title="缩小"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoom(0.1)}
              title="放大"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
              title="重置视图"
            >
              重置
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={executeWorkflow}
              disabled={isExecuting || nodes.length === 0}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  执行工作流
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 画布 */}
        <div
          ref={canvasRef}
          className={cn(
            'flex-1 relative overflow-hidden bg-background',
            isPanning && 'cursor-grabbing',
            connectingFrom && 'cursor-crosshair'
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const nodeType = e.dataTransfer.getData('nodeType')
            if (nodeType) {
              const rect = canvasRef.current?.getBoundingClientRect()
              if (rect) {
                const x = (e.clientX - rect.left - pan.x) / zoom
                const y = (e.clientY - rect.top - pan.y) / zoom
                addNode(nodeType, x, y)
              }
            }
          }}
          onClick={() => {
            if (connectingFrom) {
              setConnectingFrom(null)
            }
            setSelectedNodeId(null)
          }}
        >
          {/* 网格背景 */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
          />

          {/* 节点容器 */}
          <div
            className="absolute inset-0 overflow-visible"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 连接线 SVG - 使用更大的范围确保覆盖所有可能的连接 */}
            <svg 
              className="absolute" 
              style={{ 
                overflow: 'visible',
                width: '1px',
                height: '1px',
                left: '0',
                top: '0',
              }}
            >
              <g style={{ transform: 'translate(0, 0)' }}>
                {edges.map(renderEdge)}
                {renderConnectingLine()}
              </g>
            </svg>

            {/* 节点 */}
            {nodes.map((node) => {
              const config = NODE_CONFIG[node.type]
              const isSelected = selectedNodeId === node.id
              const status = nodeStatuses[node.id] || 'idle'
              if (!config || !node.position) return null
              
              return (
                <div
                  key={node.id}
                  className={cn(
                    'absolute w-52 rounded-lg border-2 bg-card shadow-lg',
                    'select-none',
                    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    CATEGORY_CONFIG[config.category]?.color,
                    status === 'running' && 'animate-pulse',
                    status === 'success' && 'border-green-500',
                    status === 'error' && 'border-red-500'
                  )}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedNodeId(node.id)
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 0 && !connectingFrom) {
                      e.stopPropagation()
                      const startX = e.clientX
                      const startY = e.clientY
                      const startPosX = node.position!.x
                      const startPosY = node.position!.y

                      const handleMove = (moveEvent: MouseEvent) => {
                        const dx = (moveEvent.clientX - startX) / zoom
                        const dy = (moveEvent.clientY - startY) / zoom
                        updateNodePosition(node.id, startPosX + dx, startPosY + dy)
                      }

                      const handleUp = () => {
                        document.removeEventListener('mousemove', handleMove)
                        document.removeEventListener('mouseup', handleUp)
                      }

                      document.addEventListener('mousemove', handleMove)
                      document.addEventListener('mouseup', handleUp)
                    }
                  }}
                >
                  {/* 节点头部 */}
                  <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      {status === 'running' && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-50 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNode(node.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* 输入端口 */}
                  <div className="px-3 py-2 space-y-1">
                    {config.inputs.map((input) => {
                      const isConnected = edges.some(
                        e => e.target === node.id && e.targetHandle === input.name
                      )
                      return (
                        <div
                          key={input.name}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2 cursor-pointer transition-colors',
                              isConnected ? 'bg-primary border-primary' : 'bg-background hover:border-primary',
                              connectingFrom?.type === 'output' && 'hover:bg-primary/50'
                            )}
                            style={{ borderColor: isConnected ? config.color : config.color }}
                            onMouseUp={() => finishConnection(node.id, input.name, 'input')}
                          />
                          <span className="text-muted-foreground">{input.label}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* 输出端口 */}
                  <div className="px-3 py-2 border-t border-border/50 space-y-1">
                    {config.outputs.map((output) => {
                      const isConnected = edges.some(
                        e => e.source === node.id && e.sourceHandle === output.name
                      )
                      return (
                        <div
                          key={output.name}
                          className="flex items-center justify-end gap-2 text-xs"
                        >
                          <span className="text-muted-foreground">{output.label}</span>
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2 cursor-pointer transition-colors',
                              isConnected ? 'bg-primary border-primary' : 'bg-background hover:border-primary',
                              connectingFrom?.type === 'input' && 'hover:bg-primary/50'
                            )}
                            style={{ borderColor: isConnected ? config.color : config.color }}
                            onMouseDown={(e) => startConnection(node.id, output.name, 'output', e)}
                            onMouseUp={() => finishConnection(node.id, output.name, 'output')}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 空状态提示 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8" />
                </div>
                <p className="mb-2 font-medium">从左侧拖拽节点到此处</p>
                <p className="text-sm">点击输出端口拖拽到输入端口来连接节点</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 属性面板 */}
      {selectedNodeId && (
        <div className="w-72 border-l border-border bg-card/30 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-medium">节点属性</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedNodeId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {(() => {
                const node = nodes.find((n) => n.id === selectedNodeId)
                if (!node) return null
                const config = NODE_CONFIG[node.type]
                const status = nodeStatuses[node.id] || 'idle'
                
                return (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground">节点名称</label>
                      <p className="text-sm font-medium mt-1">{config?.label}</p>
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground">描述</label>
                      <p className="text-sm mt-1 text-muted-foreground">{config?.description}</p>
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground">分类</label>
                      <div className="mt-1">
                        <Badge variant="secondary">
                          {CATEGORY_CONFIG[config?.category || '']?.label || config?.category}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">状态</label>
                      <div className="flex items-center gap-2 mt-1">
                        {status === 'idle' && <span className="text-sm">等待执行</span>}
                        {status === 'pending' && <span className="text-sm text-amber-500">等待中</span>}
                        {status === 'running' && (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-sm">执行中</span>
                          </>
                        )}
                        {status === 'success' && (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-500">成功</span>
                          </>
                        )}
                        {status === 'error' && (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-500">失败</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">位置</label>
                      <p className="text-sm mt-1">
                        X: {Math.round(node.position?.x || 0)}, Y: {Math.round(node.position?.y || 0)}
                      </p>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteNode(node.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除节点
                    </Button>
                  </div>
                )
              })()}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

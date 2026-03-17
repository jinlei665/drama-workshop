/**
 * 工作流编辑器组件
 * 参考 ComfyUI 的节点式设计
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play,
  Pause,
  Save,
  ZoomIn,
  ZoomOut,
  Move,
  Trash2,
  Settings,
  ChevronRight
} from 'lucide-react'
import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

interface WorkflowEditorProps {
  projectId: string
  initialNodes?: WorkflowNode[]
  initialEdges?: WorkflowEdge[]
  className?: string
}

// 节点类型配置
const NODE_CONFIG: Record<string, {
  category: string
  color: string
  inputs: string[]
  outputs: string[]
}> = {
  analyze_content: {
    category: 'analysis',
    color: '#3b82f6',
    inputs: ['content'],
    outputs: ['summary', 'themes', 'tone', 'structure'],
  },
  extract_characters: {
    category: 'analysis',
    color: '#3b82f6',
    inputs: ['content', 'existingCharacters'],
    outputs: ['characters'],
  },
  generate_storyboard: {
    category: 'generation',
    color: '#10b981',
    inputs: ['content', 'characters', 'style', 'episodeCount'],
    outputs: ['scenes'],
  },
  generate_character_image: {
    category: 'generation',
    color: '#10b981',
    inputs: ['character', 'style'],
    outputs: ['imageUrl', 'characterId'],
  },
  generate_scene_image: {
    category: 'generation',
    color: '#10b981',
    inputs: ['scene', 'characters', 'style'],
    outputs: ['imageUrl', 'sceneId'],
  },
  generate_video: {
    category: 'generation',
    color: '#10b981',
    inputs: ['imageUrl', 'prompt', 'duration'],
    outputs: ['videoUrl'],
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  analysis: 'bg-blue-500/20 border-blue-500/50',
  generation: 'bg-green-500/20 border-green-500/50',
}

export function WorkflowEditor({
  projectId,
  initialNodes = [],
  initialEdges = [],
  className,
}: WorkflowEditorProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes)
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })

  // 添加节点
  const addNode = useCallback((type: string, x: number, y: number) => {
    const id = `${type}_${Date.now()}`
    const config = NODE_CONFIG[type]
    
    const newNode: WorkflowNode = {
      id,
      type,
      position: { x, y },
      data: {},
    }
    
    setNodes((prev) => [...prev, newNode])
    return newNode
  }, [])

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
  }, [])

  // 更新节点位置
  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, position: { x, y } } : n
      )
    )
  }, [])

  // 连接节点
  const connectNodes = useCallback((
    sourceId: string,
    sourceHandle: string,
    targetId: string,
    targetHandle: string
  ) => {
    const edgeId = `edge_${sourceId}_${sourceHandle}_${targetId}_${targetHandle}`
    
    // 检查是否已存在连接
    const exists = edges.some(
      (e) =>
        e.target === targetId && e.targetHandle === targetHandle
    )
    
    if (exists) return

    const newEdge: WorkflowEdge = {
      id: edgeId,
      source: sourceId,
      sourceHandle,
      target: targetId,
      targetHandle,
    }
    
    setEdges((prev) => [...prev, newEdge])
  }, [edges])

  // 执行工作流
  const executeWorkflow = useCallback(async () => {
    if (isExecuting) return
    
    setIsExecuting(true)
    
    try {
      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          nodes,
          edges,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setExecutionId(result.data.executionId)
        // TODO: 轮询获取执行状态
      } else {
        console.error('Execution failed:', result.error)
      }
    } catch (err) {
      console.error('Execution error:', err)
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
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x
      const dy = e.clientY - lastMousePos.current.y
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  return (
    <div className={cn('flex h-full', className)}>
      {/* 节点面板 */}
      <div className="w-64 border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium">节点库</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {Object.entries(
              Object.entries(NODE_CONFIG).reduce((acc, [type, config]) => {
                if (!acc[config.category]) {
                  acc[config.category] = []
                }
                acc[config.category].push({ type, ...config })
                return acc
              }, {} as Record<string, Array<{ type: string; category: string; color: string; inputs: string[]; outputs: string[] }>>)
            ).map(([category, categoryNodes]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  {category === 'analysis' ? '分析节点' : '生成节点'}
                </h4>
                <div className="space-y-1">
                  {categoryNodes.map(({ type, color }) => (
                    <Card
                      key={type}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('nodeType', type)
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm">
                            {type.split('_').map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(' ')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
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
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="outline" size="sm">
              <Move className="h-4 w-4 mr-1" />
              平移
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
            <Button
              size="sm"
              onClick={executeWorkflow}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <Pause className="h-4 w-4 mr-1" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              {isExecuting ? '执行中...' : '执行'}
            </Button>
          </div>
        </div>

        {/* 画布 */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-background"
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
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 连接线 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {edges.map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source)
                const targetNode = nodes.find((n) => n.id === edge.target)
                if (!sourceNode || !targetNode || !sourceNode.position || !targetNode.position) return null

                const config = NODE_CONFIG[sourceNode.type]
                const outputIndex = config?.outputs.indexOf(edge.sourceHandle || '') || 0
                const inputConfig = NODE_CONFIG[targetNode.type]
                const inputIndex = inputConfig?.inputs.indexOf(edge.targetHandle || '') || 0

                const x1 = sourceNode.position.x + 200
                const y1 = sourceNode.position.y + 60 + outputIndex * 20
                const x2 = targetNode.position.x
                const y2 = targetNode.position.y + 60 + inputIndex * 20

                const midX = (x1 + x2) / 2

                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    className="opacity-50"
                  />
                )
              })}
            </svg>

            {/* 节点 */}
            {nodes.map((node) => {
              const config = NODE_CONFIG[node.type]
              const isSelected = selectedNodeId === node.id
              if (!node.position) return null
              
              return (
                <div
                  key={node.id}
                  className={cn(
                    'absolute w-48 rounded-lg border-2 bg-card shadow-lg',
                    'cursor-move select-none',
                    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    CATEGORY_COLORS[config?.category || '']
                  )}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                  }}
                  onClick={() => setSelectedNodeId(node.id)}
                  onMouseDown={(e) => {
                    if (e.button === 0 && node.position) {
                      e.stopPropagation()
                      const startX = e.clientX
                      const startY = e.clientY
                      const startPosX = node.position.x
                      const startPosY = node.position.y

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
                    <span className="text-sm font-medium">
                      {node.type.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNode(node.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* 输入端口 */}
                  <div className="px-3 py-2 space-y-1">
                    {config?.inputs.map((input, i) => (
                      <div
                        key={input}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className="w-2 h-2 rounded-full border-2 border-current"
                          style={{ borderColor: config.color }}
                        />
                        <span className="text-muted-foreground">{input}</span>
                      </div>
                    ))}
                  </div>

                  {/* 输出端口 */}
                  <div className="px-3 py-2 border-t border-border/50 space-y-1">
                    {config?.outputs.map((output) => (
                      <div
                        key={output}
                        className="flex items-center justify-end gap-2 text-xs"
                      >
                        <span className="text-muted-foreground">{output}</span>
                        <div
                          className="w-2 h-2 rounded-full border-2"
                          style={{ borderColor: config.color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 空状态提示 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="mb-2">从左侧拖拽节点到此处开始创建工作流</p>
                <p className="text-sm">或从模板快速开始</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 属性面板 */}
      {selectedNodeId && (
        <div className="w-72 border-l border-border bg-card/30">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-medium">节点属性</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNodeId(null)}
            >
              ×
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {(() => {
                const node = nodes.find((n) => n.id === selectedNodeId)
                if (!node) return null
                const config = NODE_CONFIG[node.type]
                
                return (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground">类型</label>
                      <p className="text-sm font-medium mt-1">
                        {node.type.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs text-muted-foreground">分类</label>
                      <Badge variant="secondary" className="mt-1">
                        {config?.category === 'analysis' ? '分析' : '生成'}
                      </Badge>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">位置</label>
                      <p className="text-sm mt-1">
                        ({Math.round(node.position?.x || 0)}, {Math.round(node.position?.y || 0)})
                      </p>
                    </div>
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

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  Edit3,
  Check,
  X,
  Copy
} from 'lucide-react'
import type { BaseNode, Edge } from '@/lib/workflow/types'

// 导出类型
export type { WorkflowEditorV2Props }

export interface WorkflowEditorV2Props {
  initialNodes?: BaseNode[]
  initialEdges?: Edge[]
  onSave?: (workflow: { nodes: BaseNode[]; edges: Edge[] }) => void
  onExecute?: () => void
  readOnly?: boolean
}

export default function WorkflowEditorV2({
  initialNodes = [],
  initialEdges = [],
  onSave,
  onExecute,
  readOnly = false,
}: WorkflowEditorV2Props) {
  console.log('🎬 WorkflowEditorV2 初始化:', { initialNodes, initialEdges, readOnly })

  // 状态管理
  const [nodes, setNodes] = useState<BaseNode[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [selectedNode, setSelectedNode] = useState<BaseNode | null>(null)
  const [draggedNode, setDraggedNode] = useState<BaseNode | null>(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }) // 节点拖动时的原始位置
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }) // 鼠标相对于节点左上角的偏移
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; portId: string; type: 'input' | 'output' } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [nodeParams, setNodeParams] = useState<Record<string, any>>({})
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isRunning, setIsRunning] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const id = React.useId()

  // 初始化节点参数
  useEffect(() => {
    // 只有当 initialNodes 真正变化时才更新
    const newParams: Record<string, any> = {}
    let hasChanged = false

    // 检查是否有新的节点或参数变化
    initialNodes.forEach(node => {
      if (node.params) {
        // 深度比较，避免不必要的更新
        const existingParams = nodeParams[node.id]
        const paramsString = JSON.stringify(node.params)
        const existingParamsString = existingParams ? JSON.stringify(existingParams) : null

        if (paramsString !== existingParamsString) {
          newParams[node.id] = { ...node.params }
          hasChanged = true
        }
      }
    })

    if (hasChanged) {
      setNodeParams(prev => ({ ...prev, ...newParams }))
    }
  }, [JSON.stringify(initialNodes)]) // 使用字符串化后的值作为依赖

  // 计算端口位置
  const getPortPosition = useCallback((node: BaseNode, portId: string, type: 'input' | 'output') => {
    const portList = type === 'input' ? node.inputs : node.outputs
    if (!portList) {
      console.warn(`⚠️ 节点 ${node.id} 没有 ${type} 端口列表`)
      return null
    }

    const portIndex = portList.findIndex(p => p.id === portId)
    if (portIndex === -1) {
      console.warn(`⚠️ 端口 ${portId} 在节点 ${node.id} 中不存在`)
      return null
    }

    // 节点尺寸常量
    const nodeWidth = 280
    const headerHeight = 48
    const portItemHeight = 32
    const portListPadding = 12

    // 计算端口中心位置
    const portY = headerHeight + portListPadding + portIndex * portItemHeight + portItemHeight / 2
    const portX = type === 'input' ? 0 : nodeWidth

    // 转换为容器坐标
    const position = {
      x: node.position.x + portX,
      y: node.position.y + portY,
    }

    console.log(`📍 端口位置计算:`, { node, portId, type, portIndex, position })

    return position
  }, [])

  // 更新节点参数
  const updateNodeParam = (nodeId: string, key: string, value: any) => {
    setNodeParams(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        [key]: value,
      },
    }))
  }

  // 节点类型颜色映射
  const getNodeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      'text-input': 'bg-blue-500',
      'image-input': 'bg-green-500',
      'video-input': 'bg-cyan-500',
      'audio-input': 'bg-purple-500',
      'script-input': 'bg-blue-600',
      'text-to-image': 'bg-pink-500',
      'image-to-image': 'bg-pink-600',
      'image-to-video': 'bg-orange-500',
      'text-to-video': 'bg-orange-600',
      'text-to-audio': 'bg-teal-500',
      'llm-process': 'bg-violet-500',
      'text-to-character': 'bg-green-600',
      'character-triple-views': 'bg-green-700',
      'text-to-voice': 'bg-teal-600',
      'script-to-scenes': 'bg-indigo-500',
      'inpaint': 'bg-yellow-500',
      'outpaint': 'bg-yellow-600',
      'upscale': 'bg-amber-500',
      'remove-bg': 'bg-red-500',
      'image-blend': 'bg-lime-500',
      'layer-merge': 'bg-emerald-500',
      'video-compose': 'bg-fuchsia-500',
      'export-image': 'bg-sky-500',
      'export-video': 'bg-sky-600',
      'export-audio': 'bg-sky-700',
    }
    return colorMap[type] || 'bg-gray-500'
  }

  // 添加节点
  const addNode = (nodeType: string) => {
    const newNode: BaseNode = {
      id: `node-${Date.now()}`,
      type: nodeType as any,
      name: getNodeName(nodeType),
      description: getNodeDescription(nodeType),
      position: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
      inputs: getNodeInputs(nodeType),
      outputs: getNodeOutputs(nodeType),
      params: {},
      status: 'idle',
    }

    console.log('➕ 创建新节点:', newNode)
    setNodes(prev => [...prev, newNode])

    // 初始化节点参数
    const defaultParams = getDefaultParams(nodeType)
    if (Object.keys(defaultParams).length > 0) {
      setTimeout(() => {
        setNodeParams(prev => ({
          ...prev,
          [newNode.id]: defaultParams,
        }))
      }, 0)
    }
  }

  // 获取节点默认参数
  const getDefaultParams = (nodeType: string) => {
    const paramsMap: Record<string, any> = {
      'script-input': {
        script: '',
        description: '',
      },
      'text-to-image': {
        prompt: '',
        style: 'realistic',
      },
      'image-to-video': {
        duration: 5,
        aspectRatio: '16:9',
      },
      'text-to-audio': {
        text: '',
        voice: 'zh_female_qingxin',
      },
      'text-to-character': {
        description: '',
      },
      'script-to-scenes': {
        script: '',
      },
      'llm-process': {
        prompt: '',
      },
      'video-compose': {
        videos: [],
      },
    }
    return paramsMap[nodeType] || {}
  }

  // 获取节点名称
  const getNodeName = (type: string): string => {
    const nameMap: Record<string, string> = {
      'script-input': '脚本输入',
      'text-to-image': '生成图像',
      'image-to-video': '生成视频',
      'text-to-audio': '生成语音',
      'text-to-character': '创建角色',
      'script-to-scenes': '分镜分析',
      'llm-process': 'LLM 处理',
      'video-compose': '视频合成',
    }
    return nameMap[type] || type
  }

  // 获取节点描述
  const getNodeDescription = (type: string): string => {
    const descMap: Record<string, string> = {
      'script-input': '输入脚本内容',
      'text-to-image': '根据描述生成图像',
      'image-to-video': '根据图像生成视频',
      'text-to-audio': '根据文本生成语音',
      'text-to-character': '根据描述创建角色',
      'script-to-scenes': '分析脚本生成分镜',
      'llm-process': '使用大语言模型处理',
      'video-compose': '合成多个视频片段',
    }
    return descMap[type] || ''
  }

  // 获取节点输入端口
  const getNodeInputs = (type: string) => {
    const inputsMap: Record<string, any[]> = {
      'script-input': [],
      'text-to-image': [
        { id: 'prompt', name: '提示词', type: 'text', required: true, connected: false },
      ],
      'image-to-video': [
        { id: 'image', name: '首帧图像', type: 'image', required: true, connected: false },
        { id: 'lastFrameImage', name: '尾帧图像', type: 'image', required: false, connected: false },
      ],
      'text-to-audio': [
        { id: 'text', name: '文本', type: 'text', required: true, connected: false },
      ],
      'text-to-character': [
        { id: 'description', name: '描述', type: 'text', required: true, connected: false },
      ],
      'script-to-scenes': [
        { id: 'script', name: '脚本', type: 'text', required: true, connected: false },
      ],
      'llm-process': [
        { id: 'input', name: '输入', type: 'any', required: true, connected: false },
      ],
      'video-compose': [
        { id: 'videos', name: '视频列表', type: 'any', required: true, connected: false },
      ],
    }
    return inputsMap[type] || []
  }

  // 获取节点输出端口
  const getNodeOutputs = (type: string) => {
    const outputsMap: Record<string, any[]> = {
      'script-input': [
        { id: 'script', name: '脚本', type: 'text', required: false, connected: false },
      ],
      'text-to-image': [
        { id: 'image', name: '图像', type: 'image', required: false, connected: false },
      ],
      'image-to-video': [
        { id: 'video', name: '视频', type: 'video', required: false, connected: false },
      ],
      'text-to-audio': [
        { id: 'audio', name: '语音', type: 'audio', required: false, connected: false },
      ],
      'text-to-character': [
        { id: 'character', name: '角色', type: 'any', required: false, connected: false },
        { id: 'image', name: '图像', type: 'image', required: false, connected: false },
      ],
      'script-to-scenes': [
        { id: 'scenes', name: '分镜', type: 'any', required: false, connected: false },
      ],
      'llm-process': [
        { id: 'output', name: '输出', type: 'any', required: false, connected: false },
      ],
      'video-compose': [
        { id: 'video', name: '视频', type: 'video', required: false, connected: false },
      ],
    }
    return outputsMap[type] || []
  }

  // 删除节点
  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
    setSelectedNode(null)
  }

  // 删除连线
  const deleteEdge = (edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId))
  }

  // 处理端口连接
  const handlePortConnect = (targetNodeId: string, targetPortId: string) => {
    console.log('🔌 尝试连接端口:', { connectingFrom, targetNodeId, targetPortId })

    if (!connectingFrom) {
      console.warn('❌ connectingFrom 为空')
      return
    }

    // 禁止连接到同一节点的端口
    if (connectingFrom.nodeId === targetNodeId) {
      console.warn('❌ 不能连接到同一节点')
      setConnectingFrom(null)
      return
    }

    // 禁止 input 连接到 input，output 连接到 output
    if (connectingFrom.type === 'input') {
      console.warn('❌ 不能从 input 连接到 input')
      setConnectingFrom(null)
      return
    }

    // 检查是否已存在连接（检查端口级别）
    const existingEdge = edges.find(
      e => e.from === connectingFrom.nodeId && e.to === targetNodeId &&
          e.fromPort === connectingFrom.portId && e.toPort === targetPortId
    )
    if (existingEdge) {
      console.warn('❌ 连接已存在:', existingEdge)
      setConnectingFrom(null)
      return
    }

    // 创建新连接
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      from: connectingFrom.nodeId,
      fromPort: connectingFrom.portId,
      to: targetNodeId,
      toPort: targetPortId,
    }

    console.log('✅ 创建新连接:', newEdge)
    setEdges(prev => {
      const newEdges = [...prev, newEdge]
      console.log('当前连线数量:', newEdges.length)
      return newEdges
    })
    setConnectingFrom(null)
  }

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }

    if (draggedNode) {
      // 计算鼠标在画布上的位置（考虑平移和缩放）
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const mouseXInCanvas = (e.clientX - rect.left - pan.x) / zoom
        const mouseYInCanvas = (e.clientY - rect.top - pan.y) / zoom

        // 新位置 = 鼠标在画布上的位置 - 鼠标相对于节点左上角的偏移
        const newX = mouseXInCanvas - dragOffset.x
        const newY = mouseYInCanvas - dragOffset.y

        setNodes(prev =>
          prev.map(n =>
            n.id === draggedNode.id ? { ...n, position: { x: newX, y: newY } } : n
          )
        )
      }
    }

    // 更新鼠标位置
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    setDraggedNode(null)
  }

  // 添加全局事件监听
  useEffect(() => {
    console.log('📊 画布状态变化:', { isPanning, draggedNode, pan, zoom, nodesCount: nodes.length, edgesCount: edges.length })

    if (isPanning || draggedNode) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isPanning, draggedNode, panStart, dragOffset, pan, zoom, nodes.length, edges.length])

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const newZoom = Math.max(0.1, Math.min(2, zoom - e.deltaY * 0.001))
      setZoom(newZoom)
    }
  }

  // 保存工作流
  const handleSave = () => {
    const workflow = {
      nodes: nodes.map(node => ({
        ...node,
        params: nodeParams[node.id] || {},
      })),
      edges,
    }
    onSave?.(workflow)
  }

  // 执行工作流
  const handleExecute = () => {
    setIsRunning(true)
    setTimeout(() => {
      setIsRunning(false)
      onExecute?.()
    }, 2000)
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">工作流编辑器</h3>
          <span className="text-sm text-muted-foreground">V2</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPan({ x: 0, y: 0 })
              setZoom(1)
            }}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            保存
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            disabled={isRunning || readOnly}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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
        {/* 左侧面板 - 节点列表（只读模式下隐藏） */}
        {!readOnly && (
          <div className="w-72 border-r bg-background/95 backdrop-blur overflow-y-auto p-4">
            <h4 className="font-semibold mb-4">添加节点</h4>
            <div className="space-y-2">
              {/* 脚本输入节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('script-input')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                  <span className="font-medium text-sm">脚本输入</span>
                </div>
                <p className="text-xs text-muted-foreground">输入脚本内容</p>
              </div>

              {/* 图像生成节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('text-to-image')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-pink-500" />
                  <span className="font-medium text-sm">生成图像</span>
                </div>
                <p className="text-xs text-muted-foreground">根据描述生成图像</p>
              </div>

              {/* 视频生成节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('image-to-video')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="font-medium text-sm">生成视频</span>
                </div>
                <p className="text-xs text-muted-foreground">根据图像生成视频</p>
              </div>

              {/* 语音生成节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('text-to-audio')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                  <span className="font-medium text-sm">生成语音</span>
                </div>
                <p className="text-xs text-muted-foreground">根据文本生成语音</p>
              </div>

              {/* 角色创建节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('text-to-character')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-green-600" />
                  <span className="font-medium text-sm">创建角色</span>
                </div>
                <p className="text-xs text-muted-foreground">根据描述创建角色</p>
              </div>

              {/* 分镜分析节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('script-to-scenes')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="font-medium text-sm">分镜分析</span>
                </div>
                <p className="text-xs text-muted-foreground">分析脚本生成分镜</p>
              </div>

              {/* LLM 处理节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('llm-process')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-violet-500" />
                  <span className="font-medium text-sm">LLM 处理</span>
                </div>
                <p className="text-xs text-muted-foreground">使用大语言模型处理</p>
              </div>

              {/* 视频合成节点 */}
              <div
                className="p-3 text-left rounded-lg border bg-card hover:bg-accent transition-colors cursor-pointer"
                onClick={() => addNode('video-compose')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-fuchsia-500" />
                  <span className="font-medium text-sm">视频合成</span>
                </div>
                <p className="text-xs text-muted-foreground">合成多个视频片段</p>
              </div>
            </div>
          </div>
        )}

        {/* 画布区域 */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-grid-pattern"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          style={{
            cursor: isPanning ? 'grabbing' : 'default',
          }}
        >
          {/* 背景网格 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            }}
          />

          {/* 画布容器 - 应用变换 */}
          <div
            className="absolute inset-0 overflow-visible pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 连线 SVG */}
            <svg
              className="absolute inset-0 pointer-events-none overflow-visible"
              width="100%"
              height="100%"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '10000px',
                height: '10000px',
              }}
            >
              <defs>
                <marker
                  id={`arrowhead-${id}`}
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
                </marker>
              </defs>

              {/* 绘制连线 */}
              {edges.map((edge) => {
                const sourceNode = nodes.find(n => n.id === edge.from)
                const targetNode = nodes.find(n => n.id === edge.to)
                if (!sourceNode || !targetNode) return null

                const startPos = getPortPosition(sourceNode, edge.fromPort || '', 'output')
                const endPos = getPortPosition(targetNode, edge.toPort || '', 'input')
                if (!startPos || !endPos) {
                  console.warn(`连线 ${edge.id}: 端口位置获取失败`, { startPos, endPos })
                  return null
                }

                const midX = (startPos.x + endPos.x) / 2
                const midY = (startPos.y + endPos.y) / 2

                return (
                  <g key={edge.id} className="cursor-pointer">
                    {/* 贝塞尔曲线 */}
                    <path
                      d={`M ${startPos.x} ${startPos.y} C ${midX} ${startPos.y}, ${midX} ${endPos.y}, ${endPos.x} ${endPos.y}`}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!readOnly) deleteEdge(edge.id)
                      }}
                    />
                    <circle cx={startPos.x} cy={startPos.y} r="4" fill="hsl(var(--primary))" />
                    <circle cx={endPos.x} cy={endPos.y} r="4" fill="hsl(var(--primary))" />
                  </g>
                )
              })}

              {/* 连接预览线 */}
              {connectingFrom && (
                <g>
                  <path
                    d={`M ${mousePos.x} ${mousePos.y} L ${mousePos.x} ${mousePos.y}`}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                </g>
              )}
            </svg>

            {/* 节点 */}
            {nodes.map((node) => {
              const nodeColor = getNodeColor(node.type)
              const isSelected = selectedNode?.id === node.id

              return (
                <div
                  key={node.id}
                  className={`absolute pointer-events-auto rounded-lg border-2 bg-card shadow-lg ${
                    isSelected ? 'border-primary' : 'border-border'
                  }`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: 280,
                    zIndex: isSelected ? 100 : 1,
                  }}
                  onMouseDown={(e) => {
                    if (readOnly) return
                    e.stopPropagation()
                    console.log('🖱️ 点击节点:', node.name)
                    setSelectedNode(node)
                    setDraggedNode(node)

                    // 计算鼠标相对于节点左上角的偏移（在画布坐标系中）
                    if (containerRef.current) {
                      const containerRect = containerRef.current.getBoundingClientRect()
                      const mouseXInCanvas = (e.clientX - containerRect.left - pan.x) / zoom
                      const mouseYInCanvas = (e.clientY - containerRect.top - pan.y) / zoom

                      setDragOffset({
                        x: mouseXInCanvas - node.position.x,
                        y: mouseYInCanvas - node.position.y,
                      })
                      console.log('📐 节点拖动初始化:', {
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        mouseXInCanvas,
                        mouseYInCanvas,
                        nodePosition: node.position,
                        dragOffset: { x: mouseXInCanvas - node.position.x, y: mouseYInCanvas - node.position.y }
                      })
                    }
                  }}
                >
                  {/* 节点头部 */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${nodeColor} bg-opacity-20`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${nodeColor}`} />
                      <span className="font-medium text-sm">{node.name}</span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6"
                          onClick={() => deleteNode(node.id)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                          {/* 输入端口 */}
                  {node.inputs && node.inputs.length > 0 && (
                    <div className="px-3 py-2 space-y-1">
                      {node.inputs.map((port) => {
                        const isConnected = edges.some(
                          e => e.to === node.id && e.toPort === port.id
                        )

                        return (
                          <div
                            key={port.id}
                            className="relative flex items-center py-1 group"
                          >
                            <div
                              className={`absolute -left-3 w-6 h-6 rounded-full border-2 bg-background transition-colors cursor-pointer ${
                                isConnected ? 'border-primary' : 'border-border'
                              }`}
                              onMouseDown={(e) => {
                                if (readOnly) return
                                e.stopPropagation()
                                e.preventDefault()
                                console.log('🔌 点击输入端口:', { nodeId: node.id, portId: port.id })
                                setConnectingFrom({ nodeId: node.id, portId: port.id, type: 'input' })
                              }}
                              onMouseUp={(e) => {
                                if (readOnly) return
                                e.stopPropagation()
                                e.preventDefault()
                                console.log('🔌 释放到输入端口:', { nodeId: node.id, portId: port.id })
                                handlePortConnect(node.id, port.id)
                              }}
                            />
                            <span className="text-xs text-muted-foreground ml-3">{port.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 输出端口 */}
                  {node.outputs && node.outputs.length > 0 && (
                    <div className="px-3 py-2 space-y-1">
                      {node.outputs.map((port) => {
                        const isConnected = edges.some(
                          e => e.from === node.id && e.fromPort === port.id
                        )

                        return (
                          <div
                            key={port.id}
                            className="relative flex items-center justify-end py-1 group"
                          >
                            <span className="text-xs text-muted-foreground mr-3">{port.name}</span>
                            <div
                              className={`absolute -right-3 w-6 h-6 rounded-full border-2 bg-background transition-colors cursor-pointer ${
                                isConnected ? 'border-primary' : 'border-border'
                              }`}
                              onMouseDown={(e) => {
                                if (readOnly) return
                                e.stopPropagation()
                                e.preventDefault()
                                console.log('🔌 点击输出端口:', { nodeId: node.id, portId: port.id })
                                setConnectingFrom({ nodeId: node.id, portId: port.id, type: 'output' })
                              }}
                              onMouseUp={(e) => {
                                if (readOnly) return
                                e.stopPropagation()
                                e.preventDefault()
                                console.log('🔌 释放到输出端口:', { nodeId: node.id, portId: port.id })
                                handlePortConnect(node.id, port.id)
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 右侧面板 - 节点参数 */}
        {selectedNode && (
          <div className="w-72 border-l bg-background/95 backdrop-blur overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">节点参数</h4>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() => setSelectedNode(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Card className="p-4">
              <div className="space-y-3">
                <div>
                  <Label>节点ID</Label>
                  <Input
                    value={selectedNode.id}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>名称</Label>
                  <Input
                    value={selectedNode.name}
                    disabled
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>类型</Label>
                  <Input
                    value={selectedNode.type}
                    disabled
                    className="mt-1"
                  />
                </div>
                {selectedNode.description && (
                  <div>
                    <Label>描述</Label>
                    <Textarea
                      value={selectedNode.description}
                      disabled
                      className="mt-1 resize-none"
                      rows={2}
                    />
                  </div>
                )}

                {/* 动态参数表单 */}
                {selectedNode.type === 'script-input' && (
                  <>
                    <div>
                      <Label>脚本内容</Label>
                      <Textarea
                        value={nodeParams[selectedNode.id]?.script || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'script', e.target.value)}
                        placeholder="输入脚本内容..."
                        className="mt-1 min-h-[150px] resize-none"
                        rows={6}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>脚本描述</Label>
                      <Textarea
                        value={nodeParams[selectedNode.id]?.description || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'description', e.target.value)}
                        placeholder="输入脚本描述..."
                        className="mt-1 resize-none"
                        rows={2}
                        disabled={readOnly}
                      />
                    </div>
                  </>
                )}

                {selectedNode.type === 'text-to-image' && (
                  <>
                    <div>
                      <Label>提示词</Label>
                      <Textarea
                        value={nodeParams[selectedNode.id]?.prompt || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'prompt', e.target.value)}
                        placeholder="描述你想要生成的图像..."
                        className="mt-1 min-h-[100px] resize-none"
                        rows={4}
                        disabled={readOnly}
                      />
                    </div>
                  </>
                )}

                {selectedNode.type === 'image-to-video' && (
                  <>
                    <div>
                      <Label>时长 (秒)</Label>
                      <Input
                        type="number"
                        value={nodeParams[selectedNode.id]?.duration || 5}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'duration', parseInt(e.target.value))}
                        min={4}
                        max={15}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>视频比例</Label>
                      <select
                        value={nodeParams[selectedNode.id]?.aspectRatio || '16:9'}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'aspectRatio', e.target.value)}
                        className="w-full px-3 py-2 rounded-md border bg-background"
                        disabled={readOnly}
                      >
                        <option value="16:9">16:9 (横屏)</option>
                        <option value="9:16">9:16 (竖屏)</option>
                      </select>
                    </div>
                  </>
                )}

                {selectedNode.type === 'text-to-audio' && (
                  <>
                    <div>
                      <Label>文本</Label>
                      <Textarea
                        value={nodeParams[selectedNode.id]?.text || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'text', e.target.value)}
                        placeholder="输入要转换为语音的文本..."
                        className="mt-1 min-h-[100px] resize-none"
                        rows={4}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>语音</Label>
                      <Input
                        value={nodeParams[selectedNode.id]?.voice || 'zh_female_qingxin'}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'voice', e.target.value)}
                        placeholder="语音类型，如 zh_female_qingxin"
                        disabled={readOnly}
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

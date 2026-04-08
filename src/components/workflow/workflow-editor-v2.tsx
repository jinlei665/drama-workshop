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
  Copy,
  CheckCircle2,
  XCircle,
  Download
} from 'lucide-react'
import { toast } from 'sonner'
import type { BaseNode, Edge } from '@/lib/workflow/types'

// 节点注册在服务器端完成，客户端只使用类型定义

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

  // 保存节点参数的 ref，用于执行工作流
  const nodeParamsRef = useRef<Record<string, any>>({})

  // 同步 nodeParams 到 ref
  useEffect(() => {
    nodeParamsRef.current = nodeParams
  }, [nodeParams])

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

    // 节点尺寸常量（与 CSS 中的 width: 280 * zoom 对应）
    const nodeWidth = 280
    const headerHeight = 48
    const portItemHeight = 32
    const portListPadding = 12
    const portSize = 24 // 端口圆点大小

    // 计算端口中心位置（变换后的屏幕坐标，与节点和 CSS 定位一致）
    // 端口圆点位于节点边缘：
    // - 输入端口：left: 0，圆心在 left + portSize/2
    // - 输出端口：right: 0，圆心在 width - portSize/2
    const portY = headerHeight + portListPadding + portIndex * portItemHeight + portItemHeight / 2
    const portX = type === 'input' 
      ? portSize / 2  // 左边缘内侧，圆心向右偏移 portSize/2
      : nodeWidth - portSize / 2  // 右边缘内侧，圆心向左偏移 portSize/2

    // 转换为变换后的屏幕坐标（与节点 CSS left/top 一致）
    const position = {
      x: pan.x + (node.position.x + portX) * zoom,
      y: pan.y + (node.position.y + portY) * zoom,
    }

    console.log(`📍 端口位置计算:`, { node, portId, type, portIndex, position, portX, portY, pan, zoom })

    return position
  }, [pan, zoom])

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
      // 'text-to-audio': 'bg-teal-500',  // TODO: 出沙盒后无法使用，暂隐藏
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
        script: '这是一个示例脚本内容，请替换为您的实际脚本。',
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
      // 'text-to-audio': {  // TODO: 出沙盒后无法使用，暂隐藏
      //   text: '',
      //   voice: 'zh_female_qingxin',
      // },
      'text-to-character': {
        description: '',
        name: '',
        personality: '',
        projectId: '',
      },
      'script-to-scenes': {
        script: '',
        numScenes: 5,
        projectId: '',
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
      // 'text-to-audio': '生成语音',  // TODO: 出沙盒后无法使用，暂隐藏
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
      // 'text-to-audio': '根据文本生成语音',  // TODO: 出沙盒后无法使用，暂隐藏
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
        { id: 'prompt', name: '提示词', type: 'text', required: false, connected: false },
        { id: 'firstFrame', name: '首帧图像', type: 'image', required: true, connected: false },
        { id: 'lastFrame', name: '尾帧图像', type: 'image', required: false, connected: false },
      ],
      // 'text-to-audio': [  // TODO: 出沙盒后无法使用，暂隐藏
      //   { id: 'text', name: '文本', type: 'text', required: true, connected: false },
      // ],
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
      // 'text-to-audio': [  // TODO: 出沙盒后无法使用，暂隐藏
      //   { id: 'audio', name: '语音', type: 'audio', required: false, connected: false },
      // ],
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
    // 检查点击的目标是否是背景
    const isBackground = e.target === containerRef.current ||
                        (e.target as HTMLElement).classList.contains('bg-grid-pattern') ||
                        (e.target as HTMLElement).classList.contains('absolute')

    // 如果是背景且是左键，或者按住中键或 Alt+左键，则开始平移
    if ((isBackground && e.button === 0) || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  // 下载文件（支持跨域）
  const downloadFile = async (url: string, filename: string) => {
    // 首先尝试使用原始 URL 直接下载（不经过 fetch）
    try {
      // 创建隐藏的 iframe 来触发下载
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = url
      document.body.appendChild(iframe)

      // 清理 iframe
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 5000)

      // 同时尝试使用 a 标签的 download 属性
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.target = '_self' // 不打开新标签
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('开始下载', {
        description: `文件: ${filename}`,
        duration: 2000,
      })
    } catch (error) {
      console.error('下载失败:', error)
      toast.error('下载失败', {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 3000,
      })
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

    // 更新鼠标位置（屏幕坐标系，与节点和连线一致）
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
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
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.min(Math.max(0.1, zoom + delta), 3)
    setZoom(newZoom)
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
    console.log('🚀 点击执行按钮')
    setIsRunning(true)
  }

  // 保存 nodes 和 edges 的 ref，避免依赖变化
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const onExecuteRef = useRef(onExecute)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    onExecuteRef.current = onExecute
  }, [onExecute])

  // 监听执行状态变化，执行工作流
  useEffect(() => {
    if (!isRunning) return

    const executionId = `exec-${Date.now()}`
    console.log('🚀 开始执行工作流:', {
      nodes: nodesRef.current.length,
      edges: edgesRef.current.length,
      executionId,
    })

    let eventSource: EventSource | null = null
    let isSSEConnected = false

    const executeWorkflow = async () => {
      try {
        console.log('🚀 开始执行工作流:', {
          nodes: nodesRef.current.length,
          edges: edgesRef.current.length,
          executionId,
        })

        // 1. 先启动 SSE 连接监听
        eventSource = new EventSource(`/api/workflow/ws?executionId=${executionId}`)

        // 设置消息处理器
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('📨 收到 SSE 事件:', data.type, data.data)

            if (data.type === 'connected') {
              console.log('✅ SSE 连接已建立')
              isSSEConnected = true
            } else if (data.type === 'node:started') {
              setNodes(prev =>
                prev.map(node =>
                  node.id === data.data.nodeId
                    ? { ...node, status: 'running', progress: 0 }
                    : node
                )
              )
            } else if (data.type === 'node:progress') {
              setNodes(prev =>
                prev.map(node =>
                  node.id === data.data.nodeId
                    ? { ...node, progress: data.data.progress }
                    : node
                )
              )
            } else if (data.type === 'node:completed') {
              setNodes(prev =>
                prev.map(node =>
                  node.id === data.data.nodeId
                    ? { ...node, status: 'completed', progress: 100, result: data.data.result }
                    : node
                )
              )

              // 如果是图像生成节点，显示生成的图像
              if (data.data.result?.type === 'image' && data.data.result?.url) {
                console.log('🖼️ 图像生成成功:', data.data.result.url)
                toast.success('图像生成成功', {
                  description: '查看右侧节点结果',
                  duration: 3000,
                })
              }
            } else if (data.type === 'node:failed') {
              setNodes(prev =>
                prev.map(node =>
                  node.id === data.data.nodeId
                    ? { ...node, status: 'failed', error: data.data.error }
                    : node
                )
              )

              toast.error('节点执行失败', {
                description: `${data.data.nodeId}: ${data.data.error}`,
                duration: 5000,
              })
            } else if (data.type === 'execution:started') {
              toast.info('开始执行工作流', {
                description: '正在处理节点...',
                duration: 2000,
              })
            } else if (data.type === 'execution:completed') {
              console.log('🎉 工作流执行完成:', data.data)
              toast.success('工作流执行完成', {
                description: data.data.isRetry ? '重试执行成功' : '成功执行工作流',
                duration: 3000,
              })

              // 保存执行历史
              fetch('/api/workflow/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  executionId: data.data.execution?.id || executionId,
                  workflowId: data.data.execution?.workflowId,
                  projectId: data.data.execution?.projectId,
                  nodes: nodesRef.current,
                  edges: edgesRef.current,
                  status: data.data.execution?.status,
                  startTime: data.data.execution?.startTime,
                  endTime: data.data.execution?.endTime,
                  results: data.data.results,
                  error: data.data.execution?.error,
                }),
              })
            } else if (data.type === 'execution:failed') {
              console.error('❌ 工作流执行失败:', data.data.error)
              toast.error('工作流执行失败', {
                description: data.data.error,
                duration: 5000,
              })
            }
          } catch (error) {
            console.error('❌ 解析 SSE 事件失败:', error)
          }
        }

        eventSource.onerror = (error) => {
          // 只在连接真正失败时显示错误
          if (eventSource?.readyState === EventSource.CLOSED && !isSSEConnected) {
            console.error('❌ SSE 连接失败:', error)
            toast.error('SSE 连接失败', {
              description: '无法建立实时连接，请刷新页面重试',
              duration: 5000,
            })
          } else if (eventSource?.readyState === EventSource.CONNECTING) {
            console.log('⏳ SSE 正在重连...')
          }
        }

        // 2. 调用后端 API 执行工作流
        // 合并 nodeParams 到 nodes 中
        const nodesWithParams = nodesRef.current.map(node => ({
          ...node,
          params: {
            ...node.params,
            ...(nodeParamsRef.current[node.id] || {})
          }
        }))

        const response = await fetch('/api/workflow/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nodes: nodesWithParams,
            edges: edgesRef.current,
            workflowId: `workflow-${Date.now()}`,
            projectId: 'temp',
            executionId,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '执行失败')
        }

        const { success, data } = await response.json()
        console.log('📊 执行 API 返回:', data)

        // 如果 SSE 事件没有正确设置节点结果，使用 API 响应的结果作为兜底
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((resultItem: any) => {
            // 提取实际的节点结果数据
            const nodeResult = resultItem.result || resultItem
            const actualResult = nodeResult.data || nodeResult.result || nodeResult

            setNodes(prev =>
              prev.map(node =>
                node.id === resultItem.nodeId
                  ? { ...node, status: nodeResult.status === 'error' || nodeResult.status === 'failed' ? 'failed' : 'completed', result: actualResult, error: nodeResult.error }
                  : node
              )
            )
          })
        }
      } catch (error) {
        console.error('❌ 执行工作流时发生错误:', error)
        toast.error('执行失败', {
          description: error instanceof Error ? error.message : '未知错误',
          duration: 5000,
        })
      } finally {
        console.log('🏁 执行结束，设置 isRunning 为 false')
        setIsRunning(false)
        // 关闭 SSE 连接
        setTimeout(() => {
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close()
          }
          eventSource = null
          isSSEConnected = false
        }, 1000)
      }
    }

    executeWorkflow()

    // 清理函数
    return () => {
      eventSource?.close()
    }
  }, [isRunning])

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
          <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
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

              {/* TODO: 语音生成节点 - 出沙盒后无法使用，暂时隐藏
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
              */}

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
                      markerEnd={`url(#arrowhead-${id})`}
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
                  {(() => {
                    const sourceNode = nodes.find(n => n.id === connectingFrom.nodeId)
                    if (!sourceNode) return null
                    const startPos = getPortPosition(sourceNode, connectingFrom.portId, 'output')
                    if (!startPos) return null
                    return (
                      <path
                        d={`M ${startPos.x} ${startPos.y} L ${mousePos.x} ${mousePos.y}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                      />
                    )
                  })()}
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
                  className={`absolute pointer-events-auto rounded-lg border-2 bg-card shadow-lg overflow-visible ${
                    isSelected ? 'border-primary' : 'border-border'
                  }`}
                  style={{
                    left: pan.x + node.position.x * zoom,
                    top: pan.y + node.position.y * zoom,
                    width: 280 * zoom,
                    zIndex: isSelected ? 100 : 1,
                    transformOrigin: 'left top',
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
                  <div className={`flex items-center justify-between border-b ${nodeColor} bg-opacity-20`} style={{ padding: `${12 * zoom}px ${16 * zoom}px` }}>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full" style={{ width: `${12 * zoom}px`, height: `${12 * zoom}px`, backgroundColor: 'currentColor' }} />
                      <span className="font-medium" style={{ fontSize: `${14 * zoom}px` }}>{node.name}</span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-accent"
                          style={{ width: `${24 * zoom}px`, height: `${24 * zoom}px` }}
                          onClick={() => deleteNode(node.id)}
                        >
                          <Trash2 className="text-destructive" style={{ width: `${12 * zoom}px`, height: `${12 * zoom}px` }} />
                        </Button>
                      </div>
                    )}
                  </div>

                          {/* 输入端口 */}
                  {(() => {
                    console.log(`🔍 渲染节点 ${node.id} 的输入端口:`, node.inputs)
                    return node.inputs && node.inputs.length > 0 ? (
                    <div className="space-y-1 relative" style={{ padding: `${8 * zoom}px ${12 * zoom}px` }}>
                      {node.inputs.map((port) => {
                        const isConnected = edges.some(
                          e => e.to === node.id && e.toPort === port.id
                        )

                        console.log(`🔍 渲染输入端口 ${port.id}:`, port)

                        return (
                          <div
                            key={port.id}
                            className="relative flex items-center group"
                            style={{ height: `${32 * zoom}px` }}
                          >
                            <div
                              className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full border-2 bg-background transition-colors cursor-pointer z-20 hover:bg-primary hover:border-primary ${
                                isConnected ? 'border-primary' : 'border-border'
                              }`}
                              style={{ width: `${24 * zoom}px`, height: `${24 * zoom}px` }}
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
                            <span className="text-muted-foreground" style={{ fontSize: `${12 * zoom}px` }}>{port.name}</span>
                          </div>
                        )
                      })}
                    </div>
                    ) : null
                  })()}

                  {/* 输出端口 */}
                  {(() => {
                    console.log(`🔍 渲染节点 ${node.id} 的输出端口:`, node.outputs)
                    return node.outputs && node.outputs.length > 0 ? (
                    <div className="space-y-1 relative" style={{ padding: `${8 * zoom}px ${12 * zoom}px` }}>
                      {node.outputs.map((port) => {
                        const isConnected = edges.some(
                          e => e.from === node.id && e.fromPort === port.id
                        )

                        console.log(`🔍 渲染输出端口 ${port.id}:`, port)

                        return (
                          <div
                            key={port.id}
                            className="relative flex items-center justify-end group"
                            style={{ height: `${32 * zoom}px` }}
                          >
                            <span className="text-muted-foreground" style={{ fontSize: `${12 * zoom}px` }}>{port.name}</span>
                            <div
                              className={`absolute right-0 top-1/2 -translate-y-1/2 rounded-full border-2 bg-background transition-colors cursor-pointer z-20 hover:bg-primary hover:border-primary ${
                                isConnected ? 'border-primary' : 'border-border'
                              }`}
                              style={{ width: `${24 * zoom}px`, height: `${24 * zoom}px` }}
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
                    ) : null
                  })()}

                  {/* 执行状态指示器 */}
                  {node.status && (
                    <div className={`px-3 py-2 border-t ${
                      node.status === 'running' ? 'bg-blue-500/10' :
                      node.status === 'completed' ? 'bg-green-500/10' :
                      node.status === 'failed' ? 'bg-red-500/10' : ''
                    }`}>
                      <div className="flex items-center gap-2 text-xs">
                        {node.status === 'running' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-blue-600 dark:text-blue-400">
                              {node.progress !== undefined ? `执行中 ${Math.round(node.progress)}%` : '运行中...'}
                            </span>
                          </>
                        )}
                        {node.status === 'completed' && (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span className="text-green-600 dark:text-green-400">已完成</span>
                          </>
                        )}
                        {node.status === 'failed' && (
                          <>
                            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                            <span className="text-red-600 dark:text-red-400">失败</span>
                          </>
                        )}
                      </div>
                      {/* 进度条 */}
                      {node.status === 'running' && node.progress !== undefined && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${node.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 执行结果预览 */}
                  {node.status === 'completed' && node.result && (
                    <div className="px-3 py-2 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-muted-foreground">执行结果</div>
                        {node.result.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const filename = `result-${node.id}.${node.result.type === 'image' ? 'png' : 'mp4'}`
                              downloadFile(node.result.url, filename)
                            }}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            下载
                          </Button>
                        )}
                      </div>
                      {node.result.type === 'image' && node.result.url && (
                        <div className="rounded-lg overflow-hidden border cursor-pointer group relative">
                          <img
                            src={node.result.url}
                            alt="生成结果"
                            className="w-full h-64 object-cover"
                            onClick={() => {
                              window.open(node.result.url, '_blank')
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">点击查看大图</span>
                          </div>
                        </div>
                      )}
                      {node.result.type === 'video' && node.result.url && (
                        <div className="rounded-lg overflow-hidden border">
                          <video
                            src={node.result.url}
                            controls
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      )}
                      {node.result.type === 'text' && node.result.content && (
                        <div className="p-2 bg-muted rounded-lg text-xs max-h-48 overflow-auto">
                          {node.result.content}
                        </div>
                      )}
                      {node.result.type === 'json' && node.result.data && (
                        <div className="p-2 bg-muted rounded-lg text-xs font-mono overflow-auto max-h-48">
                          <pre>{JSON.stringify(node.result.data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 错误信息 */}
                  {node.status === 'failed' && node.error && (
                    <div className="px-3 py-2 border-t bg-red-500/5">
                      <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">错误信息</div>
                      <div className="text-xs text-red-600 dark:text-red-400 break-words">
                        {node.error}
                      </div>
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

                {/* 创建角色节点参数面板 */}
                {selectedNode.type === 'text-to-character' && (
                  <>
                    <div>
                      <Label>项目ID</Label>
                      <Input
                        value={nodeParams[selectedNode.id]?.projectId || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'projectId', e.target.value)}
                        placeholder="留空使用工作流项目ID"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>角色名称</Label>
                      <Input
                        value={nodeParams[selectedNode.id]?.name || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'name', e.target.value)}
                        placeholder="输入角色名称（可选）"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>角色描述</Label>
                      <Textarea
                        value={nodeParams[selectedNode.id]?.description || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'description', e.target.value)}
                        placeholder="描述角色的外貌、性格、服饰等..."
                        className="mt-1 min-h-[100px] resize-none"
                        rows={4}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>性格特点</Label>
                      <Input
                        value={nodeParams[selectedNode.id]?.personality || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'personality', e.target.value)}
                        placeholder="描述角色性格（可选）"
                        disabled={readOnly}
                      />
                    </div>
                  </>
                )}

                {/* 分镜分析节点参数面板 */}
                {selectedNode.type === 'script-to-scenes' && (
                  <>
                    <div>
                      <Label>项目ID</Label>
                      <Input
                        value={nodeParams[selectedNode.id]?.projectId || ''}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'projectId', e.target.value)}
                        placeholder="留空使用工作流项目ID"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <Label>分镜数量</Label>
                      <Input
                        type="number"
                        value={nodeParams[selectedNode.id]?.numScenes || 5}
                        onChange={(e) => updateNodeParam(selectedNode.id, 'numScenes', parseInt(e.target.value))}
                        min={1}
                        max={20}
                        disabled={readOnly}
                      />
                    </div>
                  </>
                )}

                {/* TODO: 语音生成节点参数面板 - 出沙盒后无法使用，暂时隐藏
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
                */}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

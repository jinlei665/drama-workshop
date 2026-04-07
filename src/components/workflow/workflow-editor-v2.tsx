/**
 * 工作流编辑器 V2 - 参考即梦画布
 * 支持节点拖拽、参数输入、实时预览、真实执行
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Play,
  Save,
  ZoomIn,
  ZoomOut,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Lightbulb,
  Image as ImageIcon,
  Video,
  Type,
  FileText,
  Users
} from 'lucide-react'
import { toast } from 'sonner'
import type { BaseNode, Edge } from '@/lib/workflow/types'

interface NodeData {
  prompt?: string
  negativePrompt?: string
  width?: string
  height?: string
  style?: string
  strength?: number
  seed?: number
  steps?: number
  guidance?: number
  referenceImage?: string
  duration?: number
  aspectRatio?: string
  motionStrength?: number
  motionPrompt?: string
  text?: string
  imageUrl?: string
  model?: string
  description?: string
  voice?: string
  speed?: number
}

interface WorkflowEditorProps {
  projectId: string
  initialNodes?: BaseNode[]
  initialEdges?: Edge[]
  readonly?: boolean  // 是否只读模式
  isSystem?: boolean  // 是否系统工作流
  className?: string
}

// 节点类型定义
const NODE_TYPES = {
  'text-input': {
    name: '文本输入',
    icon: Type,
    color: 'bg-blue-500',
    inputs: [],
    outputs: [{ name: 'text', type: 'string' }],
    params: {
      text: { type: 'textarea', label: '文本内容', default: '' }
    }
  },
  'image-input': {
    name: '图片输入',
    icon: ImageIcon,
    color: 'bg-green-500',
    inputs: [],
    outputs: [{ name: 'image', type: 'image' }],
    params: {
      imageUrl: { type: 'text', label: '图片 URL', default: '' }
    }
  },
  'text-to-image': {
    name: '文生图',
    icon: ImageIcon,
    color: 'bg-purple-500',
    inputs: [{ name: 'prompt', type: 'string' }],
    outputs: [{ name: 'image', type: 'image' }],
    params: {
      prompt: { type: 'textarea', label: '提示词', default: '' },
      negativePrompt: { type: 'textarea', label: '负面提示词', default: '' },
      width: { type: 'select', label: '宽度', options: ['512', '768', '1024', '1360'], default: '1024' },
      height: { type: 'select', label: '高度', options: ['512', '768', '1024', '1360'], default: '1024' },
      style: { type: 'select', label: '风格', options: ['realistic', 'anime', 'cartoon', 'oil_painting', 'watercolor'], default: 'realistic' },
      seed: { type: 'number', label: '随机种子', default: -1, min: -1, max: 2147483647 },
      steps: { type: 'slider', label: '迭代步数', default: 20, min: 10, max: 50, step: 1 },
      guidance: { type: 'slider', label: '引导强度', default: 7.5, min: 1, max: 20, step: 0.5 }
    }
  },
  'image-to-image': {
    name: '图生图',
    icon: ImageIcon,
    color: 'bg-purple-500',
    inputs: [
      { name: 'referenceImage', type: 'image' },
      { name: 'prompt', type: 'string' }
    ],
    outputs: [{ name: 'image', type: 'image' }],
    params: {
      prompt: { type: 'textarea', label: '修改提示词', default: '' },
      strength: { type: 'slider', label: '修改强度', default: 0.75, min: 0, max: 1, step: 0.05 },
      seed: { type: 'number', label: '随机种子', default: -1, min: -1, max: 2147483647 },
      steps: { type: 'slider', label: '迭代步数', default: 20, min: 10, max: 50, step: 1 },
      guidance: { type: 'slider', label: '引导强度', default: 7.5, min: 1, max: 20, step: 0.5 }
    }
  },
  'image-to-video': {
    name: '图生视频',
    icon: Video,
    color: 'bg-orange-500',
    inputs: [
      { name: 'referenceImage', type: 'image' },
      { name: 'motionPrompt', type: 'string' }
    ],
    outputs: [{ name: 'video', type: 'video' }],
    params: {
      motionPrompt: { type: 'textarea', label: '动作描述', default: '' },
      duration: { type: 'slider', label: '时长(秒)', default: 5, min: 4, max: 12, step: 1 },
      aspectRatio: { type: 'select', label: '比例', options: ['16:9', '9:16', '1:1'], default: '16:9' },
      motionStrength: { type: 'slider', label: '运动强度', default: 5, min: 1, max: 10, step: 1 }
    }
  },
  'text-to-video': {
    name: '文生视频',
    icon: Video,
    color: 'bg-orange-500',
    inputs: [{ name: 'prompt', type: 'string' }],
    outputs: [{ name: 'video', type: 'video' }],
    params: {
      prompt: { type: 'textarea', label: '场景描述', default: '' },
      duration: { type: 'slider', label: '时长(秒)', default: 5, min: 4, max: 12, step: 1 },
      aspectRatio: { type: 'select', label: '比例', options: ['16:9', '9:16', '1:1'], default: '16:9' }
    }
  },
  'llm-process': {
    name: 'LLM 处理',
    icon: FileText,
    color: 'bg-pink-500',
    inputs: [{ name: 'input', type: 'string' }],
    outputs: [{ name: 'output', type: 'string' }],
    params: {
      prompt: { type: 'textarea', label: '处理指令', default: '请分析并总结以下内容：' },
      model: { type: 'select', label: '模型', options: ['deepseek-chat', 'gpt-4', 'claude-3'], default: 'deepseek-chat' }
    }
  },
  'text-to-character': {
    name: '文生人物',
    icon: Users,
    color: 'bg-teal-500',
    inputs: [{ name: 'description', type: 'string' }],
    outputs: [{ name: 'image', type: 'image' }],
    params: {
      description: { type: 'textarea', label: '人物描述', default: '' },
      style: { type: 'select', label: '风格', options: ['realistic', 'anime', 'cartoon', 'oil_painting'], default: 'realistic' }
    }
  },
  'character-triple-views': {
    name: '人物三视图',
    icon: Users,
    color: 'bg-teal-500',
    inputs: [{ name: 'referenceImage', type: 'image' }],
    outputs: [
      { name: 'frontView', type: 'image' },
      { name: 'sideView', type: 'image' },
      { name: 'backView', type: 'image' }
    ],
    params: {
      style: { type: 'select', label: '风格', options: ['realistic', 'anime', 'cartoon'], default: 'realistic' }
    }
  },
  'text-to-voice': {
    name: '文字转语音',
    icon: Video,
    color: 'bg-cyan-500',
    inputs: [{ name: 'text', type: 'string' }],
    outputs: [{ name: 'audio', type: 'audio' }],
    params: {
      text: { type: 'textarea', label: '要转换的文本', default: '' },
      voice: { type: 'select', label: '音色', options: ['zh_female', 'zh_male', 'en_female', 'en_male'], default: 'zh_female' },
      speed: { type: 'slider', label: '语速', default: 1.0, min: 0.5, max: 2.0, step: 0.1 }
    }
  }
}

type NodeStatus = 'idle' | 'running' | 'success' | 'error'
type PanelType = 'none' | 'params' | 'preview' | 'ai'

export function WorkflowEditorV2({
  projectId,
  initialNodes = [],
  initialEdges = [],
  readonly = false,
  isSystem = false,
  className
}: WorkflowEditorProps) {
  const [nodes, setNodes] = useState<BaseNode[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({})
  const [nodeResults, setNodeResults] = useState<Record<string, any>>({})
  const [nodeParams, setNodeParams] = useState<Record<string, NodeData>>({})
  const [isExecuting, setIsExecuting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string
    outputName: string
  } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [activePanel, setActivePanel] = useState<PanelType>('none')
  const [agentInput, setAgentInput] = useState('')
  const [isAgentProcessing, setIsAgentProcessing] = useState(false)
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [workflowName, setWorkflowName] = useState('')
  const [templates, setTemplates] = useState<any[]>([])

  const canvasRef = useRef<HTMLDivElement>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })

  // 加载保存的工作流
  useEffect(() => {
    const saved = localStorage.getItem('savedWorkflows')
    if (saved) {
      setSavedWorkflows(JSON.parse(saved))
    }
    loadTemplates()
  }, [])

  // 加载模板
  const loadTemplates = useCallback(() => {
    const templateList = [
      {
        id: 'template-tti',
        name: '文生图模板',
        description: '快速生成图片',
        nodes: [
          { id: 'text1', type: 'text-input', position: { x: 100, y: 100 }, inputs: [], outputs: [{ name: 'text', type: 'string' }], params: { text: '' } },
          { id: 'tti1', type: 'text-to-image', position: { x: 400, y: 100 }, inputs: [{ name: 'prompt', type: 'string' }], outputs: [{ name: 'image', type: 'image' }], params: { prompt: '', width: '1024', height: '1024', style: 'realistic' } }
        ],
        edges: [
          { id: 'e1', from: 'text1', fromPort: 'text', to: 'tti1', toPort: 'prompt' }
        ]
      },
      {
        id: 'template-itv',
        name: '图生视频模板',
        description: '图片生成视频',
        nodes: [
          { id: 'img1', type: 'image-input', position: { x: 100, y: 100 }, inputs: [], outputs: [{ name: 'image', type: 'image' }], params: { imageUrl: '' } },
          { id: 'itv1', type: 'image-to-video', position: { x: 400, y: 100 }, inputs: [{ name: 'referenceImage', type: 'image' }, { name: 'motionPrompt', type: 'string' }], outputs: [{ name: 'video', type: 'video' }], params: { motionPrompt: '', duration: 5, aspectRatio: '16:9', motionStrength: 5 } }
        ],
        edges: [
          { id: 'e1', from: 'img1', fromPort: 'image', to: 'itv1', toPort: 'referenceImage' }
        ]
      },
      {
        id: 'template-char',
        name: '人物三视图模板',
        description: '生成人物正侧背三视图',
        nodes: [
          { id: 'img1', type: 'image-input', position: { x: 100, y: 100 }, inputs: [], outputs: [{ name: 'image', type: 'image' }], params: { imageUrl: '' } },
          { id: 'triple1', type: 'character-triple-views', position: { x: 400, y: 100 }, inputs: [{ name: 'referenceImage', type: 'image' }], outputs: [{ name: 'frontView', type: 'image' }, { name: 'sideView', type: 'image' }, { name: 'backView', type: 'image' }], params: { style: 'realistic' } }
        ],
        edges: [
          { id: 'e1', from: 'img1', fromPort: 'image', to: 'triple1', toPort: 'referenceImage' }
        ]
      }
    ]
    setTemplates(templateList)
  }, [])

  // 获取选中的节点
  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const selectedNodeType = selectedNode ? NODE_TYPES[selectedNode.type as keyof typeof NODE_TYPES] : null

  // 添加节点
  const addNode = useCallback((type: string, x: number, y: number) => {
    const id = `${type}_${Date.now()}`
    const newNode: BaseNode = {
      id,
      type: type as any,
      name: NODE_TYPES[type as keyof typeof NODE_TYPES]?.name || type,
      position: { x, y },
      inputs: [],
      outputs: [],
      params: {},
      status: 'idle'
    }
    
    // 初始化节点参数
    const nodeTypeConfig = NODE_TYPES[type as keyof typeof NODE_TYPES]
    if (nodeTypeConfig?.params) {
      const initialParams: NodeData = {}
      Object.entries(nodeTypeConfig.params).forEach(([key, param]) => {
        (initialParams as any)[key] = param.default
      })
      setNodeParams(prev => ({ ...prev, [id]: initialParams }))
    }

    setNodes(prev => [...prev, newNode])
    setSelectedNodeId(id)
    setActivePanel('params')
    setHasChanges(true)
  }, [])

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
    setNodeParams(prev => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setNodeResults(prev => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setNodeStatuses(prev => {
      const next = { ...prev }
      delete next[nodeId]
      return next
    })
    setSelectedNodeId(null)
    setActivePanel('none')
    setHasChanges(true)
  }, [])

  // 更新节点位置
  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => (n.id === nodeId ? { ...n, position: { x, y } } : n)))
  }, [])

  // 更新节点参数
  const updateNodeParam = useCallback((nodeId: string, key: keyof NodeData, value: any) => {
    setNodeParams(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        [key]: value
      }
    }))
    setHasChanges(true)
  }, [])

  // 连接节点
  const connectNodes = useCallback((fromNodeId: string, fromOutput: string, toNodeId: string, toInput: string) => {
    if (fromNodeId === toNodeId) return

    const edgeId = `edge_${fromNodeId}_${fromOutput}_${toNodeId}_${toInput}`
    const newEdge: Edge = {
      id: edgeId,
      from: fromNodeId,
      fromPort: fromOutput,
      to: toNodeId,
      toPort: toInput
    }

    setEdges(prev => [...prev, newEdge])
    setHasChanges(true)
  }, [])

  // 删除连接
  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId))
    setHasChanges(true)
  }, [])

  // 执行工作流
  const executeWorkflow = useCallback(async () => {
    if (isExecuting) return
    
    setIsExecuting(true)
    
    try {
      // 构建执行顺序（拓扑排序）
      const inDegree = new Map<string, number>()
      nodes.forEach(n => inDegree.set(n.id, 0))
      edges.forEach(e => {
        inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
      })
      
      const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id)
      const results: Record<string, any> = {}
      
      while (queue.length > 0) {
        const nodeId = queue.shift()!
        const node = nodes.find(n => n.id === nodeId)
        if (!node) continue
        
        setNodeStatuses(prev => ({ ...prev, [nodeId]: 'running' }))
        
        try {
          // 准备输入数据
          const inputs: Record<string, any> = {}
          edges
            .filter(e => e.to === nodeId)
            .forEach(e => {
              const sourceResult = results[e.from]
              if (sourceResult && e.fromPort) {
                inputs[e.toPort!] = sourceResult[e.fromPort]
              }
            })
          
          // 执行节点
          const result = await executeNode(node, nodeParams[nodeId] || {}, inputs)
          results[nodeId] = result
          setNodeResults(prev => ({ ...prev, [nodeId]: result }))
          setNodeStatuses(prev => ({ ...prev, [nodeId]: 'success' }))
          
        } catch (err) {
          console.error(`Node ${nodeId} error:`, err)
          setNodeStatuses(prev => ({ ...prev, [nodeId]: 'error' }))
        }
        
        // 更新后续节点
        edges
          .filter(e => e.from === nodeId)
          .forEach(e => {
            const newDegree = (inDegree.get(e.to) || 1) - 1
            inDegree.set(e.to, newDegree)
            if (newDegree === 0) {
              queue.push(e.to)
            }
          })
      }
      
      toast.success('工作流执行完成')
    } catch (err) {
      console.error('Workflow execution error:', err)
      toast.error('工作流执行失败')
    } finally {
      setIsExecuting(false)
    }
  }, [isExecuting, nodes, edges, nodeParams])

  // 单个节点执行
  const executeNode = async (node: BaseNode, params: NodeData, inputs: Record<string, any>): Promise<any> => {
    switch (node.type) {
      case 'text-input':
        return { text: params.text || '' }

      case 'image-input':
        return { image: params.imageUrl || '' }

      case 'text-to-image':
        const imageRes = await fetch('/api/generate/scene-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: node.id,
            prompt: params.prompt,
            negativePrompt: params.negativePrompt,
            width: parseInt(params.width || '1024'),
            height: parseInt(params.height || '1024'),
            style: params.style,
            seed: params.seed === -1 ? undefined : params.seed,
            steps: params.steps,
            guidance: params.guidance
          })
        })
        const imageData = await imageRes.json()
        return { image: imageData.data?.imageUrl || '' }

      case 'image-to-image':
        const i2iRes = await fetch('/api/generate/appearance-from-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: node.id,
            referenceImageUrl: inputs.referenceImage,
            description: params.prompt,
            strength: params.strength
          })
        })
        const i2iData = await i2iRes.json()
        return { image: i2iData.data?.imageUrl || '' }

      case 'image-to-video':
        const i2vRes = await fetch('/api/generate/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: node.id,
            imageUrl: inputs.referenceImage,
            prompt: params.motionPrompt,
            duration: params.duration,
            aspectRatio: params.aspectRatio,
            motionStrength: params.motionStrength
          })
        })
        const i2vData = await i2vRes.json()
        return { video: i2vData.data?.videoUrl || '' }

      case 'text-to-video':
        const t2vRes = await fetch('/api/generate/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneId: node.id,
            prompt: params.prompt,
            duration: params.duration,
            aspectRatio: params.aspectRatio
          })
        })
        const t2vData = await t2vRes.json()
        return { video: t2vData.data?.videoUrl || '' }

      case 'llm-process':
        const llmRes = await fetch('/api/llm/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: inputs.input,
            prompt: params.prompt,
            model: params.model
          })
        })
        const llmData = await llmRes.json()
        return { output: llmData.data?.output || '' }

      case 'text-to-character':
        const charRes = await fetch('/api/generate/appearance-from-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: node.id,
            description: params.description,
            style: params.style
          })
        })
        const charData = await charRes.json()
        return { image: charData.data?.imageUrl || '' }

      case 'character-triple-views':
        const tripleRes = await fetch('/api/generate/character-triple-views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: node.id,
            referenceImageUrl: inputs.referenceImage,
            style: params.style
          })
        })
        const tripleData = await tripleRes.json()
        return {
          frontView: tripleData.data?.frontViewUrl || '',
          sideView: tripleData.data?.sideViewUrl || '',
          backView: tripleData.data?.backViewUrl || ''
        }

      case 'text-to-voice':
        const voiceRes = await fetch('/api/generate/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: params.text,
            voice: params.voice,
            speed: params.speed
          })
        })
        const voiceData = await voiceRes.json()
        return { audio: voiceData.data?.audioUrl || '' }

      default:
        return {}
    }
  }

  // 保存工作流
  const saveWorkflow = useCallback(() => {
    if (!workflowName.trim()) {
      toast.error('请输入工作流名称')
      return
    }

    const workflow = {
      id: Date.now().toString(),
      name: workflowName,
      nodes,
      edges,
      nodeParams,
      createdAt: new Date().toISOString()
    }

    const updated = [...savedWorkflows, workflow]
    setSavedWorkflows(updated)
    localStorage.setItem('savedWorkflows', JSON.stringify(updated))
    setSaveDialogOpen(false)
    setWorkflowName('')
    setHasChanges(false)
    toast.success('工作流已保存')
  }, [workflowName, nodes, edges, nodeParams, savedWorkflows])

  // 加载工作流
  const loadWorkflow = useCallback((workflow: any) => {
    setNodes(workflow.nodes)
    setEdges(workflow.edges)
    setNodeParams(workflow.nodeParams || {})
    setNodeResults({})
    setNodeStatuses({})
    setHasChanges(false)
    toast.success(`已加载工作流：${workflow.name}`)
  }, [])

  // 删除工作流
  const deleteWorkflow = useCallback((id: string) => {
    const updated = savedWorkflows.filter(w => w.id !== id)
    setSavedWorkflows(updated)
    localStorage.setItem('savedWorkflows', JSON.stringify(updated))
    toast.success('工作流已删除')
  }, [savedWorkflows])

  // 应用模板
  const applyTemplate = useCallback((template: any) => {
    setNodes(template.nodes)
    setEdges(template.edges)
    setNodeParams({})
    setNodeResults({})
    setNodeStatuses({})
    setHasChanges(true)
    toast.success(`已应用模板：${template.name}`)
  }, [])

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.min(2, Math.max(0.5, prev + delta)))
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

  // 获取端口位置
  const getPortPosition = useCallback((
    node: BaseNode,
    portName: string,
    type: 'input' | 'output'
  ): { x: number; y: number } | null => {
    if (!node.position) return null
    const nodeConfig = NODE_TYPES[node.type as keyof typeof NODE_TYPES]
    if (!nodeConfig) return null
    
    const ports = type === 'input' ? nodeConfig.inputs : nodeConfig.outputs
    const index = ports.findIndex(p => p.name === portName)
    if (index === -1) return null
    
    const NODE_WIDTH = 200
    const HEADER_HEIGHT = 40
    const PORT_HEIGHT = 24
    const PORT_Y = HEADER_HEIGHT + 10 + index * PORT_HEIGHT
    
    if (type === 'input') {
      return { x: node.position.x, y: node.position.y + PORT_Y }
    } else {
      return { x: node.position.x + NODE_WIDTH, y: node.position.y + PORT_Y }
    }
  }, [])

  return (
    <div className={cn('flex h-full', className)}>
      {/* 左侧节点库 */}
      <div className="w-64 border-r border-border bg-card/30 flex flex-col">
        {readonly && isSystem && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-100">系统工作流</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  这是系统自动生成的工作流，展示项目内容如何转换为视频。您可以查看工作原理，但无法修改。
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 border-b border-border">
          <h3 className="font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            节点库
          </h3>
          <p className="text-xs text-muted-foreground mt-1">拖拽节点到画布</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {Object.entries(NODE_TYPES).map(([type, config]) => (
              <div
                key={type}
                className={cn(
                  'p-3 rounded-lg border border-border bg-card/50 cursor-grab hover:bg-accent/50 hover:border-primary/50 transition-all active:cursor-grabbing',
                  readonly && 'opacity-50 cursor-not-allowed hover:bg-card/50 hover:border-border'
                )}
                draggable={!readonly}
                onDragStart={(e) => {
                  if (readonly) {
                    e.preventDefault()
                    return
                  }
                  e.dataTransfer.setData('nodeType', type)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
              >
                <div className="flex items-center gap-2">
                  <config.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{config.name}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 中间画布 */}
      <div className="flex-1 flex flex-col">
        {/* 工具栏 */}
        <div className="h-12 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {readonly && isSystem && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span className="text-xs font-medium text-amber-900 dark:text-amber-100">系统工作流（只读）</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {nodes.length} 个节点 · {edges.length} 条连接
            </span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            >
              重置
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-muted-foreground">有未保存的更改</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={nodes.length === 0 || readonly}
            >
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
            <Button
              size="sm"
              onClick={executeWorkflow}
              disabled={isExecuting || nodes.length === 0}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  执行工作流
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 画布区域 */}
        <div
          ref={canvasRef}
          className={cn(
            'flex-1 relative overflow-hidden bg-background',
            isPanning && 'cursor-grabbing'
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
          onClick={(e) => {
            if (e.target === canvasRef.current) {
              setSelectedNodeId(null)
              setActivePanel('none')
            }
          }}
        >
          {/* 网格背景 */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
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
            className="absolute inset-0 overflow-visible pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 连接线 */}
            <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
              {edges.map((edge) => {
                const sourceNode = nodes.find(n => n.id === edge.from)
                const targetNode = nodes.find(n => n.id === edge.to)
                if (!sourceNode?.position || !targetNode?.position) return null

                const startPos = getPortPosition(sourceNode, edge.fromPort || '', 'output')
                const endPos = getPortPosition(targetNode, edge.toPort || '', 'input')
                if (!startPos || !endPos) return null

                const midX = (startPos.x + endPos.x) / 2

                return (
                  <g key={edge.id} className="cursor-pointer">
                    <path
                      d={`M ${startPos.x} ${startPos.y} C ${midX} ${startPos.y}, ${midX} ${endPos.y}, ${endPos.x} ${endPos.y}`}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteEdge(edge.id)
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
              const nodeConfig = NODE_TYPES[node.type as keyof typeof NODE_TYPES]
              const isSelected = selectedNodeId === node.id
              const status = nodeStatuses[node.id] || 'idle'
              const NodeIcon = nodeConfig?.icon || Type

              if (!nodeConfig || !node.position) return null

              return (
                <div
                  key={node.id}
                  className={cn(
                    'absolute w-[200px] rounded-lg border-2 bg-card shadow-lg pointer-events-auto',
                    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
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
                    setActivePanel('params')
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 0 && !connectingFrom && !readonly) {
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
                  <div className={cn('px-3 py-2 border-b border-border/50 flex items-center justify-between', nodeConfig.color, 'bg-opacity-20')}>
                    <div className="flex items-center gap-2">
                      <NodeIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{nodeConfig.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                      {!readonly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNode(node.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 输入端口 */}
                  <div className="px-2 py-2 space-y-1">
                    {nodeConfig.inputs.map((input) => {
                      const isConnected = edges.some(e => e.to === node.id && e.toPort === input.name)
                      return (
                        <div key={input.name} className="flex items-center gap-2 text-xs">
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2 cursor-pointer',
                              isConnected ? 'bg-primary border-primary' : 'bg-background hover:border-primary'
                            )}
                            onMouseUp={() => {
                              if (connectingFrom) {
                                connectNodes(connectingFrom.nodeId, connectingFrom.outputName, node.id, input.name)
                                setConnectingFrom(null)
                              }
                            }}
                          />
                          <span className="text-muted-foreground">{input.name}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* 输出端口 */}
                  <div className="px-2 py-2 border-t border-border/50 space-y-1">
                    {nodeConfig.outputs.map((output) => {
                      const isConnected = edges.some(e => e.from === node.id && e.fromPort === output.name)
                      return (
                        <div key={output.name} className="flex items-center justify-end gap-2 text-xs">
                          <span className="text-muted-foreground">{output.name}</span>
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full border-2 cursor-pointer',
                              isConnected ? 'bg-primary border-primary' : 'bg-background hover:border-primary'
                            )}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              setConnectingFrom({ nodeId: node.id, outputName: output.name })
                            }}
                            onMouseUp={() => {
                              setConnectingFrom(null)
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 空状态 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground">
                {readonly && isSystem ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="mb-2 font-medium">系统工作流尚未生成</p>
                    <p className="text-sm">请返回上一页，点击"生成系统工作流"按钮</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8" />
                    </div>
                    <p className="mb-2 font-medium">从左侧拖拽节点到此处</p>
                    <p className="text-sm">点击输出端口拖拽到输入端口来连接节点</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧面板 */}
      <div className="w-80 border-l border-border bg-card/30 flex flex-col">
        <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as PanelType)}>
          <div className="border-b border-border">
            <TabsList className="w-full justify-start rounded-none h-12 px-2">
              <TabsTrigger value="params" className="flex-1">
                参数
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                预览
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">
                <Sparkles className="w-3 h-3 mr-1" />
                AI
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 参数面板 */}
          <TabsContent value="params" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {selectedNode && selectedNodeType ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">{selectedNodeType.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {Object.keys(selectedNodeType.inputs).length} 个输入,
                        {Object.keys(selectedNodeType.outputs).length} 个输出
                      </p>
                    </div>

                    {/* 参数输入 */}
                    {selectedNodeType.params && Object.entries(selectedNodeType.params).map(([key, param]) => {
                      const value = nodeParams[selectedNode.id]?.[key as keyof NodeData]

                      return (
                        <div key={key} className="space-y-2">
                          <Label>{param.label}</Label>
                          {param.type === 'textarea' && (
                            <Textarea
                              value={value as string || ''}
                              onChange={(e) => updateNodeParam(selectedNode.id, key as keyof NodeData, e.target.value)}
                              placeholder={param.label}
                              className="min-h-[80px]"
                            />
                          )}
                          {param.type === 'text' && (
                            <Input
                              value={value as string || ''}
                              onChange={(e) => updateNodeParam(selectedNode.id, key as keyof NodeData, e.target.value)}
                              placeholder={param.label}
                            />
                          )}
                          {param.type === 'number' && (
                            <Input
                              type="number"
                              value={value as number || 0}
                              onChange={(e) => updateNodeParam(selectedNode.id, key as keyof NodeData, parseInt(e.target.value) || 0)}
                              min={(param as any).min}
                              max={(param as any).max}
                            />
                          )}
                          {param.type === 'select' && (
                            <Select
                              value={(value as string) || String(param.default)}
                              onValueChange={(v) => updateNodeParam(selectedNode.id, key as keyof NodeData, v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(param as any).options?.map((opt: string) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {param.type === 'slider' && (
                            <div className="space-y-2">
                              <Slider
                                value={[Number(value) || Number(param.default)]}
                                onValueChange={([v]) => updateNodeParam(selectedNode.id, key as keyof NodeData, v)}
                                min={(param as any).min}
                                max={(param as any).max}
                                step={(param as any).step || 1}
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{(param as any).min}</span>
                                <span>{value || param.default}</span>
                                <span>{(param as any).max}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteNode(selectedNode.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除节点
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>选择一个节点查看参数</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* 预览面板 */}
          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {selectedNode ? (
                  <div className="space-y-4">
                    <h4 className="font-medium">执行结果</h4>
                    {nodeResults[selectedNode.id] ? (
                      <div className="space-y-2">
                        {Object.entries(nodeResults[selectedNode.id]).map(([key, value]) => {
                          if (key.includes('image')) {
                            return (
                              <div key={key} className="space-y-2">
                                <Label className="text-xs">{key}</Label>
                                {typeof value === 'string' && value ? (
                                  <img src={value} alt={key} className="w-full rounded-lg" />
                                ) : null}
                              </div>
                            )
                          }
                          if (key.includes('video')) {
                            return (
                              <div key={key} className="space-y-2">
                                <Label className="text-xs">{key}</Label>
                                {typeof value === 'string' && value ? (
                                  <video src={value} controls className="w-full rounded-lg" />
                                ) : null}
                              </div>
                            )
                          }
                          return (
                            <div key={key} className="space-y-2">
                              <Label className="text-xs">{key}</Label>
                              <p className="text-sm bg-muted p-2 rounded">{String(value)}</p>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <p>执行工作流后查看结果</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>选择一个节点查看预览</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* AI 面板 */}
          <TabsContent value="ai" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* AI 生成 */}
                <div>
                  <Label>描述您的需求</Label>
                  <Textarea
                    value={agentInput}
                    onChange={(e) => setAgentInput(e.target.value)}
                    placeholder="例如：创建一个文生图工作流，生成一张赛博朋克风格的城市夜景..."
                    className="mt-2 min-h-[80px]"
                  />
                  <Button
                    className="w-full mt-2"
                    onClick={() => {
                      toast.info('AI 智能生成功能开发中，敬请期待')
                    }}
                    disabled={isAgentProcessing || !agentInput.trim()}
                  >
                    {isAgentProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        智能生成
                      </>
                    )}
                  </Button>
                </div>

                {/* 模板 */}
                <div>
                  <Label>快捷模板</Label>
                  <div className="mt-2 space-y-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => applyTemplate(template)}
                      >
                        <span className="flex items-center">
                          <Lightbulb className="h-4 w-4 mr-2" />
                          {template.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{template.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 保存的工作流 */}
                {savedWorkflows.length > 0 && (
                  <div>
                    <Label>保存的工作流</Label>
                    <div className="mt-2 space-y-2">
                      {savedWorkflows.map((workflow) => (
                        <div key={workflow.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/50">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{workflow.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {workflow.nodes.length} 个节点 · {new Date(workflow.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => loadWorkflow(workflow)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteWorkflow(workflow.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* 保存工作流对话框 */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存工作流</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="workflow-name">工作流名称</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="输入工作流名称"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveWorkflow}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

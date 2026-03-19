/**
 * 默认工作流模板
 * 用于新建项目时自动创建标准工作流
 */

import type { WorkflowNode, WorkflowEdge } from '@/lib/types'

/**
 * 默认工作流节点配置
 * 布局说明：
 * - 第一行：内容分析、人物提取（分析节点）
 * - 第二行：分镜生成（生成节点）
 * - 第三行：人物图像、分镜图像、视频生成（输出节点）
 */
export const DEFAULT_WORKFLOW_NODES: WorkflowNode[] = [
  // 第一行：分析节点
  {
    id: 'node_analyze_1',
    type: 'analyze_content',
    label: '内容分析',
    position: { x: 100, y: 100 },
    data: {},
    status: 'idle',
  },
  {
    id: 'node_characters_1',
    type: 'extract_characters',
    label: '人物提取',
    position: { x: 350, y: 100 },
    data: {},
    status: 'idle',
  },
  // 第二行：分镜生成
  {
    id: 'node_storyboard_1',
    type: 'generate_storyboard',
    label: '分镜生成',
    position: { x: 225, y: 280 },
    data: {
      style: 'cinematic',
      episodeCount: 1,
    },
    status: 'idle',
  },
  // 第三行：输出节点（可选，默认不连接）
  {
    id: 'node_char_image_1',
    type: 'generate_character_image',
    label: '人物图像',
    position: { x: 100, y: 460 },
    data: {
      style: 'realistic',
    },
    status: 'idle',
  },
  {
    id: 'node_scene_image_1',
    type: 'generate_scene_image',
    label: '分镜图像',
    position: { x: 350, y: 460 },
    data: {
      style: 'cinematic',
    },
    status: 'idle',
  },
  {
    id: 'node_video_1',
    type: 'generate_video',
    label: '视频生成',
    position: { x: 600, y: 460 },
    data: {
      duration: 5,
    },
    status: 'idle',
  },
]

/**
 * 默认工作流连接配置
 * 连接说明：
 * - 内容分析 → 人物提取（传递内容）
 * - 内容分析 → 分镜生成（传递内容）
 * - 人物提取 → 分镜生成（传递人物列表）
 */
export const DEFAULT_WORKFLOW_EDGES: WorkflowEdge[] = [
  // 内容分析 → 人物提取
  {
    id: 'edge_analyze_to_characters',
    source: 'node_analyze_1',
    sourceHandle: 'summary',
    target: 'node_characters_1',
    targetHandle: 'content',
  },
  // 内容分析 → 分镜生成（传递原始内容）
  {
    id: 'edge_analyze_to_storyboard',
    source: 'node_analyze_1',
    sourceHandle: 'structure',
    target: 'node_storyboard_1',
    targetHandle: 'content',
  },
  // 人物提取 → 分镜生成
  {
    id: 'edge_characters_to_storyboard',
    source: 'node_characters_1',
    sourceHandle: 'characters',
    target: 'node_storyboard_1',
    targetHandle: 'characters',
  },
  // 分镜生成 → 分镜图像
  {
    id: 'edge_storyboard_to_scene_image',
    source: 'node_storyboard_1',
    sourceHandle: 'scenes',
    target: 'node_scene_image_1',
    targetHandle: 'scene',
  },
  // 人物提取 → 人物图像
  {
    id: 'edge_characters_to_char_image',
    source: 'node_characters_1',
    sourceHandle: 'characters',
    target: 'node_char_image_1',
    targetHandle: 'character',
  },
  // 分镜图像 → 视频生成
  {
    id: 'edge_scene_image_to_video',
    source: 'node_scene_image_1',
    sourceHandle: 'imageUrl',
    target: 'node_video_1',
    targetHandle: 'imageUrl',
  },
]

/**
 * 获取默认工作流
 * 返回深拷贝以避免修改原始模板
 */
export function getDefaultWorkflow(): {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
} {
  return {
    nodes: JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_NODES)),
    edges: JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_EDGES)),
  }
}

/**
 * 工作流模板类型
 */
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * 预定义工作流模板列表
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'default',
    name: '标准漫剧生成',
    description: '从小说/剧本到视频的完整生成流程',
    nodes: DEFAULT_WORKFLOW_NODES,
    edges: DEFAULT_WORKFLOW_EDGES,
  },
  {
    id: 'simple',
    name: '快速分析',
    description: '仅分析内容和提取人物，不生成媒体',
    nodes: DEFAULT_WORKFLOW_NODES.slice(0, 3), // 只取前3个节点
    edges: DEFAULT_WORKFLOW_EDGES.slice(0, 3), // 只取前3条连接
  },
]

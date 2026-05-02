/**
 * 剧本分镜 V2 工作流模板
 * 流程：脚本输入 → Shot数量规划 → 人物提取 → 分镜生成V2
 */

import type { BaseNode, Edge, WorkflowTemplate } from '@/lib/workflow/types'

/**
 * 分镜 V2 工作流节点配置
 */
export const STORYBOARD_V2_WORKFLOW_NODES: BaseNode[] = [
  // 第一行：脚本输入
  {
    id: 'node_script_input',
    type: 'script-input',
    name: '脚本输入',
    position: { x: 225, y: 50 },
    inputs: [],
    outputs: [
      { id: 'content_out', name: 'content', type: 'text' as const, required: false, connected: false },
    ],
    params: {
      placeholder: '请输入剧本内容...',
    },
    status: 'idle',
  },
  // 第二行：Shot 数量规划（中间）
  {
    id: 'node_shot_planning',
    type: 'plan-shot-count',
    name: 'Shot数量规划',
    position: { x: 225, y: 200 },
    inputs: [
      { id: 'content_in', name: '剧本内容', type: 'text' as const, required: true, connected: false },
    ],
    outputs: [
      { id: 'shotPlan_out', name: 'Shot规划', type: 'any' as const, required: false, connected: false },
      { id: 'sceneAudit_out', name: '场景审计', type: 'any' as const, required: false, connected: false },
      { id: 'specialNotes_out', name: '特殊说明', type: 'any' as const, required: false, connected: false },
    ],
    params: {
      targetDuration: 60,
      videoType: 'short-drama',
    },
    status: 'idle',
  },
  // 第二行：人物提取（左侧）
  {
    id: 'node_character_extract',
    type: 'llm-process',
    name: '人物提取',
    position: { x: 50, y: 200 },
    inputs: [
      { id: 'input', name: '输入', type: 'text' as const, required: false, connected: false },
    ],
    outputs: [
      { id: 'output', name: '输出', type: 'any' as const, required: false, connected: false },
    ],
    params: {
      systemPrompt: '请从以下剧本内容中提取所有出场人物，输出为 JSON 数组格式：\n\n["人物1", "人物2", ...]\n\n只输出 JSON 数组，不要输出其他内容。',
      prompt: '提取人物',
      temperature: 0.3,
    },
    status: 'idle',
  },
  // 第三行：分镜生成 V2
  {
    id: 'node_storyboard_v2',
    type: 'generate-storyboard-v2',
    name: '分镜生成V2',
    position: { x: 225, y: 350 },
    inputs: [
      { id: 'content_in', name: '剧本内容', type: 'text' as const, required: true, connected: false },
      { id: 'shotPlan_in', name: 'Shot规划', type: 'any' as const, required: false, connected: false },
      { id: 'characters_in', name: '人物列表', type: 'any' as const, required: false, connected: false },
      { id: 'style_in', name: '风格', type: 'text' as const, required: false, connected: false },
    ],
    outputs: [
      { id: 'scenes_out', name: '分镜列表', type: 'any' as const, required: false, connected: false },
    ],
    params: {
      style: 'realistic',
      numScenes: 8,
    },
    status: 'idle',
  },
]

/**
 * 分镜 V2 工作流连接配置
 */
export const STORYBOARD_V2_WORKFLOW_EDGES: Edge[] = [
  // 脚本输入 → Shot 数量规划
  {
    id: 'edge_script_to_shot_planning',
    from: 'node_script_input',
    fromPort: 'content',
    to: 'node_shot_planning',
    toPort: 'content_in',
  },
  // 脚本输入 → 人物提取
  {
    id: 'edge_script_to_character',
    from: 'node_script_input',
    fromPort: 'content',
    to: 'node_character_extract',
    toPort: 'input',
  },
  // Shot 数量规划 → 分镜生成 V2
  {
    id: 'edge_shot_planning_to_storyboard',
    from: 'node_shot_planning',
    fromPort: 'shotPlan_out',
    to: 'node_storyboard_v2',
    toPort: 'shotPlan_in',
  },
  // 人物提取 → 分镜生成 V2
  {
    id: 'edge_character_to_storyboard',
    from: 'node_character_extract',
    fromPort: 'output',
    to: 'node_storyboard_v2',
    toPort: 'characters_in',
  },
]

/**
 * 获取分镜 V2 工作流
 */
export function getStoryboardV2Workflow(): {
  nodes: BaseNode[]
  edges: Edge[]
} {
  return {
    nodes: JSON.parse(JSON.stringify(STORYBOARD_V2_WORKFLOW_NODES)),
    edges: JSON.parse(JSON.stringify(STORYBOARD_V2_WORKFLOW_EDGES)),
  }
}

/**
 * 分镜 V2 工作流模板
 */
export const STORYBOARD_V2_WORKFLOW_TEMPLATE: WorkflowTemplate = {
  id: 'storyboard-v2',
  name: '剧本分镜V2',
  description: '基于 Shot 规划的智能分镜生成，支持首尾帧模式和 Seedance 提示词优化',
  category: 'quick-start',
  tags: ['剧本', '分镜', 'Shot规划', 'Seedance'],
  difficulty: 'intermediate',
  workflow: {
    id: 'template-storyboard-v2',
    projectId: '',
    name: '剧本分镜V2',
    description: '基于 Shot 规划的智能分镜生成',
    nodes: STORYBOARD_V2_WORKFLOW_NODES,
    edges: STORYBOARD_V2_WORKFLOW_EDGES,
    isTemplate: true,
    templateCategory: 'quick-start',
    version: '2.0',
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'system',
    },
  },
}

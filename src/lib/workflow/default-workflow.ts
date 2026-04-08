/**
 * 默认工作流模板 V2
 * 用于新建项目时自动创建标准工作流
 * 基于新的节点类型系统（WorkflowEditorV2）
 */

import type { BaseNode, Edge, WorkflowTemplate } from '@/lib/workflow/types'

/**
 * 默认工作流节点配置 - 短剧创作完整流程
 * 流程说明：
 * - 第一行：文本输入（脚本/描述）
 * - 第二行：文生人物、文生图（并行生成）
 * - 第三行：人物三视图、图生视频（输出）
 */
export const DEFAULT_WORKFLOW_NODES: BaseNode[] = [
  // 第一行：文本输入
  {
    id: 'node_text_input',
    type: 'text-input',
    name: '文本输入',
    position: { x: 225, y: 50 },
    inputs: [],
    outputs: [{ id: 'text_out', name: 'text', type: 'text' as const, required: false, connected: false }],
    params: {
      text: '示例：一位古代侠女站在悬崖边，风吹过她的长发，背景是夕阳下的群山，远处有隐约的古堡',
    },
    status: 'idle',
  },
  // 第二行：文生人物（左侧）
  {
    id: 'node_text_to_character',
    type: 'text-to-character',
    name: '文生人物',
    position: { x: 100, y: 200 },
    inputs: [{ id: 'desc_in', name: 'description', type: 'text' as const, required: false, connected: false }],
    outputs: [{ id: 'image_out', name: 'image', type: 'image' as const, required: false, connected: false }],
    params: {
      description: '一位美丽的古代侠女，穿着淡青色长裙，长发飘飘，手持长剑，英姿飒爽',
      style: 'realistic',
    },
    status: 'idle',
  },
  // 第二行：文生图（右侧）
  {
    id: 'node_text_to_image',
    type: 'text-to-image',
    name: '文生图',
    position: { x: 350, y: 200 },
    inputs: [{ id: 'prompt_in', name: 'prompt', type: 'text' as const, required: false, connected: false }],
    outputs: [{ id: 'image_out', name: 'image', type: 'image' as const, required: false, connected: false }],
    params: {
      prompt: '古代侠女站在悬崖边，风吹过她的长发，背景是夕阳下的群山，远处有隐约的古堡，电影质感，光影效果',
      negativePrompt: '低质量，模糊，扭曲',
      width: '1024',
      height: '1024',
      style: 'realistic',
      seed: -1,
      steps: 30,
      guidance: 7.5,
    },
    status: 'idle',
  },
  // 第三行：人物三视图（左侧）
  {
    id: 'node_character_triple_views',
    type: 'character-triple-views',
    name: '人物三视图',
    position: { x: 100, y: 350 },
    inputs: [{ id: 'ref_in', name: 'referenceImage', type: 'image' as const, required: false, connected: false }],
    outputs: [
      { id: 'front_out', name: 'frontView', type: 'image' as const, required: false, connected: false },
      { id: 'side_out', name: 'sideView', type: 'image' as const, required: false, connected: false },
      { id: 'back_out', name: 'backView', type: 'image' as const, required: false, connected: false }
    ],
    params: {
      style: 'realistic',
    },
    status: 'idle',
  },
  // 第三行：图生视频（右侧）
  {
    id: 'node_image_to_video',
    type: 'image-to-video',
    name: '图生视频',
    position: { x: 350, y: 350 },
    inputs: [
      { id: 'ref_in', name: 'referenceImage', type: 'image' as const, required: false, connected: false },
      { id: 'motion_in', name: 'motionPrompt', type: 'text' as const, required: false, connected: false }
    ],
    outputs: [{ id: 'video_out', name: 'video', type: 'video' as const, required: false, connected: false }],
    params: {
      motionPrompt: '侠女缓缓转身，发丝随风飘动，眼神坚定',
      duration: 5,
      aspectRatio: '16:9',
      motionStrength: 5,
    },
    status: 'idle',
  },
]

/**
 * 默认工作流连接配置
 * 连接说明：
 * - 文本输入 → 文生人物
 * - 文本输入 → 文生图
 * - 文生人物 → 人物三视图
 * - 文生图 → 图生视频
 */
export const DEFAULT_WORKFLOW_EDGES: Edge[] = [
  // 文本输入 → 文生人物
  {
    id: 'edge_text_to_character',
    from: 'node_text_input',
    fromPort: 'text',
    to: 'node_text_to_character',
    toPort: 'description',
  },
  // 文本输入 → 文生图
  {
    id: 'edge_text_to_image',
    from: 'node_text_input',
    fromPort: 'text',
    to: 'node_text_to_image',
    toPort: 'prompt',
  },
  // 文生人物 → 人物三视图
  {
    id: 'edge_character_to_triple_views',
    from: 'node_text_to_character',
    fromPort: 'image',
    to: 'node_character_triple_views',
    toPort: 'referenceImage',
  },
  // 文生图 → 图生视频
  {
    id: 'edge_image_to_video',
    from: 'node_text_to_image',
    fromPort: 'image',
    to: 'node_image_to_video',
    toPort: 'referenceImage',
  },
]

/**
 * 获取默认工作流
 * 返回深拷贝以避免修改原始模板
 */
export function getDefaultWorkflow(): {
  nodes: BaseNode[]
  edges: Edge[]
} {
  return {
    nodes: JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_NODES)),
    edges: JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_EDGES)),
  }
}

/**
 * 快速模板 - 简化版工作流
 */
export function getQuickStartWorkflow(): {
  nodes: BaseNode[]
  edges: Edge[]
} {
  return {
    nodes: [
      {
        id: 'text1',
        type: 'text-input',
        name: '文本输入',
        position: { x: 100, y: 100 },
        inputs: [],
        outputs: [{ id: 'text_out', name: 'text', type: 'text' as const, required: false, connected: false }],
        params: { text: '' },
        status: 'idle',
      },
      {
        id: 'tti1',
        type: 'text-to-image',
        name: '文生图',
        position: { x: 400, y: 100 },
        inputs: [{ id: 'prompt_in', name: 'prompt', type: 'text' as const, required: false, connected: false }],
        outputs: [{ id: 'image_out', name: 'image', type: 'image' as const, required: false, connected: false }],
        params: {
          prompt: '',
          negativePrompt: '',
          width: '1024',
          height: '1024',
          style: 'realistic',
          seed: -1,
          steps: 30,
          guidance: 7.5,
        },
        status: 'idle',
      },
    ],
    edges: [
      {
        id: 'e1',
        from: 'text1',
        fromPort: 'text',
        to: 'tti1',
        toPort: 'prompt',
      },
    ],
  }
}

/**
 * 预定义工作流模板列表
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'default',
    name: '短剧创作完整流程',
    description: '从文本描述到人物、场景、视频的完整创作流程',
    category: 'quick-start',
    tags: ['短剧', '人物', '场景', '视频'],
    difficulty: 'intermediate',
    workflow: {
      id: 'template-default',
      projectId: '',
      name: '短剧创作完整流程',
      description: '从文本描述到人物、场景、视频的完整创作流程',
      nodes: DEFAULT_WORKFLOW_NODES,
      edges: DEFAULT_WORKFLOW_EDGES,
      isTemplate: true,
      templateCategory: 'quick-start',
      version: '2.0',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'system',
      },
    },
  },
  {
    id: 'quick-start',
    name: '快速开始',
    description: '简单的文生图流程，适合快速测试',
    category: 'quick-start',
    tags: ['简单', '快速', '文生图'],
    difficulty: 'beginner',
    workflow: {
      id: 'template-quick-start',
      projectId: '',
      name: '快速开始',
      description: '简单的文生图流程',
      nodes: getQuickStartWorkflow().nodes,
      edges: getQuickStartWorkflow().edges,
      isTemplate: true,
      templateCategory: 'quick-start',
      version: '2.0',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'system',
      },
    },
  },
  {
    id: 'character-design',
    name: '人物设计',
    description: '生成人物形象和三视图',
    category: 'character-design',
    tags: ['人物', '设计', '三视图'],
    difficulty: 'beginner',
    workflow: {
      id: 'template-character-design',
      projectId: '',
      name: '人物设计',
      description: '生成人物形象和三视图',
      nodes: [
        {
          id: 'text1',
          type: 'text-input',
          name: '文本输入',
          position: { x: 100, y: 100 },
          inputs: [],
          outputs: [{ id: 'text_out', name: 'text', type: 'text' as const, required: false, connected: false }],
          params: { text: '一位年轻的古代书生，身穿白色长袍，手持竹简，温文尔雅' },
          status: 'idle',
        },
        {
          id: 'ttc1',
          type: 'text-to-character',
          name: '文生人物',
          position: { x: 400, y: 100 },
          inputs: [{ id: 'desc_in', name: 'description', type: 'text' as const, required: false, connected: false }],
          outputs: [{ id: 'image_out', name: 'image', type: 'image' as const, required: false, connected: false }],
          params: {
            description: '一位年轻的古代书生，身穿白色长袍，手持竹简，温文尔雅',
            style: 'realistic',
          },
          status: 'idle',
        },
        {
          id: 'ctv1',
          type: 'character-triple-views',
          name: '人物三视图',
          position: { x: 700, y: 100 },
          inputs: [{ id: 'ref_in', name: 'referenceImage', type: 'image' as const, required: false, connected: false }],
          outputs: [
            { id: 'front_out', name: 'frontView', type: 'image' as const, required: false, connected: false },
            { id: 'side_out', name: 'sideView', type: 'image' as const, required: false, connected: false },
            { id: 'back_out', name: 'backView', type: 'image' as const, required: false, connected: false },
          ],
          params: {
            style: 'realistic',
          },
          status: 'idle',
        },
      ],
      edges: [
        {
          id: 'e1',
          from: 'text1',
          fromPort: 'text',
          to: 'ttc1',
          toPort: 'description',
        },
        {
          id: 'e2',
          from: 'ttc1',
          fromPort: 'image',
          to: 'ctv1',
          toPort: 'referenceImage',
        },
      ],
      isTemplate: true,
      templateCategory: 'character-design',
      version: '2.0',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'system',
      },
    },
  },
  {
    id: 'scene-to-video',
    name: '场景到视频',
    description: '生成场景图片并转换为视频',
    category: 'quick-start',
    tags: ['场景', '视频', '图生视频'],
    difficulty: 'beginner',
    workflow: {
      id: 'template-scene-to-video',
      projectId: '',
      name: '场景到视频',
      description: '生成场景图片并转换为视频',
      nodes: [
        {
          id: 'text1',
          type: 'text-input',
          name: '文本输入',
          position: { x: 100, y: 100 },
          inputs: [],
          outputs: [{ id: 'text_out', name: 'text', type: 'text' as const, required: false, connected: false }],
          params: {
            text: '一个宁静的湖面，晨雾缭绕，远处有山峦倒影，阳光透过云层洒在水面上',
          },
          status: 'idle',
        },
        {
          id: 'tti1',
          type: 'text-to-image',
          name: '文生图',
          position: { x: 400, y: 100 },
          inputs: [{ id: 'prompt_in', name: 'prompt', type: 'text' as const, required: false, connected: false }],
          outputs: [{ id: 'image_out', name: 'image', type: 'image' as const, required: false, connected: false }],
          params: {
            prompt: '一个宁静的湖面，晨雾缭绕，远处有山峦倒影，阳光透过云层洒在水面上，写实风格',
            negativePrompt: '',
            width: '1024',
            height: '1024',
            style: 'realistic',
            seed: -1,
            steps: 30,
            guidance: 7.5,
          },
          status: 'idle',
        },
        {
          id: 'itv1',
          type: 'image-to-video',
          name: '图生视频',
          position: { x: 700, y: 100 },
          inputs: [
            { id: 'firstFrame', name: '首帧图像', type: 'image' as const, required: true, connected: false },
            { id: 'prompt', name: '提示词', type: 'text' as const, required: false, connected: false },
            { id: 'lastFrame', name: '尾帧图像', type: 'image' as const, required: false, connected: false },
          ],
          outputs: [{ id: 'video', name: '视频', type: 'video' as const, required: false, connected: false }],
          params: {
            motionPrompt: '湖面微微泛起涟漪，雾气缓缓流动，阳光在水面上闪烁',
            duration: 5,
            aspectRatio: '16:9',
            motionStrength: 5,
          },
          status: 'idle',
        },
      ],
      edges: [
        {
          id: 'e1',
          from: 'text1',
          fromPort: 'text',
          to: 'tti1',
          toPort: 'prompt',
        },
        {
          id: 'e2',
          from: 'tti1',
          fromPort: 'image',
          to: 'itv1',
          toPort: 'firstFrame',
        },
      ],
      isTemplate: true,
      templateCategory: 'quick-start',
      version: '2.0',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'system',
      },
    },
  },
]

/**
 * 节点注册器
 * 在服务器端注册所有节点类型
 */

import { NodeFactory } from './node/BaseNode'
import {
  TextInputNode,
  ImageInputNode,
  TextToImageNode,
  ImageToVideoNode,
  TextToAudioNode,
  ScriptToScenesNode,
  LLMProcessNode,
  VideoComposeNode,
  TextToCharacterNode,
} from './nodes/index'
import { ScriptInputNode } from './nodes/ScriptInputNode'

/**
 * 注册所有节点类型
 * 这个函数应该在服务器端调用
 */
export function registerAllNodes() {
  NodeFactory.registerNode('text-input', TextInputNode as any)
  NodeFactory.registerNode('image-input', ImageInputNode as any)
  NodeFactory.registerNode('script-input', ScriptInputNode as any)
  NodeFactory.registerNode('text-to-image', TextToImageNode as any)
  NodeFactory.registerNode('image-to-video', ImageToVideoNode as any)
  NodeFactory.registerNode('text-to-audio', TextToAudioNode as any)
  NodeFactory.registerNode('script-to-scenes', ScriptToScenesNode as any)
  NodeFactory.registerNode('llm-process', LLMProcessNode as any)
  NodeFactory.registerNode('video-compose', VideoComposeNode as any)
  NodeFactory.registerNode('text-to-character', TextToCharacterNode as any)
}

// 自动注册（仅在服务器端）
if (typeof window === 'undefined') {
  registerAllNodes()
}

# Drama Studio 工作流系统升级 - 实施指南

## 📋 项目概述

基于即梦无限画布和 ComfyUI 的设计理念，将 Drama Studio 从简单的线性流程升级为专业级的 AI 创作工作流平台。

## ✅ 已完成工作

### 1. 设计文档
- **位置**: `docs/WORKFLOW_UPGRADE_DESIGN.md`
- **内容**:
  - 核心架构设计（三层架构）
  - 功能模块详细设计
  - 数据库设计
  - API 设计
  - 前端技术选型
  - 实施计划（10周）

### 2. 核心类型定义
- **位置**: `src/lib/workflow/types.ts`
- **内容**:
  - 节点类型定义
  - 工作流类型定义
  - 执行上下文类型
  - 资产类型
  - Agent 类型
  - 模板类型

### 3. 节点系统
#### 节点基类
- **位置**: `src/lib/workflow/node/BaseNode.ts`
- **功能**:
  - 节点基类实现
  - 参数验证
  - 执行框架
  - 序列化/反序列化
  - 节点工厂

#### 示例节点
- **位置**: `src/lib/workflow/nodes/index.ts`
- **已实现节点**:
  1. `TextInputNode` - 文本输入节点
  2. `ImageInputNode` - 图片输入节点
  3. `TextToImageNode` - 文生图节点
  4. `ImageToVideoNode` - 图生视频节点

## 🎯 核心特性

### 1. 节点式可视化编辑
```
✅ 节点系统架构完成
✅ 节点基类实现
✅ 节点工厂实现
✅ 参数验证机制
✅ 执行框架
```

### 2. 工作流引擎
```
⏳ 工作流引擎核心（待实现）
⏳ 节点执行器（待实现）
⏳ 连接关系处理（待实现）
```

### 3. Agent 智能共创
```
⏳ 自然语言解析（待实现）
⏳ 意图识别（待实现）
⏳ 工作流自动生成（待实现）
```

### 4. 资产管理
```
⏳ 资产上传/管理（待实现）
⏳ 资产预览（待实现）
⏳ 资产标签分类（待实现）
```

## 📁 文件结构

```
workspace/projects/
├── docs/
│   └── WORKFLOW_UPGRADE_DESIGN.md          # 设计文档
├── src/
│   ├── lib/
│   │   └── workflow/
│   │       ├── types.ts                     # 类型定义
│   │       ├── node/
│   │       │   └── BaseNode.ts             # 节点基类
│   │       ├── nodes/                      # 具体节点实现
│   │       │   └── index.ts                # 示例节点
│   │       ├── engine/                     # 工作流引擎（待实现）
│   │       │   ├── WorkflowEngine.ts
│   │       │   └── NodeExecutor.ts
│   │       ├── agent/                      # Agent 系统（待实现）
│   │       │   ├── IntentParser.ts
│   │       │   ├── WorkflowBuilder.ts
│   │       │   └── Optimizer.ts
│   │       └── templates/                  # 工作流模板（待实现）
│   │           └── index.ts
│   └── app/
│       └── api/
│           └── workflow/                   # 工作流 API（待实现）
│               ├── route.ts
│               ├── [id]/
│               │   ├── route.ts
│               │   └── execute/
│               │       └── route.ts
│               └── agent/
│                   └── route.ts
```

## 🚀 下一步计划

### 阶段 3: 工作流编辑器界面（Week 5-6）

#### 3.1 安装依赖
```bash
pnpm add reactflow @xyflow/react @dnd-kit/core @dnd-kit/sortable
pnpm add framer-motion zustand
```

#### 3.2 创建工作流编辑器组件
```
src/components/workflow/
├── WorkflowEditor.tsx          # 主编辑器组件
├── NodePalette.tsx             # 节点面板
├── Canvas.tsx                  # 画布组件
├── NodeComponent.tsx           # 节点组件
├── EdgeComponent.tsx           # 连线组件
├── PropertiesPanel.tsx         # 属性面板
└── ControlPanel.tsx            # 控制面板
```

#### 3.3 核心功能实现
- [ ] 无限画布（拖拽、缩放）
- [ ] 节点拖放添加
- [ ] 连线建立关系
- [ ] 节点分组/折叠
- [ ] 参数配置面板
- [ ] 实时预览

### 阶段 4: Agent 系统（Week 7-8）

#### 4.1 自然语言解析
```
src/lib/workflow/agent/
├── IntentParser.ts             # 意图解析器
├── EntityExtractor.ts          # 实体提取器
└── ContextAnalyzer.ts          # 上下文分析器
```

#### 4.2 工作流自动生成
```
src/lib/workflow/agent/
├── WorkflowBuilder.ts          # 工作流构建器
├── NodeSelector.ts             # 节点选择器
└── ParamOptimizer.ts           # 参数优化器
```

### 阶段 5: 模板与资产管理（Week 9）

#### 5.1 预设模板
```
src/lib/workflow/templates/
├── quick-start.json            # 快速开始模板
├── character-design.json       # 角色设计模板
├── comic-creation.json         # 漫画创作模板
└── poster-design.json          # 海报设计模板
```

#### 5.2 资产管理
```
src/components/assets/
├── AssetLibrary.tsx            # 资产库组件
├── AssetUpload.tsx             # 资产上传组件
└── AssetPreview.tsx            # 资产预览组件
```

### 阶段 6: API 实现（贯穿始终）

#### 6.1 工作流管理 API
- `POST /api/workflows` - 创建工作流
- `GET /api/workflows/:id` - 获取工作流
- `PUT /api/workflows/:id` - 更新工作流
- `DELETE /api/workflows/:id` - 删除工作流
- `POST /api/workflows/:id/execute` - 执行工作流

#### 6.2 Agent API
- `POST /api/agent/create-workflow` - 自然语言创建工作流
- `POST /api/agent/optimize` - 优化工作流
- `POST /api/agent/suggest` - 获取优化建议

## 💡 使用示例

### 创建工作流
```typescript
import { Workflow, NodeFactory } from '@/lib/workflow'

// 创建节点
const textNode = NodeFactory.createNode('text-input', {
  name: '脚本输入',
  params: {
    text: '一个关于书生和侠女的故事'
  }
})

const imageNode = NodeFactory.createNode('text-to-image', {
  name: '生成场景图',
  params: {
    prompt: '古代书院，桃花盛开，一位书生在读书',
    style: 'realistic'
  }
})

// 创建工作流
const workflow: Workflow = {
  id: 'workflow_123',
  projectId: 'proj_456',
  name: '古风短剧创作',
  nodes: [textNode, imageNode],
  edges: [
    {
      id: 'edge_1',
      from: textNode.id,
      to: imageNode.id,
      fromPort: 'output',
      toPort: 'prompt'
    }
  ]
}
```

### 执行工作流
```typescript
import { WorkflowEngine } from '@/lib/workflow/engine'

const engine = new WorkflowEngine()
const result = await engine.execute(workflow, {
  projectId: 'proj_456',
  config: {
    maxRetries: 3,
    timeout: 300000
  }
})
```

### Agent 自动创建工作流
```typescript
const response = await fetch('/api/agent/create-workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    intent: '做一个古风短剧，主角是书生和侠女',
    projectId: 'proj_456'
  })
})

const { workflow, suggestions } = await response.json()
```

## 🎨 界面设计参考

### 工作流编辑器布局
```
┌────────────────────────────────────────────────────────┐
│ Drama Studio 工作流编辑器                               │
├──────────┬──────────┬───────────────────────────────────┤
│ 菜单栏   │ 节点库   │ 画布区域                         │
├──────────┼──────────┼───────────────────────────────────┤
│          │ 输入节点 │   [文本] → [文生图] → [图生视频]   │
│  新建    │ AI节点   │   ┌─────┐    ┌─────┐    ┌─────┐  │
│  打开    │ 编辑节点 │   │节点1│ →  │节点2│ →  │节点3│  │
│  保存    │ 组合节点 │   └─────┘    └─────┘    └─────┘  │
│  导出    │ 输出节点 │                                    │
│          │          │   [角色] → [生成] → [视频]       │
├──────────┼──────────┼───────────────────────────────────┤
│ 资产栏   │ Agent    │ 执行历史 / 控制台                  │
│          │ 对话框   │                                    │
└──────────┴──────────┴───────────────────────────────────┘
```

## 📊 性能优化

### 1. 节点执行优化
- 并行执行无依赖的节点
- 缓存节点执行结果
- 增量执行（只执行变化的部分）

### 2. 画布性能
- 虚拟滚动（大量节点时）
- 懒加载节点组件
- Web Worker 处理计算密集任务

### 3. 资产加载
- CDN 加速
- 图片懒加载
- 缩略图预览

## 🔒 安全考虑

1. **参数验证**
   - 所有节点参数都经过严格验证
   - 防止注入攻击

2. **权限控制**
   - 工作流访问权限
   - 资产访问权限

3. **资源限制**
   - 节点执行超时
   - 工作流内存限制
   - 并发执行限制

## 📝 注意事项

1. **向后兼容**
   - 保持现有 API 兼容
   - 逐步迁移到新工作流系统

2. **渐进式升级**
   - 先实现核心功能
   - 逐步添加高级功能

3. **用户体验**
   - 提供丰富的预设模板
   - 详细的帮助文档
   - 友好的错误提示

## 🎉 总结

当前已完成的工作流系统核心架构包括：
- ✅ 完整的设计文档
- ✅ 类型定义系统
- ✅ 节点系统框架
- ✅ 示例节点实现

下一步将进入前端界面开发阶段，创建可视化工作流编辑器。

---

**文档版本**: 1.0  
**更新时间**: 2025-04-07  
**状态**: 开发中

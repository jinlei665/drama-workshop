# Drama Studio 工作流系统升级设计方案

## 一、设计目标

参考即梦无限画布和 ComfyUI 的核心理念，将 Drama Studio 从简单的线性流程升级为：
- **项目制工作流**：所有创作资产集中管理
- **节点式可视化编辑**：像 ComfyUI 一样灵活组合
- **Agent 智能共创**：自然语言对话即可创建工作流
- **多模态混合创作**：图片、视频、音频自由组合

## 二、核心架构

### 2.1 三层架构

```
┌─────────────────────────────────────────────┐
│           展现层 (Presentation)              │
│  - 工作流编辑器 (画布 + 节点)                │
│  - 资产预览区                                │
│  - Agent 对话界面                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│            业务逻辑层 (Business)             │
│  - 工作流引擎 (Workflow Engine)             │
│  - 节点执行器 (Node Executor)               │
│  - Agent 调度器 (Agent Scheduler)           │
│  - 资产管理器 (Asset Manager)               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│             数据层 (Data)                    │
│  - 工作流存储 (PostgreSQL)                  │
│  - 资产存储 (阿里云 OSS)                    │
│  - 执行历史 (Redis + PostgreSQL)            │
└─────────────────────────────────────────────┘
```

### 2.2 核心概念

#### 2.2.1 工作流 (Workflow)
- 定义：由多个节点连接组成的图形化处理流程
- 特点：
  - 可视化编辑（拖拽节点、连接）
  - 支持并行/串行执行
  - 可保存为模板复用
  - 支持版本控制

#### 2.2.2 节点 (Node)
- 定义：代表一个具体操作的模块
- 类型：
  1. **输入节点**：文本、图片、视频、音频输入
  2. **AI 处理节点**：文生图、图生图、视频生成、语音合成
  3. **编辑节点**：抠图、扩图、局部重绘、高清修复
  4. **组合节点**：图层合并、蒙版、混合模式
  5. **输出节点**：导出图片、导出视频、导出音频

#### 2.2.3 Agent
- 定义：理解自然语言意图，自动构建工作流
- 能力：
  - 理解创作需求（如"做一个古风短剧"）
  - 自动选择合适的节点
  - 自动配置参数
  - 提供优化建议

## 三、功能模块设计

### 3.1 工作流编辑器

#### 界面布局
```
┌──────────────────────────────────────────────────────┐
│  菜单栏  |  节点库  |  画布区域 (无限扩展)  |  属性面板 │
├──────────┼──────────┼─────────────────────────────────┤
│          │  输入节点│    [节点A] → [节点B] → [节点C]   │
│          │  AI节点  │    ┌──────────┐   ┌──────────┐  │
│  新建    │  编辑节点│    │ 文本输入 │ → │ 图片生成 │  │
│  打开    │  组合节点│    └──────────┘   └──────────┘  │
│  保存    │  输出节点│    ┌──────────┐   ┌──────────┐  │
│  导出    │          │    │ 角色参考 │ → │ 视频生成 │  │
│          │          │    └──────────┘   └──────────┘  │
│          │          │                                    │
├──────────┼──────────┼─────────────────────────────────┤
│  资产栏  │  Agent   │  执行历史 / 控制台                │
│          │  对话框  │                                    │
└──────────┴──────────┴─────────────────────────────────┘
```

#### 核心功能
1. **画布操作**
   - 无限画布（可自由拖拽、缩放）
   - 节点拖放添加
   - 连线建立节点关系
   - 节点分组/折叠
   - 多选/批量操作
   - 撤销/重做

2. **节点操作**
   - 添加/删除节点
   - 调整节点大小/位置
   - 配置节点参数
   - 预览节点输出
   - 断开/重连连线

3. **执行控制**
   - 单步执行
   - 调试模式
   - 暂停/继续
   - 实时日志

### 3.2 节点系统设计

#### 节点基类
```typescript
interface BaseNode {
  id: string
  type: string
  name: string
  position: { x: number; y: number }
  inputs: NodeInput[]
  outputs: NodeOutput[]
  params: Record<string, any>
  execute(context: ExecutionContext): Promise<NodeResult>
}
```

#### 核心节点类型

##### 1. 输入节点
- `TextNode`: 文本输入
- `ImageNode`: 图片上传/选择
- `VideoNode`: 视频上传/选择
- `AudioNode`: 音频上传/选择
- `ScriptNode`: 脚本导入

##### 2. AI 处理节点
- `TextToImageNode`: 文生图
  - 参数：提示词、风格、尺寸、参考图
  - 输出：图片

- `ImageToImageNode`: 图生图
  - 参数：参考图、提示词、强度、风格
  - 输出：图片

- `ImageToVideoNode`: 图生视频
  - 参数：首帧、尾帧、提示词、时长、比例
  - 输出：视频

- `TextToAudioNode`: 文本转语音
  - 参数：文本、语音、语速、音调
  - 输出：音频

- `ScriptToScenesNode`: 脚本解析生成分镜
  - 参数：脚本文本、风格
  - 输出：分镜列表

##### 3. 编辑节点
- `InpaintNode`: 局部重绘
  - 参数：原图、蒙版、提示词
  - 输出：图片

- `OutpaintNode`: 扩图
  - 参数：原图、扩展方向、提示词
  - 输出：图片

- `UpscaleNode`: 高清修复
  - 参数：原图、放大倍数
  - 输出：图片

- `RemoveBackgroundNode`: 抠图
  - 参数：原图
  - 输出：图片（透明背景）

##### 4. 组合节点
- `ImageBlendNode`: 图像混合
  - 参数：图1、图2、混合模式、透明度
  - 输出：图片

- `LayerMergeNode`: 图层合并
  - 参数：图层列表、合成模式
  - 输出：图片

- `VideoComposeNode`: 视频合成
  - 参数：视频列表、转场、背景音乐
  - 输出：视频

##### 5. 输出节点
- `ExportImageNode`: 导出图片
  - 参数：图片、格式、质量
  - 输出：文件路径

- `ExportVideoNode`: 导出视频
  - 参数：视频、格式、分辨率、帧率
  - 输出：文件路径

- `ExportAudioNode`: 导出音频
  - 参数：音频、格式、采样率
  - 输出：文件路径

### 3.3 Agent 系统

#### Agent 能力
1. **理解意图**
   - 自然语言解析
   - 识别创作类型（短剧、漫画、海报等）
   - 提取关键信息（风格、角色、场景）

2. **自动构建工作流**
   - 根据意图选择合适的节点
   - 自动配置节点参数
   - 建立节点连接关系

3. **优化建议**
   - 分析工作流瓶颈
   - 提供参数优化建议
   - 推荐更优的节点组合

#### Agent 使用示例
```
用户输入："做一个古风短剧，主角是书生和侠女"
Agent 处理：
1. 识别：短剧创作，需要分镜、角色、视频生成
2. 自动构建：
   - TextNode (输入角色描述)
   - ScriptToScenesNode (生成分镜)
   - TextToImageNode (生成角色形象)
   - ImageToVideoNode (生成分镜视频)
   - VideoComposeNode (合成短剧)
3. 配置参数：风格设为"古风"
```

### 3.4 工作流模板

#### 预设模板

##### 1. 快速短剧模板
```
[脚本输入] → [脚本解析] → [分镜生成] → [视频生成] → [视频合成] → [导出]
```

##### 2. 人物形象设计模板
```
[文本描述] → [角色生成] → [三视图生成] → [表情包生成] → [导出]
```

##### 3. 漫画创作模板
```
[故事文本] → [分镜脚本] → [角色生成] → [场景生成] → [漫画合成] → [导出]
```

##### 4. 商业海报模板
```
[产品图片] → [抠图] → [场景合成] → [添加文案] → [风格化] → [导出]
```

##### 5. 图像修复增强模板
```
[模糊图片] → [高清修复] → [颜色校正] → [细节增强] → [导出]
```

### 3.5 资产管理系统

#### 资产类型
1. **图像资产**
   - 角色形象
   - 场景图片
   - 道具素材
   - 参考图

2. **视频资产**
   - 分镜视频
   - 特效素材
   - 片头片尾

3. **音频资产**
   - 背景音乐
   - 音效
   - 配音

#### 资产管理功能
- 资产库浏览
- 资产标签分类
- 资产搜索
- 资产预览
- 资收藏藏
- 资产分享

### 3.6 工作流存储与版本控制

#### 存储格式
```json
{
  "id": "workflow_123",
  "name": "古风短剧创作流",
  "version": "1.0",
  "nodes": [
    {
      "id": "node_1",
      "type": "TextNode",
      "params": { "text": "书生与侠女的故事..." },
      "position": { "x": 100, "y": 100 }
    }
  ],
  "edges": [
    {
      "from": "node_1",
      "to": "node_2",
      "fromPort": "output",
      "toPort": "input"
    }
  ],
  "metadata": {
    "createdAt": "2025-04-07",
    "updatedAt": "2025-04-07",
    "author": "user_123"
  }
}
```

#### 版本控制
- 每次保存自动创建快照
- 支持版本对比
- 支持回滚到历史版本
- 支持分支管理

## 四、数据库设计

### 4.1 工作流表 (workflows)
```sql
CREATE TABLE workflows (
  id VARCHAR(100) PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL, -- 节点、连接、参数
  is_template BOOLEAN DEFAULT FALSE,
  template_category VARCHAR(100),
  version VARCHAR(20) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 工作流版本表 (workflow_versions)
```sql
CREATE TABLE workflow_versions (
  id SERIAL PRIMARY KEY,
  workflow_id VARCHAR(100) REFERENCES workflows(id),
  version VARCHAR(20) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
);
```

### 4.3 资产表 (assets)
```sql
CREATE TABLE assets (
  id VARCHAR(100) PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- image, video, audio, text
  storage_key VARCHAR(500) NOT NULL,
  storage_url VARCHAR(500) NOT NULL,
  metadata JSONB,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.4 工作流执行历史表 (workflow_executions)
```sql
CREATE TABLE workflow_executions (
  id SERIAL PRIMARY KEY,
  workflow_id VARCHAR(100) REFERENCES workflows(id),
  project_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL, -- running, completed, failed
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  results JSONB,
  error_message TEXT
);
```

## 五、API 设计

### 5.1 工作流管理 API

#### POST /api/workflows
创建工作流

#### GET /api/workflows/:id
获取工作流详情

#### PUT /api/workflows/:id
更新工作流

#### DELETE /api/workflows/:id
删除工作流

#### POST /api/workflows/:id/execute
执行工作流

#### GET /api/workflows/:id/versions
获取工作流版本列表

#### POST /api/workflows/:id/versions/:version
恢复到指定版本

### 5.2 节点 API

#### GET /api/nodes/types
获取可用节点类型列表

#### GET /api/nodes/types/:type/schema
获取节点类型的参数 schema

#### POST /api/nodes/execute
执行单个节点

### 5.3 Agent API

#### POST /api/agent/create-workflow
根据自然语言创建工作流

#### POST /api/agent/optimize
优化工作流

#### POST /api/agent/suggest
获取优化建议

### 5.4 资产 API

#### POST /api/assets
上传资产

#### GET /api/assets
获取资产列表

#### GET /api/assets/:id
获取资产详情

#### DELETE /api/assets/:id
删除资产

## 六、前端技术选型

### 6.1 工作流编辑器
- **React Flow**: 用于节点编辑器
- **Dnd Kit**: 用于拖拽功能
- **Zustand**: 状态管理

### 6.2 UI 组件
- **shadcn/ui**: 基础 UI 组件
- **Framer Motion**: 动画效果

### 6.3 图形处理
- **Konva.js**: 画布渲染
- **Fabric.js**: 更高级的图形编辑

## 七、实施计划

### 阶段 1：基础架构 (Week 1-2)
- [ ] 工作流引擎核心
- [ ] 节点系统基础
- [ ] 数据库表设计
- [ ] API 基础框架

### 阶段 2：核心节点 (Week 3-4)
- [ ] 输入节点实现
- [ ] AI 处理节点实现
- [ ] 编辑节点实现

### 阶段 3：编辑器界面 (Week 5-6)
- [ ] 节点编辑器 UI
- [ ] 画布功能
- [ ] 连线功能
- [ ] 参数配置面板

### 阶段 4：Agent 系统 (Week 7-8)
- [ ] 自然语言解析
- [ ] 工作流自动生成
- [ ] 优化建议

### 阶段 5：模板与资产管理 (Week 9)
- [ ] 预设模板
- [ ] 资产管理系统
- [ ] 版本控制

### 阶段 6：测试与优化 (Week 10)
- [ ] 功能测试
- [ ] 性能优化
- [ ] 文档完善

## 八、预期效果

升级后的 Drama Studio 将具备：

1. **专业级工作流编辑能力**
   - 可视化节点编辑
   - 灵活的工作流组合
   - 强大的自定义能力

2. **智能化创作体验**
   - Agent 自动构建工作流
   - 智能参数优化
   - 一键生成专业内容

3. **完整的资产管理**
   - 项目资产集中管理
   - 版本控制
   - 团队协作

4. **丰富的预设模板**
   - 快速开始项目
   - 学习最佳实践
   - 分享工作流

5. **卓越的用户体验**
   - 无限画布
   - 实时预览
   - 流畅的动画

## 九、总结

通过参考即梦无限画布和 ComfyUI 的设计理念，Drama Studio 将从一个简单的线性流程工具升级为一个专业级的 AI 创作工作流平台，为用户提供更强大、更灵活、更智能的创作体验。

---

**文档版本**: 1.0  
**创建时间**: 2025-04-07  
**作者**: Drama Studio Team

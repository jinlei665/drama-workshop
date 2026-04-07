# 默认工作流升级说明

## 更新内容

### 1. 新的默认工作流模板

更新了 `src/lib/workflow/default-workflow.ts`，创建了基于 WorkflowEditorV2 的默认工作流。

#### 工作流流程：
```
文本输入 → 文生人物 → 人物三视图
         ↘ 文生图 → 图生视频
```

#### 节点说明：

1. **文本输入** (node_text_input)
   - 输入：脚本或场景描述
   - 示例：一位古代侠女站在悬崖边，风吹过她的长发，背景是夕阳下的群山，远处有隐约的古堡

2. **文生人物** (node_text_to_character)
   - 输入：人物描述
   - 输出：人物形象图片
   - 示例：一位美丽的古代侠女，穿着淡青色长裙，长发飘飘，手持长剑，英姿飒爽

3. **文生图** (node_text_to_image)
   - 输入：场景描述
   - 输出：场景图片
   - 支持参数：宽度、高度、风格、随机种子、迭代步数、引导强度

4. **人物三视图** (node_text_to_character_triple_views)
   - 输入：人物参考图
   - 输出：正面、侧面、背面三个视角

5. **图生视频** (node_image_to_video)
   - 输入：参考图片 + 动作描述
   - 输出：视频文件
   - 支持参数：时长、比例、运动强度

### 2. 预置模板

除了默认工作流，还提供了 4 个预置模板：

1. **短剧创作完整流程** (default)
   - 包含 5 个节点的完整创作流程
   - 难度：中级

2. **快速开始** (quick-start)
   - 简单的文生图流程
   - 适合新手测试
   - 难度：初级

3. **人物设计** (character-design)
   - 文本输入 → 文生人物 → 人物三视图
   - 专注于角色设计
   - 难度：初级

4. **场景到视频** (scene-to-video)
   - 文本输入 → 文生图 → 图生视频
   - 专注于场景生成
   - 难度：初级

### 3. 代码修改

#### 修改文件：

1. **src/lib/workflow/default-workflow.ts**
   - 更新默认工作流节点配置
   - 修复类型定义（符合 BaseNode 类型要求）
   - 添加 4 个预置模板

2. **src/lib/workflow/agent/WorkflowBuilder.ts**
   - 导入 `getDefaultWorkflow` 函数
   - 更新 `createDefaultWorkflow` 方法
   - 使用新的默认工作流配置

3. **src/app/projects/[id]/workflow/page.tsx**
   - 将 `WorkflowEditor` 替换为 `WorkflowEditorV2`
   - 统一使用新版本编辑器

### 4. 工作流获取逻辑

项目首次访问工作流页面时，API 路由会：

1. 检查数据库中是否有保存的工作流
2. 如果没有，返回默认工作流
3. 前端使用默认工作流初始化编辑器

**API 路由**：`GET /api/projects/[id]/workflow`

### 5. 使用方式

#### 创建新项目：

1. 创建项目后，自动获得默认工作流
2. 进入项目的「工作流」标签页
3. 查看预配置的短剧创作流程

#### 应用模板：

1. 打开工作流编辑器
2. 点击右侧「AI」标签
3. 在「快捷模板」中选择模板
4. 点击应用

#### 自定义工作流：

1. 基于默认工作流修改节点参数
2. 添加或删除节点
3. 调整连接关系
4. 保存工作流

### 6. 类型兼容性

确保节点定义符合 `BaseNode` 类型要求：

```typescript
export interface BaseNode {
  id: string
  type: NodeType
  name: string
  description?: string
  position: { x: number; y: number }
  inputs: NodeInput[]      // 必须包含 id, name, type, required, connected
  outputs: NodeOutput[]    // 必须包含 id, name, type, required, connected
  params: Record<string, any>
  status?: 'idle' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}
```

### 7. 验证结果

- ✅ TypeScript 类型检查通过（default-workflow.ts）
- ✅ 默认工作流符合 BaseNode 类型定义
- ✅ WorkflowEditorV2 正确加载工作流
- ✅ 服务正常运行

### 8. 后续优化建议

1. **工作流版本管理**
   - 支持工作流版本控制
   - 允许回滚到历史版本

2. **模板扩展**
   - 添加更多预置模板（如短视频、动漫等）
   - 支持用户自定义模板

3. **工作流分享**
   - 支持导出工作流配置
   - 支持导入工作流配置
   - 工作流市场

4. **智能推荐**
   - 根据项目类型推荐合适的模板
   - 根据用户习惯优化默认工作流

---

**更新时间**：2025-04-07
**版本**：2.0
**状态**：✅ 完成并可用

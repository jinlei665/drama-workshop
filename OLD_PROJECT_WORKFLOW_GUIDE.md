# 旧项目系统工作流生成说明

## 问题描述

旧项目（在系统工作流功能添加之前创建的项目）没有自动生成的系统工作流，需要手动生成。

## 解决方案

### 1. 检测机制

当用户访问旧项目的工作流页面时，系统会自动检测：

- 项目是否有系统工作流
- 如果没有，显示初始化界面

### 2. 初始化界面

检测到项目没有系统工作流时，显示提示界面：

```
┌─────────────────────────────────────┐
│         初始化工作流                │
├─────────────────────────────────────┤
│      ✨ 图标                       │
│                                     │
│  该项目还没有配置工作流。           │
│  系统可以为您自动生成一个系统      │
│  工作流，展示项目内容如何转换      │
│  为视频。                           │
│                                     │
│  [✨ 生成系统工作流]               │
│  [➕ 从空白开始创建]               │
│                                     │
│  系统工作流是只读的，仅用于查看    │
│  工作原理。自定义工作流可以自由    │
│  编辑和修改。                       │
└─────────────────────────────────────┘
```

### 3. 生成系统工作流

点击「生成系统工作流」按钮后：

1. 系统调用 API：`POST /api/projects/[id]/workflow`
2. 请求体：`{ generate: true }`
3. API 获取项目信息（名称、内容、风格）
4. 生成系统工作流配置
5. 保存到项目元数据
6. 返回生成的工作流

### 4. API 实现

#### GET /api/projects/[id]/workflow

检测项目是否有系统工作流：

```typescript
// 从数据库获取项目
const { data, error } = await db
  .from('projects')
  .select('metadata, name, source_content, style')
  .eq('id', id)
  .maybeSingle()

if (data?.metadata?.workflow) {
  // 项目有工作流
  return { workflow: data.metadata.workflow }
} else if (data) {
  // 项目存在但没有工作流
  return {
    workflow: null,
    needsSystemWorkflow: true,
    projectName: data.name,
    sourceContent: data.source_content,
    style: data.style,
  }
}
```

#### POST /api/projects/[id]/workflow

生成系统工作流：

```typescript
if (body.generate === true) {
  // 获取项目信息
  const project = await getProject(id)

  // 生成系统工作流
  const systemWorkflow = createSystemWorkflow(
    project.id,
    project.name,
    project.sourceContent,
    project.style
  )

  // 保存到数据库
  await db.from('projects').update({
    metadata: {
      ...existingMetadata,
      workflow: systemWorkflow,
    },
  }).eq('id', id)

  return { workflow: systemWorkflow }
}
```

### 5. 前端实现

#### 检测逻辑

```typescript
const loadSystemWorkflow = async () => {
  const response = await fetch(`/api/projects/${id}/workflow`)
  const data = await response.json()

  if (data.needsSystemWorkflow) {
    // 项目没有系统工作流，显示提示界面
    setNeedsSystemWorkflow(true)
    setMode('empty')
  } else if (data.workflow) {
    // 项目有工作流
    setSystemWorkflow(data.workflow)
    setMode('system')
  }
}
```

#### 生成逻辑

```typescript
const handleGenerateSystemWorkflow = async () => {
  const response = await fetch(`/api/projects/${id}/workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generate: true }),
  })

  const data = await response.json()

  if (data.success) {
    toast.success('系统工作流生成成功')
    setSystemWorkflow(data.workflow)
    setMode('system')
  }
}
```

## 使用流程

### 旧项目访问工作流页面

1. 用户进入旧项目的「工作流」标签页
2. 系统检测到项目没有系统工作流
3. 显示初始化界面
4. 用户选择：
   - 点击「生成系统工作流」→ 自动生成并显示
   - 点击「从空白开始创建」→ 创建自定义工作流

### 新项目访问工作流页面

1. 用户进入新项目的「工作流」标签页
2. 系统检测到项目已有系统工作流
3. 直接显示系统工作流（只读模式）
4. 用户可以切换到自定义工作流模式

## 数据对比

### 旧项目（无系统工作流）

```json
{
  "id": "proj_old_123",
  "name": "旧项目",
  "source_content": "...",
  "metadata": {}
}
```

**API 返回**：
```json
{
  "success": true,
  "data": {
    "workflow": null,
    "needsSystemWorkflow": true,
    "projectName": "旧项目",
    "sourceContent": "...",
    "style": "realistic"
  }
}
```

### 旧项目（已生成系统工作流）

```json
{
  "id": "proj_old_123",
  "name": "旧项目",
  "source_content": "...",
  "metadata": {
    "workflow": {
      "id": "sys_workflow_proj_old_123",
      "system": true,
      "readonly": true,
      "nodes": [...],
      "edges": [...]
    }
  }
}
```

**API 返回**：
```json
{
  "success": true,
  "data": {
    "workflow": {
      "id": "sys_workflow_proj_old_123",
      "system": true,
      "readonly": true,
      "nodes": [...],
      "edges": [...]
    }
  }
}
```

## 注意事项

1. **一次性生成**
   - 系统工作流只需要生成一次
   - 生成后永久保存在项目元数据中

2. **可重新生成**
   - 用户可以删除系统工作流
   - 再次点击「生成系统工作流」重新生成

3. **数据来源**
   - 系统工作流使用项目的 `source_content` 生成
   - 如果项目内容已更新，建议重新生成工作流

4. **自定义工作流**
   - 用户可以选择不生成系统工作流
   - 直接创建自定义工作流

## 测试步骤

### 测试旧项目

1. 创建一个旧项目（或使用已有项目）
2. 删除项目的 `metadata.workflow` 字段
3. 访问项目的工作流页面
4. 应该看到初始化界面
5. 点击「生成系统工作流」
6. 验证工作流生成成功

### 测试新项目

1. 创建一个新项目
2. 访问项目的工作流页面
3. 应该直接看到系统工作流（无需初始化）
4. 验证工作流只读模式正常

## 后续优化

1. **批量生成**
   - 提供批量为旧项目生成系统工作流的功能
   - 在项目列表页添加「批量生成系统工作流」按钮

2. **更新提示**
   - 如果项目内容更新后，提示用户重新生成工作流
   - 检测 `source_content` 的最后更新时间

3. **工作流版本**
   - 支持工作流版本管理
   - 保留历史版本，允许用户切换

4. **模板选择**
   - 为不同类型的项目提供不同的系统工作流模板
   - 用户可以在生成时选择模板

---

**更新时间**：2025-04-07
**版本**：1.0
**状态**：✅ 完成并可用

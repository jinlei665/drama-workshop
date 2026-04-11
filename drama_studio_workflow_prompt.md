# Drama Studio 工作流提示词

## 项目概述

Drama Studio（短剧漫剧创作工坊）是一个AI驱动的短剧视频生成工具，支持分镜管理、图片生成、视频生成等功能。

## 核心模块

---

## 一、项目管理

### 1.1 创建项目
**功能**：创建新的短剧创作项目

**输入**：
- `title`: 项目标题（必填）
- `description`: 项目描述（可选）
- `style`: 预设风格（可选，详见风格列表）

**输出**：
- `projectId`: 项目ID
- `title`: 项目标题
- `createdAt`: 创建时间

**API**: `POST /api/projects`

---

### 1.2 查看项目列表
**功能**：获取所有项目列表

**输入**：无

**输出**：
- `projects[]`: 项目数组
  - `id`: 项目ID
  - `title`: 项目标题
  - `description`: 描述
  - `style`: 风格
  - `createdAt`: 创建时间
  - `updatedAt`: 更新时间

**API**: `GET /api/projects`

---

### 1.3 删除项目
**功能**：删除指定项目及其关联的分镜、角色

**输入**：
- `projectId`: 项目ID（必填）

**输出**：
- `success`: 是否成功
- `message`: 结果信息

**API**: `DELETE /api/projects/{id}`

---

## 二、脚本管理

### 2.1 创建脚本
**功能**：为项目创建脚本内容

**输入**：
- `projectId`: 项目ID（必填）
- `title`: 脚本标题（必填）
- `content`: 脚本内容（必填，支持长文本，最多50000字符）
- `description`: 脚本描述（可选）

**输出**：
- `scriptId`: 脚本ID
- `projectId`: 项目ID
- `title`: 脚本标题

**API**: `POST /api/scripts`

---

### 2.2 上传文档创建脚本
**功能**：上传txt/md文档创建脚本

**输入**：
- `file`: 文档文件（txt/md格式，最大5MB）

**输出**：
- `scriptId`: 脚本ID
- `title`: 脚本标题（从文件名提取）
- `content`: 脚本内容

**API**: `POST /api/upload/document`

---

### 2.3 AI分析脚本生成分镜
**功能**：使用AI分析脚本内容，自动生成角色和分镜

**输入**：
- `scriptId`: 脚本ID（必填）
- `projectId`: 项目ID（必填）
- `scriptContent`: 脚本内容（必填）
- `existingCharacters[]`: 已有角色列表（可选）

**输出**：
- `success`: 是否成功
- `charactersCount`: 生成的角色数量
- `scenesCount`: 生成的分镜数量

**API**: `POST /api/scripts/analyze`

**分镜分析提示词规范**：

```
## 分镜拆分核心原则（必须遵守）

### 1. 基于内容适配的分镜策略
- **内容决定数量**：完全摒弃一般的固定范围。分镜数量应由**剧情密度、情感层次和场景转换频率**自然决定。对于氛围浓厚、细节丰富的文学性故事，分镜数量应**大幅增加**，可能达到25-40个或更多。
- **时长服务于情绪**：单个分镜时长（3-8秒）是参考，**不是铁律**。对于需要营造氛围的空镜（如晨曦、晚霞）、复杂的动作序列、或包含深度情绪的特写，时长可延长至**8-12秒甚至更长**。

### 2. 针对本文本类型的特殊处理规则

#### 环境与氛围独立成镜
- 开篇定调的环境描写（如"青溪镇的春天，鸟鸣晨光"）**必须单独设立分镜**，时长可适当放长（5-8秒）
- 重要的时间节点画面（如"晨曦"、"夜幕降临"）应作为独立分镜

#### 心理活动视觉化与时间分配
- 人物的关键回忆（如师父去世、临终教诲）和深度思考，**不应简单合并**
- 应转化为闪回片段或通过人物表演来体现

#### 日常动作的分解
- 为了建立真实的生活感和人物节奏，连续的日常动作**可以拆分为多个分镜**

#### 每个"叙事相遇"独立呈现
- 与配角的每一次相遇都应视为一个独立的叙事单元，包含2-4个分镜

### 3. 分镜数量与时长指导
- 预计分镜数量可能在**30个以上**
- 不必拘泥于每个分镜3-8秒的硬性约束
- 必须为关键段落分配足够的分镜和时间

### 4. 核心目标
生成一个**连贯、细腻、不赶时间**的视觉化分镜脚本
```

---

## 三、分镜管理

### 3.1 创建分镜
**功能**：为项目创建分镜

**输入**：
- `projectId`: 项目ID（必填）
- `sceneNumber`: 分镜编号（必填）
- `title`: 分镜标题（必填）
- `description`: 分镜描述/场景（必填）
- `dialogue`: 对话内容（可选）
- `action`: 动作描述（可选）
- `emotion`: 情绪氛围（可选）
- `characterIds[]`: 关联角色ID列表（可选）
- `shotType`: 景别（可选，如：远景、全景、中景、近景、特写）
- `cameraMovement`: 镜头运动（可选，如：固定、推镜、拉镜、摇镜、跟拍）

**输出**：
- `sceneId`: 分镜ID
- `sceneNumber`: 分镜编号

**API**: `POST /api/projects/{id}/scenes`

---

### 3.2 查看分镜列表
**功能**：获取项目的所有分镜

**输入**：
- `projectId`: 项目ID

**输出**：
- `scenes[]`: 分镜数组
  - `id`: 分镜ID
  - `sceneNumber`: 分镜编号
  - `title`: 标题
  - `description`: 描述
  - `dialogue`: 对话
  - `action`: 动作
  - `emotion`: 情绪
  - `characterIds`: 角色ID列表
  - `imageUrl`: 分镜图片URL
  - `videoUrl`: 视频URL
  - `videoStatus`: 视频生成状态

**API**: `GET /api/projects/{id}/scenes`

---

### 3.3 编辑分镜
**功能**：更新分镜信息

**输入**：
- `projectId`: 项目ID
- `sceneId`: 分镜ID
- 其他字段（可选）：title, description, dialogue, action, emotion, characterIds, shotType, cameraMovement

**输出**：
- `success`: 是否成功

**API**: `PUT /api/projects/{id}/scenes/{sceneId}`

---

### 3.4 删除分镜
**功能**：删除指定分镜

**输入**：
- `projectId`: 项目ID
- `sceneId`: 分镜ID

**输出**：
- `success`: 是否成功

**API**: `DELETE /api/projects/{id}/scenes/{sceneId}`

---

### 3.5 生成场景图片
**功能**：根据分镜描述生成场景图片

**输入**：
- `projectId`: 项目ID（必填）
- `sceneId`: 分镜ID（必填）
- `prompt`: 图片描述（必填）
- `style`: 图像风格（可选，详见风格列表）
- `aspectRatio`: 图片比例（可选：1:1, 16:9, 9:16）

**输出**：
- `success`: 是否成功
- `imageUrl`: 生成图片的URL
- `sceneId`: 分镜ID

**API**: `POST /api/generate/scene-image`

---

### 3.6 批量生成分镜图片
**功能**：批量生成多个分镜的场景图片

**输入**：
- `projectId`: 项目ID（必填）
- `sceneIds[]`: 分镜ID数组（必填）
- `style`: 图像风格（可选）
- `aspectRatio`: 图片比例（可选）

**输出**：
- `success`: 是否成功
- `results[]`: 生成结果数组
  - `sceneId`: 分镜ID
  - `imageUrl`: 图片URL
  - `status`: 状态

**API**: `POST /api/generate/batch-scenes`

---

### 3.7 生成视频
**功能**：根据分镜图片生成视频

**输入**：
- `projectId`: 项目ID（必填）
- `sceneIds[]`: 分镜ID数组（必填）
- `firstFrame`: 首帧模式（必填，布尔值）
  - `true`: 使用分镜图片作为首帧
  - `false`: 使用分镜图片和尾帧图片
- `lastFrameSceneId`: 尾帧分镜ID（firstFrame=false时必填）
- `duration`: 视频时长（可选，4-12秒，默认6秒）
- `aspectRatio`: 视频比例（可选：16:9, 9:16）

**输出**：
- `success`: 是否成功
- `results[]`: 生成结果数组
  - `sceneId`: 分镜ID
  - `videoUrl`: 视频URL
  - `status`: 状态

**API**: `POST /api/generate/videos`

---

## 四、角色管理

### 4.1 创建角色
**功能**：为项目创建角色

**输入**：
- `projectId`: 项目ID（必填）
- `name`: 角色名称（必填）
- `appearance`: 外观描述（必填）
- `frontViewKey`: 正面视图存储key（可选）
- `imageUrl`: 角色图片URL（可选）

**输出**：
- `characterId`: 角色ID
- `name`: 角色名称

**API**: `POST /api/projects/{id}/characters`

---

### 4.2 查看角色列表
**功能**：获取项目的所有角色

**输入**：
- `projectId`: 项目ID

**输出**：
- `characters[]`: 角色数组
  - `id`: 角色ID
  - `name`: 角色名称
  - `appearance`: 外观描述
  - `frontViewKey`: 正面视图key
  - `imageUrl`: 角色图片URL
  - `appearances[]`: 角色形象列表

**API**: `GET /api/projects/{id}/characters`

---

### 4.3 编辑角色
**功能**：更新角色信息

**输入**：
- `projectId`: 项目ID
- `characterId`: 角色ID
- 其他字段（可选）：name, appearance, frontViewKey, imageUrl

**输出**：
- `success`: 是否成功

**API**: `PUT /api/projects/{id}/characters/{characterId}`

---

### 4.4 删除角色
**功能**：删除指定角色

**输入**：
- `projectId`: 项目ID
- `characterId`: 角色ID

**输出**：
- `success`: 是否成功

**API**: `DELETE /api/projects/{id}/characters/{characterId}`

---

### 4.5 生成角色正面视图
**功能**：根据角色描述生成正面视图

**输入**：
- `projectId`: 项目ID（必填）
- `characterId`: 角色ID（必填）
- `appearance`: 角色外观描述（必填）
- `style`: 图像风格（可选）
- `gender`: 性别（可选：male, female, neutral）
- `age`: 年龄（可选：child, teen, adult, elder）

**输出**：
- `success`: 是否成功
- `imageUrl`: 生成的图片URL
- `frontViewKey`: 存储key

**API**: `POST /api/generate/character-views`

---

### 4.6 从文字生成角色形象
**功能**：根据文字描述生成新的人物形象

**输入**：
- `projectId`: 项目ID（必填）
- `characterId`: 角色ID（必填）
- `prompt`: 形象描述（必填）
- `style`: 图像风格（可选）

**输出**：
- `success`: 是否成功
- `appearanceId`: 形象ID
- `imageUrl`: 生成的图片URL

**API**: `POST /api/generate/appearance-from-text`

---

### 4.7 从图片生成角色形象
**功能**：根据参考图片生成新的人物形象

**输入**：
- `projectId`: 项目ID（必填）
- `characterId`: 角色ID（必填）
- `imageUrl`: 参考图片URL（必填）
- `prompt`: 描述（可选）

**输出**：
- `success`: 是否成功
- `appearanceId`: 形象ID
- `imageUrl`: 生成的图片URL

**API**: `POST /api/generate/appearance-from-image`

---

## 五、人物库管理

### 5.1 获取人物库列表
**功能**：获取人物库中的所有人物

**输入**：
- `search`: 搜索关键词（可选）
- `page`: 页码（可选，默认1）
- `pageSize`: 每页数量（可选，默认20）

**输出**：
- `characters[]`: 人物数组
  - `id`: 人物ID
  - `name`: 人物名称
  - `description`: 人物描述
  - `appearance`: 外貌描述
  - `personality`: 性格描述
  - `tags[]`: 标签数组
  - `imageUrl`: 参考图片URL
  - `frontViewKey`: 正面视图key
  - `style`: 图像风格
- `total`: 总数量
- `page`: 当前页码
- `pageSize`: 每页数量

**API**: `GET /api/character-library`

---

### 5.2 添加人物到人物库
**功能**：创建新的人物到人物库

**输入**：
- `name`: 人物名称（必填）
- `description`: 人物描述（可选）
- `appearance`: 外貌描述（可选）
- `personality`: 性格描述（可选）
- `tags[]`: 标签数组（可选）
- `imageUrl`: 参考图片URL（可选，优先使用）
- `style`: 图像风格（可选：realistic, anime, cartoon, oil_painting）

**输出**：
- `id`: 人物ID
- `name`: 人物名称

**API**: `POST /api/character-library`

---

### 5.3 上传参考图生成三视图
**功能**：上传参考图片，生成角色的三视图（正面、侧面、背面）

**输入**：
- `characterId`: 人物库ID（必填）
- `imageUrl`: 参考图片URL（必填）

**输出**：
- `success`: 是否成功
- `views`: 三视图结果
  - `front`: 正面视图URL
  - `side`: 侧面视图URL
  - `back`: 背面视图URL

**API**: `POST /api/generate/character-triple-views`

---

### 5.4 从人物库导入到项目
**功能**：将人物库中的人物导入到当前项目

**输入**：
- `libraryId`: 人物库ID（必填）
- `projectId`: 项目ID（必填）

**输出**：
- `success`: 是否成功
- `characterId`: 项目角色ID

**API**: `POST /api/character-library/{id}/import`

---

### 5.5 添加项目人物到人物库
**功能**：将项目中的人物添加到人物库

**输入**：
- `projectId`: 项目ID（必填）
- `characterId`: 角色ID（必填）
- `tags[]`: 标签数组（可选）

**输出**：
- `success`: 是否成功
- `libraryId`: 人物库ID

**API**: `POST /api/character-library/from-project`

---

## 六、AI独立生成

### 6.1 文生图（Text-to-Image）
**功能**：根据文本提示词生成图片

**输入**：
- `prompt`: 提示词（必填）
- `negativePrompt`: 反向提示词（可选）
- `style`: 图像风格（必填）
- `aspectRatio`: 图片比例（必填）
- `optimizePrompt`: 是否优化提示词（可选，默认true）

**输出**：
- `success`: 是否成功
- `imageUrl`: 生成的图片URL

**API**: `POST /api/create/text-to-image`

**风格选项**：
- realistic: 写实风格
- anime: 动漫风格
- cartoon: 卡通风格
- oil_painting: 油画风格

**比例选项**：
- 1:1 (512x512)
- 16:9 (1024x576)
- 9:16 (576x1024)

---

### 6.2 图生图（Image-to-Image）
**功能**：根据参考图片生成新图片

**输入**：
- `imageUrl`: 参考图片URL（必填）
- `prompt`: 目标描述（必填）
- `style`: 图像风格（可选）
- `aspectRatio`: 图片比例（可选）
- `strength`: 变换强度（可选，0-1，默认0.7）
- `optimizePrompt`: 是否优化提示词（可选，默认true）

**输出**：
- `success`: 是否成功
- `imageUrl`: 生成的图片URL

**API**: `POST /api/create/image-to-image`

---

### 6.3 文生视频（Text-to-Video）
**功能**：根据文本描述生成视频

**输入**：
- `prompt`: 视频描述（必填）
- `duration`: 视频时长（可选，4-12秒，默认6秒）
- `aspectRatio`: 视频比例（可选：16:9, 9:16, 1:1）
- `generateAudio`: 是否生成音频（可选，默认false）
- `optimizePrompt`: 是否优化提示词（可选，默认true）

**输出**：
- `success`: 是否成功
- `videoUrl`: 生成的视频URL
- `audioUrl`: 生成的音频URL（如果generateAudio=true）

**API**: `POST /api/create/text-to-video`

---

### 6.4 图生视频（Image-to-Video）
**功能**：根据静态图片生成视频

**输入**：
- `imageUrl`: 静态图片URL（必填）
- `prompt`: 运动描述（可选）
- `firstFrame`: 是否为首帧模式（必填）
- `lastFrameImageUrl`: 尾帧图片URL（firstFrame=false时必填）
- `duration`: 视频时长（可选，4-12秒，默认6秒）
- `aspectRatio`: 视频比例（可选：16:9, 9:16）
- `optimizePrompt`: 是否优化提示词（可选，默认true）

**输出**：
- `success`: 是否成功
- `videoUrl`: 生成的视频URL

**API**: `POST /api/create/image-to-video`

---

### 6.5 提示词优化
**功能**：使用LLM智能优化用户的提示词

**输入**：
- `prompt`: 原始提示词（必填）
- `type`: 类型（必填：image 或 video）

**输出**：
- `optimizedPrompt`: 优化后的提示词

**API**: `POST /api/create/optimize-prompt`

---

## 七、视频处理

### 7.1 合并视频
**功能**：将多个视频片段合并成一个完整视频

**输入**：
- `videoUrls[]`: 视频URL数组（必填，至少2个）
- `aspectRatio`: 输出视频比例（可选：16:9, 9:16）

**输出**：
- `success`: 是否成功
- `videoUrl`: 合并后的视频URL

**API**: `POST /api/videos/merge`

---

### 7.2 合并剧集视频
**功能**：按集数合并分镜视频

**输入**：
- `episodeId`: 剧集ID（必填）
- `sceneIds[]`: 分镜ID数组（可选，默认全部）
- `aspectRatio`: 输出视频比例（可选）

**输出**：
- `success`: 是否成功
- `videoUrl`: 合并后的视频URL

**API**: `POST /api/episodes/{id}/merge-videos`

---

## 八、工作流节点类型

### 8.1 文本输入（text-input）
**输入端口**：无
**输出端口**：`text` - 文本内容

---

### 8.2 图片输入（image-input）
**输入端口**：无
**输出端口**：`image` - 图片URL

---

### 8.3 脚本输入（script-input）
**输入端口**：无
**输出端口**：`script` - 脚本内容

---

### 8.4 文生图（text-to-image）
**输入端口**：
- `prompt`: 提示词

**输出端口**：
- `image`: 生成的图片

---

### 8.5 图生视频（image-to-video）
**输入端口**：
- `prompt`: 提示词（可选）
- `firstFrame`: 首帧图片
- `lastFrame`: 尾帧图片（可选）

**输出端口**：
- `video`: 生成的视频

---

### 8.6 文字转语音（text-to-audio）
**输入端口**：
- `text`: 文本内容

**输出端口**：
- `audio`: 生成的音频

---

### 8.7 角色生成（text-to-character）
**输入端口**：
- `description`: 角色描述

**输出端口**：
- `character`: 角色对象
- `image`: 角色图片

---

### 8.8 脚本分析（script-to-scenes）
**输入端口**：
- `script`: 脚本内容

**输出端口**：
- `scenes`: 分镜数组

---

### 8.9 LLM处理（llm-process）
**输入端口**：
- `input`: 输入内容

**输出端口**：
- `output`: 处理结果

---

### 8.10 视频合成（video-compose）
**输入端口**：
- `videos`: 视频数组

**输出端口**：
- `video`: 合并后的视频

---

## 九、预设风格

### 9.1 图像风格
| 风格ID | 名称 | 说明 |
|--------|------|------|
| realistic | 写实风格 | 逼真的视觉效果 |
| anime | 动漫风格 | 日系动漫风格 |
| cartoon | 卡通风格 | 卡通动画风格 |
| oil_painting | 油画风格 | 古典油画效果 |

### 9.2 项目预设风格
| 风格ID | 名称 | 说明 |
|--------|------|------|
| cinematic | 电影级写实 | 高质量电影感画面 |
| ink_wash | 水墨国风 | 中国传统水墨画风格 |
| anime_vibe | 动漫质感 | 二次元动漫风格 |
| oil_classic | 油画质感 | 古典油画效果 |
| modern_flat | 现代扁平 | 简约现代插画风格 |
| vintage | 复古胶片 | 怀旧胶片质感 |
| noir | 黑白电影 | 经典黑白电影风格 |
| warm_tone | 暖色调 | 温馨暖色系画面 |

---

## 十、数据结构

### 10.1 项目 (Project)
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "style": "string",
  "customStylePrompt": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 10.2 脚本 (Script)
```json
{
  "id": "string",
  "projectId": "string",
  "title": "string",
  "content": "string",
  "description": "string",
  "status": "active | inactive",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 10.3 分镜 (Scene)
```json
{
  "id": "string",
  "projectId": "string",
  "sceneNumber": "number",
  "title": "string",
  "description": "string",
  "dialogue": "string",
  "action": "string",
  "emotion": "string",
  "characterIds": ["string"],
  "imageUrl": "string",
  "videoUrl": "string",
  "videoStatus": "pending | processing | completed | failed",
  "shotType": "string",
  "cameraMovement": "string",
  "metadata": {},
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 10.4 角色 (Character)
```json
{
  "id": "string",
  "projectId": "string",
  "name": "string",
  "appearance": "string",
  "frontViewKey": "string",
  "imageUrl": "string",
  "appearances": [
    {
      "id": "string",
      "imageUrl": "string",
      "prompt": "string",
      "isPrimary": "boolean",
      "order": "number"
    }
  ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 10.5 人物库 (CharacterLibrary)
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "appearance": "string",
  "personality": "string",
  "tags": ["string"],
  "imageUrl": "string",
  "frontViewKey": "string",
  "style": "string",
  "createdAt": "datetime"
}
```

---

## 十一、工作流示例

### 示例1：完整短剧制作流程
```
1. 文本输入 → 输入脚本内容
2. 脚本分析 → 提取角色和分镜
3. 角色生成（循环）→ 为每个角色生成形象
4. 分镜图片生成（循环）→ 为每个分镜生成场景图
5. 视频生成（循环）→ 将图片转为视频
6. 视频合成 → 合并所有视频片段
7. 输出 → 完整短剧视频
```

### 示例2：快速生成模式
```
1. 文本输入 → 输入视频描述
2. 文生图 → 生成首帧图片
3. 图生视频 → 生成视频
4. 输出 → 视频文件
```

---

## 十二、注意事项

1. **视频生成时长**：默认4-12秒，如使用Seedance 2.0可扩展至4-15秒
2. **图片比例**：推荐使用9:16（竖屏）适合短视频平台
3. **分镜数量**：文学性内容建议30个以上分镜
4. **角色关联**：分镜图片生成时会自动使用分镜中关联角色的形象
5. **存储**：所有生成的图片和视频存储在阿里云OSS

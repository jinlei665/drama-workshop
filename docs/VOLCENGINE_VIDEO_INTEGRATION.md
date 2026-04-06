# 火山引擎视频生成集成说明

## 概述

项目现已支持火山引擎（VolcEngine）的视频生成 API，支持最新的 Seedance 2.0 系列模型，视频时长可配置范围为 4-15 秒。

**重要说明**：
- 默认模型为 **doubao-seedance-1-5-pro-251215**（豆包 1.5pro），时长范围 **4-12秒**
- **Seedance 2.0 是可选的**，需要用户手动配置才能使用
- 只有配置了 Seedance 2.0 模型时，才能选择 **4-15秒** 的时长

## 视频模型对比

### 豆包 1.5pro（默认）

- **模型名称**: `doubao-seedance-1-5-pro-251215`
- **Provider**: `doubao`
- **时长范围**: 4-12秒
- **特性**:
  - 稳定可靠
  - 适用于简单场景
  - 系统默认模型

### 火山引擎 Seedance 2.0（可选）

- **模型名称**: `doubao-seedance-2-0`
- **Provider**: `volcengine`
- **时长范围**: 4-15秒
- **特性**:
  - 支持更长时长（最多15秒）
  - 更好的画面连贯性
  - 支持首尾帧模式，确保场景过渡流畅
  - 支持多种分辨率：480p, 720p, 1080p
  - 支持多种比例：16:9, 9:16, 1:1, 4:3, 3:4, 21:9

## 配置方式

### 1. 使用默认模型（推荐）

无需任何配置，系统默认使用豆包 1.5pro 模型，时长范围 4-12秒。

### 2. 配置 Seedance 2.0（可选）

#### 数据库配置

在 `user_settings` 表中配置：

```sql
UPDATE user_settings
SET
  video_provider = 'volcengine',
  video_model = 'doubao-seedance-2-0'
WHERE id = '<user_id>';
```

#### 环境变量配置

在 `.env.local` 文件中配置：

```env
# 火山引擎 API 配置（可选）
VOLCENGINE_API_KEY=your_api_key_here
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com
```

## 时长配置（自动适配）

系统会根据当前配置的模型自动调整时长范围：

### 豆包 1.5pro（默认）

- **时长范围**: 4-12秒
- **前端显示**: 滑块最大值为12
- **后端验证**: 自动限制在12秒以内

### Seedance 2.0

- **时长范围**: 4-15秒
- **前端显示**: 滑块最大值为15
- **后端验证**: 自动限制在15秒以内

### 前端配置

在分镜面板的视频生成对话框中，系统会自动根据当前模型调整时长选择器：

```tsx
<Slider
  id="duration"
  min={4}
  max={maxVideoDuration}  // 自动根据模型调整：1.5pro=12, 2.0=15
  step={1}
  value={[duration]}
  onValueChange={(value) => setDuration(value[0])}
/>
```

### 后端计算

后端会根据分镜内容自动计算推荐时长，并根据当前模型限制最大值：

```typescript
function calculateDuration(scene, videoModel) {
  let duration = 4; // 基础4秒

  // 根据对白长度增加时长
  if (scene.dialogue) {
    const dialogueLength = scene.dialogue.length;
    if (dialogueLength > 50) duration += 4;
    else if (dialogueLength > 30) duration += 3;
    else if (dialogueLength > 15) duration += 2;
    else if (dialogueLength > 0) duration += 1;
  }

  // 根据动作描述增加时长
  if (scene.action && scene.action.length > 20) duration += 2;
  else if (scene.action && scene.action.length > 0) duration += 1;

  // 根据场景描述增加时长
  if (scene.description && scene.description.length > 100) duration += 1;

  // 根据视频模型确定最大时长
  const maxDuration = videoModel === 'doubao-seedance-2-0' ? 15 : 12;
  return Math.min(Math.max(duration, 4), maxDuration);
}
```

## API 调用示例

### 单帧模式（一张图片生成视频）

```typescript
import { generateVideoFromImage } from '@/lib/ai'

// 使用默认模型（1.5pro）
const result = await generateVideoFromImage(
  prompt,           // 视频描述提示词
  imageUrl,         // 首帧图片URL
  {
    model: 'doubao-seedance-1-5-pro-251215',
    duration: 10,   // 10秒（最大12秒）
    ratio: '16:9',  // 宽高比
    resolution: '720p',
    generateAudio: true,
  }
)

// 使用 Seedance 2.0
const result2 = await generateVideoFromImage(
  prompt,           // 视频描述提示词
  imageUrl,         // 首帧图片URL
  {
    model: 'doubao-seedance-2-0',
    duration: 14,   // 14秒（最大15秒）
    ratio: '16:9',  // 宽高比
    resolution: '720p',
    generateAudio: true,
  }
)
```

### 首尾帧模式（两张图片生成视频）

```typescript
import { generateVideoFromFrames } from '@/lib/ai'

// 使用默认模型（1.5pro）
const result = await generateVideoFromFrames(
  prompt,           // 视频描述提示词
  firstFrameUrl,    // 首帧图片URL
  lastFrameUrl,     // 尾帧图片URL
  {
    model: 'doubao-seedance-1-5-pro-251215',
    duration: 8,    // 8秒（最大12秒）
    ratio: '16:9',
    resolution: '720p',
    generateAudio: true,
  }
)

// 使用 Seedance 2.0
const result2 = await generateVideoFromFrames(
  prompt,           // 视频描述提示词
  firstFrameUrl,    // 首帧图片URL
  lastFrameUrl,     // 尾帧图片URL
  {
    model: 'doubao-seedance-2-0',
    duration: 12,   // 12秒（最大15秒）
    ratio: '16:9',
    resolution: '720p',
    generateAudio: true,
  }
)
```

## 注意事项

1. **模型切换**：
   - 默认使用 1.5pro，无需配置
   - 需要更长时长时，可切换到 Seedance 2.0
   - 切换模型后，时长选择器会自动调整范围

2. **API Key 要求**：
   - 使用 Seedance 2.0 需要有效的火山引擎 API Key
   - 确保账户有足够的配额

3. **时长建议**：
   - **1.5pro**：简单场景4-6秒，中等7-9秒，复杂10-12秒
   - **Seedance 2.0**：简单场景4-6秒，中等7-11秒，复杂12-15秒

4. **性能优化**：
   - 批量生成时建议添加延迟（10秒间隔）避免限流
   - 使用首尾帧模式可以获得更流畅的过渡效果

5. **兼容性**：
   - 旧版 1.5pro 模型仍可使用
   - 可以在同一项目中混合使用不同模型
   - 前端会根据当前模型自动调整时长范围

## 技术细节

### 默认配置

```typescript
// src/lib/model-config.tsx
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  videoProvider: 'doubao',        // 默认使用豆包
  videoModel: 'doubao-seedance-1-5-pro-251215',  // 1.5pro
  // ...
}
```

### 动态时长调整

前端会根据用户配置的模型自动计算最大时长：

```typescript
const getMaxVideoDuration = () => {
  if (modelConfig.videoModel === 'doubao-seedance-2-0') {
    return 15;  // Seedance 2.0 支持 4-15 秒
  }
  return 12;  // 其他模型（如 1.5pro）支持 4-12 秒
}
```

### 修改的文件

1. `src/lib/model-config.tsx` - 默认配置为 1.5pro
2. `src/lib/ai/index.ts` - 默认视频模型为 1.5pro
3. `src/app/api/generate/videos/route.ts` - 根据模型动态计算时长
4. `src/app/projects/[id]/scenes-panel.tsx` - 前端根据模型调整时长范围

## 支持的提供商

目前支持以下视频生成提供商：

1. **doubao** (豆包) - 默认，Seedance 1.5 Pro，时长4-12秒
2. **volcengine** (火山引擎) - 可选，Seedance 2.0，时长4-15秒

## 未来扩展

计划支持更多视频生成模型：

- Runway Gen-3
- Pika Labs
- Kling AI
- Sora (OpenAI)

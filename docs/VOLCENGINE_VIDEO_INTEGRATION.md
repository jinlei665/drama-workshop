# 火山引擎视频生成集成说明

## 概述

项目现已支持火山引擎（VolcEngine）的视频生成 API，支持最新的 Seedance 2.0 系列模型，视频时长可配置范围为 4-15 秒。

## 视频模型

### 火山引擎 Seedance 2.0

- **模型名称**: `doubao-seedance-2-0`
- **Provider**: `volcengine`
- **特性**:
  - 支持更长时长：4-15秒（相比旧版4-12秒）
  - 更好的画面连贯性
  - 支持首尾帧模式，确保场景过渡流畅
  - 支持多种分辨率：480p, 720p, 1080p
  - 支持多种比例：16:9, 9:16, 1:1, 4:3, 3:4, 21:9

### 旧版模型（仍可使用）

- **模型名称**: `doubao-seedance-1-5-pro-251215`
- **Provider**: `doubao`
- **特性**:
  - 时长范围：4-12秒
  - 稳定可靠
  - 适用于简单场景

## 配置方式

### 1. 数据库配置

在 `user_settings` 表中配置：

```sql
UPDATE user_settings
SET
  video_provider = 'volcengine',
  video_model = 'doubao-seedance-2-0'
WHERE id = '<user_id>';
```

### 2. 环境变量配置

在 `.env.local` 文件中配置：

```env
# 火山引擎 API 配置
VOLCENGINE_API_KEY=your_api_key_here
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com
```

### 3. 默认配置

系统默认使用火山引擎模型：

```typescript
// src/lib/model-config.tsx
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  // ...
  videoProvider: 'volcengine',
  videoModel: 'doubao-seedance-2-0',
  // ...
}
```

## 时长配置

### 前端配置

在分镜面板的视频生成对话框中，用户可以通过滑块选择视频时长：

```tsx
<Slider
  id="duration"
  min={4}
  max={15}
  step={1}
  value={[duration]}
  onValueChange={(value) => setDuration(value[0])}
/>
```

### 后端计算

后端会根据分镜内容自动计算推荐时长，但会限制在 4-15 秒范围内：

```typescript
function calculateDuration(scene: { dialogue?: string | null; action?: string | null; description?: string }): number {
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

  // 限制在 4-15 秒范围内
  return Math.min(Math.max(duration, 4), 15);
}
```

## API 调用示例

### 单帧模式（一张图片生成视频）

```typescript
import { generateVideoFromImage } from '@/lib/ai'

const result = await generateVideoFromImage(
  prompt,           // 视频描述提示词
  imageUrl,         // 首帧图片URL
  {
    model: 'doubao-seedance-2-0',
    duration: 10,   // 10秒
    ratio: '16:9',  // 宽高比
    resolution: '720p',
    generateAudio: true,
  }
)
```

### 首尾帧模式（两张图片生成视频）

```typescript
import { generateVideoFromFrames } from '@/lib/ai'

const result = await generateVideoFromFrames(
  prompt,           // 视频描述提示词
  firstFrameUrl,    // 首帧图片URL
  lastFrameUrl,     // 尾帧图片URL
  {
    model: 'doubao-seedance-2-0',
    duration: 8,    // 8秒
    ratio: '16:9',
    resolution: '720p',
    generateAudio: true,
  }
)
```

## 迁移指南

### 从旧版迁移到火山引擎

1. **运行迁移脚本**:

```bash
psql -U drama_user -d drama_studio -f assets/migrate-to-volcengine-video.sql
```

2. **验证迁移结果**:

```sql
SELECT
  video_provider,
  video_model,
  COUNT(*) as user_count
FROM user_settings
GROUP BY video_provider, video_model;
```

3. **重启应用**:

```bash
pnpm dev
```

## 注意事项

1. **API Key 要求**:
   - 火山引擎需要有效的 API Key
   - 确保账户有足够的配额

2. **时长建议**:
   - 简单场景：4-6秒
   - 中等场景：7-10秒
   - 复杂场景：11-15秒

3. **性能优化**:
   - 批量生成时建议添加延迟（10秒间隔）避免限流
   - 使用首尾帧模式可以获得更流畅的过渡效果

4. **兼容性**:
   - 旧版模型仍可使用，不受影响
   - 可以在同一项目中混合使用不同模型

## 技术细节

### 时长限制变化

- **旧版**: 4-12秒（基础6秒）
- **新版**: 4-15秒（基础4秒）

### 修改的文件

1. `src/lib/model-config.tsx` - 更新默认模型配置
2. `src/lib/ai/index.ts` - 更新默认视频模型
3. `src/app/api/generate/videos/route.ts` - 更新时长计算逻辑
4. `src/app/projects/[id]/scenes-panel.tsx` - 更新前端时长选择器
5. `assets/migrate-to-volcengine-video.sql` - 数据库迁移脚本

## 支持的提供商

目前支持以下视频生成提供商：

1. **volcengine** (火山引擎) - 默认，最新 Seedance 2.0
2. **doubao** (豆包) - 旧版 Seedance 1.5 Pro

## 未来扩展

计划支持更多视频生成模型：

- Runway Gen-3
- Pika Labs
- Kling AI
- Sora (OpenAI)

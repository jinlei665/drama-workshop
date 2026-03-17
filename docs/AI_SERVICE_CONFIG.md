# AI 服务配置指南

## 快速配置（推荐）

### 使用 Coze API 配置系统模型

本项目支持在**设置页面**配置 Coze API Key，配置后可在自部署环境中使用系统内置的所有 AI 模型。

#### 获取 Coze API Key

1. 访问 [Coze 平台](https://www.coze.cn) 并登录
2. 点击右上角头像 →「个人设置」
3. 在左侧菜单选择「API 访问令牌」
4. 点击「创建令牌」，选择权限后生成
5. 复制生成的 Token（以 `pat-` 开头）

#### 配置步骤

1. 打开应用，点击右上角「设置」按钮
2. 选择「API」标签页
3. 填入 API Key 和 Base URL（可选，默认 `https://api.coze.com`）
4. 点击「保存配置」

配置完成后，所有 AI 功能（LLM、图像生成、视频生成）都将使用你配置的 Coze API。

---

## 问题说明

本项目使用的 `coze-coding-dev-sdk` 依赖 Coze 平台的认证环境变量：
- `COZE_WORKLOAD_IDENTITY_API_KEY`
- `COZE_INTEGRATION_BASE_URL`

**在自己部署的环境中，这些环境变量不存在。** 但通过配置 Coze API Key，可以继续使用系统内置模型。

---

## 数据库配置（如使用数据库）

如果使用 MySQL 或 Supabase，需要在 `user_settings` 表中添加新字段：

```sql
-- 添加 Coze API 配置字段
ALTER TABLE user_settings 
ADD COLUMN coze_api_key VARCHAR(500),
ADD COLUMN coze_base_url VARCHAR(200) DEFAULT 'https://api.coze.com';
```

完整的 `user_settings` 表结构：

```sql
CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT UUID(),
    -- Coze API 配置
    coze_api_key VARCHAR(500),
    coze_base_url VARCHAR(200) DEFAULT 'https://api.coze.com',
    -- LLM 配置
    llm_provider VARCHAR(50) DEFAULT 'doubao',
    llm_model VARCHAR(100) DEFAULT 'doubao-seed-1-8-251228',
    llm_api_key VARCHAR(500),
    llm_base_url VARCHAR(500),
    -- 图像配置
    image_provider VARCHAR(50) DEFAULT 'doubao',
    image_model VARCHAR(100) DEFAULT 'doubao-seed-3-0',
    image_api_key VARCHAR(500),
    image_base_url VARCHAR(500),
    image_size VARCHAR(20) DEFAULT '2K',
    -- 视频配置
    video_provider VARCHAR(50) DEFAULT 'doubao',
    video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
    video_api_key VARCHAR(500),
    video_base_url VARCHAR(500),
    video_resolution VARCHAR(20) DEFAULT '720p',
    video_ratio VARCHAR(10) DEFAULT '16:9',
    -- 语音配置
    voice_provider VARCHAR(50) DEFAULT 'doubao',
    voice_model VARCHAR(100) DEFAULT 'doubao-tts',
    voice_api_key VARCHAR(500),
    voice_base_url VARCHAR(500),
    voice_default_style VARCHAR(50) DEFAULT 'natural',
    -- FFmpeg 配置
    ffmpeg_path VARCHAR(500),
    ffprobe_path VARCHAR(500),
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 方案二：使用火山引擎/豆包 API

### 1. 获取 API Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 开通「豆包大模型」服务
3. 创建 API Key

### 2. 配置环境变量

```env
# 火山引擎/豆包 API 配置
ARK_API_KEY=your_ark_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 图像生成（豆包 SeeDream）
IMAGE_API_KEY=your_image_api_key
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 视频生成（豆包 Seedance）
VIDEO_API_KEY=your_video_api_key
VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

### 3. 修改代码

需要修改 `src/lib/ai/index.ts`，替换 SDK 为火山引擎官方 SDK：

```typescript
// 安装火山引擎 SDK
// pnpm add @volcengine/openapi

import { Ark } from '@volcengine/openapi';

const client = new Ark({
  apiKey: process.env.ARK_API_KEY,
  baseUrl: process.env.ARK_BASE_URL,
});

// 调用 LLM
const response = await client.chat.completions.create({
  model: 'doubao-pro-32k',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

---

## 方案二：使用 OpenAI API

### 1. 获取 API Key

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 创建 API Key

### 2. 配置环境变量

```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1  # 或代理地址
```

### 3. 修改代码

```typescript
// 安装 OpenAI SDK
// pnpm add openai

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// LLM 调用
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

// 图像生成
const image = await openai.images.generate({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset',
  size: '1024x1024',
});
```

---

## 方案三：使用 DeepSeek API（性价比高）

### 1. 获取 API Key

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册并创建 API Key

### 2. 配置环境变量

```env
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### 3. 修改代码

DeepSeek API 兼容 OpenAI 格式：

```typescript
import OpenAI from 'openai';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// LLM 调用
const response = await deepseek.chat.completions.create({
  model: 'deepseek-chat',  // 或 deepseek-reasoner
  messages: [{ role: 'user', content: 'Hello' }],
});
```

---

## 方案四：使用本地模型（完全离线）

### Ollama 本地部署

#### 1. 安装 Ollama

```bash
# Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# 下载 https://ollama.com/download/windows
```

#### 2. 下载模型

```bash
# 下载 Llama 3
ollama pull llama3.1:8b

# 下载 Qwen2.5
ollama pull qwen2.5:7b

# 下载 DeepSeek
ollama pull deepseek-r1:7b
```

#### 3. 配置环境变量

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

#### 4. 修改代码

```typescript
// Ollama API 兼容 OpenAI 格式
import OpenAI from 'openai';

const ollama = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // 任意值
});

const response = await ollama.chat.completions.create({
  model: 'llama3.1:8b',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### 本地图像生成（Stable Diffusion）

#### 1. 安装 Stable Diffusion WebUI

```bash
# 克录项目
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui

# 启动（带 API）
./webui.sh --api --listen
```

#### 2. 调用 API

```typescript
const response = await fetch('http://localhost:7860/sdapi/v1/txt2img', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A beautiful sunset',
    steps: 20,
    width: 1024,
    height: 1024,
  }),
});

const { images } = await response.json();
```

---

## 方案五：国内其他 AI 服务

### 智谱 AI (ChatGLM)

```env
ZHIPU_API_KEY=xxx
```

```typescript
import OpenAI from 'openai';

const zhipu = new OpenAI({
  apiKey: process.env.ZHIPU_API_KEY,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
});

const response = await zhipu.chat.completions.create({
  model: 'glm-4-plus',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### 通义千问 (阿里云)

```env
DASHSCOPE_API_KEY=xxx
```

```typescript
import OpenAI from 'openai';

const qwen = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const response = await qwen.chat.completions.create({
  model: 'qwen-max',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

---

## 视频生成替代方案

目前视频生成 API 较少，推荐以下方案：

| 服务商 | 特点 | 价格 |
|-------|------|------|
| 可灵 AI | 快手出品，效果较好 | 按次计费 |
| Runway | 国际领先，效果最佳 | 订阅制 |
| Pika Labs | 3D 动画效果好 | 订阅制 |
| Sora | OpenAI 出品，未全面开放 | - |

### 可灵 AI API 示例

```typescript
// 需要申请 API 权限
const response = await fetch('https://api.klingai.com/v1/videos/text2video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.KLING_API_KEY}`,
  },
  body: JSON.stringify({
    prompt: 'A cat walking on the beach',
    duration: 5,
    aspect_ratio: '16:9',
  }),
});
```

---

## 功能对比

| 功能 | Coze SDK | 火山引擎 | OpenAI | DeepSeek | Ollama |
|------|---------|---------|--------|----------|--------|
| LLM | ✅ | ✅ | ✅ | ✅ | ✅ |
| 图像生成 | ✅ | ✅ | ✅ (DALL-E) | ❌ | ❌ |
| 视频生成 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 需要网络 | 是 | 是 | 是 | 是 | 否 |
| 费用 | 免费* | 按量 | 按量 | 便宜 | 免费 |

*\*Coze SDK 在沙箱环境免费，自部署需配置自己的 API*

---

## 推荐方案

### 个人开发/测试
- **LLM**: DeepSeek（便宜）或 Ollama（免费）
- **图像**: 暂时不支持，可使用图片库
- **视频**: 暂时不支持

### 商业项目
- **LLM**: 火山引擎豆包或通义千问
- **图像**: 火山引擎 SeeDream 或 DALL-E 3
- **视频**: 可灵 AI 或火山引擎 Seedance

### 完全离线
- **LLM**: Ollama + Qwen2.5
- **图像**: Stable Diffusion WebUI
- **视频**: 暂无成熟开源方案

---

## 快速切换配置

在 `.env.local` 中添加：

```env
# AI 服务选择
AI_PROVIDER=openai  # 可选: coze, openai, deepseek, ollama, zhipu

# OpenAI 配置
OPENAI_API_KEY=sk-xxx

# DeepSeek 配置
DEEPSEEK_API_KEY=sk-xxx

# Ollama 配置
OLLAMA_BASE_URL=http://localhost:11434

# 火山引擎配置
ARK_API_KEY=xxx
```

然后修改 `src/lib/ai/index.ts` 根据 `AI_PROVIDER` 选择不同的实现。

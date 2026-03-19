# 🎬 短剧漫剧创作工坊

> 将文字故事转化为精美短剧视频的 AI 创作工具

## ✨ 功能特性

- **📝 智能剧本解析** - 自动解析小说或脚本内容，提取人物、场景、对白
- **🎬 分镜自动生成** - AI 智能生成分镜脚本，包含景别、镜头运动、画面描述
- **🎭 人物一致性保持** - 智能识别并保持人物外观一致性，支持人物库管理
- **🖼️ 多风格图像生成** - 支持真人实拍、国风2D动画等多种风格，2K 高清画质
- **🎥 动态视频生成** - 6-12秒动态视频，根据内容自动计算时长
- **🔊 语音合成** - 为角色配置独特语音，保持人物语言统一
- **📚 剧集管理** - 树状结构组织分集内容，支持按季分组
- **🔄 可视化工作流** - 拖拽式工作流编辑器，自定义创作流程

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 4 |
| 数据库 | PostgreSQL (Supabase) / 内存存储 |
| 存储 | S3 兼容对象存储 / 本地存储 |
| LLM | 豆包大模型 / Coze API |
| 图像生成 | Coze 图像生成 API |
| 视频生成 | Coze 视频生成 API |

---

## 📦 完整部署指南

### 第一步：拉取项目

```bash
# 克隆项目
git clone https://github.com/jinlei665/drama-workshop.git

# 进入项目目录
cd drama-workshop
```

### 第二步：安装依赖

```bash
# 安装 pnpm（如果未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install


### 第三步：下载 FFmpeg

视频处理需要 FFmpeg，请根据操作系统安装：

**Windows:**
```bash
# 方式一：使用 winget
winget install FFmpeg

# 方式二：使用 Chocolatey
choco install ffmpeg

# 方式三：手动下载
# 1. 访问 https://www.gyan.dev/ffmpeg/builds/
# 2. 下载 ffmpeg-release-essentials.zip
# 3. 解压到 C:\ffmpeg
# 4. 添加 C:\ffmpeg\bin 到系统环境变量 PATH
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**验证安装:**
```bash
ffmpeg -version
```

### 第四步：配置 Supabase 数据库

#### 4.1 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击「Start your project」注册/登录
3. 创建新组织（Organization）
4. 创建新项目（Project），设置数据库密码
5. 选择离你最近的区域，等待项目创建完成（约 2 分钟）

#### 4.2 获取配置信息

进入项目后，点击左侧「Settings」→「API」：

- **Project URL** → 对应 `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → 对应 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → 对应 `SUPABASE_SERVICE_ROLE_KEY`（点击「Reveal」显示）

#### 4.3 创建数据库表

进入「SQL Editor」，执行以下 SQL：

```sql
-- 用户设置表
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  coze_api_key TEXT,
  coze_base_url TEXT,
  coze_bot_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 项目表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  style TEXT,
  status TEXT DEFAULT 'draft',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 人物表
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT,
  age TEXT,
  personality TEXT,
  background TEXT,
  appearance TEXT,
  voice_id TEXT,
  front_view_key TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 剧集表
CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  season_number INTEGER DEFAULT 1,
  episode_number INTEGER NOT NULL,
  title TEXT,
  synopsis TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 分镜表
CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  episode_id TEXT REFERENCES episodes(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  dialogue TEXT,
  action TEXT,
  emotion TEXT,
  character_ids TEXT[],
  image_key TEXT,
  image_url TEXT,
  video_url TEXT,
  video_status TEXT,
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 工作流表
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nodes JSONB,
  edges JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_characters_project ON characters(project_id);
CREATE INDEX idx_episodes_project ON episodes(project_id);
CREATE INDEX idx_scenes_episode ON scenes(episode_id);
CREATE INDEX idx_workflows_project ON workflows(project_id);
```

### 第五步：配置对象存储

#### 方式一：使用 Supabase Storage（推荐）

Supabase 自带对象存储，无需额外配置：

1. 在 Supabase 项目中，点击左侧「Storage」
2. 创建名为 `drama-workshop` 的 Bucket
3. 设置为 Public Bucket（或使用签名 URL）

#### 方式二：使用 MinIO（本地开发）

```bash
# 使用 Docker 启动 MinIO
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"

# 访问控制台
# http://localhost:9001
# 用户名: minioadmin
# 密码: minioadmin123

# 创建 Bucket: drama-workshop
```

### 第六步：配置扣子（Coze）Bot 和 API

#### 6.1 获取 Coze API Key

1. 访问 [https://www.coze.cn](https://www.coze.cn)（国内用户）或 [https://www.coze.com](https://www.coze.com)（海外用户）
2. 登录后，点击右上角头像 →「个人设置」
3. 选择「API Token」标签
4. 点击「生成新密钥」
5. 复制生成的 **Personal Access Token**

#### 6.2 创建 Bot（可选，用于 Bot Skills 方式）

如果你希望使用 Bot Skills 进行图像/视频生成：

1. 在 Coze 平台创建新 Bot
2. 为 Bot 添加以下 Skills：
   - **图像生成**：`image_generation` 或类似技能
   - **视频生成**：`video_generation` 或类似技能
3. 发布 Bot 后，复制 **Bot ID**

### 第七步：配置环境变量

创建 `.env.local` 文件：

```bash
# 复制示例配置
cp .env.docker.example .env.local
```

编辑 `.env.local`，填入必要配置：

```env
# ==================== 数据库配置 ====================
# 数据库类型：postgresql
DATABASE_TYPE=postgresql

# Supabase 配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ==================== 对象存储配置 ====================
# 使用 Supabase Storage 时，与上面配置一致
# 使用 MinIO 时填写以下配置
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=drama-workshop
S3_REGION=us-east-1

# ==================== LLM Provider 配置 ====================
# 可选值: coze (默认) 或 openai-compatible
# LLM_PROVIDER=coze

# ===== 方式一：使用 Coze API（默认）=====
COZE_API_KEY=your-coze-api-key
COZE_BASE_URL=https://api.coze.cn
COZE_BOT_ID=your-bot-id

# ===== 方式二：使用 OpenAI 兼容 API =====
# 支持所有 OpenAI 兼容服务：MiniMax、DeepSeek、智谱、Moonshot、Ollama 等
# LLM_PROVIDER=openai-compatible
# LLM_API_KEY=your-api-key
# LLM_BASE_URL=https://api.deepseek.com/v1
# LLM_MODEL=deepseek-chat

# 常用 OpenAI 兼容服务配置示例：
# MiniMax:      LLM_BASE_URL=https://api.minimax.chat/v1
# DeepSeek:     LLM_BASE_URL=https://api.deepseek.com/v1
# 智谱 GLM:     LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
# Moonshot:     LLM_BASE_URL=https://api.moonshot.cn/v1
# 通义千问:      LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# 本地 Ollama:  LLM_BASE_URL=http://localhost:11434/v1

# ==================== 图像/视频生成 API ====================
# 图像和视频生成目前仅支持 Coze API
IMAGE_API_KEY=your-coze-api-key
IMAGE_BASE_URL=https://api.coze.cn
VIDEO_API_KEY=your-coze-api-key
VIDEO_BASE_URL=https://api.coze.cn

# ==================== 代理配置（可选）====================
# 如果网络需要代理访问 API
# HTTP_PROXY=http://127.0.0.1:7890
# HTTPS_PROXY=http://127.0.0.1:7890

# ==================== 其他配置 ====================
PORT=5000
NODE_ENV=production
```

### 第八步：构建和启动

#### 开发模式

```bash
# 启动开发服务器（支持热更新）
pnpm dev

# 访问应用
# http://localhost:5000
```

#### 生产模式

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 访问应用
# http://localhost:5000
```

---

## 🔧 配置说明

### LLM Provider 配置

系统支持两种 LLM Provider：

| Provider | 说明 | 适用场景 |
|----------|------|----------|
| `coze` (默认) | 使用 Coze SDK 调用豆包系列模型 | 默认选项，支持多模态 |
| `openai-compatible` | 使用 OpenAI 兼容 API | 使用第三方模型服务 |

#### OpenAI 兼容服务配置示例

```env
# 设置 Provider
LLM_PROVIDER=openai-compatible

# MiniMax
LLM_API_KEY=your-minimax-api-key
LLM_BASE_URL=https://api.minimax.chat/v1
LLM_MODEL=abab6.5s-chat

# DeepSeek
LLM_API_KEY=your-deepseek-api-key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# 智谱 GLM
LLM_API_KEY=your-zhipu-api-key
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_MODEL=glm-4

# 本地 Ollama
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3
```

### API 配置优先级

系统按以下顺序获取 API 配置：

1. **环境变量** - `.env.local` 中的配置
2. **用户设置（数据库）** - 在应用设置页面配置的 API Key
3. **内存存储** - 无数据库时的临时存储
4. **沙箱环境** - 如果在 Coze 沙箱环境运行

### 图像/视频生成

图像和视频生成目前仅支持 **Coze API**，不支持第三方服务。系统按以下顺序尝试：

1. **沙箱内置凭证** - 在 Coze 沙箱环境自动使用
2. **Bot Skills** - 通过配置的 Bot ID 调用图像生成技能
3. **API Key 直接调用** - 使用 Personal Access Token 直接调用 API

### 人物一致性方案

通过图生图功能保持人物一致性：

1. 在人物管理中为角色上传/生成正面参考图
2. 生成分镜时，系统自动使用参考图作为输入
3. AI 根据参考图生成保持面部一致的新图像

---

## 📁 项目结构

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   ├── projects/          # 项目页面
│   │   └── page.tsx           # 首页
│   ├── components/            # React 组件
│   │   ├── ui/               # shadcn/ui 组件
│   │   └── workflow/         # 工作流组件
│   ├── lib/                   # 工具函数
│   │   ├── ai/               # AI 服务封装
│   │   ├── storage/          # 存储层
│   │   └── memory-storage.ts # 内存存储
│   └── types/                 # TypeScript 类型定义
├── public/                     # 静态资源
│   ├── images/               # 生成的图片
│   └── videos/               # 生成的视频
├── docs/                       # 部署文档
└── sql/                        # 数据库初始化脚本
```

---

## ❓ 常见问题

### Q: 图像生成失败，提示"所有方式均不可用"

确保以下任一条件满足：
1. 在 Coze 沙箱环境中运行
2. 配置了有效的 `COZE_API_KEY` 环境变量
3. 在应用设置页面配置了 API Key
4. 创建了配置图像生成 Skill 的 Bot 并设置了 `COZE_BOT_ID`

### Q: 数据库连接失败

检查：
1. Supabase 项目是否正常运行
2. `NEXT_PUBLIC_SUPABASE_URL` 和密钥是否正确
3. 网络是否能访问 Supabase 服务

### Q: 视频无法播放

视频已自动下载到本地 `public/videos/` 目录，确保：
1. 服务运行在 5000 端口
2. 检查浏览器控制台是否有跨域错误

---

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Made with ❤️ by Drama Workshop Team**

# 短剧漫剧创作工坊

> 将文字故事转化为精美短剧视频的 AI 创作工具

## 功能特性

- **智能剧本解析** - 自动解析小说或脚本内容，提取人物、场景、对白
- **分镜自动生成** - AI 智能生成分镜脚本，包含景别、镜头运动、画面描述
- **人物一致性保持** - 智能识别并保持人物外观一致性，支持人物库管理
- **多风格图像生成** - 支持真人实拍、国风2D动画、水墨国风等多种风格
- **动态视频生成** - 4-12秒动态视频，支持首尾帧模式
- **剧集管理** - 树状结构组织分集内容，支持按季分组
- **可视化工作流** - 拖拽式工作流编辑器，自定义创作流程
- **AI 独立生成** - 文生图、图生图、文生视频、图生视频独立模块

---

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- FFmpeg（用于视频处理）

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/jinlei665/drama-workshop.git
cd drama-workshop

# 安装 pnpm（如果未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local` 并配置：

```bash
cp .env.example .env.local
```

详细配置见下方「配置说明」章节。

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:5000

### 构建生产版本

```bash
pnpm build
pnpm start
```

---

## 配置说明

### 数据库配置（必选）

支持两种方式：

#### 方式一：Supabase 云数据库（推荐）

1. 访问 [Supabase](https://supabase.com) 注册并创建项目
2. 获取配置信息：
   - Project URL：`NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key：`NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service role key：`SUPABASE_SERVICE_ROLE_KEY`

```env
DATABASE_TYPE=postgresql
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 方式二：本地 PostgreSQL

```env
DATABASE_TYPE=postgresql
PGDATABASE_URL=postgresql://user:password@localhost:5432/drama_studio
```

### 对象存储配置（必选）

支持多种 S3 兼容存储：

#### 阿里云 OSS

```env
S3_ENDPOINT=https://drama-studio.oss-cn-chengdu.aliyuncs.com
S3_PUBLIC_ENDPOINT=https://drama-studio.oss-cn-chengdu.aliyuncs.com
S3_ACCESS_KEY=your-access-key-id
S3_SECRET_KEY=your-access-key-secret
S3_BUCKET=drama-studio
S3_REGION=oss-cn-chengdu
```

#### AWS S3

```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_PUBLIC_ENDPOINT=https://your-bucket.s3.amazonaws.com
S3_ACCESS_KEY=your-aws-access-key
S3_SECRET_KEY=your-aws-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

#### 本地 MinIO

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio
S3_REGION=us-east-1
```

启动 MinIO：
```bash
# Windows
minio.exe server ./minio-data --console-address ":9001"

# Linux/Mac
./minio server ./minio-data --console-address ":9001"
```

访问控制台：http://localhost:9001（默认账号：minioadmin / minioadmin）

### AI API 配置

#### 豆包/火山引擎 API（推荐）

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark)
2. 获取 API Key

```env
LLM_API_KEY=your-llm-api-key
LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

IMAGE_API_KEY=your-image-api-key
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

VIDEO_API_KEY=your-video-api-key
VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

---

## 数据库初始化

首次部署时，需要在数据库中创建表结构。连接 Supabase 后执行以下 SQL：

### SQL 建表脚本

```sql
-- ============================================
-- 短剧漫剧创作工坊 数据库表结构
-- ============================================

-- 人物库
CREATE TABLE IF NOT EXISTS character_library (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    appearance TEXT,
    personality TEXT,
    tags TEXT[] DEFAULT '{}',
    image_url TEXT,
    front_view_key TEXT,
    style VARCHAR(50) DEFAULT 'realistic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_content TEXT NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'novel',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    final_video_url TEXT,
    final_video_status VARCHAR(50) DEFAULT 'pending',
    style VARCHAR(50) DEFAULT 'realistic_cinema',
    custom_style_prompt TEXT,
    metadata JSONB DEFAULT '{}'
);

-- 脚本表
CREATE TABLE IF NOT EXISTS scripts (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    project_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    appearance TEXT,
    personality TEXT,
    front_view_key TEXT,
    side_view_key TEXT,
    back_view_key TEXT,
    reference_image_key TEXT,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    voice_id VARCHAR(255),
    voice_url TEXT,
    voice_style VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    image_url TEXT
);

-- 角色形象表（支持一个角色多个形象）
CREATE TABLE IF NOT EXISTS character_appearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_key TEXT NOT NULL,
    image_url TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分镜表
CREATE TABLE IF NOT EXISTS scenes (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    project_id VARCHAR(255) NOT NULL,
    scene_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT NOT NULL,
    dialogue TEXT,
    action TEXT,
    emotion VARCHAR(50),
    character_ids JSONB DEFAULT '[]',
    image_key TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    video_url TEXT,
    video_status VARCHAR(50) DEFAULT 'pending',
    last_frame_url TEXT,
    image_url TEXT,
    episode_id VARCHAR(255),
    script_id VARCHAR(255)
);

-- 剧集表
CREATE TABLE IF NOT EXISTS episodes (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    project_id VARCHAR(255) NOT NULL,
    season_number INTEGER NOT NULL DEFAULT 1,
    episode_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    merged_video_url TEXT,
    merged_video_status VARCHAR(50) DEFAULT 'pending',
    merged_video_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR(255),
    llm_provider VARCHAR(50) DEFAULT 'doubao',
    llm_model VARCHAR(100) DEFAULT 'doubao-seed-2-0-pro',
    llm_api_key TEXT,
    llm_base_url VARCHAR(255),
    image_provider VARCHAR(50) DEFAULT 'doubao',
    image_model VARCHAR(100) DEFAULT 'doubao-seed-3-0',
    image_api_key TEXT,
    image_base_url VARCHAR(255),
    image_size VARCHAR(20) DEFAULT '2K',
    video_provider VARCHAR(50) DEFAULT 'doubao',
    video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
    video_api_key TEXT,
    video_base_url VARCHAR(255),
    video_resolution VARCHAR(20) DEFAULT '720p',
    video_ratio VARCHAR(20) DEFAULT '16:9',
    voice_provider VARCHAR(50) DEFAULT 'doubao',
    voice_model VARCHAR(100) DEFAULT 'doubao-tts',
    voice_api_key TEXT,
    voice_base_url VARCHAR(255),
    voice_default_style VARCHAR(50) DEFAULT 'natural',
    coze_api_key TEXT,
    coze_base_url VARCHAR(255) DEFAULT 'https://api.coze.com',
    coze_bot_id TEXT,
    coze_bot_type VARCHAR(50) DEFAULT 'v3_chat',
    coze_bot_endpoint TEXT,
    coze_bot_project_id TEXT,
    coze_bot_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 健康检查表
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_project_id ON scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_episodes_project_id ON episodes(project_id);

-- ============================================
-- Row Level Security (RLS) - 可选
-- ============================================

-- 启用 RLS
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- 允许公开访问（匿名用户可读写）
-- CREATE POLICY "Allow public access" ON projects FOR ALL TO anon USING (true);
-- CREATE POLICY "Allow public access" ON scenes FOR ALL TO anon USING (true);
-- CREATE POLICY "Allow public access" ON characters FOR ALL TO anon USING (true);
```

### 在 Supabase 中执行 SQL

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧「SQL Editor」
4. 粘贴上方 SQL 并点击「Run」

---

## FFmpeg 安装

视频处理需要 FFmpeg，请根据操作系统安装：

### Windows

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

### macOS

```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
```

### 验证安装

```bash
ffmpeg -version
```

---

## 目录结构

```
drama-workshop/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── api/               # API 路由
│   │   │   ├── projects/      # 项目管理 API
│   │   │   ├── characters/     # 角色管理 API
│   │   │   ├── scenes/         # 分镜管理 API
│   │   │   ├── generate/      # AI 生成 API
│   │   │   ├── create/         # AI 独立生成 API
│   │   │   └── workflow/       # 工作流 API
│   │   ├── projects/          # 项目详情页
│   │   ├── characters/        # 人物库页面
│   │   ├── create/            # AI 独立生成页面
│   │   └── workflow/          # 工作流页面
│   ├── components/            # React 组件
│   ├── lib/                   # 工具库
│   │   ├── ai/                # AI SDK 封装
│   │   ├── workflow/          # 工作流引擎
│   │   └── storage/           # 存储相关
│   └── styles/                # 全局样式
├── public/                    # 静态资源
├── sql/                       # SQL 脚本
└── docs/                      # 文档（部署指南等）
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 4 |
| 数据库 | PostgreSQL (Supabase) / 内存存储 |
| 存储 | S3 兼容对象存储 (阿里云 OSS / AWS S3 / MinIO) |
| LLM | 豆包大模型 / 火山引擎 |
| 图像生成 | 豆包图像生成 / 火山引擎 |
| 视频生成 | 豆包视频生成 / 火山引擎 Seedance |

---

## License

MIT

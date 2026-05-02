# 短剧漫剧创作工坊 - 系统架构文档

## 1. 项目概述

### 1.1 项目简介
**短剧漫剧创作工坊** 是一个 AI 驱动的短剧视频生成平台，专注于将文字故事转化为精美的短剧/漫剧视频。系统提供从剧本创作、角色设计、分镜生成到视频合成的完整工作流。

### 1.2 技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 |
| UI 组件库 | shadcn/ui + Radix UI |
| 编程语言 | TypeScript 5 |
| 数据库 | PostgreSQL + MySQL (通过 Supabase) |
| 对象存储 | MinIO (S3 兼容) |
| AI 模型 | Coze API、OpenAI 兼容接口 |
| 工作流引擎 | 自研节点式工作流 (参考 ComfyUI) |
| 容器化 | Docker Compose |
| ORM | Drizzle ORM |

### 1.3 项目规模
- **55+ 个 UI 组件**
- **20+ 个 API 路由模块**
- **完整的工作流引擎实现**
- **多 AI 提供商支持**

---

## 2. 顶层目录结构

```
drama-workshop/
├── src/                          # 源代码目录
│   ├── app/                      # Next.js App Router (页面 + API)
│   ├── components/               # React 组件
│   ├── lib/                      # 核心业务逻辑库
│   ├── storage/                  # 数据存储层
│   └── hooks/                    # React Hooks
├── public/                       # 静态资源
├── sql/                          # 数据库初始化脚本
├── assets/                       # 资源文件 (数据库 schema)
├── docs/                         # 文档 (本文档)
├── docker-compose.yml            # Docker 部署配置
└── package.json                  # 项目依赖配置
```

---

## 3. 功能模块架构

系统按业务领域划分为 **6 大核心功能模块**：

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户界面层 (Frontend)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  项目管理  │ │ 角色管理  │ │ 分镜管理  │ │ 剧集管理  │ │ 工作流   │  │
│  │  页面     │ │  页面    │ │  页面    │ │  页面    │ │  编辑器   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API 网关层 (API Routes)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ /api/proj-  │ │ /api/chara- │ │ /api/scenes │ │ /api/epis-  │  │
│  │   ects/     │ │   cters/    │ │             │ │   odes/     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ /api/gene-  │ │ /api/work-   │ │ /api/create │ │ /api/upload │  │
│  │   rate/     │ │   flow/     │ │             │ │             │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         业务逻辑层 (Lib Layer)                        │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │  AI 服务模块    │  │  工作流引擎     │  │  数据库服务     │         │
│  │  lib/ai/       │  │  lib/workflow/  │  │  lib/db/       │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │  存储服务模块   │  │  工具函数库     │  │  错误处理      │         │
│  │  lib/storage/  │  │  lib/utils.ts   │  │  lib/errors/   │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         数据持久层 (Storage Layer)                    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │  数据库客户端   │  │  内存存储       │  │  对象存储       │         │
│  │  storage/      │  │  lib/memory-   │  │  lib/storage/  │         │
│  │  database/     │  │  storage.ts    │  │  image-storage │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. 核心模块详解

### 4.1 项目管理模块 (Project Management)

**功能职责**：管理短剧项目的创建、编辑、删除和状态追踪

**代码目录**：
| 目录/文件 | 说明 |
|-----------|------|
| `src/app/projects/` | 项目列表页和项目详情页 |
| `src/app/api/projects/` | 项目相关 API 路由 |
| `src/lib/db/index.ts` | ProjectService 项目服务 |
| `src/storage/database/shared/schema.ts` | 项目表定义 (projects 表) |

**核心数据模型**：
```typescript
// projects 表核心字段
{
  id: string,              // UUID
  name: string,            // 项目名称
  description: string,     // 项目描述
  sourceContent: string,   // 原始小说/脚本内容
  sourceType: string,      // 'novel' | 'script'
  status: string,          // 'draft' | 'processing' | 'completed'
  finalVideoUrl: string,   // 最终合成视频 URL
  finalVideoStatus: string // 视频生成状态
}
```

---

### 4.2 角色管理模块 (Character Management)

**功能职责**：管理角色信息、角色造型图（正面/侧面/背面）、角色配音配置

**代码目录**：
| 目录/文件 | 说明 |
|-----------|------|
| `src/app/characters/` | 角色库页面 |
| `src/app/api/characters/` | 角色 CRUD API |
| `src/app/api/character-library/` | 角色库 API (通用角色模板) |
| `src/app/api/character-appearances/` | 角色形象 API |
| `src/lib/db/index.ts` | CharacterService 角色服务 |
| `src/storage/database/shared/schema.ts` | 角色表定义 |

**核心数据模型**：
```typescript
// characters 表核心字段
{
  id: string,
  projectId: string,
  name: string,
  description: string,
  appearance: string,      // 外貌特征描述
  personality: string,      // 性格特点
  frontViewKey: string,    // 正面造型图
  sideViewKey: string,     // 侧面造型图
  backViewKey: string,     // 背面造型图
  voiceId: string,         // 语音 ID
  voiceStyle: string       // 语音风格
}

// character_appearances 表 (角色多形象)
{
  id: string,
  characterId: string,
  name: string,            // 形象名称 (如: "日常装"、"正装")
  imageKey: string,
  imageUrl: string,
  isPrimary: boolean,      // 是否主形象
  tags: string[]           // 形象标签
}
```

---

### 4.3 剧本/分镜管理模块 (Script & Scene Management)

**功能职责**：管理剧本内容、自动生成分镜、处理分镜到图片/视频的转换

**代码目录**：
| 目录/文件 | 说明 |
|-----------|------|
| `src/app/api/scripts/` | 剧本管理 API |
| `src/app/api/scenes/` | 分镜管理 API |
| `src/app/api/generate/` | 内容生成 API (图片/视频/语音) |
| `src/lib/db/index.ts` | SceneService 分镜服务 |
| `src/storage/database/shared/schema.ts` | scripts 表、scenes 表定义 |

**核心数据模型**：
```typescript
// scripts 表
{
  id: string,
  projectId: string,
  title: string,
  content: string,
  status: string
}

// scenes 表
{
  id: string,
  projectId: string,
  episodeId: string,       // 所属剧集
  scriptId: string,         // 所属剧本
  sceneNumber: number,      // 分镜序号
  title: string,
  description: string,     // 场景描述
  dialogue: string,         // 对白
  action: string,          // 动作描述
  emotion: string,          // 情绪氛围
  characterIds: string[],   // 出场人物
  imageKey: string,         // 生成的分镜图片
  imageUrl: string,
  videoUrl: string,          // 生成的视频片段
  videoStatus: string,       // 'pending' | 'generating' | 'completed' | 'failed'
  lastFrameUrl: string,      // 视频最后一帧 (用于连续生成)
  metadata: object          // 景别、镜头运动等元数据
}
```

---

### 4.4 剧集管理模块 (Episode Management)

**功能职责**：管理多季多集的结构、剧集合并视频生成

**代码目录**：
| 目录/文件 | 说明 |
|-----------|------|
| `src/app/api/episodes/` | 剧集 CRUD API |
| `src/app/api/videos/` | 视频合并 API |
| `src/lib/db/index.ts` | 剧集相关服务 |
| `src/storage/database/shared/schema.ts` | episodes 表定义 |

**核心数据模型**：
```typescript
// episodes 表
{
  id: string,
  projectId: string,
  seasonNumber: number,     // 季数
  episodeNumber: number,    // 集数
  title: string,
  description: string,
  mergedVideoUrl: string,   // 合并后的剧集视频
  mergedVideoStatus: string // 'pending' | 'merging' | 'completed' | 'failed'
}
```

---

### 4.5 AI 服务模块 (AI Service)

**功能职责**：统一封装多种 AI 提供商 (Coze、OpenAI 兼容接口)，提供 LLM 推理、图片生成、视频生成、语音合成能力

**代码目录**：
| 目录/文件 | 说明 |
|-----------|------|
| `src/lib/ai/` | AI 服务核心模块 |
| `src/lib/ai/coze-direct.ts` | Coze API 直连实现 |
| `src/lib/ai/openai-compatible.ts` | OpenAI 兼容接口封装 |
| `src/lib/memory-store.ts` | 内存配置存储 (AI API Key 等) |
| `src/app/api/generate/voice/` | 语音生成 API |
| `src/app/api/generate/videos-stream/` | 视频流式生成 API |
| `src/app/api/create/text-to-image/` | 文生图 API |
| `src/app/api/create/image-to-video/` | 图生视频 API |

**AI 提供商支持**：

| 提供商 | 用途 | 适配方式 |
|--------|------|----------|
| Coze (api.coze.cn) | LLM + Bot Skills | coze-direct.ts |
| MiniMax | LLM / 语音 | OpenAI 兼容 |
| DeepSeek | LLM | OpenAI 兼容 |
| 智谱 GLM | LLM | OpenAI 兼容 |
| Moonshot/Kimi | LLM | OpenAI 兼容 |
| 通义千问 | LLM | OpenAI 兼容 |
| 火山引擎 (Doubao) | 图像/视频生成 | OpenAI 兼容 |
| Ollama (本地) | LLM | OpenAI 兼容 |

**服务入口**：`src/lib/ai/index.ts`

---

### 4.6 工作流引擎模块 (Workflow Engine)

**功能职责**：参考 ComfyUI 的节点式工作流系统，支持可视化编排、自动执行复杂的多步骤 AI 任务

**代码目录**：
| 目录/文件 | 说明 |
|-----------|------|
| `src/lib/workflow/` | 工作流核心模块 |
| `src/lib/workflow/engine.ts` | 工作流引擎主类 |
| `src/lib/workflow/types.ts` | 工作流类型定义 |
| `src/lib/workflow/agent/` | 智能代理模块 |
| `src/lib/workflow/agent/IntentParser.ts` | 意图解析器 |
| `src/lib/workflow/agent/WorkflowAgent.ts` | 工作流智能体 |
| `src/lib/workflow/agent/WorkflowBuilder.ts` | 工作流构建器 |
| `src/lib/workflow/assets/AssetManager.ts` | 资源管理器 |
| `src/app/api/workflow/` | 工作流 API 路由 |
| `src/components/workflow/` | 工作流可视化编辑器组件 |

**核心概念**：

```
WorkflowEngine (工作流引擎)
    │
    ├── 节点定义 (NodeDefinition)
    │     ├── type: 节点类型
    │     ├── category: 节点分类
    │     ├── inputs: 输入定义
    │     ├── outputs: 输出定义
    │     └── execute(): 执行函数
    │
    ├── 工作流执行 (WorkflowExecution)
    │     ├── 拓扑排序 (Topological Sort)
    │     ├── 节点串行执行
    │     └── 进度回调 (onProgress)
    │
    └── 节点注册机制
          └── 支持内置节点 + 自定义节点
```

---

## 5. 数据存储层架构

### 5.1 存储策略

系统采用 **双存储策略**：数据库为主、内存为辅 (开发环境)

```
┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │     │   MySQL         │
│   (生产环境)     │     │   (可选)        │
│  Supabase 客户端 │     │  直连客户端      │
└────────┬────────┘     └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │   数据库抽象层       │
         │  storage/database/ │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   服务层 (lib/db/)   │
         │  ProjectService     │
         │  CharacterService   │
         │  SceneService       │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   API 路由层        │
         │  src/app/api/      │
         └────────────────────┘

         ┌────────────────────┐
         │   内存存储          │
         │ lib/memory-storage │
         │ (开发/无数据库时)   │
         └────────────────────┘
```

### 5.2 数据库 Schema

**核心表结构**：

| 表名 | 说明 | 主要关联 |
|------|------|----------|
| `projects` | 项目表 | 主表 |
| `episodes` | 剧集表 | project_id → projects |
| `scripts` | 剧本表 | project_id → projects |
| `characters` | 角色表 | project_id → projects |
| `character_appearances` | 角色形象表 | character_id → characters |
| `scenes` | 分镜表 | project_id, episode_id, script_id |
| `user_settings` | 用户设置表 | 存储 AI API Keys |

### 5.3 代码目录

| 目录/文件 | 说明 |
|-----------|------|
| `src/storage/database/shared/schema.ts` | Drizzle ORM schema 定义 (PostgreSQL) |
| `src/storage/database/shared/schema-mysql.ts` | MySQL schema 定义 |
| `src/storage/database/supabase-client.ts` | Supabase 客户端 |
| `src/storage/database/pg-client.ts` | PostgreSQL 直连客户端 |
| `src/storage/database/shared/relations.ts` | 表关系定义 |
| `src/lib/memory-storage.ts` | 内存存储实现 |
| `src/lib/memory-store.ts` | 内存配置存储 |

---

## 6. API 路由架构

### 6.1 路由分组

```
src/app/api/
├── projects/          # 项目管理 (CRUD + 导出)
├── characters/        # 角色管理
├── character-appearances/  # 角色形象
├── character-library/ # 角色库 (通用模板)
├── scripts/           # 剧本管理
├── scenes/            # 分镜管理 (CRUD + 批量 + 下载)
├── episodes/          # 剧集管理 + 合并视频
├── generate/          # 内容生成
│   ├── voice/         # 语音合成
│   ├── videos-stream/ # 视频流式生成 (SSE)
│   ├── batch-scenes/  # 批量生成分镜
│   └── appearance-*/  # 角色/分镜图片生成
├── create/            # 创建类 API
│   ├── text-to-image/
│   ├── image-to-image/
│   ├── text-to-video/
│   └── image-to-video/
├── upload/            # 文件上传
├── videos/            # 视频处理 (合并/流式播放)
├── workflow/          # 工作流管理
│   ├── agent/         # AI 智能体
│   ├── execute/        # 工作流执行
│   ├── assets/        # 资源管理
│   └── history/       # 执行历史
├── analyze/           # 内容分析
├── settings/          # 用户设置
├── ffmpeg/            # FFmpeg 状态
└── debug/             # 调试用 API
```

### 6.2 API 设计特点

- **RESTful 风格**：使用 HTTP 方法语义
- **流式响应**：视频生成使用 SSE (Server-Sent Events)
- **统一错误处理**：通过 `lib/errors/` 模块
- **配置优先级**：内存 > 数据库 > 环境变量

---

## 7. 前后端集成方式

### 7.1 前端入口

| 页面 | 路由 | 功能 |
|------|------|------|
| 首页 | `/` | 项目列表入口 |
| 项目列表 | `/projects` | 项目管理 |
| 项目详情 | `/projects/[id]` | 项目工作区 |
| 角色库 | `/characters` | 角色库管理 |
| 创作中心 | `/create` | 创作功能入口 |
| 工作流 | `/workflow` | 工作流编辑器 |
| 设置 | `/settings` | 系统设置 |

### 7.2 组件层次

```
布局组件 (Layout)
├── MainLayout (主布局)
│   ├── Header
│   ├── Sidebar
│   └── Content Area
└── 业务组件
    ├── Projects/
    ├── Characters/
    ├── Workflow/
    └── UI/ (shadcn/ui 组件库)
```

### 7.3 API 调用方式

前端通过 `src/lib/api/index.ts` 封装调用：

```typescript
// 示例：创建项目
import { api } from '@/lib/api'
const project = await api.projects.create({ name: '新项目', sourceContent: '...' })
```

---

## 8. 外部服务集成

### 8.1 AI 服务

| 服务 | 用途 | 配置文件 |
|------|------|----------|
| Coze API | LLM + Bot | `src/lib/ai/coze-direct.ts` |
| 火山引擎 | 图像/视频生成 | `src/lib/ai/openai-compatible.ts` |
| MiniMax | LLM / 语音 | `src/lib/ai/openai-compatible.ts` |

### 8.2 基础设施服务

| 服务 | 用途 | 容器配置 |
|------|------|----------|
| PostgreSQL | 主数据库 | docker-compose.yml |
| MinIO | S3 兼容对象存储 | docker-compose.yml |
| Redis | 缓存 (可选) | docker-compose.yml |

### 8.3 第三方 SDK

| SDK | 用途 |
|-----|------|
| `coze-coding-dev-sdk` | Coze 开发工具包 |
| `@supabase/supabase-js` | Supabase 客户端 |
| `@aws-sdk/lib-storage` | S3 上传 |

---

## 9. 部署架构

### 9.1 Docker Compose 架构

```
┌─────────────────────────────────────────────────────────┐
│                    drama-network (bridge)                │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Web       │  │   DB        │  │   MinIO     │     │
│  │  (Next.js)  │  │ (PostgreSQL)│  │  (Storage)  │     │
│  │  Port 5000  │  │  Port 5432  │  │  Port 9000  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                          │
│  ┌─────────────┐                                         │
│  │   Redis     │                                         │
│  │  (Optional) │                                         │
│  │  Port 6379  │                                         │
│  └─────────────┘                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.2 环境变量配置

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `LLM_API_KEY` | LLM API Key |
| `IMAGE_API_KEY` | 图像生成 API Key |
| `VIDEO_API_KEY` | 视频生成 API Key |
| `S3_ENDPOINT` | MinIO endpoint |
| `S3_ACCESS_KEY` | MinIO access key |
| `S3_SECRET_KEY` | MinIO secret key |
| `S3_BUCKET` | 存储桶名称 |

---

## 10. 模块依赖关系图

```
┌──────────────────────────────────────────────────────────────────┐
│                        依赖方向                                   │
│                                                                  │
│   UI Components ─────────────────────────────────────────────►   │
│        │                                                         │
│        ▼                                                         │
│   API Routes ───────────────────────────────────────────────►    │
│        │                                                         │
│        ▼                                                         │
│   Business Services (lib/db/)                                    │
│        │                                                         │
│        ├──────────────────┬──────────────────┐                    │
│        ▼                  ▼                  ▼                    │
│   AI Module         Workflow Engine    Storage Module             │
│   (lib/ai/)         (lib/workflow/)    (storage/database/)        │
│        │                  │                  │                   │
│        ▼                  ▼                  ▼                   │
│   External AI      Node Executor       PostgreSQL                │
│   Providers         Assets Manager     MySQL                     │
│                                                  │                │
│                                                  ▼                │
│                                          Object Storage           │
│                                          (MinIO/S3)               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. 关键设计模式

### 11.1 服务化设计
业务逻辑集中在 `src/lib/db/` 和 `src/lib/ai/`，API 路由仅做请求转发和参数验证。

### 11.2 存储抽象
通过统一的数据库抽象层，系统支持 PostgreSQL 和 MySQL 两种数据库引擎，通过 `isDatabaseConfigured()` 判断可用性。

### 11.3 内存回退
当数据库不可用时，系统自动回退到内存存储 (`lib/memory-storage.ts`)，确保开发环境可用。

### 11.4 流式处理
视频生成使用 Server-Sent Events (SSE) 实现实时进度推送，提升用户体验。

### 11.5 节点式工作流
工作流引擎采用类似 ComfyUI 的节点式设计，支持可视化编排和并行执行优化。

---

## 12. 总结

本项目采用 **前后端一体化** 的 Next.js 架构，通过清晰的模块划分实现了：

1. **业务解耦**：6 大功能模块各司其职
2. **技术解耦**：存储层、AI 层独立封装
3. **可扩展性**：节点式工作流支持自定义扩展
4. **多后端支持**：PostgreSQL + MySQL，多 AI 提供商
5. **容器化部署**：Docker Compose 一键部署完整环境

系统最适合 **中小型团队** 的短剧创作场景，可快速将小说/脚本转化为可视化分镜和视频内容。

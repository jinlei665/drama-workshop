# 短剧漫剧创作工坊 - 工作流文档

## 一、项目概述

### 1.1 项目定位
短剧漫剧创作工坊是一个 AI 驱动的短剧视频自动生成平台，能够将小说或脚本内容自动转化为精美的短剧视频。

### 1.2 核心能力
- **智能分析**：AI 自动分析小说/脚本，提取人物和分镜信息
- **角色造型生成**：为每个角色生成真人风格的三视图（正面/侧面/背面）
- **分镜图像生成**：根据场景描述生成高质量分镜图片
- **视频片段生成**：将分镜图片转化为连贯的视频片段
- **视频合成**：自动合成完整剧集或项目视频
- **人物一致性**：通过角色造型参考图保持人物形象一致

---

## 二、技术架构

### 2.1 技术栈
| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 4 |
| 数据库 | MySQL (本地) / Supabase (云端) |
| 对象存储 | MinIO (本地) / S3 兼容存储 |
| AI 服务 | MiniMax (LLM)、豆包 (图像/视频生成) |

### 2.2 系统架构图
```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ 项目管理 │ │ 人物管理 │ │ 分镜编辑 │ │ 视频预览 │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 服务层                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ /analyze │ │/generate │ │/projects │ │ /export  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        AI 服务层                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ MiniMax  │ │ 图像生成  │ │ 视频生成  │ │ 语音合成  │       │
│  │  (LLM)   │ │  (2K)    │ │ (720p)   │ │  (TTS)   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        存储层                                │
│  ┌──────────┐                    ┌──────────┐              │
│  │  MySQL   │                    │  MinIO   │              │
│  │ (元数据)  │                    │ (媒体文件) │              │
│  └──────────┘                    └──────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型

### 3.1 核心实体关系
```
Project (项目)
    │
    ├── Character (人物) - 多个角色，包含造型图和配音
    │
    ├── Episode (剧集) - 可选，用于分集管理
    │       │
    │       └── Scene (分镜) - 属于该集的分镜
    │
    └── Scene (分镜) - 直接属于项目的分镜
            │
            └── 包含图片、视频、对白等信息
```

### 3.2 数据表说明

#### projects (项目表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 项目唯一标识 |
| name | varchar | 项目名称 |
| source_content | text | 原始小说/脚本内容 |
| source_type | varchar | 来源类型：novel/script |
| status | varchar | 状态：draft/processing/completed |
| final_video_url | text | 最终合成视频URL |

#### characters (人物表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 人物唯一标识 |
| project_id | UUID | 所属项目 |
| name | varchar | 人物名称 |
| appearance | text | 外貌特征描述 |
| front_view_key | text | 正面造型图存储key |
| side_view_key | text | 侧面造型图存储key |
| back_view_key | text | 背面造型图存储key |
| voice_id | varchar | 配音ID |

#### scenes (分镜表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 分镜唯一标识 |
| project_id | UUID | 所属项目 |
| episode_id | UUID | 所属剧集（可选）|
| scene_number | int | 分镜序号 |
| title | varchar | 分镜标题 |
| description | text | 场景描述 |
| dialogue | text | 对白内容 |
| character_ids | jsonb | 出场人物ID列表 |
| image_url | text | 生成的分镜图片URL |
| video_url | text | 生成的视频片段URL |
| video_status | varchar | 视频状态 |
| metadata | jsonb | 景别、镜头运动等 |

---

## 四、核心工作流程

### 4.1 主要流程图
```
┌─────────────────────────────────────────────────────────────────────┐
│                        短剧视频生成主流程                            │
└─────────────────────────────────────────────────────────────────────┘

     ┌──────────┐
     │ 1.创建项目 │
     └─────┬────┘
           │ 输入小说/脚本内容
           ▼
     ┌──────────┐     ┌─────────────────────────────────┐
     │ 2.AI分析  │────▶│ LLM 提取人物 + 分镜信息          │
     └─────┬────┘     │ - 人物名称、外貌、性格           │
           │          │ - 场景描述、对白、情绪           │
           │          │ - 景别、镜头运动                 │
           │          └─────────────────────────────────┘
           ▼
     ┌──────────┐     ┌─────────────────────────────────┐
     │ 3.人物造型 │────▶│ 为每个角色生成三视图             │
     │   生成    │     │ - 正面图（主要造型）             │
     └─────┬────┘     │ - 侧面图                        │
           │          │ - 背面图                        │
           │          └─────────────────────────────────┘
           ▼
     ┌──────────┐     ┌─────────────────────────────────┐
     │ 4.分镜图像 │────▶│ 根据场景描述生成分镜图片         │
     │   生成    │     │ - 真人实拍风格                   │
     └─────┬────┘     │ - 2K高清画质                    │
           │          │ - 包含角色特征                   │
           │          └─────────────────────────────────┘
           ▼
     ┌──────────┐     ┌─────────────────────────────────┐
     │ 5.视频生成 │────▶│ 图片转视频                      │
     │          │     │ - 720p分辨率                    │
     └─────┬────┘     │ - 连续模式保持视觉连贯           │
           │          │ - 每帧约5秒                     │
           │          └─────────────────────────────────┘
           ▼
     ┌──────────┐     ┌─────────────────────────────────┐
     │ 6.视频合成 │────▶│ 合并所有视频片段                 │
     │          │     │ - 生成剧集视频                   │
     └─────┬────┘     │ - 生成完整项目视频               │
           │          └─────────────────────────────────┘
           ▼
     ┌──────────┐
     │ 7.导出分享 │
     └──────────┘
```

### 4.2 详细步骤说明

#### 步骤1：创建项目
```
用户操作：
1. 点击"新建项目"
2. 输入项目名称
3. 粘贴小说或脚本内容
4. 选择来源类型（小说/脚本）

系统处理：
- 创建项目记录
- 存储原始内容到 source_content 字段
- 初始状态设为 "draft"
```

#### 步骤2：AI 分析
```
API: POST /api/analyze

输入：
- projectId: 项目ID
- content: 小说/脚本内容

处理流程：
1. 构建 System Prompt（短剧创作助手角色设定）
2. 调用 MiniMax LLM API
3. 解析返回的 JSON 结果：
   - characters[]: 人物列表
   - scenes[]: 分镜列表
4. 将结果保存到数据库

输出：
- characters 表：插入人物记录
- scenes 表：插入分镜记录
- 返回提取的人物和分镜数量
```

#### 步骤3：人物造型生成
```
API: POST /api/generate/character-views

输入：
- characterId: 人物ID
- appearance: 外貌描述

处理流程：
1. 构建真人风格提示词
2. 调用图像生成 API
3. 下载生成的图片
4. 上传到 MinIO 存储
5. 更新人物表的造型图字段

提示词示例：
"真人实拍风格，短剧角色设定图，[外貌描述]，
专业影视造型，三视图包含正面、侧面、背面三个角度，
白色摄影棚背景，高清人像摄影，电影级光影，4K画质"

输出：
- front_view_key: 正面图存储key
- side_view_key: 侧面图存储key
- back_view_key: 背面图存储key
```

#### 步骤4：分镜图像生成
```
API: POST /api/generate/scene-image 或 /api/generate/batch-scenes

输入：
- sceneId: 分镜ID
- description: 场景描述
- emotion: 情绪氛围
- characterDescriptions: 角色描述

处理流程：
1. 构建分镜图像提示词
2. 添加角色特征描述（保持一致性）
3. 调用图像生成 API
4. 上传到 MinIO 存储
5. 更新分镜表的 image_url 字段

提示词示例：
"真人实拍风格，短剧视频分镜画面，[场景描述]，
[情绪]的氛围，画面中的角色：[角色描述]，
专业影视剧画面，电影级构图，高清摄影，4K画质"

输出：
- image_url: 分镜图片URL
- status: 更新为 "completed"
```

#### 步骤5：视频生成
```
API: POST /api/generate/videos 或 /api/generate/videos-stream

输入：
- projectId: 项目ID
- sceneIds: 分镜ID列表（可选）
- mode: 生成模式

生成模式：
- continuous（连续模式）：使用上一帧保持连贯性（推荐）
- fast（快速模式）：并行生成，速度快但可能不够连贯

处理流程：
1. 获取所有有图片的分镜
2. 按序号排序
3. 对于每个分镜：
   a. 调用视频生成 API
   b. 传入图片URL和提示词
   c. 等待生成完成（约30-60秒）
   d. 下载视频并上传到 MinIO
   e. 更新 video_url 和 video_status
4. 连续模式：使用 last_frame_url 保持视觉连贯

输出：
- video_url: 视频片段URL
- video_status: 生成状态
- last_frame_url: 最后一帧URL（用于连续生成）
```

#### 步骤6：视频合成
```
API: POST /api/episodes/[id]/merge-videos

输入：
- episodeId: 剧集ID 或 projectId

处理流程：
1. 获取所有已生成视频的分镜
2. 按序号排序
3. 使用 FFmpeg 合并视频
4. 上传合成后的视频到 MinIO
5. 更新 merged_video_url 或 final_video_url

输出：
- merged_video_url: 合成视频URL
- merged_video_status: 合成状态
```

---

## 五、API 接口清单

### 5.1 项目管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 获取项目列表 |
| POST | /api/projects | 创建新项目 |
| GET | /api/projects/[id] | 获取项目详情 |
| PUT | /api/projects/[id] | 更新项目 |
| DELETE | /api/projects/[id] | 删除项目 |
| GET | /api/projects/[id]/characters | 获取项目人物 |
| GET | /api/projects/[id]/scenes | 获取项目分镜 |
| POST | /api/projects/[id]/export | 导出项目 |

### 5.2 AI 分析
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/analyze | 分析文本，提取人物和分镜 |

### 5.3 内容生成
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/generate/character-views | 生成人物三视图 |
| POST | /api/generate/scene-image | 生成单个分镜图片 |
| POST | /api/generate/batch-scenes | 批量生成分镜图片 |
| POST | /api/generate/videos | 批量生成视频片段 |
| POST | /api/generate/videos-stream | 流式生成视频（SSE） |
| POST | /api/generate/voice | 生成语音 |

### 5.4 人物管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/characters/[id] | 获取人物详情 |
| PUT | /api/characters/[id] | 更新人物 |
| DELETE | /api/characters/[id] | 删除人物 |

### 5.5 分镜管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/scenes/[id] | 获取分镜详情 |
| PUT | /api/scenes/[id] | 更新分镜 |
| DELETE | /api/scenes/[id] | 删除分镜 |
| GET | /api/scenes/[id]/download | 下载分镜资源 |

### 5.6 剧集管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/episodes | 获取剧集列表 |
| POST | /api/episodes | 创建剧集 |
| GET | /api/episodes/[id] | 获取剧集详情 |
| PUT | /api/episodes/[id] | 更新剧集 |
| DELETE | /api/episodes/[id] | 删除剧集 |
| POST | /api/episodes/[id]/merge-videos | 合并剧集视频 |

### 5.7 系统设置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/settings | 获取设置 |
| PUT | /api/settings | 更新设置 |

---

## 六、配置说明

### 6.1 环境变量配置
```env
# 数据库配置
DATABASE_TYPE=mysql
DATABASE_URL=mysql://root:password@localhost:3306/drama_studio

# 对象存储配置
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=drama-studio

# LLM API 配置 (MiniMax)
LLM_API_KEY=your-minimax-api-key
LLM_BASE_URL=https://api.minimaxi.com/anthropic
LLM_MODEL=MiniMax-Text-01

# 图像生成 API 配置
IMAGE_API_KEY=your-image-api-key
IMAGE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 视频生成 API 配置
VIDEO_API_KEY=your-video-api-key
VIDEO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_MODEL=doubao-seedance-1-5-pro-251215
```

### 6.2 AI 模型配置
| 服务 | 默认模型 | 说明 |
|------|----------|------|
| LLM | MiniMax-Text-01 | 文本分析、内容提取 |
| 图像生成 | doubao-seed-3-0 | 2K高清图片生成 |
| 视频生成 | doubao-seedance-1-5-pro | 720p视频生成 |

---

## 七、部署说明

### 7.1 本地开发部署
```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 3. 启动开发服务
coze dev
# 或
pnpm dev
```

### 7.2 Windows 便携版部署
```bash
# 1. 构建便携版
bash scripts/build-portable.sh

# 2. 输出文件
dist/portable/drama-studio-win-x64.zip

# 3. 使用方式
# - 解压到任意目录
# - 复制 .env.example 为 .env 并配置
# - 双击 start.bat 启动
```

### 7.3 依赖服务
- **MySQL 5.7+**: 数据存储
- **MinIO**: 对象存储（图片、视频）
- **Node.js 20+**: 运行环境

---

## 八、常见问题

### Q1: AI 分析超时怎么办？
- 减少输入内容长度（建议 1 万字以内）
- 检查 API Base URL 是否正确
- 查看控制台日志确认重试情况

### Q2: 人物造型不一致怎么办？
- 确保先生成人物三视图
- 分镜生成时会自动引用角色特征
- 在人物管理中可以重新生成造型图

### Q3: 视频生成失败怎么办？
- 确保分镜图片已成功生成
- 检查视频 API 配置是否正确
- 查看分镜详情中的 video_status 状态

### Q4: 如何批量生成？
- 分镜图片：使用"批量生成"按钮
- 视频片段：点击"生成所有视频"
- 系统会自动按顺序处理

---

## 九、版本历史

### v1.0.0 (2025-03)
- 完成核心功能开发
- 支持 MiniMax LLM API
- 支持本地 MySQL 数据库
- 支持 MinIO 对象存储
- Windows 便携版打包

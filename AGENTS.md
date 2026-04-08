# Drama Studio - AGENTS.md

## 项目概览

**项目名称**: Drama Studio (短剧漫剧创作工坊)
**项目描述**: AI驱动的短剧视频生成工具，支持分镜管理、图片生成、视频生成等功能
**技术栈**:
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Storage**: 阿里云 OSS (ali-oss SDK)
- **AI SDK**: coze-coding-dev-sdk (图像、视频、语音生成)

## 核心功能模块

### 0. 脚本管理 (Scripts)
- **路径**: `src/app/api/scripts/`
- **数据库表**: `scripts`
- **功能**: 创建脚本、编辑脚本、删除脚本、查看脚本列表
- **数据结构**:
  - `id`: 唯一标识符
  - `project_id`: 项目ID
  - `title`: 脚本标题
  - `content`: 脚本内容
  - `description`: 脚本描述
  - `status`: 状态（active/inactive）
  - `created_at`: 创建时间
  - `updated_at`: 更新时间
- **AI 分析**: `/api/scripts/analyze` - 根据 AI 分析生成角色和分镜，直接插入数据库
- **注意事项**:
  - Supabase PostgREST schema cache 需要手动刷新（在 SQL Editor 中执行 `NOTIFY pgrst, 'reload';`）
  - 沙箱环境无法连接到 Supabase 的 IPv6 数据库，已实现自动 fallback 机制

### 1. 项目管理 (Projects)
- **路径**: `src/app/api/projects/`
- **数据库表**: `projects`
- **功能**: 创建项目、查看项目列表、删除项目

### 2. 分镜管理 (Scenes)
- **路径**: `src/app/api/projects/[id]/scenes/`
- **数据库表**: `scenes`
- **功能**: 创建分镜、编辑分镜、删除分镜、查看分镜列表
- **数据结构**:
  - `id`: 唯一标识符
  - `sceneNumber`: 分镜编号
  - `title`: 标题
  - `description`: 描述
  - `dialogue`: 对话内容
  - `action`: 动作描述
  - `emotion`: 情绪氛围
  - `characterIds`: 关联角色ID列表
  - `imageKey`: 图片存储key
  - `imageUrl`: 图片URL
  - `videoUrl`: 视频URL
  - `videoStatus`: 视频生成状态
  - `status`: 状态
  - `metadata`: 元数据（包含镜头类型、相机运动等）

### 3. 角色管理 (Characters)
- **路径**: `src/app/api/projects/[id]/characters/`
- **数据库表**: `characters`
- **功能**: 创建角色、编辑角色、删除角色、查看角色列表
- **数据结构**:
  - `id`: 唯一标识符
  - `name`: 角色名称
  - `appearance`: 外观描述
  - `frontViewKey`: 正面视图存储key
  - `imageUrl`: 图片URL

### 4. AI 生成功能

#### 4.1 图片生成
- **路径**: `src/app/api/generate/scene-image/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 根据场景描述生成场景图片
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限

#### 4.1.1 人物库图片生成
- **路径**: `src/app/api/generate/character-image/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 根据人物描述生成人物图像（文生图）
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限

#### 4.1.2 人物库三视图生成
- **路径**: `src/app/api/generate/character-triple-views/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 根据参考图片生成三视图（图生图）
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限

#### 4.1.3 项目角色视图生成
- **路径**: `src/app/api/generate/character-views/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 生成角色的正面视图
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限

#### 4.1.4 项目人物形象生成（文生图）
- **路径**: `src/app/api/generate/appearance-from-text/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 根据文字描述生成人物形象
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限

#### 4.1.5 项目人物形象生成（图生图）
- **路径**: `src/app/api/generate/appearance-from-image/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 根据参考图片生成新的人物形象
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限

#### 4.2 视频生成
- **路径**: `src/app/api/generate/videos/`
- **SDK**: coze-coding-dev-sdk (video-generation)
- **功能**:
  - 单帧模式：使用一张图片生成视频
  - 首尾帧模式：使用两张图片（首帧和尾帧）生成视频
  - 支持自定义视频时长（4-12秒）
  - 支持选择视频比例（16:9 或 9:16）
- **存储**: 自动上传到阿里云 OSS，设置公开读取权限
- **特殊处理**:
  - 自动上传本地图片到阿里云 OSS
  - 生成公网 URL 供 Bot API 访问
  - 禁用重试机制（maxRetries: 0），失败立即返回错误

#### 4.3 语音生成
- **路径**: `src/app/api/generate/voice/`
- **SDK**: coze-coding-dev-sdk (audio)
- **功能**: 根据文本生成语音
- **用途**: 为角色配音

#### 4.4 角色视图生成
- **路径**: `src/app/api/generate/character-views/`
- **SDK**: coze-coding-dev-sdk (image-generation)
- **功能**: 生成角色的正面视图

### 5. 视频合并
- **路径**: `src/app/api/videos/merge/`, `src/app/api/episodes/[id]/merge-videos/`
- **功能**: 将多个视频片段合并成一个完整视频
- **工具**: FFmpeg

### 6. 人物库管理 (Character Library)
- **路径**: `src/app/api/character-library/`, `src/app/characters/`
- **数据库表**: `character_library`
- **功能**: 创建人物、编辑人物、删除人物、查看人物列表、从人物库导入到项目
- **数据结构**:
  - `id`: 唯一标识符
  - `name`: 人物名称
  - `description`: 人物描述
  - `appearance`: 外貌描述
  - `personality`: 性格描述
  - `tags`: 标签（如性别、年龄等）
  - `image_url`: 参考图片 URL
  - `front_view_key`: 正面视图存储 key
  - `style`: 图像风格（realistic、anime、cartoon、oil_painting）
  - `created_at`: 创建时间
- **API 端点**:
  - `GET /api/character-library`: 获取人物库列表（支持搜索）
  - `POST /api/character-library`: 添加人物到人物库（支持上传参考图和文字描述）
  - `PUT /api/character-library?id=xxx`: 更新人物库中的人物
  - `DELETE /api/character-library?id=xxx`: 从人物库删除人物
- **前端功能**:
  - 人物卡片显示参考图片
  - 新建人物时支持上传参考图和填写文字描述
  - 编辑人物信息
  - 上传参考图生成三视图（图生图）
  - 删除人物
- **项目人物管理**:
  - 支持从人物库导入人物
  - 支持添加项目人物到人物库
  - 支持文字生成新形象（文生图）
  - 支持形象管理（上传图片、添加形象、设置主形象、拖拽排序）
- **注意事项**:
  - 人物库 API 支持 Supabase + pg fallback 机制，解决 IPv6 连接问题
  - 参考图片上传到阿里云 OSS，生成公网 URL
  - 三视图使用 image-to-image 生成，保持人物特征一致

### 6.5 AI 独立生成模块 (AI Create)
- **路径**: `src/app/create/`, `src/app/api/create/`
- **功能**: 提供独立的 AI 生成功能（不存入数据库，直接生成和下载）
- **页面结构**:
  - `/create` - AI 生成首页（重定向到文生图）
  - `/create/text-to-image` - 文生图页面
  - `/create/image-to-image` - 图生图页面
  - `/create/text-to-video` - 文生视频页面
  - `/create/image-to-video` - 图生视频页面
- **页面导航**: 所有 AI 生成子页面都包含返回按钮，方便用户返回 AI 生成首页

#### 6.5.1 文生图 (Text-to-Image)
- **路径**: `src/app/api/create/text-to-image/route.ts`
- **前端页面**: `src/app/create/text-to-image/page.tsx`
- **功能**:
  - 输入文本提示词和反向提示词
  - 选择图像风格（写实、动漫、卡通、油画等）
  - 选择图像尺寸（512x512 到 1536x1024）
  - **LLM 优化提示词**：使用 AI 智能优化用户输入的提示词
  - 生成图像并支持预览、下载、复制链接
- **存储**: 生成结果优先上传到阿里 OSS，失败则保存到本地 `public/ai-create/`

#### 6.5.2 图生图 (Image-to-Image)
- **路径**: `src/app/api/create/image-to-image/route.ts`
- **前端页面**: `src/app/create/image-to-image/page.tsx`
- **功能**:
  - 上传参考图片
  - 输入目标描述
  - **LLM 优化提示词**：使用 AI 智能优化用户输入的描述
  - 选择风格和尺寸
  - 调整变换强度
  - 生成新图像并支持对比预览

#### 6.5.3 文生视频 (Text-to-Video)
- **路径**: `src/app/api/create/text-to-video/route.ts`
- **前端页面**: `src/app/create/text-to-video/page.tsx`
- **功能**:
  - 输入视频描述提示词
  - **LLM 优化提示词**：使用 AI 智能优化视频描述
  - 选择视频时长（4-12 秒）
  - 选择视频比例（16:9、9:16、1:1）
  - 可选生成配套音频
  - 视频预览和下载

#### 6.5.4 图生视频 (Image-to-Video)
- **路径**: `src/app/api/create/image-to-video/route.ts`
- **前端页面**: `src/app/create/image-to-video/page.tsx`
- **功能**:
  - 上传静态图片
  - 可选输入运动描述
  - **LLM 优化提示词**：使用 AI 智能优化运动描述
  - 选择视频时长和比例
  - 生成动态视频
  - 视频预览和下载

### 6.6 提示词优化 API
- **路径**: `src/app/api/create/optimize-prompt/route.ts`
- **功能**: 使用 LLM 智能优化用户的提示词
- **参数**:
  - `prompt`: 原始提示词
  - `type`: 类型（`image` 或 `video`）
- **返回**: 优化后的提示词
- **依赖**: 需要用户在设置中配置 Coze API Key### 7. 工作流 (Workflow)
- **路径**: `src/app/api/workflow/`
- **功能**: 定义和执行自动化工作流

### 7.1 工作流节点端口配置
- **视频节点 (image-to-video)**:
  - 输入端口: `prompt`(提示词), `firstFrame`(首帧图像), `lastFrame`(尾帧图像)
  - 输出端口: `video`(视频)
  - 后端执行逻辑支持多种端口 ID 映射（`image`/`firstFrame` → `firstFrame`，`lastFrameImage`/`lastFrame` → `lastFrame`）

### 7.2 工作流节点完整列表
工作流系统已实现以下节点类型：

| 节点类型 | 名称 | 输入端口 | 输出端口 | 功能说明 |
|---------|------|---------|---------|---------|
| `text-input` | 文本输入 | 无 | `text` | 输入文本内容 |
| `image-input` | 图片输入 | 无 | `image` | 上传或选择图片 |
| `script-input` | 脚本输入 | 无 | `script` | 输入脚本内容 |
| `text-to-image` | 文生图 | `prompt` | `image` | 根据提示词生成图像 |
| `image-to-video` | 图生视频 | `prompt`, `firstFrame`, `lastFrame` | `video` | 根据图片生成视频 |
| `text-to-audio` | 文字转语音 | `text` | `audio` | 将文本转换为语音 |
| `text-to-character` | 角色生成 | `description` | `character`, `image` | 根据描述创建角色 |
| `script-to-scenes` | 脚本分析 | `script` | `scenes` | 分析脚本生成分镜 |
| `llm-process` | LLM 处理 | `input` | `output` | 使用大语言模型处理输入 |
| `video-compose` | 视频合成 | `videos` | `video` | 合并多个视频片段 |

### 7.3 LLM 调用支持
工作流节点支持多种 LLM 调用方式：

1. **Coze SDK**（默认）:
   - 使用 `invokeLLM` / `invokeLLMWithStream`
   - 支持系统配置的 API Key

2. **Coze Direct API**:
   - 支持 Bot ID + 个人令牌调用
   - 使用 `invokeCozeDirect` 函数

3. **自定义 LLM Provider**:
   - 支持 DeepSeek、Kimi、火山引擎等 OpenAI 兼容服务
   - 支持用户配置的 API Key 和 Base URL
   - 使用 `OpenAICompatibleClient`

### 7.4 API 调用优先级
1. 优先使用用户配置的自定义 LLM Provider（如果配置了）
2. 如果使用 Coze/豆包模型，检查是否配置了 Bot ID（使用 Coze Direct）
3. 如果配置了 API Key，使用 Coze SDK
4. 使用系统默认模型

### 7.5 端口 ID 规范
- 前端 `getNodeInputs` 和后端节点 `process` 方法中的端口 ID 必须保持一致
- 统一使用规范的命名：`firstFrame`, `lastFrame`, `prompt` 等
- 执行器根据 `edge.toPort` 匹配输入端口并设置值

## 数据库架构

### Supabase 连接配置
- **配置文件**: `.env.local`
- **连接函数**: `src/lib/supabase.ts`
- **主要表**:
  - `projects`: 项目表
  - `scenes`: 分镜表
  - `characters`: 角色表
  - `episodes`: 集数表（如果存在）

## 阿里云 OSS 配置

### 环境变量
```env
ALIYUN_OSS_REGION=
ALIYUN_OSS_ACCESS_KEY_ID=
ALIYUN_OSS_ACCESS_KEY_SECRET=
ALIYUN_OSS_BUCKET=
```

### OSS 工具类
- **路径**: `src/lib/oss.ts`
- **功能**:
  - 上传文件（支持路径自动转换为正斜杠）
  - 设置文件访问权限（公开读取）
  - 生成公网 URL
- **关键方法**:
  - `uploadFile(key: string, content: Buffer, mimeType: string)`: 上传文件
  - `setPublicRead(key: string)`: 设置公开读取权限
  - `getPublicUrl(key: string)`: 获取公网 URL

## AI SDK 配置

### 通用配置
- **SDK**: coze-coding-dev-sdk
- **配置路径**: `src/lib/ai/index.ts`
- **支持模块**:
  - `llm`: 大语言模型
  - `imageGeneration`: 图像生成
  - `videoGeneration`: 视频生成
  - `audio`: 音频（TTS/ASR）
  - `embedding`: 向量嵌入
  - `webSearch`: 网页搜索

### 关键配置
- **视频生成**: 禁用重试机制（maxRetries: 0）
- **图像生成**: 默认启用高质量模式
- **音频生成**: 支持多种语音和格式

## 前端页面结构

### 1. 项目列表页
- **路径**: `src/app/page.tsx`
- **功能**: 显示所有项目，支持创建新项目

### 2. 项目详情页
- **路径**: `src/app/projects/[id]/page.tsx`
- **功能**: 显示项目详情，包含分镜面板和角色面板

### 3. 分镜面板组件
- **路径**: `src/app/projects/[id]/scenes-panel.tsx`
- **功能**:
  - 显示分镜列表
  - 添加/编辑/删除分镜
  - 生成场景图片
  - 生成视频（支持首尾帧模式）
  - 选择视频比例
  - 下载视频

### 4. 角色面板组件
- **路径**: `src/app/projects/[id]/characters-panel.tsx`
- **功能**:
  - 显示角色列表
  - 添加/编辑/删除角色
  - 生成角色正面视图
  - 形象管理（上传图片、添加形象、设置主形象、拖拽排序）
  - 文字生成新形象（文生图）
  - 从人物库导入人物
  - 添加人物到人物库

### 5. 人物库页面
- **路径**: `src/app/characters/page.tsx`
- **功能**:
  - 显示人物库列表（支持搜索）
  - 新建人物（支持上传参考图和文字描述）
  - 编辑人物信息
  - 上传参考图生成三视图（图生图）
  - 删除人物

### 6. AI 独立生成模块
- **路径**: `src/app/create/`
- **布局**: `src/app/create/layout.tsx`
- **功能**: 提供独立的 AI 生成功能入口

#### 6.1 文生图页面
- **路径**: `src/app/create/text-to-image/page.tsx`
- **功能**:
  - 输入提示词和反向提示词
  - 选择图像风格和尺寸
  - 生成图像并预览、下载、复制链接

#### 6.2 图生图页面
- **路径**: `src/app/create/image-to-image/page.tsx`
- **功能**:
  - 上传参考图片
  - 输入目标描述
  - 选择风格和尺寸
  - 调整变换强度
  - 生成并对比预览

#### 6.3 文生视频页面
- **路径**: `src/app/create/text-to-video/page.tsx`
- **功能**:
  - 输入视频描述
  - 选择时长和比例
  - 可选生成音频
  - 视频预览和下载

#### 6.4 图生视频页面
- **路径**: `src/app/create/image-to-video/page.tsx`
- **功能**:
  - 上传静态图片
  - 输入运动描述
  - 选择时长和比例
  - 视频预览和下载

## 构建和测试命令

### 开发环境
```bash
pnpm dev          # 启动开发服务器（端口 5000）
pnpm dev:lan      # 启动开发服务器（局域网访问）
```

### 生产环境
```bash
pnpm build        # 构建生产版本
pnpm start        # 启动生产服务器（端口 5000）
```

### 代码检查
```bash
pnpm lint         # ESLint 代码检查
pnpm ts-check     # TypeScript 类型检查
pnpm typecheck    # TypeScript 无输出生成检查
```

### 其他命令
```bash
pnpm deploy       # 远程部署
pnpm docker:up    # 启动 Docker 容器
pnpm docker:down  # 停止 Docker 容器
```

## 代码风格指南

### TypeScript
- 使用严格的 TypeScript 配置（strict: true）
- 所有函数参数必须标注类型
- 所有组件/函数/类型使用前必须 import
- 标点符号全部半角，禁止中文全角标点

### React
- 使用 React 19 新特性
- 使用 'use client' 标记客户端组件
- 避免在 JSX 渲染逻辑中直接使用 typeof window、Date.now() 等动态数据
- 必须使用 useEffect + useState 确保动态内容仅在客户端挂载后渲染

### CSS
- 使用 Tailwind CSS 4
- 使用 shadcn/ui 主题变量（bg-background, text-foreground 等）
- 禁止硬编码颜色和圆角
- 使用语义化变量（如 bg-primary/10, text-primary/80）

## 常见问题与解决方案

### 1. 视频生成失败
- **问题**: Bot API 无法访问本地 localhost 图片
- **解决**: 自动上传本地图片到阿里云 OSS，生成公网 URL

### 2. OSS 路径错误
- **问题**: 使用反斜杠导致 NoSuchKeyError
- **解决**: 使用阿里云 OSS SDK，确保路径分隔符为正斜杠

### 3. 视频上传失败
- **问题**: 缺少 COZE_WORKLOAD_IDENTITY_API_KEY
- **解决**: 使用阿里云 OSS SDK 上传视频

### 4. 首尾帧选择错误
- **问题**: 条件判断 `scene.id === userLastFrameSceneId` 导致无法正确选择尾帧
- **解决**: 移除错误的条件判断，直接使用 `userLastFrameSceneId` 查找对应场景

### 5. Hydration 错误
- **问题**: 在 JSX 渲染逻辑中直接使用动态数据
- **解决**: 使用 'use client' + useEffect + useState 模式

## 安全注意事项

1. **环境变量**: 所有敏感信息（API Key、数据库连接等）必须存储在 `.env.local` 文件中
2. **OSS 访问**: 图片和视频上传后必须设置为公开读取权限，但 Bucket 本身应配置适当的访问策略
3. **API 安全**: 所有 API 路由应进行适当的身份验证和授权检查
4. **数据验证**: 所有用户输入必须进行验证和清理

## 性能优化建议

1. **图片优化**: 使用 Next.js Image 组件优化图片加载
2. **代码分割**: 使用动态 import () 实现代码分割
3. **缓存策略**: 合理使用 Supabase 缓存和 Next.js 缓存
4. **OSS CDN**: 使用阿里云 OSS CDN 加速静态资源访问

## 部署指南

### 开发环境
1. 安装依赖: `pnpm install`
2. 配置环境变量: 复制 `.env.example` 到 `.env.local` 并填写配置
3. 启动开发服务器: `pnpm dev`
4. 访问: `http://localhost:5000`

### 生产环境
1. 构建项目: `pnpm build`
2. 启动生产服务器: `pnpm start`
3. 访问: 配置的域名

### Docker 部署
1. 构建 Docker 镜像: `pnpm docker:up`
2. 查看日志: `pnpm docker:logs`
3. 停止容器: `pnpm docker:down`

## 日志与调试

### 日志目录
- **应用日志**: `/app/work/logs/bypass/app.log`
- **开发日志**: `/app/work/logs/bypass/dev.log`
- **控制台日志**: `/app/work/logs/bypass/console.log`

### 调试命令
```bash
# 查看最新日志
tail -n 50 /app/work/logs/bypass/app.log

# 搜索错误
grep -iE "error|exception|warn" /app/work/logs/bypass/app.log

# 查看特定行
sed -n "100,150p" /app/work/logs/bypass/app.log
```

## 联系与支持

- **项目仓库**: [GitHub 链接]
- **问题反馈**: [Issue 链接]
- **文档**: [文档链接]

---

**最后更新**: 2025-04-05
**版本**: 1.0.0

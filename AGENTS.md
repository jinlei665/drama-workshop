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

### 6. 工作流 (Workflow)
- **路径**: `src/app/api/workflow/`
- **功能**: 定义和执行自动化工作流

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

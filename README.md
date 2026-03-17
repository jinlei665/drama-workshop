# 🎬 短剧漫剧创作工坊

> 将文字故事转化为精美短剧视频的 AI 创作工具

## ✨ 功能特性

- **📝 智能剧本解析** - 自动解析小说或脚本内容，提取人物、场景、对白
- **🎬 分镜自动生成** - AI 智能生成分镜脚本，包含景别、镜头运动、画面描述
- **🎭 人物一致性保持** - 智能识别并保持人物外观一致性
- **🖼️ 真人实拍风格** - 2K 高清图像生成，适合短剧视频制作
- **🎥 动态视频生成** - 6-12秒动态视频，根据内容自动计算时长
- **🔊 语音合成** - 为角色配置独特语音，保持人物语言统一
- **📚 剧集管理** - 树状结构组织分集内容，支持按季分组
- **🖥️ 桌面应用** - 支持 Windows 和 Linux 平台

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 4 |
| 数据库 | PostgreSQL (Supabase) / MySQL |
| 存储 | MinIO / S3 兼容对象存储 |
| LLM | 豆包大模型 (doubao-seed-2-0-pro) |
| 图像生成 | 真人实拍风格 (2K) |
| 视频生成 | doubao-seedance-1-5-pro |
| 桌面应用 | Electron |

## 📦 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/drama-workshop.git
cd drama-workshop

# 配置环境变量
cp .env.docker.example .env
# 编辑 .env 文件，填入必要的配置

# 启动服务
docker-compose up -d

# 访问应用
open http://localhost:5000
```

### 方式二：源码部署

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/drama-workshop.git
cd drama-workshop

# 安装依赖
pnpm install

# 配置环境变量
cp .env.docker.example .env
# 编辑 .env 文件

# 启动开发服务器
pnpm dev

# 或构建生产版本
pnpm build && pnpm start
```

## 📚 文档

| 文档 | 说明 |
|------|------|
| [Ubuntu 部署](docs/DEPLOY_UBUNTU.md) | Ubuntu 服务器部署指南 |
| [Windows 部署](docs/DEPLOY_WINDOWS.md) | Windows 本地部署指南 |
| [数据库与存储配置](docs/DATABASE_STORAGE_CONFIG.md) | MySQL/PostgreSQL 和 MinIO 配置 |
| [MinIO 安装](docs/MINIO_INSTALL.md) | MinIO 本地安装指南（无 Docker） |
| [MinIO 问题排查](docs/MINIO_TROUBLESHOOTING.md) | MinIO 常见问题解决方案 |
| [打包说明](docs/PACKAGING.md) | Electron 桌面应用打包 |

## 🗄️ 数据库初始化

### MySQL

```bash
mysql -u root -p < sql/init-mysql.sql
```

### PostgreSQL

```bash
psql -U postgres -f sql/init-postgresql.sql
```

## 🔧 本地开发环境

使用 Docker Compose 快速搭建本地开发环境：

```bash
# 启动 MySQL + MinIO
docker-compose -f docker-compose.local.yml up -d

# MinIO 控制台
open http://localhost:9001
# 用户名: minioadmin
# 密码: minioadmin123
```

## 📁 项目结构

```
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React 组件
│   │   └── ui/             # shadcn/ui 组件
│   ├── lib/                # 工具函数
│   ├── storage/            # 存储层
│   │   ├── database/       # 数据库客户端
│   │   └── oss/            # 对象存储
│   └── types/              # TypeScript 类型定义
├── docs/                    # 部署文档
├── sql/                     # 数据库初始化脚本
├── docker/                  # Docker 相关文件
└── dist/                    # Electron 打包输出
```

## 🔑 环境变量

```env
# 数据库配置（二选一）
# PostgreSQL
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# MySQL
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=drama_workshop

# 对象存储配置
OSS_ACCESS_KEY=minioadmin
OSS_SECRET_KEY=minioadmin123
OSS_ENDPOINT=http://localhost:9000
OSS_BUCKET=drama-workshop

# AI 服务配置
LLM_API_KEY=your_llm_api_key
IMAGE_API_KEY=your_image_api_key
VIDEO_API_KEY=your_video_api_key
```

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Made with ❤️ by Drama Workshop Team**

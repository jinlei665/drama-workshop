echo "5. pm2 start pnpm --name 'short-drama' -- start"
```

---

## 九、快速启动清单

### 完整命令汇总

```bash
# === 1. 环境准备 ===
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
corepack enable && corepack prepare pnpm@latest --activate

# 安装 FFmpeg
sudo apt install -y ffmpeg

# === 2. 项目部署 ===
# 克隆项目
git clone https://github.com/jinlei665/drama-workshop.git
cd drama-workshop

# 安装依赖（自动包含 coze-coding-dev-sdk）
pnpm install

# 配置环境变量
cp .env.example .env.local
nano .env.local  # 填入 COZE_API_KEY 等配置

# 初始化数据库（如使用 MySQL）
mysql -u root -p < sql/init-mysql.sql

# 构建
pnpm run build

# 启动
pnpm run start
# 或后台运行
pm2 start pnpm --name drama-workshop -- start
```

### 必需配置

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| `COZE_API_KEY` | Coze API 密钥 | [Coze 平台](https://www.coze.cn) → 个人设置 → API 访问令牌 |
| `DATABASE_TYPE` | 数据库类型 | `memory` / `mysql` / `supabase` |
| `COZE_BUCKET_*` | 对象存储 | 用于存储图片/视频 |

### 访问地址

- 本地开发: http://localhost:5000
- 生产环境: 配置 Nginx 后使用域名访问

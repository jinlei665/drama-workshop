# 数据库诊断指南

## 当前状态

### Windows 环境数据库 (kutcpntisqkzrlsdwzfc.supabase.co)

| 表名 | 记录数 |
|------|--------|
| projects | 4 |
| characters | 3 |
| scenes | 20 |
| episodes | 1 |
| user_settings | 1 |
| character_library | 3 |

### 项目列表

| ID | 名称 | 状态 | 风格 |
|----|------|------|------|
| 189e8526-d3f4-42a0-8b30-a27587912301 | 幽冥集录：民间诡事异闻录 | ready | anime_2d_cn |
| 38f0f9d3-874b-4794-98db-3fae112a7294 | 罡斗人间世 | draft | realistic_cinema |
| 92081b38-13ff-4c2e-aba8-f4b320204e64 | 测试项目2 | draft | realistic_cinema |
| 85f0cbd0-bfae-41ad-a98a-dba8962dc7f8 | 测试项目 | draft | realistic_cinema |

## Ubuntu 排查步骤

### 1. 检查环境变量

在 Ubuntu 上运行：
```bash
cd ~/drama-workshop
cat .env.local | grep SUPABASE
```

应该显示：
```
NEXT_PUBLIC_SUPABASE_URL=https://kutcpntisqkzrlsdwzfc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 测试数据库连接

在 Ubuntu 上运行：
```bash
# 安装 supabase CLI (如果没有)
npm install -g supabase

# 或者直接用 curl 测试
curl -X GET "https://kutcpntisqkzrlsdwzfc.supabase.co/rest/v1/projects" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 3. 检查服务日志

启动服务后查看日志：
```bash
pnpm run dev:lan 2>&1 | tee dev.log
```

然后访问一个项目，看日志中的数据库查询结果。

### 4. 常见问题

#### 问题 1: 环境变量未加载
- 确保 `.env.local` 文件在项目根目录
- 重启开发服务器

#### 问题 2: 缓存问题
```bash
rm -rf .next
pnpm run dev:lan
```

#### 问题 3: 网络问题
- 检查 Ubuntu 服务器是否能访问 `kutcpntisqkzrlsdwzfc.supabase.co`
```bash
curl -I https://kutcpntisqkzrlsdwzfc.supabase.co
```

## 数据库导出

如果需要完整导出数据，可以在 Supabase 控制台：
1. 进入 SQL Editor
2. 运行 `SELECT * FROM projects;` 等 SQL
3. 或者使用 Table Editor 导出 CSV

## 验证脚本

在 Supabase SQL Editor 中运行以下 SQL 验证数据：

```sql
-- 验证人物数据
SELECT 
  p.name as project,
  c.name as character_name,
  c.status
FROM characters c
JOIN projects p ON c.project_id = p.id
ORDER BY c.created_at DESC;

-- 验证分镜数据
SELECT 
  p.name as project,
  COUNT(s.id) as scenes
FROM projects p
LEFT JOIN scenes s ON s.project_id = p.id
GROUP BY p.name;
```

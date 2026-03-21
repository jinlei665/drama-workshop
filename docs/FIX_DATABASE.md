# 数据库问题修复指南

## 问题描述

如果您在使用本地部署时遇到以下问题：
- 前端显示 0 个人物，但分镜数量正确
- 日志显示 `Characters query: { count: 0 }` 但分析时有提取到人物
- WebSocket HMR 连接失败导致页面不断刷新

## 原因分析

1. **数据库表缺少字段**：`characters` 表缺少 `status` 字段，导致插入失败
2. **RLS 策略问题**：如果 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 格式不正确，可能无法正确认证
3. **WebSocket 配置问题**：局域网访问时 HMR WebSocket 连接失败

## 解决方案

### 方案一：执行数据库更新脚本（推荐）

1. 打开 Supabase 控制台，进入 SQL Editor
2. 执行项目中的 `assets/update-database.sql` 文件内容
3. 这会自动添加缺失的字段

### 方案二：手动添加字段

在 Supabase SQL Editor 中执行：

```sql
-- 为 characters 表添加 status 字段
ALTER TABLE characters ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS characters_status_idx ON characters(status);
```

### 方案三：重新初始化数据库

如果数据库是空的，可以执行完整的初始化脚本：

```sql
-- 执行 assets/init-database.sql 文件内容
```

## 配置检查

### 1. 检查环境变量

确保 `.env` 文件中有正确的配置：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**重要**：
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 应该是 JWT 格式（以 `eyJ` 开头）
- `SUPABASE_SERVICE_ROLE_KEY` 用于服务端绕过 RLS，确保正确配置

### 2. 获取正确的 Key

1. 登录 Supabase 控制台
2. 进入项目设置 → API
3. 复制正确的 `anon public` key（JWT 格式）
4. 复制 `service_role` key（点击 Reveal 显示）

### 3. WebSocket HMR 问题

如果页面不断刷新，可以在 `.env` 中添加：

```env
# 禁用 HMR（如果问题持续）
WATCHPACK_POLLING=true
```

或者确保使用 `--hostname 0.0.0.0` 启动开发服务器：

```bash
pnpm dev --port 5000 --hostname 0.0.0.0
```

## 验证修复

1. 重启开发服务器
2. 重新创建项目并分析内容
3. 检查日志确认人物保存成功：
   ```
   [Analyze] Saved character "xxx" to database: xxx
   ```
4. 检查前端是否正确显示人物数量

## 故障排除

### 查看详细日志

启动开发服务器时，查看控制台输出，特别关注：
- `[Database] Connecting to Supabase` - 确认数据库连接
- `[Analyze] Using service_role/anon client` - 确认使用的客户端类型
- `[Analyze] Inserting character` - 查看插入数据
- `[Analyze] Error details` - 查看错误详情

### 常见错误

1. **`column "status" of relation "characters" does not exist`**
   - 执行更新脚本添加 status 字段

2. **`new row violates row-level security policy`**
   - 确保 `SUPABASE_SERVICE_ROLE_KEY` 已正确配置
   - 或检查 RLS 策略是否允许 anon 访问

3. **`invalid JWT`**
   - 检查 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 格式是否正确
   - 应该以 `eyJ` 开头，不是 `sb_publishable_`

## 联系支持

如果问题仍未解决，请提供：
1. 错误日志（控制台输出）
2. 环境变量配置（隐藏敏感信息）
3. Supabase 表结构截图

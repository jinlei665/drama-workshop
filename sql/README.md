# 数据库初始化 SQL 文件

此目录包含用于初始化数据库的 SQL 脚本。

## 文件说明

| 文件 | 数据库 | 说明 |
|------|--------|------|
| `init-mysql.sql` | MySQL | 创建数据库、用户和所有表结构 |
| `init-postgresql.sql` | PostgreSQL | 创建数据库和所有表结构 |

## 使用方法

### MySQL

**方式1: 命令行直接执行**
```bash
mysql -u root -p < init-mysql.sql
```

**方式2: 登录 MySQL 后执行**
```sql
source /path/to/init-mysql.sql
```

**方式3: Windows CMD**
```cmd
mysql -u root -p < sql\init-mysql.sql
```

**方式4: MySQL Workbench**
1. 打开 MySQL Workbench
2. 连接到数据库
3. File → Open SQL Script → 选择 `init-mysql.sql`
4. 点击执行（闪电图标）

### PostgreSQL

**方式1: 命令行直接执行**
```bash
psql -U postgres -f init-postgresql.sql
```

**方式2: 登录 PostgreSQL 后执行**
```sql
\i /path/to/init-postgresql.sql
```

**方式3: Windows CMD**
```cmd
psql -U postgres -f sql\init-postgresql.sql
```

**方式4: pgAdmin**
1. 打开 pgAdmin
2. 连接到服务器
3. Tools → Query Tool
4. 打开 `init-postgresql.sql` 文件
5. 点击执行（F5）

## 默认配置

### MySQL

| 配置项 | 值 |
|--------|-----|
| 数据库名 | drama_studio |
| 用户名 | drama_user |
| 密码 | drama123456 |

**⚠️ 请在生产环境中修改默认密码！**

### PostgreSQL

| 配置项 | 值 |
|--------|-----|
| 数据库名 | drama_studio |
| 用户名 | postgres（默认）|

## 表结构

初始化后创建的表：

| 表名 | 说明 |
|------|------|
| `health_check` | 系统健康检查表 |
| `projects` | 项目表 |
| `episodes` | 剧集表 |
| `characters` | 人物表 |
| `scenes` | 分镜表 |

## 注意事项

1. **重复执行**：脚本设计为可重复执行，不会覆盖现有数据
2. **外键约束**：已配置级联删除，删除项目时会自动删除相关数据
3. **字符集**：MySQL 使用 utf8mb4，支持完整的 Unicode（包括 emoji）

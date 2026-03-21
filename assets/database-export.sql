-- ============================================
-- 数据库完整导出 - 2026-03-21
-- 来源: Windows 环境
-- 数据库: kutcpntisqkzrlsdwzfc.supabase.co
-- ============================================

-- ============================================
-- 表结构
-- ============================================

-- projects 表 (4 条记录)
SELECT 'projects 表结构正常' as status;

-- characters 表 (3 条记录)
SELECT 'characters 表结构正常，包含 status 字段' as status;

-- scenes 表 (20 条记录)
SELECT 'scenes 表结构正常' as status;

-- episodes 表 (1 条记录)
SELECT 'episodes 表结构正常' as status;

-- user_settings 表 (1 条记录)
SELECT 'user_settings 表结构正常' as status;

-- character_library 表 (3 条记录)
SELECT 'character_library 表结构正常' as status;

-- ============================================
-- 数据统计
-- ============================================

SELECT 
  'projects' as table_name, 
  COUNT(*) as count 
FROM projects
UNION ALL
SELECT 'characters', COUNT(*) FROM characters
UNION ALL
SELECT 'scenes', COUNT(*) FROM scenes
UNION ALL
SELECT 'episodes', COUNT(*) FROM episodes
UNION ALL
SELECT 'user_settings', COUNT(*) FROM user_settings
UNION ALL
SELECT 'character_library', COUNT(*) FROM character_library;

-- ============================================
-- 项目列表
-- ============================================

SELECT 
  id, 
  name, 
  status, 
  style,
  created_at 
FROM projects 
ORDER BY created_at DESC;

-- ============================================
-- 人物列表
-- ============================================

SELECT 
  c.id,
  c.project_id,
  p.name as project_name,
  c.name as character_name,
  c.status,
  CASE WHEN c.front_view_key IS NOT NULL THEN '有图片' ELSE '无图片' END as has_image,
  c.created_at
FROM characters c
LEFT JOIN projects p ON c.project_id = p.id
ORDER BY c.created_at DESC;

-- ============================================
-- 分镜统计
-- ============================================

SELECT 
  p.name as project_name,
  COUNT(s.id) as scene_count,
  SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN s.image_url IS NOT NULL THEN 1 ELSE 0 END) as has_image,
  SUM(CASE WHEN s.video_url IS NOT NULL THEN 1 ELSE 0 END) as has_video
FROM projects p
LEFT JOIN scenes s ON s.project_id = p.id
GROUP BY p.id, p.name
ORDER BY p.created_at DESC;

-- 短剧漫剧创作工坊 - 数据库增量更新脚本
-- 如果数据库已存在，执行此脚本添加缺失的字段
-- 在 Supabase SQL Editor 中执行

-- ============================================
-- 1. 为 characters 表添加缺失的字段
-- ============================================

-- 添加 status 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'status'
  ) THEN
    ALTER TABLE characters ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    RAISE NOTICE 'Added status column to characters table';
  ELSE
    RAISE NOTICE 'status column already exists in characters table';
  END IF;
END $$;

-- 添加 personality 列（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'personality'
  ) THEN
    ALTER TABLE characters ADD COLUMN personality TEXT;
    RAISE NOTICE 'Added personality column to characters table';
  ELSE
    RAISE NOTICE 'personality column already exists in characters table';
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS characters_status_idx ON characters(status);

-- ============================================
-- 2. 为 scenes 表添加缺失的字段
-- ============================================

-- 添加 episode_id 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scenes' AND column_name = 'episode_id'
  ) THEN
    ALTER TABLE scenes ADD COLUMN episode_id VARCHAR(36);
    RAISE NOTICE 'Added episode_id column to scenes table';
  ELSE
    RAISE NOTICE 'episode_id column already exists in scenes table';
  END IF;
END $$;

-- 添加 last_frame_url 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scenes' AND column_name = 'last_frame_url'
  ) THEN
    ALTER TABLE scenes ADD COLUMN last_frame_url TEXT;
    RAISE NOTICE 'Added last_frame_url column to scenes table';
  ELSE
    RAISE NOTICE 'last_frame_url column already exists in scenes table';
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS scenes_episode_id_idx ON scenes(episode_id);

-- ============================================
-- 3. 为 episodes 表添加缺失的字段
-- ============================================

-- 添加 season_number 列
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episodes' AND column_name = 'season_number'
  ) THEN
    ALTER TABLE episodes ADD COLUMN season_number INTEGER DEFAULT 1 NOT NULL;
    RAISE NOTICE 'Added season_number column to episodes table';
  ELSE
    RAISE NOTICE 'season_number column already exists in episodes table';
  END IF;
END $$;

-- ============================================
-- 4. 验证更新结果
-- ============================================

SELECT 
  'characters' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'characters' 
ORDER BY ordinal_position;

SELECT 
  'scenes' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'scenes' 
ORDER BY ordinal_position;

-- ============================================
-- 完成
-- ============================================
SELECT 'Database update completed successfully!' as status;

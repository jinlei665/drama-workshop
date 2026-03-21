-- 短剧漫剧创作工坊 - 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 0. 删除旧表（如果存在）
-- ============================================
DROP TABLE IF EXISTS scenes CASCADE;
DROP TABLE IF EXISTS characters CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;

-- ============================================
-- 1. 项目表
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_content TEXT NOT NULL,
  source_type VARCHAR(20) DEFAULT 'novel' NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' NOT NULL,
  style VARCHAR(50) DEFAULT 'realistic_cinema',
  final_video_url TEXT,
  final_video_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at);

-- ============================================
-- 2. 剧集表
-- ============================================
CREATE TABLE IF NOT EXISTS episodes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(36) NOT NULL,
  season_number INTEGER DEFAULT 1 NOT NULL,
  episode_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  merged_video_url TEXT,
  merged_video_status VARCHAR(20) DEFAULT 'pending',
  merged_video_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS episodes_project_id_idx ON episodes(project_id);
CREATE INDEX IF NOT EXISTS episodes_season_episode_idx ON episodes(season_number, episode_number);

-- ============================================
-- 3. 人物表
-- ============================================
CREATE TABLE IF NOT EXISTS characters (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  appearance TEXT,
  personality TEXT,
  front_view_key TEXT,
  side_view_key TEXT,
  back_view_key TEXT,
  reference_image_key TEXT,
  image_url TEXT,
  voice_id VARCHAR(100),
  voice_url TEXT,
  voice_style VARCHAR(50),
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS characters_project_id_idx ON characters(project_id);
CREATE INDEX IF NOT EXISTS characters_name_idx ON characters(name);

-- ============================================
-- 4. 分镜表
-- ============================================
CREATE TABLE IF NOT EXISTS scenes (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(36) NOT NULL,
  episode_id VARCHAR(36),
  scene_number INTEGER NOT NULL,
  title VARCHAR(255),
  description TEXT NOT NULL,
  dialogue TEXT,
  action TEXT,
  emotion VARCHAR(50),
  character_ids JSONB DEFAULT '[]',
  image_key TEXT,
  image_url TEXT,
  video_url TEXT,
  video_status VARCHAR(20) DEFAULT 'pending',
  last_frame_url TEXT,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scenes_project_id_idx ON scenes(project_id);
CREATE INDEX IF NOT EXISTS scenes_episode_id_idx ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS scenes_scene_number_idx ON scenes(scene_number);
CREATE INDEX IF NOT EXISTS scenes_status_idx ON scenes(status);

-- ============================================
-- 5. 用户配置表
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id VARCHAR(36) PRIMARY KEY,
  
  -- LLM配置
  llm_provider VARCHAR(50) DEFAULT 'coze',
  llm_model VARCHAR(100),
  llm_api_key TEXT,
  llm_base_url VARCHAR(255),
  
  -- Coze配置
  coze_api_key TEXT,
  coze_base_url VARCHAR(255),
  bot_id VARCHAR(100),
  
  -- 图像生成配置
  image_provider VARCHAR(50) DEFAULT 'doubao',
  image_model VARCHAR(100),
  image_api_key TEXT,
  image_base_url VARCHAR(255),
  image_size VARCHAR(20) DEFAULT '2K',
  
  -- 视频生成配置
  video_provider VARCHAR(50) DEFAULT 'doubao',
  video_model VARCHAR(100),
  video_api_key TEXT,
  video_base_url VARCHAR(255),
  video_resolution VARCHAR(20) DEFAULT '720p',
  video_ratio VARCHAR(20) DEFAULT '16:9',
  
  -- 语音生成配置
  voice_provider VARCHAR(50) DEFAULT 'doubao',
  voice_model VARCHAR(100),
  voice_api_key TEXT,
  voice_base_url VARCHAR(255),
  voice_default_style VARCHAR(50) DEFAULT 'natural',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- ============================================
-- 6. 启用 Row Level Security (RLS)
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问（开发环境）
CREATE POLICY "Allow all for anon" ON projects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON episodes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON characters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON scenes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON user_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- 允许服务端完全访问
CREATE POLICY "Service role full access" ON projects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON episodes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON characters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON scenes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 完成
-- ============================================
SELECT 'Database initialization completed!' as status;

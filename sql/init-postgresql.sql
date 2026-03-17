-- Drama Studio - PostgreSQL 数据库初始化脚本
-- 适用于源码部署，直接使用本地 PostgreSQL 执行此脚本

-- ============================================
-- 使用方法
-- ============================================
-- 方式1: 命令行执行
--   psql -U postgres -f init-postgresql.sql
--
-- 方式2: 登录 PostgreSQL 后执行
--   \i /path/to/init-postgresql.sql
--
-- 方式3: 使用 pgAdmin
--   打开 Query Tool 并执行此文件
-- ============================================

-- 创建数据库
CREATE DATABASE drama_studio;

-- 连接到数据库
\c drama_studio

-- 创建 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建用户（可选）
-- 注意：请修改密码为安全的密码
-- CREATE USER drama_user WITH ENCRYPTED PASSWORD 'drama123456';
-- GRANT ALL PRIVILEGES ON DATABASE drama_studio TO drama_user;

-- ============================================
-- 系统表
-- ============================================
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 项目表
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_content TEXT NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'novel',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    final_video_url TEXT,
    final_video_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- ============================================
-- 剧集表
-- ============================================
CREATE TABLE IF NOT EXISTS episodes (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    season_number INT NOT NULL DEFAULT 1,
    episode_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    merged_video_url TEXT,
    merged_video_status VARCHAR(20) DEFAULT 'pending',
    merged_video_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_episodes_project_id ON episodes(project_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_episode ON episodes(season_number, episode_number);

-- ============================================
-- 人物表
-- ============================================
CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    appearance TEXT,
    personality TEXT,
    front_view_key TEXT,
    side_view_key TEXT,
    back_view_key TEXT,
    reference_image_key TEXT,
    voice_id VARCHAR(100),
    voice_url TEXT,
    voice_style VARCHAR(50),
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);

-- ============================================
-- 分镜表
-- ============================================
CREATE TABLE IF NOT EXISTS scenes (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_id VARCHAR(36) REFERENCES episodes(id) ON DELETE SET NULL,
    scene_number INT NOT NULL,
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
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_scenes_scene_number ON scenes(scene_number);
CREATE INDEX IF NOT EXISTS idx_scenes_status ON scenes(status);

-- ============================================
-- 创建更新时间触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为每个表创建触发器
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['projects', 'episodes', 'characters', 'scenes'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$;

-- ============================================
-- 插入健康检查记录
-- ============================================
INSERT INTO health_check (updated_at) VALUES (NOW());

-- ============================================
-- 用户设置表
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Coze API 配置
    coze_api_key VARCHAR(500),
    coze_base_url VARCHAR(200) DEFAULT 'https://api.coze.com',
    -- LLM 配置
    llm_provider VARCHAR(50) DEFAULT 'doubao',
    llm_model VARCHAR(100) DEFAULT 'doubao-seed-1-8-251228',
    llm_api_key VARCHAR(500),
    llm_base_url VARCHAR(500),
    -- 图像配置
    image_provider VARCHAR(50) DEFAULT 'doubao',
    image_model VARCHAR(100) DEFAULT 'doubao-seed-3-0',
    image_api_key VARCHAR(500),
    image_base_url VARCHAR(500),
    image_size VARCHAR(20) DEFAULT '2K',
    -- 视频配置
    video_provider VARCHAR(50) DEFAULT 'doubao',
    video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
    video_api_key VARCHAR(500),
    video_base_url VARCHAR(500),
    video_resolution VARCHAR(20) DEFAULT '720p',
    video_ratio VARCHAR(10) DEFAULT '16:9',
    -- 语音配置
    voice_provider VARCHAR(50) DEFAULT 'doubao',
    voice_model VARCHAR(100) DEFAULT 'doubao-tts',
    voice_api_key VARCHAR(500),
    voice_base_url VARCHAR(500),
    voice_default_style VARCHAR(50) DEFAULT 'natural',
    -- FFmpeg 配置
    ffmpeg_path VARCHAR(500),
    ffprobe_path VARCHAR(500),
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 为 user_settings 表创建触发器
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成
SELECT '========================================' AS "";
SELECT 'Database initialized successfully!' AS "Message";
SELECT 'Database: drama_studio' AS "Info";
SELECT '========================================' AS "";

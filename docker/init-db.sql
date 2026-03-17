-- 短剧漫剧创作工坊 - 数据库初始化脚本
-- 创建必要的表结构

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== 用户设置表 ====================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Coze API 配置
    coze_api_key TEXT,
    coze_base_url TEXT DEFAULT 'https://api.coze.com',
    -- LLM 配置
    llm_provider VARCHAR(50) DEFAULT 'doubao',
    llm_model VARCHAR(100) DEFAULT 'doubao-seed-1-8-251228',
    llm_api_key TEXT,
    llm_base_url TEXT,
    -- 图像配置
    image_provider VARCHAR(50) DEFAULT 'doubao',
    image_model VARCHAR(100) DEFAULT 'doubao-seed-3-0',
    image_api_key TEXT,
    image_base_url TEXT,
    image_size VARCHAR(20) DEFAULT '2K',
    -- 视频配置
    video_provider VARCHAR(50) DEFAULT 'doubao',
    video_model VARCHAR(100) DEFAULT 'doubao-seedance-1-5-pro-251215',
    video_api_key TEXT,
    video_base_url TEXT,
    video_resolution VARCHAR(20) DEFAULT '720p',
    video_ratio VARCHAR(20) DEFAULT '16:9',
    -- 语音配置
    voice_provider VARCHAR(50) DEFAULT 'doubao',
    voice_model VARCHAR(100) DEFAULT 'doubao-tts',
    voice_api_key TEXT,
    voice_base_url TEXT,
    voice_default_style VARCHAR(50) DEFAULT 'natural',
    -- FFmpeg 配置
    ffmpeg_path TEXT,
    ffprobe_path TEXT,
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认设置
INSERT INTO user_settings (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;

-- ==================== 项目表 ====================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_content TEXT,
    source_type VARCHAR(50) DEFAULT 'text',
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== 剧集表 ====================
CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    season_number INTEGER DEFAULT 1,
    episode_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, season_number, episode_number)
);

-- ==================== 角色表 ====================
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    appearance TEXT,
    personality TEXT,
    front_view_key TEXT,
    side_view_key TEXT,
    back_view_key TEXT,
    voice_id VARCHAR(100),
    voice_url TEXT,
    voice_style VARCHAR(50) DEFAULT 'natural',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== 分镜表 ====================
CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
    scene_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT NOT NULL,
    dialogue TEXT,
    action TEXT,
    emotion VARCHAR(100),
    character_ids UUID[] DEFAULT '{}',
    image_key TEXT,
    image_url TEXT,
    video_key TEXT,
    video_url TEXT,
    video_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, scene_number)
);

-- ==================== 索引 ====================
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_episodes_project_id ON episodes(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
CREATE INDEX IF NOT EXISTS idx_scenes_status ON scenes(status);
CREATE INDEX IF NOT EXISTS idx_scenes_video_status ON scenes(video_status);

-- ==================== 更新时间触发器 ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_episodes_updated_at BEFORE UPDATE ON episodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== 授权 ====================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
END $$;

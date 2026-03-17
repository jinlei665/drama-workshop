-- Drama Studio - MySQL 数据库初始化脚本
-- 适用于源码部署，直接使用本地 MySQL 执行此脚本

-- ============================================
-- 使用方法
-- ============================================
-- 方式1: 命令行执行
--   mysql -u root -p < init-mysql.sql
--
-- 方式2: 登录 MySQL 后执行
--   source /path/to/init-mysql.sql
--
-- 方式3: 使用 MySQL Workbench
--   打开此文件并执行
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS drama_studio
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- 创建用户（如果不存在）
-- 注意：请修改密码为安全的密码
CREATE USER IF NOT EXISTS 'drama_user'@'localhost' IDENTIFIED BY 'drama123456';

-- 授权
GRANT ALL PRIVILEGES ON drama_studio.* TO 'drama_user'@'localhost';
FLUSH PRIVILEGES;

-- 使用数据库
USE drama_studio;

-- ============================================
-- 系统表
-- ============================================
CREATE TABLE IF NOT EXISTS health_check (
    id INT AUTO_INCREMENT PRIMARY KEY,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- 项目表
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_content TEXT NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'novel',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    final_video_url TEXT,
    final_video_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_projects_status (status),
    INDEX idx_projects_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 剧集表
-- ============================================
CREATE TABLE IF NOT EXISTS episodes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    season_number INT NOT NULL DEFAULT 1,
    episode_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    merged_video_url TEXT,
    merged_video_status VARCHAR(20) DEFAULT 'pending',
    merged_video_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_episodes_project_id (project_id),
    INDEX idx_episodes_season_episode (season_number, episode_number),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 人物表
-- ============================================
CREATE TABLE IF NOT EXISTS characters (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
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
    tags JSON DEFAULT ('[]'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_characters_project_id (project_id),
    INDEX idx_characters_name (name),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 分镜表
-- ============================================
CREATE TABLE IF NOT EXISTS scenes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id CHAR(36) NOT NULL,
    episode_id CHAR(36),
    scene_number INT NOT NULL,
    title VARCHAR(255),
    description TEXT NOT NULL,
    dialogue TEXT,
    action TEXT,
    emotion VARCHAR(50),
    character_ids JSON DEFAULT ('[]'),
    image_key TEXT,
    image_url TEXT,
    video_url TEXT,
    video_status VARCHAR(20) DEFAULT 'pending',
    last_frame_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_scenes_project_id (project_id),
    INDEX idx_scenes_episode_id (episode_id),
    INDEX idx_scenes_scene_number (scene_number),
    INDEX idx_scenes_status (status),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 插入健康检查记录
-- ============================================
INSERT INTO health_check (updated_at) VALUES (NOW());

-- ============================================
-- 用户设置表
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 完成
SELECT '========================================' AS '';
SELECT 'Database initialized successfully!' AS 'Message';
SELECT 'Database: drama_studio' AS 'Info';
SELECT 'User: drama_user' AS 'Info';
SELECT 'Password: drama123456 (please change it!)' AS 'Warning';
SELECT '========================================' AS '';

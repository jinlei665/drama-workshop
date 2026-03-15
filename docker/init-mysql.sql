-- Drama Studio - MySQL 数据库初始化脚本

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

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

-- 完成
SELECT 'Database initialized successfully!' AS message;

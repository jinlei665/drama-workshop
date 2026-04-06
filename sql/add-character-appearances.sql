-- 添加人物形象表
-- 支持一个角色拥有多个形象

CREATE TABLE IF NOT EXISTS character_appearances (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id VARCHAR(36) NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL DEFAULT '默认形象',  -- 形象名称，如"正面"、"侧面"、"服装A"等
  image_key TEXT NOT NULL,  -- 图片存储key
  image_url TEXT,  -- 图片URL
  is_primary BOOLEAN DEFAULT FALSE,  -- 是否主形象
  description TEXT,  -- 形象描述
  tags JSONB DEFAULT '[]',  -- 形象标签
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS character_appearances_character_id_idx ON character_appearances(character_id);
CREATE INDEX IF NOT EXISTS character_appearances_is_primary_idx ON character_appearances(character_id, is_primary);

-- 添加注释
COMMENT ON TABLE character_appearances IS '人物形象表 - 存储角色的多个形象';
COMMENT ON COLUMN character_appearances.character_id IS '关联的人物ID';
COMMENT ON COLUMN character_appearances.name IS '形象名称，如正面、侧面、服装A等';
COMMENT ON COLUMN character_appearances.image_key IS '图片存储key';
COMMENT ON COLUMN character_appearances.is_primary IS '是否主形象，一个角色可以有一个主形象';

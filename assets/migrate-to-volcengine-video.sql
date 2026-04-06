-- 迁移到火山引擎视频生成
-- 将默认视频模型更新为火山引擎的 Seedance 2.0

-- 更新现有用户的视频配置
UPDATE user_settings
SET
  video_provider = 'volcengine',
  video_model = 'doubao-seedance-2-0'
WHERE video_provider = 'doubao' AND video_model LIKE 'seedance%';

-- 插入注释说明
COMMENT ON COLUMN user_settings.video_provider IS '视频生成服务提供商: doubao(豆包), volcengine(火山引擎)';
COMMENT ON COLUMN user_settings.video_model IS '视频模型: doubao-seedance-2-0(火山引擎最新), doubao-seedance-1-5-pro-251215(旧版)';

-- 查看迁移结果
SELECT
  video_provider,
  video_model,
  COUNT(*) as user_count
FROM user_settings
GROUP BY video_provider, video_model;

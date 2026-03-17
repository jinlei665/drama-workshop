import { NextRequest, NextResponse } from 'next/server';
import { generateVideoFromImage, DEFAULT_VIDEO_MODEL } from '@/lib/ai';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client';

/**
 * 批量生成视频片段
 * POST /api/generate/videos
 * 
 * 将分镜图片转换为视频片段
 * - 连续生成模式：使用上一帧保持连贯性（推荐）
 * - 快速模式：并行生成，速度快但可能不够连贯
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sceneIds, mode = 'continuous' } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: '缺少项目ID' },
        { status: 400 }
      );
    }

    // 检查数据库是否可用
    if (!isDatabaseConfigured()) {
      return NextResponse.json(
        { error: '数据库未配置，无法保存视频' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseClient();

    // 获取用户配置
    let videoModel = DEFAULT_VIDEO_MODEL;
    let videoResolution: '480p' | '720p' | '1080p' = '720p';
    let videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' = '16:9';

    try {
      const result = await supabase
        .from('user_settings')
        .select('video_model, video_resolution, video_ratio')
        .limit(1)
        .maybeSingle();
      
      if (result.data) {
        videoModel = result.data.video_model || DEFAULT_VIDEO_MODEL;
        if (['480p', '720p', '1080p'].includes(result.data.video_resolution)) {
          videoResolution = result.data.video_resolution as '480p' | '720p' | '1080p';
        }
        if (['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].includes(result.data.video_ratio)) {
          videoRatio = result.data.video_ratio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
        }
      }
    } catch {
      // 使用默认值
    }

    // 获取项目信息
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // 获取分镜列表（按序号排序）
    let query = supabase
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number', 'asc');

    if (sceneIds && sceneIds.length > 0) {
      query = query.in('id', sceneIds);
    }

    const { data: scenesList, error: scenesError } = await query;

    if (scenesError) {
      console.error('获取分镜失败:', scenesError);
      return NextResponse.json(
        { error: '获取分镜失败' },
        { status: 500 }
      );
    }

    // 过滤出有图片的分镜
    const scenesWithImages = (scenesList || []).filter((s: { image_key?: string }) => s.image_key);
    
    if (scenesWithImages.length === 0) {
      return NextResponse.json(
        { error: '没有可用的分镜图片，请先生成分镜图片' },
        { status: 400 }
      );
    }

    // 更新所有分镜的视频状态为 generating
    const sceneIdsToUpdate = scenesWithImages.map((s: { id: string }) => s.id);
    await supabase
      .from('scenes')
      .update({ video_status: 'generating', updated_at: new Date().toISOString() })
      .in('id', sceneIdsToUpdate);

    // 初始化对象存储（用于获取图片URL）
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    let results: { sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[] = [];

    // 根据模式选择生成方式
    if (mode === 'fast') {
      results = await generateFast(scenesWithImages, storage, supabase, videoModel, videoResolution, videoRatio);
    } else {
      results = await generateSequential(scenesWithImages, storage, supabase, videoModel, videoResolution, videoRatio);
    }

    // 更新项目状态
    const completedCount = results.filter(r => r.status === 'completed').length;
    await supabase
      .from('projects')
      .update({
        final_video_status: completedCount === scenesWithImages.length ? 'completed' : 'partial',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    return NextResponse.json({
      success: true,
      message: `成功生成 ${completedCount}/${scenesWithImages.length} 个视频片段`,
      results,
    });
  } catch (error) {
    console.error('视频生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '视频生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 连续生成模式 - 使用上一帧保持视觉连贯性
 */
async function generateSequential(
  scenesWithImages: { id: string; scene_number: number; image_key?: string; image_url?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  storage: S3Storage,
  supabase: ReturnType<typeof getSupabaseClient>,
  videoModel: string,
  videoResolution: '480p' | '720p' | '1080p',
  videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
): Promise<{ sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[]> {
  const results: { sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[] = [];
  let previousLastFrame: string | null = null;

  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];
    
    // 添加延迟避免限流（10秒间隔）
    if (i > 0) {
      console.log(`等待10秒后继续生成下一个视频...`);
      await delay(10000);
    }
    
    try {
      let firstFrameUrl: string;
      
      // 如果有上一帧，使用它作为首帧
      if (previousLastFrame) {
        firstFrameUrl = previousLastFrame;
      } else {
        // 获取当前分镜图片的签名URL
        const imageUrl = await getImageUrl(scene, storage);
        if (!imageUrl) {
          throw new Error('无法获取分镜图片URL');
        }
        firstFrameUrl = imageUrl;
      }

      // 构建视频描述
      const videoPrompt = buildVideoPrompt(scene);
      const duration = calculateDuration(scene);

      console.log(`开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒`);

      // 使用系统自带的视频生成服务
      const result = await generateVideoFromImage(videoPrompt, firstFrameUrl, {
        model: videoModel,
        duration,
        ratio: videoRatio,
        resolution: videoResolution,
        generateAudio: true,
      });

      // 更新数据库
      await supabase
        .from('scenes')
        .update({
          video_url: result.videoUrl,
          last_frame_url: result.lastFrameUrl || null,
          video_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scene.id);

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        videoUrl: result.videoUrl,
        duration,
        status: 'completed',
      });

      previousLastFrame = result.lastFrameUrl || null;
      console.log(`分镜 ${scene.scene_number} 视频生成成功`);
    } catch (error) {
      console.error(`分镜 ${scene.scene_number} 视频生成失败:`, error);
      
      await supabase
        .from('scenes')
        .update({
          video_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scene.id);

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        error: error instanceof Error ? error.message : '未知错误',
        status: 'failed',
      });

      // 失败后重置
      previousLastFrame = null;
    }
  }

  return results;
}

/**
 * 获取分镜图片URL
 */
async function getImageUrl(scene: { image_key?: string; image_url?: string }, storage: S3Storage): Promise<string | null> {
  // 优先使用直接存储的URL
  if (scene.image_url) {
    return scene.image_url;
  }

  // 从对象存储获取签名URL
  if (scene.image_key) {
    try {
      const signedUrl = await storage.generatePresignedUrl({
        key: scene.image_key,
        expireTime: 3600,
      });
      return typeof signedUrl === 'string' ? signedUrl : (signedUrl as { url: string }).url;
    } catch (e) {
      console.error('获取图片URL失败:', e);
      return null;
    }
  }

  return null;
}

/**
 * 计算视频时长（基于内容复杂度）
 */
function calculateDuration(scene: { dialogue?: string | null; action?: string | null; description?: string }): number {
  let duration = 6; // 基础6秒

  if (scene.dialogue) {
    const dialogueLength = scene.dialogue.length;
    if (dialogueLength > 50) duration += 4;
    else if (dialogueLength > 30) duration += 3;
    else if (dialogueLength > 15) duration += 2;
    else if (dialogueLength > 0) duration += 1;
  }

  if (scene.action && scene.action.length > 20) duration += 2;
  else if (scene.action && scene.action.length > 0) duration += 1;

  if (scene.description && scene.description.length > 100) duration += 1;

  return Math.min(Math.max(duration, 6), 12);
}

/**
 * 构建视频生成提示词
 */
function buildVideoPrompt(scene: { description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }): string {
  const parts: string[] = [];

  if (scene.description) parts.push(scene.description);
  if (scene.action) parts.push(scene.action);
  if (scene.dialogue) parts.push(`角色说道："${scene.dialogue}"`);
  if (scene.emotion) parts.push(`氛围：${scene.emotion}`);

  if (scene.metadata) {
    if (scene.metadata.shotType) parts.push(`景别：${scene.metadata.shotType}`);
    if (scene.metadata.cameraMovement) {
      const movementMap: Record<string, string> = {
        '固定': 'static camera',
        '推镜': 'slow zoom in',
        '拉镜': 'slow zoom out',
        '摇镜': 'panning shot',
        '跟拍': 'tracking shot',
      };
      parts.push(`镜头运动：${movementMap[scene.metadata.cameraMovement] || scene.metadata.cameraMovement}`);
    }
  }

  if (parts.length === 0) {
    parts.push('流畅的电影镜头，自然的光线变化，细腻的情感表达');
  }

  return parts.join('，');
}

/**
 * 快速生成模式 - 串行生成视频片段
 */
async function generateFast(
  scenesWithImages: { id: string; scene_number: number; image_key?: string; image_url?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  storage: S3Storage,
  supabase: ReturnType<typeof getSupabaseClient>,
  videoModel: string,
  videoResolution: '480p' | '720p' | '1080p',
  videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'
): Promise<{ sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[]> {
  const results: { sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[] = [];

  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];
    
    if (i > 0) {
      console.log(`[快速模式] 等待10秒后继续生成下一个视频...`);
      await delay(10000);
    }

    try {
      const imageUrl = await getImageUrl(scene, storage);
      if (!imageUrl) {
        throw new Error('无法获取分镜图片URL');
      }

      const videoPrompt = buildVideoPrompt(scene);
      const duration = calculateDuration(scene);

      console.log(`[快速模式] 开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒`);

      const result = await generateVideoFromImage(videoPrompt, imageUrl, {
        model: videoModel,
        duration,
        ratio: videoRatio,
        resolution: videoResolution,
        generateAudio: true,
      });

      await supabase
        .from('scenes')
        .update({
          video_url: result.videoUrl,
          video_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scene.id);

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        videoUrl: result.videoUrl,
        duration,
        status: 'completed',
      });
    } catch (error) {
      console.error(`[快速模式] 分镜 ${scene.scene_number} 视频生成失败:`, error);

      await supabase
        .from('scenes')
        .update({
          video_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scene.id);

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        error: error instanceof Error ? error.message : '未知错误',
        status: 'failed',
      });
    }
  }

  return results;
}

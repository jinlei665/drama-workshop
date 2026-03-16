import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationClient, Config, HeaderUtils, S3Storage, Content } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

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
    const { projectId, sceneIds, parallel = false, mode = 'continuous' } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: '缺少项目ID' },
        { status: 400 }
      );
    }

    // 获取用户配置
    let settings: any = null
    try {
      const supabase = getSupabaseClient();
      const result = await supabase
        .from('user_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      settings = result.data;
    } catch (dbError) {
      console.warn("Failed to fetch user settings:", dbError)
    }

    // 使用用户配置的模型，如果没有配置则使用默认模型
    const videoModel = settings?.video_model || process.env.VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215';

    const supabase = getSupabaseClient();

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
    const scenesWithImages = (scenesList || []).filter((s: any) => s.image_key);
    
    if (scenesWithImages.length === 0) {
      return NextResponse.json(
        { error: '没有可用的分镜图片，请先生成分镜图片' },
        { status: 400 }
      );
    }

    // 更新所有分镜的视频状态为 generating
    const sceneIdsToUpdate = scenesWithImages.map((s: any) => s.id);
    await supabase
      .from('scenes')
      .update({ video_status: 'generating', updated_at: new Date().toISOString() })
      .in('id', sceneIdsToUpdate);

    // 初始化视频生成客户端，增加超时时间到 300 秒（视频生成需要更长时间）
    const config = new Config({
      apiKey: settings?.video_api_key || process.env.VIDEO_API_KEY,
      baseUrl: settings?.video_base_url || process.env.VIDEO_BASE_URL,
      timeout: 300000, // 300 秒超时
    });
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = new VideoGenerationClient(config, customHeaders);

    // 初始化对象存储（用于获取图片URL）
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    let results: any[] = [];

    // 根据模式选择生成方式
    // fast: 快速模式 - 并行生成，速度快但可能不够连贯
    // continuous: 连续模式 - 使用上一帧保持连贯性，推荐
    
    if (mode === 'fast') {
      results = await generateFast(scenesWithImages, client, storage, supabase, videoModel);
    } else {
      results = await generateSequential(scenesWithImages, client, storage, supabase, videoModel);
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
 * 带重试的视频生成 - 使用指数退避策略
 */
async function generateVideoWithRetry(
  client: VideoGenerationClient,
  contentItems: Content[],
  options: any,
  maxRetries: number = 5
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.videoGeneration(contentItems, options);
      return response;
    } catch (error: any) {
      lastError = error;
      
      // 打印详细错误信息
      console.log(`视频生成错误详情:`, {
        message: error.message,
        statusCode: error.statusCode,
        response: error.response ? JSON.stringify(error.response).substring(0, 500) : 'N/A'
      });
      
      // 如果是403错误，使用指数退避等待后重试
      if (error.message?.includes('403') || error.statusCode === 403) {
        // 指数退避：20秒、40秒、60秒、80秒、100秒
        const waitTime = (attempt + 1) * 20000;
        console.log(`收到403限流错误，等待 ${waitTime/1000} 秒后重试 (尝试 ${attempt + 1}/${maxRetries})...`);
        console.log(`提示：API调用频率受限，建议减少并发请求或等待更长时间`);
        await delay(waitTime);
      } else {
        // 其他错误直接抛出
        throw error;
      }
    }
  }
  
  throw lastError || new Error('视频生成失败，API请求频率过高，请稍后再试（建议等待2-3分钟后重试）');
}

/**
 * 连续生成模式 - 使用上一帧保持视觉连贯性
 * 添加请求间隔和重试机制，避免403限流
 */
async function generateSequential(
  scenesWithImages: any[],
  client: VideoGenerationClient,
  storage: S3Storage,
  supabase: any,
  videoModel: string = 'doubao-seedance-1-5-pro-251215'
): Promise<any[]> {
  const results = [];
  let previousLastFrame: string | null = null;

  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];
    
    // 如果不是第一个视频，添加延迟避免限流（10秒间隔）
    if (i > 0) {
      console.log(`等待10秒后继续生成下一个视频...`);
      await delay(10000);
    }
    
    try {
      const contentItems: Content[] = [];
      
      // 如果有上一帧，使用它作为首帧
      if (previousLastFrame) {
        contentItems.push({
          type: 'image_url',
          image_url: { url: previousLastFrame },
          role: 'first_frame',
        });
      } else {
        // 获取当前分镜图片的签名URL
        const imageUrl = await getImageUrl(scene, storage);
        if (!imageUrl) {
          throw new Error('无法获取分镜图片URL');
        }
        contentItems.push({
          type: 'image_url',
          image_url: { url: imageUrl },
          role: 'first_frame',
        });
      }

      // 添加视频描述
      const videoPrompt = buildVideoPrompt(scene);
      contentItems.push({
        type: 'text',
        text: videoPrompt,
      });

      // 计算视频时长（基于内容复杂度）
      const duration = calculateDuration(scene);

      console.log(`开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒`);

      // 生成视频（带重试机制）
      const response = await generateVideoWithRetry(client, contentItems, {
        model: videoModel,
        duration: duration,
        ratio: '16:9',
        resolution: '720p',
        returnLastFrame: true,
        generateAudio: true,
      }); // 使用默认重试次数（5次）

      if (response.videoUrl) {
        await updateSceneVideo(supabase, scene.id, response.videoUrl, response.lastFrameUrl, 'completed');
        
        results.push({
          sceneId: scene.id,
          sceneNumber: scene.scene_number,
          videoUrl: response.videoUrl,
          duration: duration,
          status: 'completed',
        });

        previousLastFrame = response.lastFrameUrl;
        console.log(`分镜 ${scene.scene_number} 视频生成成功`);
      } else {
        throw new Error('视频生成失败：未返回视频URL');
      }
    } catch (error) {
      console.error(`分镜 ${scene.scene_number} 视频生成失败:`, error);
      
      await updateSceneVideo(supabase, scene.id, null, null, 'failed');
      
      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        error: error instanceof Error ? error.message : '未知错误',
        status: 'failed',
      });

      // 失败后重置，下一个视频使用自己的图片
      previousLastFrame = null;
    }
  }

  return results;
}

/**
 * 获取分镜图片URL
 */
async function getImageUrl(scene: any, storage: S3Storage): Promise<string | null> {
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
      return typeof signedUrl === 'string' ? signedUrl : (signedUrl as any).url;
    } catch (e) {
      console.error('获取图片URL失败:', e);
      return null;
    }
  }

  return null;
}

/**
 * 更新分镜视频信息
 */
async function updateSceneVideo(
  supabase: any,
  sceneId: string,
  videoUrl: string | null,
  lastFrameUrl: string | null,
  status: string
) {
  await supabase
    .from('scenes')
    .update({
      video_url: videoUrl,
      last_frame_url: lastFrameUrl,
      video_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sceneId);
}

/**
 * 计算视频时长（基于内容复杂度）
 * - 基础时长：6秒
 * - 有对白：根据对白长度增加1-4秒
 * - 有动作描述：增加1-2秒
 * - 最长12秒，最短6秒
 */
function calculateDuration(scene: {
  dialogue?: string | null;
  action?: string | null;
  description?: string;
}): number {
  let duration = 6; // 基础6秒

  // 根据对白长度计算
  if (scene.dialogue) {
    const dialogueLength = scene.dialogue.length;
    if (dialogueLength > 50) {
      duration += 4;
    } else if (dialogueLength > 30) {
      duration += 3;
    } else if (dialogueLength > 15) {
      duration += 2;
    } else if (dialogueLength > 0) {
      duration += 1;
    }
  }

  // 有动作描述增加时长
  if (scene.action && scene.action.length > 20) {
    duration += 2;
  } else if (scene.action && scene.action.length > 0) {
    duration += 1;
  }

  // 场景描述很长时也增加时长
  if (scene.description && scene.description.length > 100) {
    duration += 1;
  }

  // 限制在6-12秒范围内
  return Math.min(Math.max(duration, 6), 12);
}

/**
 * 构建视频生成提示词
 */
function buildVideoPrompt(scene: {
  description: string;
  dialogue?: string | null;
  action?: string | null;
  emotion?: string | null;
  metadata?: any;
}): string {
  const parts: string[] = [];

  // 场景描述
  if (scene.description) {
    parts.push(scene.description);
  }

  // 动作描述
  if (scene.action) {
    parts.push(scene.action);
  }

  // 对白（放在引号中，便于生成音频）
  if (scene.dialogue) {
    parts.push(`角色说道："${scene.dialogue}"`);
  }

  // 情绪氛围
  if (scene.emotion) {
    parts.push(`氛围：${scene.emotion}`);
  }

  // 从metadata中获取景别和镜头运动
  if (scene.metadata) {
    const metadata = scene.metadata as Record<string, string>;
    if (metadata.shotType) {
      parts.push(`景别：${metadata.shotType}`);
    }
    if (metadata.cameraMovement) {
      const movementMap: Record<string, string> = {
        '固定': 'static camera',
        '推镜': 'slow zoom in',
        '拉镜': 'slow zoom out',
        '摇镜': 'panning shot',
        '跟拍': 'tracking shot',
      };
      const movement = movementMap[metadata.cameraMovement] || metadata.cameraMovement;
      parts.push(`镜头运动：${movement}`);
    }
  }

  // 默认提示词
  if (parts.length === 0) {
    parts.push('流畅的电影镜头，自然的光线变化，细腻的情感表达');
  }

  return parts.join('，');
}

/**
 * 快速生成模式 - 串行生成视频片段（避免限流）
 * 注意：虽然名为快速模式，但为了避免API限流，实际上采用串行方式
 */
async function generateFast(
  scenesWithImages: any[],
  client: VideoGenerationClient,
  storage: S3Storage,
  supabase: any,
  videoModel: string = 'doubao-seedance-1-5-pro-251215'
): Promise<any[]> {
  const results = [];

  // 串行生成所有视频（避免并发限流）
  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];
    
    // 添加延迟，避免API限流（每个视频之间间隔10秒）
    if (i > 0) {
      console.log(`[快速模式] 等待10秒后继续生成下一个视频...`);
      await delay(10000);
    }

    try {
      // 获取当前分镜图片的签名URL
      const imageUrl = await getImageUrl(scene, storage);
      if (!imageUrl) {
        throw new Error('无法获取分镜图片URL');
      }

      const contentItems: Content[] = [
        {
          type: 'image_url',
          image_url: { url: imageUrl },
          role: 'first_frame',
        },
        {
          type: 'text',
          text: buildVideoPrompt(scene),
        },
      ];

      // 计算视频时长
      const duration = calculateDuration(scene);

      console.log(`[快速模式] 开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒`);

      // 生成视频（带重试）
      const response = await generateVideoWithRetry(client, contentItems, {
        model: videoModel,
        duration: duration,
        ratio: '16:9',
        resolution: '720p',
        returnLastFrame: false,
        generateAudio: true,
      }); // 使用默认重试次数（5次）

      if (response.videoUrl) {
        await updateSceneVideo(supabase, scene.id, response.videoUrl, null, 'completed');

        results.push({
          sceneId: scene.id,
          sceneNumber: scene.scene_number,
          videoUrl: response.videoUrl,
          duration: duration,
          status: 'completed',
        });
      } else {
        throw new Error('视频生成失败：未返回视频URL');
      }
    } catch (error) {
      console.error(`[快速模式] 分镜 ${scene.scene_number} 视频生成失败:`, error);

      await updateSceneVideo(supabase, scene.id, null, null, 'failed');

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

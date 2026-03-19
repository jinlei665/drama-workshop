import { NextRequest, NextResponse } from 'next/server';
import { generateVideoFromImage, DEFAULT_VIDEO_MODEL } from '@/lib/ai';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client';
import { memoryScenes, memoryProjects } from '@/lib/memory-storage';

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

    const useDatabase = isDatabaseConfigured();
    const supabase = useDatabase ? getSupabaseClient() : null;

    // 获取用户配置
    let videoModel = DEFAULT_VIDEO_MODEL;
    let videoResolution: '480p' | '720p' | '1080p' = '720p';
    let videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' = '16:9';

    if (useDatabase && supabase) {
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
    }

    // 获取项目信息和分镜列表
    let project: any = null;
    let scenesList: any[] = [];
    let actuallyUseDatabase = false;

    if (useDatabase && supabase) {
      const { data, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) {
        console.warn('获取项目失败，回退到内存存储:', projectError.message);
      } else if (data) {
        project = data;
        actuallyUseDatabase = true;

        // 获取分镜列表（按序号排序）
        let query = supabase
          .from('scenes')
          .select('*')
          .eq('project_id', projectId)
          .order('scene_number', { ascending: true });

        if (sceneIds && sceneIds.length > 0) {
          query = query.in('id', sceneIds);
        }

        const { data: scenesData, error: scenesError } = await query;

        if (scenesError) {
          console.warn('获取分镜失败:', scenesError.message);
        }
        scenesList = scenesData || [];
      }
    }
    
    // 如果数据库中没有找到，回退到内存存储
    if (!project) {
      console.log('从内存存储获取项目:', projectId);
      project = memoryProjects.find(p => p.id === projectId);
      scenesList = memoryScenes
        .filter(s => s.projectId === projectId)
        .sort((a, b) => a.sceneNumber - b.sceneNumber);
      
      if (sceneIds && sceneIds.length > 0) {
        scenesList = scenesList.filter(s => sceneIds.includes(s.id));
      }
    }

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // 过滤出有图片的分镜（支持 image_key 和 imageUrl）
    const scenesWithImages = scenesList.filter((s: { image_key?: string; image_url?: string; imageUrl?: string }) => s.image_key || s.image_url || s.imageUrl);
    
    if (scenesWithImages.length === 0) {
      return NextResponse.json(
        { error: '没有可用的分镜图片，请先生成分镜图片' },
        { status: 400 }
      );
    }

    // 更新所有分镜的视频状态为 generating（仅数据库模式）
    if (actuallyUseDatabase && supabase) {
      const sceneIdsToUpdate = scenesWithImages.map((s: { id: string }) => s.id);
      await supabase
        .from('scenes')
        .update({ video_status: 'generating', updated_at: new Date().toISOString() })
        .in('id', sceneIdsToUpdate);
    }

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
      results = await generateFast(scenesWithImages, storage, supabase, videoModel, videoResolution, videoRatio, actuallyUseDatabase);
    } else {
      results = await generateSequential(scenesWithImages, storage, supabase, videoModel, videoResolution, videoRatio, actuallyUseDatabase);
    }

    // 更新项目状态（仅数据库模式）
    if (actuallyUseDatabase && supabase) {
      const completedCount = results.filter(r => r.status === 'completed').length;
      await supabase
        .from('projects')
        .update({
          final_video_status: completedCount === scenesWithImages.length ? 'completed' : 'partial',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
    }

    const completedCount = results.filter(r => r.status === 'completed').length;
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
  scenesWithImages: { id: string; scene_number: number; image_key?: string; image_url?: string; imageUrl?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  storage: S3Storage,
  supabase: ReturnType<typeof getSupabaseClient> | null,
  videoModel: string,
  videoResolution: '480p' | '720p' | '1080p',
  videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9',
  actuallyUseDatabase: boolean
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
        const imgUrl = await getImageUrl(scene, storage);
        if (!imgUrl) {
          throw new Error('无法获取分镜图片URL');
        }
        firstFrameUrl = imgUrl;
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

      // 更新数据库或内存
      if (actuallyUseDatabase && supabase) {
        // 先尝试完整更新（包含 last_frame_url）
        const { error: updateError } = await supabase
          .from('scenes')
          .update({
            video_url: result.videoUrl,
            last_frame_url: result.lastFrameUrl || null,
            video_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
        
        if (updateError) {
          // 如果是列不存在的错误，尝试不包含 last_frame_url 的更新
          if (updateError.message.includes('last_frame_url')) {
            console.warn(`分镜 ${scene.scene_number} 数据库缺少 last_frame_url 列，尝试不包含该字段的更新`);
            const { error: retryError } = await supabase
              .from('scenes')
              .update({
                video_url: result.videoUrl,
                video_status: 'completed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', scene.id);
            
            if (retryError) {
              console.error(`分镜 ${scene.scene_number} 数据库更新失败:`, retryError.message);
            } else {
              console.log(`分镜 ${scene.scene_number} 数据库更新成功（无 last_frame_url），video_url:`, result.videoUrl?.substring(0, 50) + '...');
            }
          } else {
            console.error(`分镜 ${scene.scene_number} 数据库更新失败:`, updateError.message);
          }
        } else {
          console.log(`分镜 ${scene.scene_number} 数据库更新成功，video_url:`, result.videoUrl?.substring(0, 50) + '...');
        }
      } else {
        // 更新内存存储
        const sceneIndex = memoryScenes.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          memoryScenes[sceneIndex].videoUrl = result.videoUrl;
          memoryScenes[sceneIndex].videoStatus = 'completed';
          console.log(`分镜 ${scene.scene_number} 内存更新成功`);
        } else {
          console.warn(`分镜 ${scene.scene_number} 在内存中未找到`);
        }
      }

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
      
      if (actuallyUseDatabase && supabase) {
        await supabase
          .from('scenes')
          .update({
            video_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
      } else {
        // 更新内存存储
        const sceneIndex = memoryScenes.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          memoryScenes[sceneIndex].videoStatus = 'failed';
        }
      }

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
async function getImageUrl(scene: { image_key?: string; image_url?: string; imageUrl?: string }, storage: S3Storage): Promise<string | null> {
  // 优先使用直接存储的URL
  if (scene.imageUrl) {
    return scene.imageUrl;
  }
  
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
  scenesWithImages: { id: string; scene_number: number; image_key?: string; image_url?: string; imageUrl?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  storage: S3Storage,
  supabase: ReturnType<typeof getSupabaseClient> | null,
  videoModel: string,
  videoResolution: '480p' | '720p' | '1080p',
  videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9',
  actuallyUseDatabase: boolean
): Promise<{ sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[]> {
  const results: { sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[] = [];

  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];
    
    if (i > 0) {
      console.log(`[快速模式] 等待10秒后继续生成下一个视频...`);
      await delay(10000);
    }

    try {
      const imgUrl = await getImageUrl(scene, storage);
      if (!imgUrl) {
        throw new Error('无法获取分镜图片URL');
      }

      const videoPrompt = buildVideoPrompt(scene);
      const duration = calculateDuration(scene);

      console.log(`[快速模式] 开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒`);

      const result = await generateVideoFromImage(videoPrompt, imgUrl, {
        model: videoModel,
        duration,
        ratio: videoRatio,
        resolution: videoResolution,
        generateAudio: true,
      });

      if (actuallyUseDatabase && supabase) {
        await supabase
          .from('scenes')
          .update({
            video_url: result.videoUrl,
            video_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
      } else {
        // 更新内存存储
        const sceneIndex = memoryScenes.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          memoryScenes[sceneIndex].videoUrl = result.videoUrl;
          memoryScenes[sceneIndex].videoStatus = 'completed';
        }
      }

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        videoUrl: result.videoUrl,
        duration,
        status: 'completed',
      });
    } catch (error) {
      console.error(`[快速模式] 分镜 ${scene.scene_number} 视频生成失败:`, error);

      if (actuallyUseDatabase && supabase) {
        await supabase
          .from('scenes')
          .update({
            video_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
      } else {
        // 更新内存存储
        const sceneIndex = memoryScenes.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          memoryScenes[sceneIndex].videoStatus = 'failed';
        }
      }

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

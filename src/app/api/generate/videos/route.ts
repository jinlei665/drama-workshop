import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationClient, Config, HeaderUtils, S3Storage, Content } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 批量生成视频片段
 * POST /api/generate/videos
 * 
 * 将分镜图片转换为视频片段，支持连续生成以保持视觉连贯性
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sceneIds } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: '缺少项目ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 获取项目信息
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

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
      .order('scene_number', { ascending: true });

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

    // 初始化视频生成客户端
    const config = new Config();
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

    // 顺序生成视频（保持连贯性）
    const results = [];
    let previousLastFrame: string | null = null;

    for (const scene of scenesWithImages) {
      try {
        // 构建视频生成内容
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
          let imageUrl = (scene as any).image_url;
          if (!imageUrl && (scene as any).image_key) {
            try {
              const signedUrl = await storage.generatePresignedUrl({
                key: (scene as any).image_key,
                expireTime: 3600, // 1小时有效
              });
              // signedUrl可能是字符串或对象
              imageUrl = typeof signedUrl === 'string' ? signedUrl : (signedUrl as any).url;
            } catch (e) {
              console.error('获取图片URL失败:', e);
              throw new Error('无法获取分镜图片URL');
            }
          }

          if (!imageUrl) {
            throw new Error('分镜图片URL不存在');
          }

          contentItems.push({
            type: 'image_url',
            image_url: { url: imageUrl },
            role: 'first_frame',
          });
        }

        // 添加视频描述
        const videoPrompt = buildVideoPrompt(scene as any);
        contentItems.push({
          type: 'text',
          text: videoPrompt,
        });

        // 生成视频
        const response = await client.videoGeneration(contentItems, {
          model: 'doubao-seedance-1-5-pro-251215',
          duration: 5, // 5秒视频
          ratio: '16:9', // 短剧常用比例
          resolution: '720p',
          returnLastFrame: true, // 获取最后一帧用于下一个视频
          generateAudio: true, // 生成音效和对白
        });

        if (response.videoUrl) {
          // 更新分镜记录
          await supabase
            .from('scenes')
            .update({
              video_url: response.videoUrl,
              last_frame_url: response.lastFrameUrl || null,
              video_status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', (scene as any).id);

          results.push({
            sceneId: (scene as any).id,
            sceneNumber: (scene as any).scene_number,
            videoUrl: response.videoUrl,
            status: 'completed',
          });

          // 保存最后一帧用于下一个视频
          previousLastFrame = response.lastFrameUrl;
        } else {
          throw new Error('视频生成失败：未返回视频URL');
        }
      } catch (error) {
        console.error(`分镜 ${(scene as any).scene_number} 视频生成失败:`, error);
        
        // 更新失败状态
        await supabase
          .from('scenes')
          .update({
            video_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', (scene as any).id);

        results.push({
          sceneId: (scene as any).id,
          sceneNumber: (scene as any).scene_number,
          error: error instanceof Error ? error.message : '未知错误',
          status: 'failed',
        });

        // 如果失败，重置previousLastFrame，下一个视频使用自己的图片
        previousLastFrame = null;
      }
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

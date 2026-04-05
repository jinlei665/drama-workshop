import { NextRequest, NextResponse } from 'next/server';
import { generateVideoFromImage, generateVideoFromFrames, DEFAULT_VIDEO_MODEL } from '@/lib/ai';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient, isDatabaseConfigured } from '@/storage/database/supabase-client';
import { memoryScenes, memoryProjects } from '@/lib/memory-storage';
import { getCozeConfigFromMemory } from '@/lib/memory-store';
import { getVideoStylePrompt } from '@/lib/styles';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 检查是否应该使用本地存储
 * 在没有对象存储配置时，无论开发还是生产环境都应该使用本地存储
 */
function shouldUseLocalStorage(): boolean {
  // 如果有对象存储配置，优先使用对象存储
  const hasS3Config = process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL;
  if (hasS3Config) {
    return false;
  }
  // 没有对象存储配置时，始终使用本地存储
  return true;
}

/**
 * 验证视频文件是否有效
 */
function isValidVideoBuffer(buffer: Buffer): { valid: boolean; reason?: string } {
  // 检查文件大小（视频至少应该有 10KB）
  if (buffer.length < 10 * 1024) {
    return { valid: false, reason: `文件太小 (${buffer.length} bytes)，可能不是有效的视频` };
  }
  
  // 检查视频文件魔数（MP4: ftyp, WebM: webm）
  const header = buffer.slice(0, 12).toString('ascii').toLowerCase();
  const isMP4 = header.includes('ftyp');
  const isWebM = header.includes('webm');
  const isMOV = buffer.slice(4, 8).toString('ascii') === 'ftyp';
  
  if (!isMP4 && !isWebM && !isMOV) {
    // 可能是 HTML 错误页面
    if (buffer.toString('utf-8').slice(0, 100).toLowerCase().includes('<!doctype') ||
        buffer.toString('utf-8').slice(0, 100).toLowerCase().includes('<html')) {
      return { valid: false, reason: '下载的是 HTML 页面，不是视频文件' };
    }
    return { valid: false, reason: `未知视频格式，头部: ${buffer.slice(0, 20).toString('hex')}` };
  }
  
  return { valid: true };
}

/**
 * 下载视频并重新上传到存储
 * 解决 Bot 返回的临时 URL 过期问题
 */
async function rehostVideo(
  originalUrl: string, 
  sceneId: string, 
  storage: S3Storage | null,
  apiKey?: string
): Promise<string> {
  console.log(`正在下载并重新托管视频: ${originalUrl.substring(0, 80)}...`);
  
  // 多种请求头策略
  const headerStrategies: Record<string, string>[] = [
    // 策略1: 模拟浏览器 + Coze来源
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.coze.cn/',
      'Origin': 'https://www.coze.cn',
    },
    // 策略2: 简单请求
    {
      'User-Agent': 'Mozilla/5.0 (compatible; VideoBot/1.0)',
    },
    // 策略3: 无任何头
    {},
  ];
  
  // 如果有 apiKey，添加到第一个策略
  if (apiKey) {
    headerStrategies[0]['Authorization'] = `Bearer ${apiKey}`;
  }
  
  // 依次尝试不同的请求头策略
  for (let i = 0; i < headerStrategies.length; i++) {
    try {
      console.log(`尝试下载策略 ${i + 1}/${headerStrategies.length}...`);
      const response = await fetch(originalUrl, { 
        headers: headerStrategies[i],
        redirect: 'follow',
      });
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length');
        console.log(`下载成功! Content-Length: ${contentLength}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`视频下载完成，大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        return await saveVideo(buffer, sceneId, storage, originalUrl);
      } else {
        console.warn(`策略 ${i + 1} 失败: HTTP ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.warn(`策略 ${i + 1} 异常:`, err instanceof Error ? err.message : String(err));
    }
  }
  
  // 所有下载策略都失败
  console.warn(`所有下载策略都失败，返回原始 URL`);
  console.log(`提示: 视频可能需要在浏览器中直接播放，请确保前端能处理跨域视频`);
  return originalUrl;
}

/**
 * 保存视频到存储
 */
async function saveVideo(
  buffer: Buffer, 
  sceneId: string, 
  storage: S3Storage | null,
  originalUrl: string
): Promise<string> {
  // 验证视频文件
  const validation = isValidVideoBuffer(buffer);
  if (!validation.valid) {
    console.error(`视频验证失败: ${validation.reason}`);
    console.log(`视频 URL: ${originalUrl.substring(0, 100)}...`);
    // 返回原始 URL，让前端尝试直接播放
    return originalUrl;
  }
  
  console.log(`视频验证通过，大小: ${(buffer.length / 1024).toFixed(2)} KB`);
  
  // 尝试上传到对象存储
  if (storage) {
    try {
      const key = `videos/${sceneId}/video_${Date.now()}.mp4`;
      await storage.uploadFile({
        fileContent: buffer,
        fileName: key,
        contentType: 'video/mp4'
      });
      const publicUrl = await storage.generatePresignedUrl({
        key,
        expireTime: 3600 * 24 * 7 // 7天有效期
      });
      console.log(`视频已上传到对象存储: ${key}`);
      return typeof publicUrl === 'string' ? publicUrl : (publicUrl as any).url;
    } catch (uploadErr) {
      console.warn(`对象存储上传失败，尝试本地存储:`, uploadErr);
    }
  }
  
  // 本地存储（无对象存储配置时始终使用）
  if (shouldUseLocalStorage()) {
    try {
      // 检测 standalone 模式：Next.js standalone 运行时需要保存到 .next/standalone/public
      const isStandalone = fs.existsSync(path.join(process.cwd(), '.next', 'standalone', 'server.js')) ||
                          process.cwd().includes('.next/standalone');
      
      let publicDir: string;
      if (isStandalone && !process.cwd().includes('.next/standalone')) {
        // standalone 模式，但工作目录是项目根目录
        publicDir = path.join(process.cwd(), '.next', 'standalone', 'public', 'videos', sceneId);
        console.log(`[Standalone 模式] 视频保存路径: ${publicDir}`);
      } else if (process.cwd().includes('.next/standalone')) {
        // 已经在 standalone 目录中运行
        publicDir = path.join(process.cwd(), 'public', 'videos', sceneId);
        console.log(`[Standalone 运行时] 视频保存路径: ${publicDir}`);
      } else {
        // 开发模式
        publicDir = path.join(process.cwd(), 'public', 'videos', sceneId);
        console.log(`[开发模式] 视频保存路径: ${publicDir}`);
      }
      
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      const filename = `video_${Date.now()}.mp4`;
      const filePath = path.join(publicDir, filename);
      fs.writeFileSync(filePath, buffer);
      
      // 验证文件是否成功写入
      const stats = fs.statSync(filePath);
      console.log(`视频已保存: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      
      const localUrl = `/videos/${sceneId}/${filename}`;
      return localUrl;
    } catch (localErr) {
      console.warn(`本地存储失败:`, localErr);
    }
  }
  
  // 无法重新托管，返回原始 URL
  console.log(`无法重新托管视频，使用原始 URL`);
  return originalUrl;
}


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
    const { projectId, sceneIds, mode = 'continuous', duration: userDuration, dialogue: userDialogue, action: userAction, emotion: userEmotion, lastFrameSceneId: userLastFrameSceneId } = body;

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

        // 获取完整分镜列表（用于查找尾帧，不受 sceneIds 限制）
        const { data: allScenesData, error: allScenesError } = await supabase
          .from('scenes')
          .select('*')
          .eq('project_id', projectId)
          .order('scene_number', { ascending: true });

        if (allScenesError) {
          console.warn('获取完整分镜列表失败:', allScenesError.message);
        }
        scenesList = allScenesData || [];
      }
    }
    
    // 如果数据库中没有找到，回退到内存存储
    if (!project) {
      console.log('从内存存储获取项目:', projectId);
      project = memoryProjects.find(p => p.id === projectId);
      // 获取完整分镜列表（用于查找尾帧，不受 sceneIds 限制）
      scenesList = memoryScenes
        .filter(s => s.projectId === projectId)
        .sort((a, b) => a.sceneNumber - b.sceneNumber);
    }

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // 过滤出有图片的分镜
    let scenesWithImages = scenesList.filter((s: { image_key?: string; image_url?: string; imageKey?: string; imageUrl?: string }) => s.image_key || s.image_url || s.imageKey || s.imageUrl);
    
    // 如果指定了 sceneIds，只生成这些分镜的视频（但完整列表用于找尾帧）
    if (sceneIds && sceneIds.length > 0) {
      scenesWithImages = scenesWithImages.filter((s: { id: string }) => sceneIds.includes(s.id));
      console.log(`[视频生成] 指定生成 ${sceneIds.length} 个分镜的视频`);
    }
    
    // 调试日志：显示完整分镜列表
    console.log(`[视频生成] 完整分镜列表: ${scenesList.length} 个分镜`);
    console.log(`[视频生成] 待生成视频的分镜: ${scenesWithImages.length} 个`);
    scenesList.forEach((s: any) => {
      const hasImage = !!(s.image_key || s.image_url || s.imageKey || s.imageUrl);
      const willGenerate = scenesWithImages.some((sg: any) => sg.id === s.id);
      console.log(`  - 分镜 ${s.scene_number}: ${hasImage ? '有图片' : '无图片'} ${willGenerate ? '[待生成]' : ''}`);
    });
    
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
      endpointUrl: process.env.S3_ENDPOINT || process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      bucketName: process.env.S3_BUCKET || process.env.COZE_BUCKET_NAME,
      region: process.env.S3_REGION || 'us-east-1',
    });

    // 获取项目风格并生成视频风格提示词
    const style = project?.style || 'realistic_cinema';
    const stylePrompt = getVideoStylePrompt(style);
    console.log(`项目风格: ${style}, 视频风格提示词: ${stylePrompt.substring(0, 50)}...`);

    let results: { sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[] = [];

    // 根据模式选择生成方式
    if (mode === 'fast') {
      results = await generateFast(scenesWithImages, storage, supabase, videoModel, videoResolution, videoRatio, actuallyUseDatabase, stylePrompt, userDuration, userDialogue, userAction, userEmotion, userLastFrameSceneId);
    } else {
      // 连续模式：传入完整分镜列表用于获取下一个分镜的尾帧
      results = await generateSequential(scenesWithImages, scenesList, storage, supabase, videoModel, videoResolution, videoRatio, actuallyUseDatabase, stylePrompt, userDuration, userDialogue, userAction, userEmotion, userLastFrameSceneId);
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
 * 连续生成模式 - 使用下一个分镜图片作为尾帧
 * 
 * 逻辑说明：
 * - 视频1：首帧=分镜1图片，尾帧=分镜2图片
 * - 视频2：首帧=分镜2图片，尾帧=分镜3图片
 * - 视频N：首帧=分镜N图片，尾帧=分镜N+1图片（如果有）
 * - 最后一个视频：仅首帧，无尾帧
 */
async function generateSequential(
  scenesWithImages: { id: string; scene_number: number; image_key?: string; image_url?: string; imageKey?: string; imageUrl?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  allScenes: { id: string; scene_number: number; image_key?: string; image_url?: string; imageKey?: string; imageUrl?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  storage: S3Storage,
  supabase: ReturnType<typeof getSupabaseClient> | null,
  videoModel: string,
  videoResolution: '480p' | '720p' | '1080p',
  videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9',
  actuallyUseDatabase: boolean,
  stylePrompt: string,
  userDuration?: number,
  userDialogue?: string,
  userAction?: string,
  userEmotion?: string,
  userLastFrameSceneId?: string
): Promise<{ sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[]> {
  const results: { sceneId: string; sceneNumber: number; videoUrl?: string; duration?: number; status: string; error?: string }[] = [];
  
  // 获取用户配置（用于下载视频时的认证）
  const userConfig = getCozeConfigFromMemory();
  const apiKey = userConfig?.apiKey;
  
  console.log(`[连续模式] 完整分镜列表 allScenes 数量: ${allScenes.length}`);
  console.log(`[连续模式] 有图片分镜 scenesWithImages 数量: ${scenesWithImages.length}`);

  for (let i = 0; i < scenesWithImages.length; i++) {
    const scene = scenesWithImages[i];

    // 确定使用哪个场景的尾帧
    // 如果用户指定了 lastFrameSceneId，使用该场景；否则使用下一个分镜
    let lastFrameScene: any = null;

    // 判断用户是否选择了"无尾帧"（userLastFrameSceneId 为空或 'none'）
    const isNoLastFrame = !userLastFrameSceneId || userLastFrameSceneId === 'none';

    if (isNoLastFrame) {
      // 用户选择了无尾帧
      console.log(`[连续模式] 分镜 ${scene.scene_number}: 用户选择无尾帧`);
      lastFrameScene = null;
    } else if (userLastFrameSceneId && scenesWithImages.length === 1 && scene.id === userLastFrameSceneId) {
      // 用户指定了特定的尾帧场景
      lastFrameScene = allScenes.find(s => s.id === userLastFrameSceneId);
      console.log(`[连续模式] 分镜 ${scene.scene_number}: 使用用户指定的尾帧场景 ${userLastFrameSceneId}`);
    } else {
      // 使用默认逻辑：下一个分镜
      const nextSceneNumber = scene.scene_number + 1;
      lastFrameScene = allScenes.find(s => s.scene_number === nextSceneNumber);
      console.log(`[连续模式] 分镜 ${scene.scene_number}: 查找分镜 ${nextSceneNumber}, 结果: ${lastFrameScene ? '找到' : '未找到'}`);
    }
    
    // 添加延迟避免限流（10秒间隔）
    if (i > 0) {
      console.log(`等待10秒后继续生成下一个视频...`);
      await delay(10000);
    }
    
    try {
      // 获取当前分镜图片作为首帧
      const firstFrameUrl = await getImageUrl(scene, storage);
      if (!firstFrameUrl) {
        throw new Error('无法获取分镜图片URL');
      }

      // 获取下一个分镜图片作为尾帧（如果存在且有图片）
      let lastFrameUrl: string | null = null;
      if (lastFrameScene) {
        lastFrameUrl = await getImageUrl(lastFrameScene, storage);
        if (lastFrameUrl) {
          console.log(`分镜 ${scene.scene_number} 将使用分镜 ${lastFrameScene.scene_number} 的图片作为尾帧`);
        } else {
          console.log(`分镜 ${scene.scene_number} 的尾帧分镜 ${lastFrameScene.scene_number} 没有图片，无法作为尾帧`);
        }
      } else {
        console.log(`分镜 ${scene.scene_number} 没有尾帧`);
      }

      // 构建视频描述，添加风格提示词
      // 使用用户提供的参数覆盖场景中的值
      const modifiedScene = {
        ...scene,
        dialogue: userDialogue !== undefined ? userDialogue : scene.dialogue,
        action: userAction !== undefined ? userAction : scene.action,
        emotion: userEmotion !== undefined ? userEmotion : scene.emotion
      };
      const videoPrompt = `${stylePrompt}，${buildVideoPrompt(modifiedScene)}`;
      const duration = userDuration !== undefined ? userDuration : calculateDuration(scene);

      console.log(`开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒，${lastFrameUrl ? '有尾帧' : '无尾帧'}`);

      let result: { videoUrl: string; lastFrameUrl?: string };
      
      if (lastFrameUrl) {
        // 有尾帧：使用首尾帧模式生成视频
        result = await generateVideoFromFrames(videoPrompt, firstFrameUrl, lastFrameUrl, {
          model: videoModel,
          duration,
          ratio: videoRatio,
          resolution: videoResolution,
          generateAudio: true,
        });
      } else {
        // 无尾帧（最后一个分镜）：仅使用首帧生成视频
        result = await generateVideoFromImage(videoPrompt, firstFrameUrl, {
          model: videoModel,
          duration,
          ratio: videoRatio,
          resolution: videoResolution,
          generateAudio: true,
        });
      }

      // 重新托管所有外部视频 URL 到本地，避免跨域问题
      let finalVideoUrl = result.videoUrl;
      if (result.videoUrl && (result.videoUrl.includes('volces.com') || result.videoUrl.includes('tos.coze.site') || result.videoUrl.startsWith('http'))) {
        console.log(`检测到外部视频 URL，尝试下载到本地...`);
        finalVideoUrl = await rehostVideo(result.videoUrl, scene.id, storage, apiKey);
        
        // 如果下载成功，URL 会变成本地路径 /videos/...
        if (finalVideoUrl !== result.videoUrl) {
          console.log(`视频已保存到本地: ${finalVideoUrl}`);
        } else {
          console.warn(`视频下载失败，使用原始 URL: ${result.videoUrl.substring(0, 60)}...`);
        }
      }

      // 更新数据库或内存
      if (actuallyUseDatabase && supabase) {
        const { error: updateError } = await supabase
          .from('scenes')
          .update({
            video_url: finalVideoUrl,
            video_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
        
        if (updateError) {
          console.error(`分镜 ${scene.scene_number} 数据库更新失败:`, updateError.message);
        } else {
          console.log(`分镜 ${scene.scene_number} 数据库更新成功，video_url:`, finalVideoUrl?.substring(0, 50) + '...');
        }
      } else {
        // 更新内存存储
        const sceneIndex = memoryScenes.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          memoryScenes[sceneIndex].videoUrl = finalVideoUrl;
          memoryScenes[sceneIndex].videoStatus = 'completed';
          console.log(`分镜 ${scene.scene_number} 内存更新成功`);
        } else {
          console.warn(`分镜 ${scene.scene_number} 在内存中未找到`);
        }
      }

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        videoUrl: finalVideoUrl,
        duration,
        status: 'completed',
      });

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
    }
  }

  return results;
}

/**
 * 将图片 URL 转换为视频 Skill 支持的格式
 * 
 * Coze 视频 Skill 要求：
 * - 明确的图片格式（png, jpg, jpeg）
 * - Content-Type: image/png 或 image/jpeg
 * 
 * 不支持的格式：
 * - s.coze.cn 短链接（有时不稳定）
 * - application/octet-stream
 */
async function convertImageUrlForVideo(
  imageUrl: string, 
  sceneId: string,
  storage: S3Storage
): Promise<string> {
  console.log(`[convertImageUrl] 原始 URL: ${imageUrl.substring(0, 80)}...`);
  
  // 处理本地存储的图片 URL（以 /scenes/ 或 /characters/ 开头）
  if (imageUrl.startsWith('/scenes/') || imageUrl.startsWith('/characters/')) {
    console.log(`[convertImageUrl] 检测到本地图片，尝试上传到对象存储...`);

    try {
      // 构造完整的 URL
      const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
      const fullUrl = `${domain}${imageUrl}`
      console.log(`[convertImageUrl] 下载本地图片: ${fullUrl}`)

      // 下载图片
      const response = await fetch(fullUrl)
      if (!response.ok) {
        console.warn(`[convertImageUrl] 本地图片下载失败: ${response.status}`)
        return fullUrl
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 检测图片格式
      let format = 'png'
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        format = 'jpg'
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        format = 'png'
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
        format = 'webp'
      }

      console.log(`[convertImageUrl] 本地图片格式: ${format}, 大小: ${(buffer.length / 1024).toFixed(2)} KB`)

      // 上传到对象存储
      // 确保使用正斜杠作为路径分隔符，并清理所有反斜杠
      const cleanedSceneId = sceneId.replace(/\\/g, '/')
      const key = `scenes/${cleanedSceneId}/image_${Date.now()}.${format}`.replace(/\\/g, '/')
      console.log(`[convertImageUrl] 上传到 OSS，key: ${key}`)
      console.log(`[convertImageUrl] 原始 sceneId: ${sceneId}`)
      console.log(`[convertImageUrl] 清理后 sceneId: ${cleanedSceneId}`)
      const uploadResult = await storage.uploadFile({
        fileContent: buffer,
        fileName: key,
        contentType: `image/${format}`,
      })
      console.log(`[convertImageUrl] 上传成功，返回值: ${JSON.stringify(uploadResult)}`)

      // 生成预签名 URL（使用阿里云 OSS SDK）
      let newUrl: string
      try {
        const OSS = await import('ali-oss')

        console.log(`[convertImageUrl] 开始生成预签名 URL...`)
        console.log(`[convertImageUrl] OSS Bucket: ${process.env.S3_BUCKET}`)
        console.log(`[convertImageUrl] OSS Region: ${process.env.S3_REGION}`)
        console.log(`[convertImageUrl] Object Key: ${key}`)
        console.log(`[convertImageUrl] Access Key: ${process.env.S3_ACCESS_KEY?.substring(0, 10)}...`)

        // 创建 OSS 客户端
        const client = new OSS.default({
          region: process.env.S3_REGION || 'oss-cn-chengdu',
          bucket: process.env.S3_BUCKET || 'drama-studio',
          accessKeyId: process.env.S3_ACCESS_KEY || '',
          accessKeySecret: process.env.S3_SECRET_KEY || '',
          secure: true, // 使用 HTTPS
        })

        // 设置图片为公开读取
        console.log(`[convertImageUrl] 设置图片为公开读取...`)
        await client.putACL(key, 'public-read')
        console.log(`[convertImageUrl] 图片已设置为公开读取`)

        // 使用公网 URL（不带签名）
        newUrl = `https://${process.env.S3_BUCKET}.${process.env.S3_REGION}.aliyuncs.com/${key}`
        console.log(`[convertImageUrl] 公网 URL 生成成功`)
        console.log(`[convertImageUrl] 完整 URL: ${newUrl}`)

        // 验证 URL 是否可访问
        console.log(`[convertImageUrl] 验证 URL 是否可访问...`)
        try {
          const testResponse = await fetch(newUrl, { method: 'HEAD' })
          if (testResponse.ok) {
            console.log(`[convertImageUrl] URL 验证成功，HTTP ${testResponse.status}`)
          } else {
            console.warn(`[convertImageUrl] URL 验证失败，HTTP ${testResponse.status}`)
            throw new Error(`URL 不可访问: HTTP ${testResponse.status}`)
          }
        } catch (fetchError) {
          console.error(`[convertImageUrl] URL 验证失败:`, fetchError)
          throw new Error(`URL 验证失败: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
        }
      } catch (urlError) {
        console.error(`[convertImageUrl] 使用阿里云 OSS SDK 生成预签名 URL 失败:`, urlError)
        // 抛出错误，不使用回退方案
        throw new Error(`生成预签名 URL 失败: ${urlError instanceof Error ? urlError.message : String(urlError)}`)
      }

      console.log(`[convertImageUrl] 已上传到对象存储: ${newUrl.substring(0, 80)}...`)

      // 更新数据库中的 image_url（可选，推荐）
      try {
        const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client')
        if (isDatabaseConfigured()) {
          const supabase = getSupabaseClient()
          await supabase
            .from('scenes')
            .update({
              image_url: newUrl,
              image_key: key,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sceneId)
          console.log(`[convertImageUrl] 已更新数据库中的图片 URL`)
        }
      } catch (dbError) {
        console.warn(`[convertImageUrl] 更新数据库失败:`, dbError)
      }

      return newUrl
    } catch (error) {
      console.error(`[convertImageUrl] 上传本地图片到对象存储失败:`, error)
      // 失败后回退到 localhost URL
      const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
      return `${domain}${imageUrl}`
    }
  }
  
  // 检查 URL 是否已经是支持的格式
  const supportedPatterns = [
    /\.png$/i,
    /\.jpg$/i,
    /\.jpeg$/i,
    /\.webp$/i,
  ];
  
  // 如果 URL 已经包含明确的图片格式后缀，直接返回
  if (supportedPatterns.some(pattern => pattern.test(imageUrl))) {
    console.log(`[convertImageUrl] URL 已包含支持的图片格式`);
    return imageUrl;
  }
  
  // 检查是否是 Coze 存储链接（s.coze.cn 或 tos）
  const isCozeStorage = imageUrl.includes('s.coze.cn') || 
                        imageUrl.includes('tos.coze.site') ||
                        imageUrl.includes('lf-bot-studio-plugin-resource');
  
  if (!isCozeStorage) {
    // 非 Coze 存储链接，尝试添加 .png 后缀
    const urlWithFormat = imageUrl + (imageUrl.includes('?') ? '&format=png' : '?format=png');
    console.log(`[convertImageUrl] 非 Coze 存储，添加格式参数`);
    return urlWithFormat;
  }
  
  // 对于 Coze 存储链接，下载并验证图片
  try {
    console.log(`[convertImageUrl] 下载图片验证格式...`);
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) {
      console.warn(`[convertImageUrl] 图片下载失败: ${response.status}`);
      return imageUrl; // 返回原始 URL
    }
    
    const contentType = response.headers.get('content-type') || '';
    console.log(`[convertImageUrl] Content-Type: ${contentType}`);
    
    // 如果已经是正确的图片格式，直接返回
    if (contentType.includes('image/png') || 
        contentType.includes('image/jpeg') || 
        contentType.includes('image/jpg')) {
      console.log(`[convertImageUrl] 图片格式正确`);
      return imageUrl;
    }
    
    // 如果是 octet-stream 或其他格式，需要转换
    if (contentType.includes('octet-stream') || contentType.includes('application/')) {
      console.log(`[convertImageUrl] 需要转换图片格式...`);
      
      // 下载图片
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 检测实际图片格式（通过魔数）
      let format = 'png';
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        format = 'jpg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        format = 'png';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
        format = 'webp';
      }
      
      console.log(`[convertImageUrl] 检测到图片格式: ${format}, 大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      
      // 尝试上传到对象存储
      try {
        const key = `video-frames/${sceneId}/frame_${Date.now()}.${format}`;
        await storage.uploadFile({
          fileContent: buffer,
          fileName: key,
          contentType: `image/${format}`,
        });
        
        const signedUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 3600,
        });
        
        const newUrl = typeof signedUrl === 'string' ? signedUrl : (signedUrl as { url: string }).url;
        console.log(`[convertImageUrl] 已转换为正确格式: ${newUrl.substring(0, 60)}...`);
        return newUrl;
      } catch (uploadErr) {
        console.warn(`[convertImageUrl] 上传失败，使用原始 URL:`, uploadErr);
        return imageUrl;
      }
    }
    
    return imageUrl;
  } catch (err) {
    console.warn(`[convertImageUrl] 转换失败:`, err);
    return imageUrl;
  }
}

/**
 * 获取分镜图片URL
 * 支持多种字段名：image_key（数据库）、imageKey（内存）、image_url、imageUrl
 * 
 * 存储策略：先尝试对象存储，失败后回退到本地存储
 */
async function getImageUrl(
  scene: { id: string; image_key?: string; image_url?: string; imageKey?: string; imageUrl?: string }, 
  storage: S3Storage
): Promise<string | null> {
  let rawUrl: string | null = null;
  
  // 优先使用直接存储的URL
  if (scene.imageUrl) {
    console.log(`[getImageUrl] 使用 imageUrl: ${scene.imageUrl.substring(0, 50)}...`);
    rawUrl = scene.imageUrl;
  } else if (scene.image_url) {
    console.log(`[getImageUrl] 使用 image_url: ${scene.image_url.substring(0, 50)}...`);
    rawUrl = scene.image_url;
  }

  // 从对象存储获取签名URL
  if (!rawUrl) {
    const imageKey = scene.image_key || scene.imageKey;
    if (imageKey) {
      try {
        console.log(`[getImageUrl] 从对象存储获取签名URL, key: ${imageKey}`);
        const signedUrl = await storage.generatePresignedUrl({
          key: imageKey,
          expireTime: 3600,
        });
        rawUrl = typeof signedUrl === 'string' ? signedUrl : (signedUrl as { url: string }).url;
        console.log(`[getImageUrl] 签名URL: ${rawUrl.substring(0, 50)}...`);
      } catch (e) {
        console.error('[getImageUrl] 获取图片URL失败:', e);
        return null;
      }
    }
  }
  
  if (!rawUrl) {
    console.log('[getImageUrl] 未找到图片字段');
    return null;
  }
  
  // 检查是否是火山引擎 TOS URL（服务器端可能无法访问）
  const isVolcengineTosUrl = rawUrl.includes('ark-content-generation') || 
                             rawUrl.includes('tos-cn-beijing.volces.com');
  
  // 检查是否是本地存储 URL
  const isLocalStorageUrl = rawUrl.startsWith('/scenes/') || rawUrl.startsWith('/characters/');
  
  if (isLocalStorageUrl) {
    // 本地存储 URL，直接转换为完整 URL
    return convertImageUrlForVideo(rawUrl, scene.id, storage);
  }
  
  if (isVolcengineTosUrl) {
    console.log(`[getImageUrl] 检测到火山引擎 TOS URL，尝试下载并重新存储...`);
    
    try {
      // 下载图片 - 使用更完整的请求头模拟浏览器访问
      const response = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
        },
        redirect: 'follow',
      });
      
      if (!response.ok) {
        console.warn(`[getImageUrl] 下载失败: ${response.status}，使用原始 URL`);
        return rawUrl;
      }
      
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`[getImageUrl] 图片下载成功，大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      
      let finalUrl: string;
      
      // 策略1: 先尝试上传到对象存储
      try {
        const key = `scenes/${scene.id}/image_${Date.now()}.png`;
        await storage.uploadFile({
          fileContent: imageBuffer,
          fileName: key,
          contentType: 'image/png',
        });
        
        const signedUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 86400 * 7, // 7天有效期
        });
        finalUrl = typeof signedUrl === 'string' ? signedUrl : (signedUrl as { url: string }).url;
        console.log(`[getImageUrl] 图片已上传到对象存储: ${key}`);
        
        // 更新数据库
        await updateSceneImageUrl(scene.id, key, finalUrl);
        
      } catch (storageErr) {
        console.warn(`[getImageUrl] 对象存储上传失败，尝试本地存储:`, storageErr);
        
        // 策略2: 回退到本地存储
        const fs = await import('fs');
        const path = await import('path');
        
        const publicDir = path.join(process.cwd(), 'public', 'scenes', scene.id);
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        
        const localFileName = `image_${Date.now()}.png`;
        const localFilePath = path.join(publicDir, localFileName);
        fs.writeFileSync(localFilePath, imageBuffer);
        
        finalUrl = `/scenes/${scene.id}/${localFileName}`;
        console.log(`[getImageUrl] 图片已保存到本地: ${localFilePath}`);
        
        // 更新数据库
        await updateSceneImageUrl(scene.id, null, finalUrl);
      }
      
      // 返回转换后的 URL
      return convertImageUrlForVideo(finalUrl, scene.id, storage);
      
    } catch (downloadError) {
      console.warn(`[getImageUrl] 下载保存失败:`, downloadError);
      // 使用原始 URL
      return rawUrl;
    }
  }
  
  // 非 TOS URL，直接转换格式
  return convertImageUrlForVideo(rawUrl, scene.id, storage);
}

/**
 * 更新分镜图片 URL（数据库和内存）
 */
async function updateSceneImageUrl(sceneId: string, imageKey: string | null, imageUrl: string): Promise<void> {
  // 更新数据库
  const { getSupabaseClient, isDatabaseConfigured } = await import('@/storage/database/supabase-client');
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseClient();
    const updateData: Record<string, any> = { image_url: imageUrl };
    if (imageKey) {
      updateData.image_key = imageKey;
    }
    await supabase
      .from('scenes')
      .update(updateData)
      .eq('id', sceneId);
    console.log(`[updateSceneImageUrl] 数据库已更新`);
  }
  
  // 更新内存
  const { memoryScenes } = await import('@/lib/memory-storage');
  const sceneIndex = memoryScenes.findIndex(s => s.id === sceneId);
  if (sceneIndex !== -1) {
    memoryScenes[sceneIndex].imageUrl = imageUrl;
    if (imageKey) {
      memoryScenes[sceneIndex].imageKey = imageKey;
    }
  }
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
  scenesWithImages: { id: string; scene_number: number; image_key?: string; image_url?: string; imageKey?: string; imageUrl?: string; description: string; dialogue?: string | null; action?: string | null; emotion?: string | null; metadata?: Record<string, string> }[],
  storage: S3Storage,
  supabase: ReturnType<typeof getSupabaseClient> | null,
  videoModel: string,
  videoResolution: '480p' | '720p' | '1080p',
  videoRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9',
  actuallyUseDatabase: boolean,
  stylePrompt: string,
  userDuration?: number,
  userDialogue?: string,
  userAction?: string,
  userEmotion?: string,
  userLastFrameSceneId?: string
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

      // 使用用户提供的参数覆盖场景中的值
      const modifiedScene = {
        ...scene,
        dialogue: userDialogue !== undefined ? userDialogue : scene.dialogue,
        action: userAction !== undefined ? userAction : scene.action,
        emotion: userEmotion !== undefined ? userEmotion : scene.emotion
      };
      const videoPrompt = `${stylePrompt}，${buildVideoPrompt(modifiedScene)}`;
      const duration = userDuration !== undefined ? userDuration : calculateDuration(scene);

      console.log(`[快速模式] 开始生成分镜 ${scene.scene_number} 视频，时长: ${duration}秒`);

      const result = await generateVideoFromImage(videoPrompt, imgUrl, {
        model: videoModel,
        duration,
        ratio: videoRatio,
        resolution: videoResolution,
        generateAudio: true,
      });

      // 重新托管所有外部视频 URL 到本地，避免跨域问题
      let finalVideoUrl = result.videoUrl;
      const userConfig = getCozeConfigFromMemory();
      if (result.videoUrl && (result.videoUrl.includes('volces.com') || result.videoUrl.includes('tos.coze.site') || result.videoUrl.startsWith('http'))) {
        console.log(`[快速模式] 检测到外部视频 URL，尝试下载到本地...`);
        finalVideoUrl = await rehostVideo(result.videoUrl, scene.id, storage, userConfig?.apiKey);
      }

      if (actuallyUseDatabase && supabase) {
        await supabase
          .from('scenes')
          .update({
            video_url: finalVideoUrl,
            video_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
      } else {
        // 更新内存存储
        const sceneIndex = memoryScenes.findIndex(s => s.id === scene.id);
        if (sceneIndex !== -1) {
          memoryScenes[sceneIndex].videoUrl = finalVideoUrl;
          memoryScenes[sceneIndex].videoStatus = 'completed';
        }
      }

      results.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        videoUrl: finalVideoUrl,
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

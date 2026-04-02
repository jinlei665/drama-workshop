/**
 * 数据库服务统一接口
 * 提供简洁的数据访问层
 */

import { getSupabaseClient } from '@/storage/database/supabase-client'
import { Errors, logger } from '@/lib/errors'
import { generateId } from '@/lib/memory-storage'
import type { Project, Character, Scene, Episode, UserSettings } from '@/lib/types'

// ============================================
// 项目服务
// ============================================

export const ProjectService = {
  /** 获取所有项目 */
  async list(limit = 20, offset = 0): Promise<Project[]> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw Errors.DatabaseError('获取项目列表失败', { error })
    // 手动分页以兼容不同数据库
    return (data || []).slice(offset, offset + limit)
  },

  /** 获取单个项目 */
  async get(id: string): Promise<Project | null> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    
    if (error) throw Errors.DatabaseError('获取项目失败', { error })
    return data
  },

  /** 创建项目 */
  async create(input: { name: string; sourceContent: string; sourceType?: string; description?: string }): Promise<Project> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('projects')
      .insert({
        id: generateId('proj'),  // 添加 id 字段
        name: input.name,
        source_content: input.sourceContent,
        source_type: input.sourceType || 'novel',
        description: input.description,
        status: 'draft',
      })
      .select()
      .single()
    
    if (error) throw Errors.DatabaseError('创建项目失败', { error })
    return data
  },

  /** 更新项目 */
  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw Errors.DatabaseError('更新项目失败', { error })
    if (!data) throw Errors.NotFound('项目')
    return data
  },

  /** 删除项目 */
  async delete(id: string): Promise<void> {
    const db = getSupabaseClient()
    
    // 先删除关联数据
    await db.from('scenes').delete().eq('project_id', id)
    await db.from('characters').delete().eq('project_id', id)
    await db.from('episodes').delete().eq('project_id', id)
    
    // 删除项目
    const { error } = await db.from('projects').delete().eq('id', id)
    if (error) throw Errors.DatabaseError('删除项目失败', { error })
  },

  /** 更新项目状态 */
  async updateStatus(id: string, status: string): Promise<void> {
    const db = getSupabaseClient()
    const { error } = await db
      .from('projects')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    if (error) throw Errors.DatabaseError('更新项目状态失败', { error })
  },
}

// ============================================
// 人物服务
// ============================================

export const CharacterService = {
  /** 获取项目人物 */
  async list(projectId: string): Promise<Character[]> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('characters')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    
    if (error) throw Errors.DatabaseError('获取人物列表失败', { error })
    return data || []
  },

  /** 创建人物 */
  async create(projectId: string, input: {
    name: string
    description?: string
    appearance: string
    personality?: string
    tags?: string[]
  }): Promise<Character> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('characters')
      .insert({
        id: generateId('char'),  // 添加 id 字段
        project_id: projectId,
        name: input.name,
        description: input.description,
        appearance: input.appearance,
        personality: input.personality,
        tags: input.tags || [],
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) throw Errors.DatabaseError('创建人物失败', { error })
    return data
  },

  /** 批量创建人物 */
  async createMany(projectId: string, characters: Array<{
    name: string
    description?: string
    appearance: string
    personality?: string
    tags?: string[]
  }>): Promise<Character[]> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('characters')
      .insert(characters.map(c => ({
        id: generateId('char'),  // 添加 id 字段
        project_id: projectId,
        name: c.name,
        description: c.description,
        appearance: c.appearance,
        personality: c.personality,
        tags: c.tags || [],
        status: 'pending',
      })))
      .select()
    
    if (error) throw Errors.DatabaseError('批量创建人物失败', { error })
    return data || []
  },

  /** 更新人物 */
  async update(id: string, updates: Partial<Character>): Promise<Character> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('characters')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw Errors.DatabaseError('更新人物失败', { error })
    return data
  },

  /** 删除人物 */
  async delete(id: string): Promise<void> {
    const db = getSupabaseClient()
    const { error } = await db.from('characters').delete().eq('id', id)
    if (error) throw Errors.DatabaseError('删除人物失败', { error })
  },
}

// ============================================
// 分镜服务
// ============================================

export const SceneService = {
  /** 获取项目分镜 */
  async list(projectId: string, episodeId?: string): Promise<Scene[]> {
    const db = getSupabaseClient()
    let query = db
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true })
    
    if (episodeId) {
      query = query.eq('episode_id', episodeId)
    }
    
    const { data, error } = await query
    if (error) throw Errors.DatabaseError('获取分镜列表失败', { error })
    return data || []
  },

  /** 创建分镜 */
  async create(projectId: string, input: {
    sceneNumber: number
    title?: string
    description: string
    dialogue?: string
    action?: string
    emotion?: string
    characterIds?: string[]
    episodeId?: string
    metadata?: Record<string, unknown>
  }): Promise<Scene> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('scenes')
      .insert({
        id: generateId('scene'),  // 添加 id 字段
        project_id: projectId,
        scene_number: input.sceneNumber,
        title: input.title,
        description: input.description,
        dialogue: input.dialogue,
        action: input.action,
        emotion: input.emotion,
        character_ids: input.characterIds || [],
        episode_id: input.episodeId,
        metadata: input.metadata,
        status: 'pending',
      })
      .select()
      .single()
    
    if (error) throw Errors.DatabaseError('创建分镜失败', { error })
    return data
  },

  /** 批量创建分镜 */
  async createMany(projectId: string, scenes: Array<{
    sceneNumber: number
    title?: string
    description: string
    dialogue?: string
    action?: string
    emotion?: string
    characterIds?: string[]
    episodeId?: string
    metadata?: Record<string, unknown>
  }>): Promise<Scene[]> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('scenes')
      .insert(scenes.map(s => ({
        id: generateId('scene'),  // 添加 id 字段
        project_id: projectId,
        scene_number: s.sceneNumber,
        title: s.title,
        description: s.description,
        dialogue: s.dialogue,
        action: s.action,
        emotion: s.emotion,
        character_ids: s.characterIds || [],
        episode_id: s.episodeId,
        metadata: s.metadata,
        status: 'pending',
      })))
      .select()
    
    if (error) throw Errors.DatabaseError('批量创建分镜失败', { error })
    return data || []
  },

  /** 更新分镜 */
  async update(id: string, updates: Partial<Scene>): Promise<Scene> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('scenes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw Errors.DatabaseError('更新分镜失败', { error })
    return data
  },

  /** 删除分镜 */
  async delete(id: string): Promise<void> {
    const db = getSupabaseClient()
    const { error } = await db.from('scenes').delete().eq('id', id)
    if (error) throw Errors.DatabaseError('删除分镜失败', { error })
  },

  /** 获取待生成图片的分镜 */
  async getPendingImages(projectId: string): Promise<Scene[]> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .is('image_url', null)
      .order('scene_number', { ascending: true })
    
    if (error) throw Errors.DatabaseError('获取待生成分镜失败', { error })
    return data || []
  },

  /** 获取待生成视频的分镜 */
  async getPendingVideos(projectId: string): Promise<Scene[]> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('scenes')
      .select('*')
      .eq('project_id', projectId)
      .not('image_url', 'is', null)
      .is('video_url', null)
      .order('scene_number', { ascending: true })
    
    if (error) throw Errors.DatabaseError('获取待生成视频失败', { error })
    return data || []
  },
}

// ============================================
// 设置服务
// ============================================

export const SettingsService = {
  /** 获取设置 */
  async get(): Promise<UserSettings> {
    const db = getSupabaseClient()
    const { data, error } = await db
      .from('user_settings')
      .select('*')
      .maybeSingle()
    
    if (error) throw Errors.DatabaseError('获取设置失败', { error })
    
    if (!data) {
      return {
        llm: {
          provider: 'minimax',
          model: 'MiniMax-Text-01',
          apiKey: process.env.LLM_API_KEY,
          baseUrl: process.env.LLM_BASE_URL,
        },
        image: {
          provider: 'doubao',
          model: 'doubao-seedream-4-0-250828',
          apiKey: process.env.IMAGE_API_KEY,
          baseUrl: process.env.IMAGE_BASE_URL,
        },
        video: {
          provider: 'doubao',
          model: 'doubao-seedance-1-5-pro-251215',
          apiKey: process.env.VIDEO_API_KEY,
          baseUrl: process.env.VIDEO_BASE_URL,
        },
        voice: {
          provider: 'doubao',
          model: 'doubao-tts',
        },
      }
    }
    
    return {
      llm: {
        provider: data.llm_provider || 'minimax',
        model: data.llm_model || 'MiniMax-Text-01',
        apiKey: data.llm_api_key || process.env.LLM_API_KEY,
        baseUrl: data.llm_base_url || process.env.LLM_BASE_URL,
      },
      image: {
        provider: data.image_provider || 'doubao',
        model: data.image_model || 'doubao-seedream-4-0-250828',
        apiKey: data.image_api_key || process.env.IMAGE_API_KEY,
        baseUrl: data.image_base_url || process.env.IMAGE_BASE_URL,
      },
      video: {
        provider: data.video_provider || 'doubao',
        model: data.video_model || 'doubao-seedance-1-5-pro-251215',
        apiKey: data.video_api_key || process.env.VIDEO_API_KEY,
        baseUrl: data.video_base_url || process.env.VIDEO_BASE_URL,
      },
      voice: {
        provider: data.voice_provider || 'doubao',
        model: data.voice_model || 'doubao-tts',
        apiKey: data.voice_api_key,
        baseUrl: data.voice_base_url,
      },
    }
  },

  /** 更新设置 */
  async update(settings: Partial<UserSettings>): Promise<void> {
    const db = getSupabaseClient()
    
    // 检查是否存在设置
    const { data: existing } = await db
      .from('user_settings')
      .select('id')
      .maybeSingle()
    
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    
    if (settings.llm) {
      updates.llm_provider = settings.llm.provider
      updates.llm_model = settings.llm.model
      updates.llm_api_key = settings.llm.apiKey
      updates.llm_base_url = settings.llm.baseUrl
    }
    if (settings.image) {
      updates.image_provider = settings.image.provider
      updates.image_model = settings.image.model
      updates.image_api_key = settings.image.apiKey
      updates.image_base_url = settings.image.baseUrl
    }
    if (settings.video) {
      updates.video_provider = settings.video.provider
      updates.video_model = settings.video.model
      updates.video_api_key = settings.video.apiKey
      updates.video_base_url = settings.video.baseUrl
    }
    
    if (existing?.id) {
      const { error } = await db
        .from('user_settings')
        .update(updates)
        .eq('id', existing.id)
      if (error) throw Errors.DatabaseError('更新设置失败', { error })
    } else {
      const { error } = await db
        .from('user_settings')
        .insert({ id: 'default', ...updates })
      if (error) throw Errors.DatabaseError('创建设置失败', { error })
    }
  },
}

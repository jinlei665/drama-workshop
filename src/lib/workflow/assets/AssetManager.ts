/**
 * 资产管理系统
 * 负责工作流资产的存储、管理和版本控制
 */

import { v4 as uuidv4 } from 'uuid'
import S3Storage from '@/lib/storage'

export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
  MODEL = 'model'
}

export enum AssetStatus {
  UPLOADING = 'uploading',
  READY = 'ready',
  PROCESSING = 'processing',
  ERROR = 'error'
}

export interface AssetMetadata {
  width?: number
  height?: number
  duration?: number
  format?: string
  size?: number
  fps?: number
  audioChannels?: number
  sampleRate?: number
}

export interface Asset {
  id: string
  projectId: string
  workflowId?: string
  nodeId?: string
  name: string
  type: AssetType
  status: AssetStatus
  url: string
  storageKey: string
  metadata: AssetMetadata
  tags: string[]
  version: number
  parentId?: string // 用于版本控制，指向父级资产
  createdAt: string
  updatedAt: string
}

export interface AssetFilter {
  projectId?: string
  workflowId?: string
  type?: AssetType
  status?: AssetStatus
  tags?: string[]
  searchQuery?: string
}

export class AssetManager {
  private assets: Map<string, Asset> = new Map()
  private storage: S3Storage

  constructor() {
    this.storage = new S3Storage()
  }

  /**
   * 上传资产
   */
  async uploadAsset(params: {
    projectId: string
    workflowId?: string
    nodeId?: string
    name: string
    type: AssetType
    file: File | Buffer
    tags?: string[]
    metadata?: Partial<AssetMetadata>
  }): Promise<Asset> {
    const id = uuidv4()
    const timestamp = Date.now()
    const extension = this.getFileExtension(params.type, params.metadata?.format)
    const storageKey = `assets/${params.projectId}/${id}.${extension}`

    // 上传到存储
    let url: string
    if (params.file instanceof File) {
      const buffer = Buffer.from(await params.file.arrayBuffer())
      url = await this.storage.uploadFile(storageKey, buffer, this.getMimeType(params.type, extension))
    } else {
      url = await this.storage.uploadFile(storageKey, params.file, this.getMimeType(params.type, extension))
    }

    // 提取元数据
    const metadata = await this.extractMetadata(params.type, params.file, params.metadata)

    // 创建资产记录
    const asset: Asset = {
      id,
      projectId: params.projectId,
      workflowId: params.workflowId,
      nodeId: params.nodeId,
      name: params.name,
      type: params.type,
      status: AssetStatus.READY,
      url,
      storageKey,
      metadata,
      tags: params.tags || [],
      version: 1,
      createdAt: new Date(timestamp).toISOString(),
      updatedAt: new Date(timestamp).toISOString()
    }

    this.assets.set(id, asset)
    return asset
  }

  /**
   * 从 URL 导入资产
   */
  async importAsset(params: {
    projectId: string
    workflowId?: string
    nodeId?: string
    name: string
    type: AssetType
    url: string
    tags?: string[]
  }): Promise<Asset> {
    const id = uuidv4()
    const timestamp = Date.now()

    // 下载文件
    const response = await fetch(params.url)
    const buffer = Buffer.from(await response.arrayBuffer())

    // 上传到存储
    const extension = this.getFileExtensionFromUrl(params.url)
    const storageKey = `assets/${params.projectId}/${id}.${extension}`
    const finalUrl = await this.storage.uploadFile(
      storageKey,
      buffer,
      response.headers.get('content-type') || this.getMimeType(params.type, extension)
    )

    // 提取元数据
    const metadata = await this.extractMetadata(params.type, buffer)

    // 创建资产记录
    const asset: Asset = {
      id,
      projectId: params.projectId,
      workflowId: params.workflowId,
      nodeId: params.nodeId,
      name: params.name,
      type: params.type,
      status: AssetStatus.READY,
      url: finalUrl,
      storageKey,
      metadata,
      tags: params.tags || [],
      version: 1,
      createdAt: new Date(timestamp).toISOString(),
      updatedAt: new Date(timestamp).toISOString()
    }

    this.assets.set(id, asset)
    return asset
  }

  /**
   * 获取资产
   */
  getAsset(assetId: string): Asset | undefined {
    return this.assets.get(assetId)
  }

  /**
   * 列出资产
   */
  listAssets(filter: AssetFilter): Asset[] {
    let results = Array.from(this.assets.values())

    // 应用过滤器
    if (filter.projectId) {
      results = results.filter(a => a.projectId === filter.projectId)
    }

    if (filter.workflowId) {
      results = results.filter(a => a.workflowId === filter.workflowId)
    }

    if (filter.type) {
      results = results.filter(a => a.type === filter.type)
    }

    if (filter.status) {
      results = results.filter(a => a.status === filter.status)
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(a =>
        filter.tags!.some(tag => a.tags.includes(tag))
      )
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      results = results.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  /**
   * 更新资产
   */
  async updateAsset(
    assetId: string,
    updates: {
      name?: string
      tags?: string[]
      metadata?: Partial<AssetMetadata>
    }
  ): Promise<Asset | null> {
    const asset = this.assets.get(assetId)
    if (!asset) return null

    const updatedAsset = {
      ...asset,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    this.assets.set(assetId, updatedAsset)
    return updatedAsset
  }

  /**
   * 删除资产
   */
  async deleteAsset(assetId: string): Promise<boolean> {
    const asset = this.assets.get(assetId)
    if (!asset) return false

    // 从存储删除
    try {
      await this.storage.deleteFile(asset.storageKey)
    } catch (error) {
      console.error('删除存储文件失败:', error)
    }

    // 从内存删除
    return this.assets.delete(assetId)
  }

  /**
   * 创建新版本
   */
  async createVersion(assetId: string, newFile: File | Buffer): Promise<Asset> {
    const originalAsset = this.assets.get(assetId)
    if (!originalAsset) {
      throw new Error('原资产不存在')
    }

    // 上传新版本
    const newAsset = await this.uploadAsset({
      projectId: originalAsset.projectId,
      workflowId: originalAsset.workflowId,
      nodeId: originalAsset.nodeId,
      name: originalAsset.name,
      type: originalAsset.type,
      file: newFile,
      tags: originalAsset.tags,
      metadata: originalAsset.metadata
    })

    // 设置版本关系
    newAsset.version = originalAsset.version + 1
    newAsset.parentId = originalAsset.id
    newAsset.updatedAt = new Date().toISOString()

    this.assets.set(newAsset.id, newAsset)
    return newAsset
  }

  /**
   * 获取版本历史
   */
  getVersionHistory(assetId: string): Asset[] {
    const history: Asset[] = []
    let currentAsset = this.assets.get(assetId)

    while (currentAsset) {
      history.unshift(currentAsset)
      currentAsset = currentAsset.parentId
        ? this.assets.get(currentAsset.parentId)
        : undefined
    }

    return history
  }

  /**
   * 批量删除
   */
  async batchDelete(assetIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = []
    const failed: string[] = []

    for (const assetId of assetIds) {
      try {
        await this.deleteAsset(assetId)
        success.push(assetId)
      } catch (error) {
        failed.push(assetId)
      }
    }

    return { success, failed }
  }

  /**
   * 添加标签
   */
  addTags(assetId: string, tags: string[]): Asset | null {
    const asset = this.assets.get(assetId)
    if (!asset) return null

    const newTags = [...new Set([...asset.tags, ...tags])]
    asset.tags = newTags
    asset.updatedAt = new Date().toISOString()

    return asset
  }

  /**
   * 移除标签
   */
  removeTags(assetId: string, tags: string[]): Asset | null {
    const asset = this.assets.get(assetId)
    if (!asset) return null

    asset.tags = asset.tags.filter(tag => !tags.includes(tag))
    asset.updatedAt = new Date().toISOString()

    return asset
  }

  /**
   * 获取所有标签
   */
  getAllTags(projectId: string): string[] {
    const tagsSet = new Set<string>()

    this.assets.forEach(asset => {
      if (asset.projectId === projectId) {
        asset.tags.forEach(tag => tagsSet.add(tag))
      }
    })

    return Array.from(tagsSet).sort()
  }

  /**
   * 提取文件扩展名
   */
  private getFileExtension(type: AssetType, format?: string): string {
    if (format) return format.replace('.', '')

    const extensions: Record<AssetType, string> = {
      [AssetType.IMAGE]: 'png',
      [AssetType.VIDEO]: 'mp4',
      [AssetType.AUDIO]: 'mp3',
      [AssetType.TEXT]: 'txt',
      [AssetType.MODEL]: 'json'
    }

    return extensions[type]
  }

  /**
   * 从 URL 提取扩展名
   */
  private getFileExtensionFromUrl(url: string): string {
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i)
    return match ? match[1] : 'bin'
  }

  /**
   * 获取 MIME 类型
   */
  private getMimeType(type: AssetType, extension: string): string {
    const mimeTypes: Record<AssetType, Record<string, string>> = {
      [AssetType.IMAGE]: {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif'
      },
      [AssetType.VIDEO]: {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime'
      },
      [AssetType.AUDIO]: {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4'
      },
      [AssetType.TEXT]: {
        txt: 'text/plain',
        json: 'application/json'
      },
      [AssetType.MODEL]: {
        json: 'application/json'
      }
    }

    return mimeTypes[type]?.[extension.toLowerCase()] || 'application/octet-stream'
  }

  /**
   * 提取元数据
   */
  private async extractMetadata(
    type: AssetType,
    file: File | Buffer,
    providedMetadata?: Partial<AssetMetadata>
  ): Promise<AssetMetadata> {
    const metadata: AssetMetadata = { ...providedMetadata }

    // 如果是 File，提取基本信息
    if (file instanceof File) {
      metadata.size = file.size

      // 尝试获取图片尺寸
      if (type === AssetType.IMAGE) {
        try {
          const dimensions = await this.getImageDimensions(file)
          metadata.width = dimensions.width
          metadata.height = dimensions.height
        } catch (error) {
          console.error('提取图片尺寸失败:', error)
        }
      }
    }

    return metadata
  }

  /**
   * 获取图片尺寸
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.width, height: img.height })
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('无法加载图片'))
      }

      img.src = url
    })
  }
}

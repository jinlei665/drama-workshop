/**
 * 本地脚本存储
 * 使用 localStorage 临时存储脚本数据
 * 绕过 Supabase PostgREST schema cache 问题
 */

const STORAGE_KEY = 'drama_studio_scripts'

export interface LocalScript {
  id: string
  projectId: string
  title: string
  content: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
}

export class ScriptStorage {
  /**
   * 获取所有脚本
   */
  static getAll(projectId: string): LocalScript[] {
    if (typeof window === 'undefined') return []
    
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return []
      
      const scripts: LocalScript[] = JSON.parse(data)
      return scripts.filter(s => s.projectId === projectId)
    } catch (e) {
      console.error('读取脚本失败:', e)
      return []
    }
  }

  /**
   * 获取单个脚本
   */
  static get(id: string): LocalScript | null {
    if (typeof window === 'undefined') return null
    
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return null
      
      const scripts: LocalScript[] = JSON.parse(data)
      return scripts.find(s => s.id === id) || null
    } catch (e) {
      console.error('读取脚本失败:', e)
      return null
    }
  }

  /**
   * 创建脚本
   */
  static create(script: Omit<LocalScript, 'createdAt' | 'updatedAt'>): LocalScript {
    if (typeof window === 'undefined') {
      throw new Error('localStorage 不可用')
    }
    
    const now = new Date().toISOString()
    const newScript: LocalScript = {
      ...script,
      createdAt: now,
      updatedAt: now
    }
    
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      const scripts: LocalScript[] = data ? JSON.parse(data) : []
      scripts.push(newScript)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts))
      return newScript
    } catch (e) {
      console.error('保存脚本失败:', e)
      throw new Error('保存脚本失败')
    }
  }

  /**
   * 更新脚本
   */
  static update(id: string, updates: Partial<Pick<LocalScript, 'title' | 'content' | 'description' | 'status'>>): LocalScript | null {
    if (typeof window === 'undefined') return null
    
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return null
      
      const scripts: LocalScript[] = JSON.parse(data)
      const index = scripts.findIndex(s => s.id === id)
      
      if (index === -1) return null
      
      scripts[index] = {
        ...scripts[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts))
      return scripts[index]
    } catch (e) {
      console.error('更新脚本失败:', e)
      return null
    }
  }

  /**
   * 删除脚本
   */
  static delete(id: string): boolean {
    if (typeof window === 'undefined') return false
    
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return true
      
      const scripts: LocalScript[] = JSON.parse(data)
      const filtered = scripts.filter(s => s.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      return true
    } catch (e) {
      console.error('删除脚本失败:', e)
      return false
    }
  }
}

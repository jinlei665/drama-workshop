/**
 * 短剧漫剧创作工坊 - Electron Preload 脚本
 * 提供安全的 IPC 通信桥接
 */

import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 文件对话框
  showOpenDialog: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('show-open-dialog', options),
  
  showSaveDialog: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('show-save-dialog', options),
  
  // 平台信息
  platform: process.platform,
  
  // 是否为 Electron 环境
  isElectron: true
})

// TypeScript 类型声明
export interface ElectronAPI {
  getVersion: () => Promise<string>
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
  platform: NodeJS.Platform
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

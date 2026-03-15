/**
 * 短剧漫剧创作工坊 - Electron 主进程
 * 将 Next.js 应用打包为桌面应用
 */

import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let nextServer: ChildProcess | null = null
const PORT = 5000

// 判断是否为开发模式
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 获取应用路径
const getAppPath = () => {
  if (isDev) {
    return join(__dirname, '..')
  }
  return join(process.resourcesPath, 'app')
}

// 启动 Next.js 服务器
const startNextServer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const appPath = getAppPath()
    
    if (isDev) {
      // 开发模式：使用 next dev
      nextServer = spawn('pnpm', ['dev', '--port', PORT.toString()], {
        cwd: appPath,
        shell: true,
        stdio: 'inherit'
      })
    } else {
      // 生产模式：使用 standalone 服务器
      const serverPath = join(appPath, '.next', 'standalone', 'server.js')
      
      if (!existsSync(serverPath)) {
        reject(new Error('未找到构建产物，请先运行 pnpm build'))
        return
      }
      
      nextServer = spawn('node', [serverPath], {
        cwd: join(appPath, '.next', 'standalone'),
        env: {
          ...process.env,
          PORT: PORT.toString(),
          HOSTNAME: '0.0.0.0'
        },
        stdio: 'inherit'
      })
    }
    
    nextServer.on('error', (err) => {
      console.error('服务器启动失败:', err)
      reject(err)
    })
    
    // 等待服务器启动
    setTimeout(resolve, 2000)
  })
}

// 创建主窗口
const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '短剧漫剧创作工坊',
    icon: join(getAppPath(), 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    },
    show: false
  })
  
  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
  
  // 加载应用
  const url = isDev 
    ? `http://localhost:${PORT}` 
    : `http://localhost:${PORT}`
  
  await mainWindow.loadURL(url)
  
  // 开发模式下打开 DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }
  
  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用启动
app.whenReady().then(async () => {
  try {
    await startNextServer()
    await createWindow()
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error) {
    console.error('应用启动失败:', error)
    dialog.showErrorBox('启动失败', `应用启动失败: ${error}`)
    app.quit()
  }
})

// 关闭应用时清理
app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 处理进程退出
process.on('exit', () => {
  if (nextServer) {
    nextServer.kill()
  }
})

// IPC 通信处理
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('show-open-dialog', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options)
  return result
})

ipcMain.handle('show-save-dialog', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options)
  return result
})

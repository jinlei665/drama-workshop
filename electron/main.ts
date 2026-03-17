/**
 * 短剧漫剧创作工坊 - Electron 主进程
 * 将 Next.js 应用打包为桌面应用
 */

import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { existsSync, readFileSync } from 'fs'

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
  return process.resourcesPath
}

// 加载 .env 文件
const loadEnvFile = () => {
  const appPath = getAppPath()
  const envPath = join(appPath, '.env')
  
  if (existsSync(envPath)) {
    console.log('Loading .env file from:', envPath)
    const content = readFileSync(envPath, 'utf-8')
    const lines = content.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim()
        let value = trimmed.substring(eqIndex + 1).trim()
        
        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        
        // 设置环境变量
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
    
    console.log('.env file loaded successfully')
  } else {
    console.warn('.env file not found at:', envPath)
  }
}

// 启动 Next.js 服务器
const startNextServer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const appPath = getAppPath()
    
    // 加载环境变量
    loadEnvFile()
    
    if (isDev) {
      // 开发模式：使用 next dev
      nextServer = spawn('pnpm', ['dev', '--port', PORT.toString()], {
        cwd: appPath,
        shell: true,
        stdio: 'inherit'
      })
    } else {
      // 生产模式：使用 standalone 服务器
      const standalonePath = join(appPath, 'app')
      const serverPath = join(standalonePath, 'server.js')
      
      if (!existsSync(serverPath)) {
        reject(new Error('未找到构建产物，请先运行 pnpm build'))
        return
      }
      
      console.log('Starting standalone server from:', standalonePath)
      
      nextServer = spawn('node', [serverPath], {
        cwd: standalonePath,
        env: {
          ...process.env,
          PORT: PORT.toString(),
          HOSTNAME: '0.0.0.0'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      // 输出服务器日志
      nextServer.stdout?.on('data', (data) => {
        console.log('[Server]', data.toString())
      })
      
      nextServer.stderr?.on('data', (data) => {
        console.error('[Server Error]', data.toString())
      })
    }
    
    nextServer.on('error', (err) => {
      console.error('服务器启动失败:', err)
      reject(err)
    })
    
    // 等待服务器启动
    setTimeout(resolve, 3000)
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
  
  try {
    await mainWindow.loadURL(url)
  } catch (error) {
    console.error('加载页面失败:', error)
    dialog.showErrorBox('加载失败', `无法加载应用页面: ${error}`)
    app.quit()
    return
  }
  
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
    console.log('========================================')
    console.log('短剧漫剧创作工坊 - 启动中...')
    console.log('========================================')
    
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

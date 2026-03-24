import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, getBitManager } from './ipc-handlers'
import { startFileServer, stopFileServer } from './file-server'
import { initDatabase, closeDatabase } from '../database/db'
import { CrashRecovery } from '../core/CrashRecovery'

export let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    title: '灵芝水铺 - AI多平台智能发布系统',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.lingzhi.publisher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 1. 初始化数据库
  console.log('[Main] Initializing database...')
  initDatabase()

  // 2. 启动本地文件服务
  console.log('[Main] Starting file server...')
  startFileServer()

  // 3. 注册IPC处理器（需在CrashRecovery前注册，以便BitManager可用）
  console.log('[Main] Registering IPC handlers...')
  registerIpcHandlers()

  // 4. 启动自检 - 崩溃恢复
  console.log('[Main] Running crash recovery...')
  const crashRecovery = new CrashRecovery(getBitManager())
  const result = await crashRecovery.startupCheck()
  console.log(`[Main] Crash recovery done: recovered=${result.recovered}, cleaned=${result.cleaned}`)

  // 5. 创建主窗口
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopFileServer()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

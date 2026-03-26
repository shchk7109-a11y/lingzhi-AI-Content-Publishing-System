import express from 'express'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import http from 'http'
import { DEFAULT_SETTINGS } from '../shared/constants'

let server: http.Server | null = null

/**
 * 启动本地Express静态文件服务
 * 将用户数据目录下的媒体文件映射为HTTP URL
 * 解决Electron渲染进程中图片预览和上传路径问题
 */
export function startFileServer(): void {
  const expressApp = express()
  const port = DEFAULT_SETTINGS.fileServerPort

  // 媒体文件存储目录
  const mediaDir = path.join(app.getPath('userData'), 'media')
  const screenshotDir = path.join(app.getPath('userData'), 'screenshots')

  // 确保目录存在
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true })
  }
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true })
  }

  // CORS 头 - 允许渲染进程访问
  expressApp.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET')
    next()
  })

  // 静态文件路由
  expressApp.use('/media', express.static(mediaDir))
  expressApp.use('/screenshots', express.static(screenshotDir))

  // 健康检查
  expressApp.get('/health', (_req, res) => {
    res.json({ status: 'ok', mediaDir, screenshotDir })
  })

  server = expressApp.listen(port, '127.0.0.1', () => {
    console.log(`[FileServer] Running at http://127.0.0.1:${port}`)
  })
}

/**
 * 停止文件服务
 */
export function stopFileServer(): void {
  if (server) {
    server.close()
    server = null
    console.log('[FileServer] Stopped')
  }
}

/**
 * 获取文件服务的URL前缀
 */
export function getFileServerUrl(): string {
  return `http://127.0.0.1:${DEFAULT_SETTINGS.fileServerPort}`
}

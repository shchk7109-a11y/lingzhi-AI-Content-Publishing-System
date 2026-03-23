/**
 * 内容资产库 - 客户端存储工具
 * 使用 localStorage 持久化已生成的内容资产
 * - 生成完成后自动导入
 * - 按时间倒序排列
 * - 7天自动过期清理
 * - 支持已下载标记
 */

export type Platform = "xiaohongshu" | "wechat" | "video"

export interface ScriptScene {
  visual: string
  audio: string
  text_overlay?: string
}

export interface ContentAsset {
  id: string
  topic: string
  platform: Platform
  title: string
  content?: string
  tags?: string[]
  hook?: string
  duration?: string
  scenes?: ScriptScene[]
  savedAt: string       // ISO date string
  expiresAt: string     // ISO date string，7天后过期
  downloadedAt?: string // 首次下载时间
  productId?: string
  productName?: string
  angle_id?: string
  angle_label?: string
}

const STORAGE_KEY = "lingzhi_content_assets"
const EXPIRE_DAYS = 7

/** 获取所有未过期资产，按时间倒序 */
export function getContentAssets(): ContentAsset[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as ContentAsset[]
    const now = Date.now()
    // 过滤掉已过期的
    const valid = all.filter((a) => {
      if (!a.expiresAt) return true // 兼容旧数据
      return new Date(a.expiresAt).getTime() > now
    })
    // 如果有过期数据，顺便清理
    if (valid.length !== all.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    // 按时间倒序
    return valid.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    )
  } catch {
    return []
  }
}

/** 自动保存资产（生成完成时调用），去重逻辑：同选题+平台+角度只保留最新一条 */
export function saveContentAsset(
  asset: Omit<ContentAsset, "id" | "savedAt" | "expiresAt">
): ContentAsset {
  const assets = getContentAssets()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const newAsset: ContentAsset = {
    ...asset,
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: now.toISOString(),
    expiresAt,
  }

  // 去重：同选题 + 平台 + 角度 只保留最新
  const filtered = assets.filter(
    (a) =>
      !(
        a.topic === asset.topic &&
        a.platform === asset.platform &&
        a.angle_id === asset.angle_id
      )
  )
  filtered.unshift(newAsset)
  // 最多保留 500 条
  const trimmed = filtered.slice(0, 500)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  return newAsset
}

/** 标记资产为已下载 */
export function markAssetsDownloaded(ids: string[]): void {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const all = JSON.parse(raw) as ContentAsset[]
    const now = new Date().toISOString()
    const updated = all.map((a) =>
      ids.includes(a.id) ? { ...a, downloadedAt: now } : a
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {}
}

export function deleteContentAssets(ids: string[]): void {
  const assets = getContentAssets()
  const filtered = assets.filter((a) => !ids.includes(a.id))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

export function clearAllContentAssets(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** 计算资产剩余天数 */
export function getAssetRemainingDays(asset: ContentAsset): number {
  if (!asset.expiresAt) return EXPIRE_DAYS
  const diff = new Date(asset.expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: "小红书",
  wechat: "朋友圈",
  video: "短视频",
}

export const PLATFORM_COLORS: Record<Platform, { bg: string; text: string; border: string }> = {
  xiaohongshu: { bg: "#FFF0F0", text: "#E53E3E", border: "#FEB2B2" },
  wechat: { bg: "#F0FFF4", text: "#276749", border: "#9AE6B4" },
  video: { bg: "#EBF8FF", text: "#2B6CB0", border: "#90CDF4" },
}

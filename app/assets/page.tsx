"use client"

import * as React from "react"
import Link from "next/link"
import {
  Archive,
  Trash2,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  ArrowLeft,
  Leaf,
  Copy,
  Check,
  PackageOpen,
  Clock,
  BadgeCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  ContentAsset,
  getContentAssets,
  deleteContentAssets,
  clearAllContentAssets,
  markAssetsDownloaded,
  getAssetRemainingDays,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  Platform,
} from "@/lib/content-assets"

export default function AssetsPage() {
  const [assets, setAssets] = React.useState<ContentAsset[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterPlatform, setFilterPlatform] = React.useState<Platform | "all">("all")
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const refresh = () => setAssets(getContentAssets())

  React.useEffect(() => {
    refresh()
  }, [])

  const filteredAssets = React.useMemo(() => {
    return assets.filter((a) => {
      const matchPlatform = filterPlatform === "all" || a.platform === filterPlatform
      const matchSearch =
        !searchQuery ||
        a.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase())
      return matchPlatform && matchSearch
    })
  }, [assets, filterPlatform, searchQuery])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filteredAssets.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredAssets.map((a) => a.id)))
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = () => {
    if (selected.size === 0) return
    deleteContentAssets(Array.from(selected))
    refresh()
    setSelected(new Set())
    toast.success(`已删除 ${selected.size} 条内容`)
  }

  const getAssetText = (asset: ContentAsset): string => {
    if (asset.platform === "video") {
      return `【视频标题】${asset.title}\n\n【黄金三秒钩子】\n${asset.hook || ""}\n\n【分镜脚本】\n${
        asset.scenes
          ?.map(
            (s, i) =>
              `第${i + 1}幕\n画面：${s.visual}\n口播：${s.audio}${
                s.text_overlay ? `\n字幕：${s.text_overlay}` : ""
              }`
          )
          .join("\n\n") || ""
      }`
    }
    return `${asset.title}\n\n${asset.content || ""}\n\n${asset.tags?.join(" ") || ""}`
  }

  const copyAsset = async (asset: ContentAsset) => {
    await navigator.clipboard.writeText(getAssetText(asset))
    setCopiedId(asset.id)
    toast.success("已复制到剪贴板")
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── 清洗：过滤正文为空的资产 ──────────────────────────────────────────────

  const getValidTargets = (targets: ContentAsset[]): ContentAsset[] => {
    return targets.filter((a) => {
      if (a.platform === "video") {
        return !!(a.hook || (a.scenes && a.scenes.length > 0))
      }
      return !!(a.content && a.content.trim().length > 0)
    })
  }

  // ── 导出 Excel ────────────────────────────────────────────────────────────

  const handleExportExcel = async () => {
    const raw = filteredAssets.filter((a) => selected.size === 0 || selected.has(a.id))
    const targets = getValidTargets(raw)
    const skipped = raw.length - targets.length

    if (targets.length === 0) {
      toast.error("没有有效内容可导出（正文为空的条目已过滤）")
      return
    }
    try {
      const XLSX = await import("xlsx")
      const rows = targets.map((a, i) => ({
        序号: i + 1,
        平台: PLATFORM_LABELS[a.platform],
        内容角度: a.angle_label || "",
        选题标题: a.topic,
        内容标题: a.title,
        正文内容: a.platform !== "video" ? (a.content || "") : (a.hook || ""),
        标签: a.tags?.join(" ") || "",
        保存时间: new Date(a.savedAt).toLocaleString("zh-CN"),
        过期时间: new Date(a.expiresAt || "").toLocaleDateString("zh-CN"),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws["!cols"] = [
        { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 40 },
        { wch: 40 }, { wch: 80 }, { wch: 30 }, { wch: 20 }, { wch: 12 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "内容资产库")
      XLSX.writeFile(wb, `灵芝水铺_内容资产库_${new Date().toISOString().slice(0, 10)}.xlsx`)
      // 标记已下载
      markAssetsDownloaded(targets.map((a) => a.id))
      refresh()
      toast.success(
        `已导出 ${targets.length} 条${skipped > 0 ? `（已自动过滤 ${skipped} 条空内容）` : ""}`
      )
    } catch {
      toast.error("导出失败，请重试")
    }
  }

  // ── 导出 Word ────────────────────────────────────────────────────────────

  const handleExportWord = async () => {
    const raw = filteredAssets.filter((a) => selected.size === 0 || selected.has(a.id))
    const targets = getValidTargets(raw)
    const skipped = raw.length - targets.length

    if (targets.length === 0) {
      toast.error("没有有效内容可导出（正文为空的条目已过滤）")
      return
    }
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx")

      const children: any[] = [
        new Paragraph({
          text: "灵芝水铺 · 内容资产库",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `导出时间：${new Date().toLocaleString("zh-CN")}  共 ${targets.length} 条`,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
      ]

      targets.forEach((asset, idx) => {
        children.push(
          new Paragraph({
            text: `${idx + 1}. 【${PLATFORM_LABELS[asset.platform]}】${asset.topic}`,
            heading: HeadingLevel.HEADING_2,
          })
        )
        if (asset.angle_label) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: "内容角度：", bold: true }),
                new TextRun(asset.angle_label),
              ],
            })
          )
        }
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "标题：", bold: true }),
              new TextRun(asset.title),
            ],
          })
        )
        if (asset.platform === "video") {
          if (asset.hook) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "黄金钩子：", bold: true }),
                  new TextRun(asset.hook),
                ],
              })
            )
          }
          asset.scenes?.forEach((scene, si) => {
            children.push(
              new Paragraph({ children: [new TextRun({ text: `第${si + 1}幕`, bold: true })] })
            )
            children.push(new Paragraph({ text: `  画面：${scene.visual}` }))
            children.push(new Paragraph({ text: `  口播：${scene.audio}` }))
            if (scene.text_overlay) {
              children.push(new Paragraph({ text: `  字幕：${scene.text_overlay}` }))
            }
          })
        } else {
          if (asset.content) {
            children.push(
              new Paragraph({ children: [new TextRun({ text: "正文：", bold: true })] })
            )
            asset.content.split("\n").forEach((line) => {
              children.push(new Paragraph({ text: line || " " }))
            })
          }
          if (asset.tags && asset.tags.length > 0) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "标签：", bold: true }),
                  new TextRun(asset.tags.join(" ")),
                ],
              })
            )
          }
        }
        children.push(new Paragraph({ text: "─".repeat(40) }))
        children.push(new Paragraph({ text: "" }))
      })

      const doc = new Document({ sections: [{ children }] })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `灵芝水铺_内容资产库_${new Date().toISOString().slice(0, 10)}.docx`
      a.click()
      URL.revokeObjectURL(url)
      // 标记已下载
      markAssetsDownloaded(targets.map((a) => a.id))
      refresh()
      toast.success(
        `已导出 ${targets.length} 条${skipped > 0 ? `（已自动过滤 ${skipped} 条空内容）` : ""}`
      )
    } catch (e: any) {
      console.error(e)
      toast.error("Word 导出失败，请重试")
    }
  }

  // ── 打包下载（TXT 文本包） ────────────────────────────────────────────────

  const handleBatchDownload = async () => {
    const raw = filteredAssets.filter((a) => selected.size === 0 || selected.has(a.id))
    const targets = getValidTargets(raw)
    const skipped = raw.length - targets.length

    if (targets.length === 0) {
      toast.error("没有有效内容可下载")
      return
    }

    try {
      // 将所有内容合并为一个 TXT 文件
      const lines: string[] = [
        "灵芝水铺 · 内容资产库打包",
        `导出时间：${new Date().toLocaleString("zh-CN")}`,
        `共 ${targets.length} 条内容`,
        "═".repeat(60),
        "",
      ]

      targets.forEach((asset, idx) => {
        lines.push(`【${idx + 1}】${PLATFORM_LABELS[asset.platform]} · ${asset.angle_label || ""}`)
        lines.push(`选题：${asset.topic}`)
        lines.push(`标题：${asset.title}`)
        lines.push("")
        lines.push(getAssetText(asset))
        lines.push("")
        lines.push("─".repeat(60))
        lines.push("")
      })

      const content = lines.join("\n")
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `灵芝水铺_内容打包_${new Date().toISOString().slice(0, 10)}.txt`
      a.click()
      URL.revokeObjectURL(url)

      // 标记已下载
      markAssetsDownloaded(targets.map((a) => a.id))
      refresh()
      toast.success(
        `已打包下载 ${targets.length} 条${skipped > 0 ? `（已过滤 ${skipped} 条空内容）` : ""}`
      )
    } catch {
      toast.error("打包下载失败，请重试")
    }
  }

  const platformOptions: { key: Platform | "all"; label: string }[] = [
    { key: "all", label: "全部平台" },
    { key: "xiaohongshu", label: "小红书" },
    { key: "wechat", label: "朋友圈" },
    { key: "video", label: "短视频" },
  ]

  return (
    <main
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #F5FAF4 0%, #FFFDF8 60%, #F0F9EE 100%)" }}
    >
      {/* 顶部导航 */}
      <div
        className="sticky top-0 z-40 px-4 py-3"
        style={{
          background: "rgba(250,246,238,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(45,90,39,0.1)",
          boxShadow: "0 2px 12px rgba(45,90,39,0.06)",
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "#2D5A27" }}
            >
              <ArrowLeft className="w-4 h-4" />
              返回流水线
            </Link>
            <div className="w-px h-4" style={{ background: "rgba(45,90,39,0.2)" }} />
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
              >
                <Archive className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base" style={{ color: "#1E3D1A" }}>
                  内容资产库
                </h1>
                <p className="text-xs" style={{ color: "#8B6B4A" }}>
                  共 {assets.length} 条 · 自动保存 · 保留7天
                </p>
              </div>
            </div>
          </div>
          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: "linear-gradient(135deg, #B85C00, #E8820A)",
                color: "white",
                boxShadow: "0 2px 8px rgba(184,92,0,0.25)",
              }}
            >
              <PackageOpen className="w-3.5 h-3.5" />
              打包下载
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: "linear-gradient(135deg, #2D5A27, #4A8A42)",
                color: "white",
                boxShadow: "0 2px 8px rgba(45,90,39,0.25)",
              }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              onClick={handleExportWord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: "linear-gradient(135deg, #3B4FA8, #5B6FD8)",
                color: "white",
                boxShadow: "0 2px 8px rgba(59,79,168,0.25)",
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              Word
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 搜索与筛选栏 */}
        <div
          className="rounded-2xl p-4 flex flex-col sm:flex-row gap-3"
          style={{
            background: "white",
            border: "1px solid rgba(45,90,39,0.1)",
            boxShadow: "0 2px 12px rgba(45,90,39,0.06)",
          }}
        >
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "rgba(45,90,39,0.4)" }}
            />
            <input
              type="text"
              placeholder="搜索选题或标题..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{
                background: "rgba(45,90,39,0.04)",
                border: "1.5px solid rgba(45,90,39,0.12)",
                color: "#1E3D1A",
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {platformOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterPlatform(opt.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background:
                    filterPlatform === opt.key
                      ? "linear-gradient(135deg, #2D5A27, #4A8A42)"
                      : "rgba(45,90,39,0.06)",
                  color: filterPlatform === opt.key ? "white" : "#5C3D1E",
                  border:
                    filterPlatform === opt.key
                      ? "1.5px solid #2D5A27"
                      : "1.5px solid rgba(45,90,39,0.12)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 批量操作栏 */}
        {filteredAssets.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: "#2D5A27" }}
            >
              {selected.size === filteredAssets.length && filteredAssets.length > 0 ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selected.size > 0
                ? `已选 ${selected.size} 条（可打包下载或导出）`
                : `全选 (${filteredAssets.length})`}
            </button>
            {selected.size > 0 && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: "rgba(220,38,38,0.08)",
                  color: "#DC2626",
                  border: "1px solid rgba(220,38,38,0.2)",
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除选中
              </button>
            )}
          </div>
        )}

        {/* 内容列表 */}
        {filteredAssets.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: "white",
              border: "1px solid rgba(45,90,39,0.1)",
            }}
          >
            <Archive
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: "rgba(45,90,39,0.2)" }}
            />
            <p className="font-semibold text-base" style={{ color: "#5C3D1E" }}>
              {searchQuery || filterPlatform !== "all"
                ? "没有找到匹配的内容"
                : "资产库暂无内容"}
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(45,90,39,0.5)" }}>
              {searchQuery || filterPlatform !== "all"
                ? "尝试修改搜索条件"
                : "在步骤四生成文案后，内容将自动保存到此处，保留 7 天"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAssets.map((asset) => {
              const isExpanded = expandedIds.has(asset.id)
              const isSelected = selected.has(asset.id)
              const colors = PLATFORM_COLORS[asset.platform]
              const remainingDays = getAssetRemainingDays(asset)
              const isExpiringSoon = remainingDays <= 2
              const isDownloaded = !!asset.downloadedAt

              return (
                <div
                  key={asset.id}
                  className="rounded-2xl overflow-hidden transition-all duration-200"
                  style={{
                    background: "white",
                    border: isSelected
                      ? "2px solid #2D5A27"
                      : "1px solid rgba(45,90,39,0.1)",
                    boxShadow: isSelected
                      ? "0 0 0 3px rgba(45,90,39,0.08)"
                      : "0 2px 8px rgba(45,90,39,0.05)",
                  }}
                >
                  {/* 卡片头部 */}
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: isExpanded ? "1px solid rgba(45,90,39,0.08)" : "none" }}
                  >
                    {/* 选择框 */}
                    <button onClick={() => toggleSelect(asset.id)} className="flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4" style={{ color: "#2D5A27" }} />
                      ) : (
                        <Square className="w-4 h-4" style={{ color: "rgba(45,90,39,0.3)" }} />
                      )}
                    </button>

                    {/* 平台标签 */}
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {PLATFORM_LABELS[asset.platform]}
                    </span>

                    {/* 角度标签 */}
                    {asset.angle_label && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline"
                        style={{
                          background: "rgba(45,90,39,0.06)",
                          color: "#5C3D1E",
                          border: "1px solid rgba(45,90,39,0.12)",
                        }}
                      >
                        {asset.angle_label}
                      </span>
                    )}

                    {/* 标题 */}
                    <button
                      onClick={() => toggleExpand(asset.id)}
                      className="flex-1 text-left text-sm font-semibold line-clamp-1 hover:opacity-80 transition-opacity"
                      style={{ color: "#1E3D1A" }}
                    >
                      {asset.title}
                    </button>

                    {/* 已下载标记 */}
                    {isDownloaded && (
                      <span
                        className="flex items-center gap-1 text-xs flex-shrink-0 hidden sm:flex"
                        style={{ color: "#2D5A27" }}
                        title={`已于 ${new Date(asset.downloadedAt!).toLocaleDateString("zh-CN")} 下载`}
                      >
                        <BadgeCheck className="w-3.5 h-3.5" />
                        已下载
                      </span>
                    )}

                    {/* 过期提示 */}
                    <span
                      className="flex items-center gap-1 text-xs flex-shrink-0 hidden sm:flex"
                      style={{ color: isExpiringSoon ? "#DC2626" : "rgba(45,90,39,0.4)" }}
                      title={`将于 ${new Date(asset.expiresAt || "").toLocaleDateString("zh-CN")} 过期`}
                    >
                      <Clock className="w-3 h-3" />
                      {remainingDays}天
                    </span>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => copyAsset(asset)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: "rgba(45,90,39,0.06)",
                          color: copiedId === asset.id ? "#2D5A27" : "rgba(45,90,39,0.5)",
                        }}
                        title="复制内容"
                      >
                        {copiedId === asset.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleExpand(asset.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: "rgba(45,90,39,0.06)",
                          color: "rgba(45,90,39,0.5)",
                        }}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 展开内容 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 space-y-3">
                      {/* 选题来源 */}
                      <div className="text-xs" style={{ color: "#8B6B4A" }}>
                        <span className="font-semibold">选题：</span>
                        {asset.topic}
                      </div>

                      {asset.platform === "video" ? (
                        <div className="space-y-3">
                          {asset.hook && (
                            <div
                              className="p-3 rounded-xl"
                              style={{ background: "#FFF8E7", border: "1px solid #FDE68A" }}
                            >
                              <div className="text-xs font-bold mb-1" style={{ color: "#B85C00" }}>
                                🎬 黄金三秒钩子
                              </div>
                              <p className="text-sm" style={{ color: "#3D2B1F" }}>
                                {asset.hook}
                              </p>
                            </div>
                          )}
                          {asset.scenes?.map((scene, si) => (
                            <div
                              key={si}
                              className="p-3 rounded-xl"
                              style={{
                                background: "#F8F9FF",
                                border: "1px solid rgba(59,79,168,0.15)",
                              }}
                            >
                              <div className="text-xs font-bold mb-2" style={{ color: "#3B4FA8" }}>
                                第 {si + 1} 幕
                              </div>
                              <div className="space-y-1 text-sm">
                                <p>
                                  <span className="font-semibold" style={{ color: "#5C3D1E" }}>画面：</span>
                                  <span style={{ color: "#3D2B1F" }}>{scene.visual}</span>
                                </p>
                                <p>
                                  <span className="font-semibold" style={{ color: "#5C3D1E" }}>口播：</span>
                                  <span style={{ color: "#3D2B1F" }}>{scene.audio}</span>
                                </p>
                                {scene.text_overlay && (
                                  <p>
                                    <span className="font-semibold" style={{ color: "#5C3D1E" }}>字幕：</span>
                                    <span style={{ color: "#3D2B1F" }}>{scene.text_overlay}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div
                            className="p-3 rounded-xl text-sm whitespace-pre-line"
                            style={{
                              background: "rgba(45,90,39,0.03)",
                              border: "1px solid rgba(45,90,39,0.08)",
                              color: "#3D2B1F",
                              lineHeight: 1.7,
                            }}
                          >
                            {asset.content}
                          </div>
                          {asset.tags && asset.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {asset.tags.map((tag, ti) => (
                                <span
                                  key={ti}
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{
                                    background: colors.bg,
                                    color: colors.text,
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 底部元信息 */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs" style={{ color: "rgba(45,90,39,0.4)" }}>
                          保存于 {new Date(asset.savedAt).toLocaleString("zh-CN")}
                          {isDownloaded && ` · 已于 ${new Date(asset.downloadedAt!).toLocaleDateString("zh-CN")} 下载`}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: isExpiringSoon ? "#DC2626" : "rgba(45,90,39,0.4)" }}
                        >
                          {isExpiringSoon ? "⚠️ " : ""}剩余 {remainingDays} 天过期
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 底部说明 */}
        {assets.length > 0 && (
          <div className="text-center py-4">
            <button
              onClick={() => {
                if (confirm("确定要清空所有内容资产吗？此操作不可撤销。")) {
                  clearAllContentAssets()
                  setAssets([])
                  setSelected(new Set())
                  toast.success("已清空所有内容资产")
                }
              }}
              className="text-xs transition-colors"
              style={{ color: "rgba(220,38,38,0.5)" }}
            >
              清空所有资产
            </button>
          </div>
        )}
      </div>

      {/* 底部装饰 */}
      <footer className="text-center py-6 text-xs" style={{ color: "rgba(45,90,39,0.35)" }}>
        <div className="flex items-center justify-center gap-1.5">
          <Leaf className="w-3 h-3" />
          <span>灵芝水铺 · 内容资产库 · 自动保存 · 7天保留</span>
          <Leaf className="w-3 h-3" />
        </div>
      </footer>
    </main>
  )
}

"use client"

import * as React from "react"
import {
  Loader2,
  PlayCircle,
  Copy,
  Check,
  Download,
  FileText,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Archive,
  BookmarkCheck,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { fetchWithAIConfig } from "@/lib/ai-client-frontend"
import { saveContentAsset, markAssetsDownloaded, PLATFORM_LABELS } from "@/lib/content-assets"

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface ScriptScene {
  visual: string
  audio: string
  text_overlay?: string
}

interface GeneratedContent {
  title: string
  duration?: string
  hook?: string
  scenes?: ScriptScene[]
  content?: string
  tags?: string[]
  status: "pending" | "generating" | "completed" | "error"
  error?: string
  savedToAssets?: boolean
  angle_id?: string
  angle_label?: string
}

type Platform = "xiaohongshu" | "wechat" | "video"

interface Step4ScriptsProps {
  topics: string[]
  platform: Platform
  onBack: () => void
  onRestart?: () => void
}

// ─── 5个内容角度定义 ─────────────────────────────────────────────────────────

const CONTENT_ANGLES = [
  {
    id: "formula",
    label: "配方科普",
    icon: "🔬",
    desc: "揭秘成分功效与科学原理，制造「原来如此」的恍然大悟感",
    color: "#3B4FA8",
    bg: "#EBF0FF",
    border: "rgba(59,79,168,0.2)",
  },
  {
    id: "taste",
    label: "口感体验",
    icon: "✨",
    desc: "第一人称真实口感描述，前中后调 + 与传统方式对比",
    color: "#B85C00",
    bg: "#FFF8E7",
    border: "rgba(184,92,0,0.2)",
  },
  {
    id: "solution",
    label: "问题解决",
    icon: "💡",
    desc: "痛点共鸣 → 尝试过程 → 效果出现，关键词：终于/解决了/告别",
    color: "#2D5A27",
    bg: "#EBF5E9",
    border: "rgba(45,90,39,0.2)",
  },
  {
    id: "story",
    label: "场景故事",
    icon: "📖",
    desc: "完整小故事，产品作为生活转折点，情感变化从 X 到 Y",
    color: "#7C3D8A",
    bg: "#F5EEFF",
    border: "rgba(124,61,138,0.2)",
  },
  {
    id: "comparison",
    label: "对比评测",
    icon: "⚖️",
    desc: "与 2-3 个替代方案多维度对比，客观专业，明确推荐理由",
    color: "#0D6E8A",
    bg: "#E6F6FB",
    border: "rgba(13,110,138,0.2)",
  },
]

// ─── 智能角度推荐 ────────────────────────────────────────────────────────────────
//
// 根据选题文本关键词推断最匹配的内容角度。
// 同时保证多个选题之间角度尽量均匀分布（不全是同一角度）。

const ANGLE_KEYWORDS: Record<string, string[]> = {
  formula: [
    "成分", "配方", "原理", "科学", "含有", "提取", "有效", "研究",
    "灵芝", "薏仁", "茯苓", "人参", "红枣", "枸杞", "药食同源",
    "为什么", "揭秘", "秘密", "原来", "真相",
  ],
  taste: [
    "好喝", "口感", "味道", "香", "甜", "苦", "回甘", "顺滑",
    "比奶茶", "不苦", "无苦涩", "中式", "特调", "风味",
    "第一口", "喝起来", "尝起来",
  ],
  solution: [
    "救命", "终于", "解决", "告别", "再也不", "困扰", "问题",
    "消肿", "去黄", "祛湿", "提神", "睡眠", "养颜", "减脂",
    "有效", "改善", "变好", "效果",
  ],
  story: [
    "故事", "经历", "那天", "记得", "那次", "分享", "日记",
    "早八", "打工", "上班", "下班", "加班", "熬夜", "生活",
    "妈妈", "朋友", "同事", "推荐",
  ],
  comparison: [
    "对比", "vs", "VS", "比较", "哪个好", "区别", "选择",
    "传统", "普通", "其他", "相比", "更好", "胜过",
    "评测", "测评", "横评",
  ],
}

/**
 * 根据选题文本推断最匹配的内容角度 ID。
 * 计算每个角度的关键词命中数，取最高分；若平局则按角度顺序取第一个。
 */
function inferAngle(topic: string): string {
  const scores: Record<string, number> = {}
  for (const [angleId, keywords] of Object.entries(ANGLE_KEYWORDS)) {
    scores[angleId] = keywords.filter((kw) => topic.includes(kw)).length
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  // 如果最高分为 0（无关键词命中），返回 null 让均匀分布逻辑处理
  return best[1] > 0 ? best[0] : ''
}

/**
 * 为一组选题智能分配内容角度：
 * 1. 先用关键词推断每个选题的最佳角度
 * 2. 对无法推断的选题，按照「已分配角度的使用频次」补充，保证尽量均匀
 */
function assignAngles(topics: string[]): Record<string, string> {
  const angleIds = CONTENT_ANGLES.map((a) => a.id)
  const result: Record<string, string> = {}
  const usageCount: Record<string, number> = Object.fromEntries(angleIds.map((id) => [id, 0]))

  // 第一轮：关键词推断
  const unassigned: string[] = []
  for (const topic of topics) {
    const inferred = inferAngle(topic)
    if (inferred) {
      result[topic] = inferred
      usageCount[inferred]++
    } else {
      unassigned.push(topic)
    }
  }

  // 第二轮：未推断出的选题按使用频次最少的角度补充（均匀分布）
  for (const topic of unassigned) {
    const leastUsed = angleIds.sort((a, b) => usageCount[a] - usageCount[b])[0]
    result[topic] = leastUsed
    usageCount[leastUsed]++
  }

  return result
}

// ─── 并发控制 ─────────────────────────────────────────────────────────────────

const CONCURRENCY_LIMIT = 5

async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []
  for (const task of tasks) {
    const p = task().then((result) => {
      results.push(result)
    })
    executing.push(p)
    if (executing.length >= limit) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex((e) => e === p),
        1
      )
    }
  }
  await Promise.allSettled(executing)
  return results
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function Step4Scripts({ topics, platform, onBack, onRestart }: Step4ScriptsProps) {
  // items: key = `${topic}__${angle_id}`
  const [items, setItems] = React.useState<Record<string, GeneratedContent>>({})
  const [activeTopic, setActiveTopic] = React.useState<string>(topics[0] || "")
  // 每个 topic 当前选中的角度
  const [selectedAngles, setSelectedAngles] = React.useState<Record<string, string>>({})
  const [isGeneratingAll, setIsGeneratingAll] = React.useState(false)
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!activeTopic && topics.length > 0) setActiveTopic(topics[0])
    // 智能推荐角度：根据选题内容自动分配，均匀分布，人工可修改
    setSelectedAngles((prev) => {
      // 找出尚未分配角度的选题
      const newTopics = topics.filter((t) => !prev[t])
      if (newTopics.length === 0) return prev
      const smartAssigned = assignAngles(newTopics)
      return { ...prev, ...smartAssigned }
    })
  }, [topics])

  // 当前 topic 选中的角度 id
  const activeAngleId = selectedAngles[activeTopic] || CONTENT_ANGLES[0].id
  // 当前展示的 item key
  const activeKey = `${activeTopic}__${activeAngleId}`
  const activeItem = items[activeKey]

  // ── 生成单篇 ──────────────────────────────────────────────────────────────

  const generateContent = async (topic: string, angle_id: string) => {
    const key = `${topic}__${angle_id}`
    setItems((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { title: topic }), status: "generating", error: undefined },
    }))
    try {
      const response = await fetchWithAIConfig("/api/generate/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform, angle_id }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || "生成失败")
      }
      const data = await response.json()
      // 生成完成后自动保存到资产库
      const angle = CONTENT_ANGLES.find((a) => a.id === angle_id) || CONTENT_ANGLES[0]
      saveContentAsset({
        topic,
        platform,
        title: data.title || topic,
        content: data.content,
        tags: data.tags,
        hook: data.hook,
        duration: data.duration,
        scenes: data.scenes,
        angle_id: angle_id,
        angle_label: angle.label,
      })
      setItems((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || { title: topic }), ...data, status: "completed", savedToAssets: true },
      }))
    } catch (err: any) {
      setItems((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || { title: topic }),
          status: "error",
          error: err.message || "生成失败，请重试",
        },
      }))
    }
  }

  // ── 批量生成（当前选中角度） ──────────────────────────────────────────────

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true)
    const topicsToGenerate = topics.filter((t) => {
      const angleId = selectedAngles[t] || CONTENT_ANGLES[0].id
      const key = `${t}__${angleId}`
      return items[key]?.status !== "completed"
    })
    if (topicsToGenerate.length === 0) {
      toast.info("所有内容已生成完毕")
      setIsGeneratingAll(false)
      return
    }
    toast.info(`开始并行生成 ${topicsToGenerate.length} 条内容...`)
    const tasks = topicsToGenerate.map(
      (topic) => () => generateContent(topic, selectedAngles[topic] || CONTENT_ANGLES[0].id)
    )
    try {
      await runWithConcurrencyLimit(tasks, CONCURRENCY_LIMIT)
      toast.success("批量生成完成！")
    } catch {
      toast.error("部分内容生成失败，请检查后重试")
    } finally {
      setIsGeneratingAll(false)
    }
  }

  // ── 复制 ──────────────────────────────────────────────────────────────────

  const getCopyText = (item: GeneratedContent) => {
    if (!item) return ""
    if (platform === "video") {
      return `【视频标题】${item.title}\n\n【黄金三秒钩子】\n${item.hook}\n\n【分镜脚本】\n${item.scenes
        ?.map(
          (s, i) =>
            `第${i + 1}幕\n画面：${s.visual}\n口播：${s.audio}${
              s.text_overlay ? `\n字幕：${s.text_overlay}` : ""
            }`
        )
        .join("\n\n")}`
    }
    return `${item.title}\n\n${item.content}\n\n${item.tags?.join(" ")}`
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success("已复制到剪贴板")
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // ── 保存到资产库 ──────────────────────────────────────────────────────────

  const handleSaveToAssets = (topic: string, angle_id: string) => {
    const key = `${topic}__${angle_id}`
    const item = items[key]
    if (!item || item.status !== "completed") return
    saveContentAsset({
      topic,
      platform,
      title: item.title,
      content: item.content,
      tags: item.tags,
      hook: item.hook,
      duration: item.duration,
      scenes: item.scenes,
    })
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], savedToAssets: true },
    }))
    toast.success("已保存到内容资产库！")
  }

  // ── 导出 Excel ────────────────────────────────────────────────────────────

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx")
      const rows: any[] = []
      let rowNum = 1
      topics.forEach((t) => {
        CONTENT_ANGLES.forEach((angle) => {
          const key = `${t}__${angle.id}`
          const item = items[key]
          // 清洗：只导出已生成且有正文内容的条目
          if (item?.status !== "completed") return
          const content = getCopyText(item)
          if (!content || content.trim().length === 0) return
          rows.push({
            序号: rowNum++,
            选题标题: t,
            平台: PLATFORM_LABELS[platform],
            内容角度: angle.label,
            "正文内容/脚本": content,
            状态: "已生成",
          })
        })
      })
      if (rows.length === 0) {
        toast.error("没有已生成的内容可导出，请先生成内容")
        return
      }
      const ws = XLSX.utils.json_to_sheet(rows)
      ws["!cols"] = [
        { wch: 6 },
        { wch: 40 },
        { wch: 10 },
        { wch: 12 },
        { wch: 80 },
        { wch: 10 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "内容文案")
      XLSX.writeFile(
        wb,
        `灵芝水铺_${PLATFORM_LABELS[platform]}_${new Date().toISOString().slice(0, 10)}.xlsx`
      )
      toast.success("Excel 文件已导出")
    } catch {
      toast.error("导出失败，请重试")
    }
  }

  // ── 统计 ──────────────────────────────────────────────────────────────────

  const completedCount = topics.filter((t) => {
    const angleId = selectedAngles[t] || CONTENT_ANGLES[0].id
    return items[`${t}__${angleId}`]?.status === "completed"
  }).length

  const activeAngle = CONTENT_ANGLES.find((a) => a.id === activeAngleId) || CONTENT_ANGLES[0]

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-5">
      {/* 头部信息栏 */}
      <div
        className="rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-3"
        style={{
          background: "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 60%, #3A6E33 100%)",
          boxShadow: "0 4px 16px rgba(30,61,26,0.25)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2
              className="font-bold text-white"
              style={{ fontFamily: "'Songti SC', serif" }}
            >
              步骤四：{PLATFORM_LABELS[platform]}生成
            </h2>
            <p className="text-green-200/70 text-xs">
              已完成 {completedCount} / {topics.length} 条（按当前选中角度统计）
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 进度条 */}
          <div
            className="w-28 h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${topics.length > 0 ? (completedCount / topics.length) * 100 : 0}%`,
                background: "linear-gradient(90deg, #A8D5A2, #E8820A)",
              }}
            />
          </div>
          <span className="text-white/80 text-sm font-bold">
            {topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0}%
          </span>
          {/* 资产库快捷入口 */}
          <Link
            href="/assets"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <Archive className="w-3.5 h-3.5" />
            资产库
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* 左侧：选题列表 */}
        <div
          className="w-full md:w-72 flex-shrink-0 rounded-2xl overflow-hidden"
          style={{
            background: "white",
            border: "1px solid rgba(45,90,39,0.12)",
            boxShadow: "0 4px 16px rgba(45,90,39,0.06)",
          }}
        >
          {/* 批量操作 */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: "1px solid rgba(45,90,39,0.08)", background: "#F5FAF4" }}
          >
            <div className="flex gap-2">
              <button
                onClick={handleGenerateAll}
                disabled={isGeneratingAll}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background: isGeneratingAll
                    ? "rgba(45,90,39,0.4)"
                    : "linear-gradient(135deg, #2D5A27, #4A8A42)",
                }}
              >
                {isGeneratingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="w-3.5 h-3.5" />
                )}
                {isGeneratingAll ? "生成中..." : "批量生成"}
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: "rgba(45,90,39,0.06)",
                  color: "#2D5A27",
                  border: "1px solid rgba(45,90,39,0.12)",
                }}
              >
                <Download className="w-3 h-3" />
                导出
              </button>
            </div>
          </div>

          {/* 选题列表 */}
          <div className="overflow-y-auto" style={{ maxHeight: "520px" }}>
            {topics.map((topic, idx) => {
              const angleId = selectedAngles[topic] || CONTENT_ANGLES[0].id
              const key = `${topic}__${angleId}`
              const item = items[key]
              const isActive = topic === activeTopic
              const angle = CONTENT_ANGLES.find((a) => a.id === angleId)

              return (
                <div
                  key={topic}
                  onClick={() => setActiveTopic(topic)}
                  className="px-4 py-3 cursor-pointer transition-all"
                  style={{
                    borderBottom: "1px solid rgba(45,90,39,0.06)",
                    background: isActive
                      ? "linear-gradient(135deg, #EBF5E9, #F5FAF4)"
                      : "white",
                    borderLeft: isActive ? "3px solid #2D5A27" : "3px solid transparent",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                      style={{
                        background: isActive ? "#2D5A27" : "rgba(45,90,39,0.1)",
                        color: isActive ? "white" : "#2D5A27",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium leading-snug line-clamp-2"
                        style={{ color: isActive ? "#1E3D1A" : "#3D3D3D" }}
                      >
                        {topic}
                      </p>
                      {/* 状态 + 当前角度 */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item?.status === "completed" && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: "#EBF5E9", color: "#2D5A27" }}
                          >
                            ✓ 已生成
                          </span>
                        )}
                        {item?.status === "generating" && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"
                            style={{ background: "#FFF8E7", color: "#B85C00" }}
                          >
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            生成中
                          </span>
                        )}
                        {item?.status === "error" && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}
                          >
                            ✗ 失败
                          </span>
                        )}
                        {angle && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: angle.bg, color: angle.color }}
                          >
                            {angle.icon} {angle.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 返回/重新开始 */}
          <div
            className="px-4 py-3 flex gap-2"
            style={{ borderTop: "1px solid rgba(45,90,39,0.08)" }}
          >
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: "rgba(45,90,39,0.06)",
                color: "#2D5A27",
                border: "1px solid rgba(45,90,39,0.12)",
              }}
            >
              <ArrowLeft className="w-3 h-3" />
              返回
            </button>
            {onRestart && (
              <button
                onClick={onRestart}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: "rgba(45,90,39,0.06)",
                  color: "#2D5A27",
                  border: "1px solid rgba(45,90,39,0.12)",
                }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
                </svg>
                重新开始
              </button>
            )}
          </div>
        </div>

        {/* 右侧：内容展示 */}
        <div
          className="flex-1 rounded-2xl overflow-hidden"
          style={{
            background: "white",
            border: "1px solid rgba(45,90,39,0.12)",
            boxShadow: "0 4px 16px rgba(45,90,39,0.06)",
            minHeight: "500px",
          }}
        >
          {/* 内容头部：选题标题 */}
          <div
            className="px-6 py-4"
            style={{
              borderBottom: "1px solid rgba(45,90,39,0.1)",
              background: "#F5FAF4",
            }}
          >
            <h3 className="font-bold text-base leading-snug" style={{ color: "#1E3D1A" }}>
              {activeTopic}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#8B6B4A" }}>
              选择内容角度后点击生成，每个角度均可独立生成
            </p>
          </div>

          {/* 5个角度选择器 */}
          <div
            className="px-6 py-4"
            style={{ borderBottom: "1px solid rgba(45,90,39,0.08)", background: "#FAFDF9" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold" style={{ color: "#5C3D1E" }}>
                选择内容角度（5选1）
              </p>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(45,90,39,0.08)", color: "#2D5A27" }}
              >
                ✨ AI 已智能推荐，可手动修改
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CONTENT_ANGLES.map((angle) => {
                const isSelected = activeAngleId === angle.id
                const key = `${activeTopic}__${angle.id}`
                const item = items[key]
                const isDone = item?.status === "completed"

                // 判断该角度是否是当前选题的 AI 推荐角度
                const isRecommended = inferAngle(activeTopic) === angle.id ||
                  (!inferAngle(activeTopic) && assignAngles([activeTopic])[activeTopic] === angle.id)

                return (
                  <button
                    key={angle.id}
                    onClick={() =>
                      setSelectedAngles((prev) => ({ ...prev, [activeTopic]: angle.id }))
                    }
                    className="relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-all"
                    style={{
                      background: isSelected ? angle.bg : "white",
                      border: isSelected
                        ? `2px solid ${angle.color}`
                        : isRecommended
                        ? `2px dashed ${angle.color}40`
                        : "2px solid rgba(45,90,39,0.1)",
                      boxShadow: isSelected ? `0 2px 8px ${angle.border}` : "none",
                    }}
                  >
                    {/* AI推荐标记（未选中时显示虚线边框提示） */}
                    {isRecommended && !isSelected && (
                      <span
                        className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap"
                        style={{ background: angle.color, lineHeight: "1.4" }}
                      >
                        AI推荐
                      </span>
                    )}
                    {/* 已完成标记 */}
                    {isDone && (
                      <span
                        className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white"
                        style={{ background: "#2D5A27", fontSize: "8px" }}
                      >
                        ✓
                      </span>
                    )}
                    <span className="text-lg leading-none mt-1">{angle.icon}</span>
                    <span
                      className="text-xs font-semibold leading-tight"
                      style={{ color: isSelected ? angle.color : "#5C3D1E" }}
                    >
                      {angle.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {/* 当前角度描述 */}
            <div
              className="mt-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: activeAngle.bg, color: activeAngle.color, border: `1px solid ${activeAngle.border}` }}
            >
              <span className="font-bold">{activeAngle.icon} {activeAngle.label}：</span>
              {activeAngle.desc}
            </div>
          </div>

          {/* 操作栏 */}
          <div
            className="px-6 py-3 flex items-center justify-between gap-3"
            style={{ borderBottom: "1px solid rgba(45,90,39,0.08)" }}
          >
            <div className="flex items-center gap-2">
              {/* 生成按钮 */}
              {(!activeItem || activeItem.status === "pending" || activeItem.status === "error") && (
                <button
                  onClick={() => generateContent(activeTopic, activeAngleId)}
                  className="flex items-center gap-1.5 px-4 h-8 rounded-lg text-sm font-semibold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg, #2D5A27, #4A8A42)",
                    boxShadow: "0 2px 8px rgba(45,90,39,0.3)",
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {activeItem?.status === "error" ? "重新生成" : "生成此角度"}
                </button>
              )}
              {activeItem?.status === "generating" && (
                <div
                  className="flex items-center gap-2 px-4 h-8 rounded-lg text-sm font-medium"
                  style={{ background: "#FFF8E7", color: "#B85C00" }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI 创作中...
                </div>
              )}
              {activeItem?.status === "completed" && (
                <button
                  onClick={() => generateContent(activeTopic, activeAngleId)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: "rgba(45,90,39,0.06)",
                    color: "#2D5A27",
                    border: "1px solid rgba(45,90,39,0.12)",
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  重新生成
                </button>
              )}
            </div>

            {/* 已完成时的操作按钮 */}
            {activeItem?.status === "completed" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveToAssets(activeTopic, activeAngleId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: activeItem.savedToAssets
                      ? "linear-gradient(135deg, #EBF5E9, #F5FAF4)"
                      : "rgba(232,130,10,0.08)",
                    color: activeItem.savedToAssets ? "#2D5A27" : "#B85C00",
                    border: activeItem.savedToAssets
                      ? "1px solid rgba(45,90,39,0.2)"
                      : "1px solid rgba(232,130,10,0.2)",
                  }}
                >
                  {activeItem.savedToAssets ? (
                    <><BookmarkCheck className="w-3.5 h-3.5" />已保存</>
                  ) : (
                    <><Archive className="w-3.5 h-3.5" />保存到资产库</>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(getCopyText(activeItem), activeKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: "rgba(45,90,39,0.08)",
                    color: "#2D5A27",
                    border: "1px solid rgba(45,90,39,0.15)",
                  }}
                >
                  {copiedKey === activeKey ? (
                    <><Check className="w-3.5 h-3.5" />已复制</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" />复制内容</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 内容区 */}
          <div className="p-6">
            {/* 待生成 */}
            {(!activeItem || activeItem.status === "pending") && (
              <div className="flex flex-col items-center justify-center h-56 gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{ background: activeAngle.bg }}
                >
                  {activeAngle.icon}
                </div>
                <p className="text-sm font-medium" style={{ color: "#5C3D1E" }}>
                  已选：{activeAngle.label}
                </p>
                <p className="text-xs text-center max-w-xs" style={{ color: "#8B6B4A" }}>
                  {activeAngle.desc}
                </p>
                <button
                  onClick={() => generateContent(activeTopic, activeAngleId)}
                  className="mt-1 px-5 h-10 rounded-xl font-semibold text-white text-sm flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #2D5A27, #4A8A42)",
                    boxShadow: "0 3px 10px rgba(45,90,39,0.3)",
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  生成「{activeAngle.label}」版文案
                </button>
              </div>
            )}

            {/* 生成中 */}
            {activeItem?.status === "generating" && (
              <div className="flex flex-col items-center justify-center h-56 gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
                >
                  <Loader2 className="w-7 h-7 text-white animate-spin" />
                </div>
                <p className="text-sm animate-pulse" style={{ color: "#8B6B4A" }}>
                  AI 正在创作「{activeAngle.label}」版文案，请稍候...
                </p>
              </div>
            )}

            {/* 生成失败 */}
            {activeItem?.status === "error" && (
              <div className="flex flex-col items-center justify-center h-56 gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(220,38,38,0.1)" }}
                >
                  <AlertCircle className="w-7 h-7" style={{ color: "#DC2626" }} />
                </div>
                <p className="text-sm" style={{ color: "#DC2626" }}>
                  {activeItem.error || "生成失败，请重试"}
                </p>
              </div>
            )}

            {/* 生成完成 */}
            {activeItem?.status === "completed" && (
              <div className="space-y-5">
                {/* 角度标签 */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: activeAngle.bg, color: activeAngle.color, border: `1px solid ${activeAngle.border}` }}
                >
                  {activeAngle.icon} {activeAngle.label}版
                </div>

                {platform === "video" ? (
                  <>
                    {/* 黄金钩子 */}
                    <div
                      className="p-4 rounded-xl"
                      style={{ background: "#FFF8E7", border: "1.5px solid rgba(232,130,10,0.25)" }}
                    >
                      <div className="text-xs font-bold mb-2 tracking-wider" style={{ color: "#B85C00" }}>
                        ⚡ 黄金三秒钩子 (Hook)
                      </div>
                      <p className="text-base font-semibold" style={{ color: "#1E3D1A" }}>
                        {activeItem.hook}
                      </p>
                    </div>

                    {/* 分镜表格 */}
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(45,90,39,0.12)" }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: "linear-gradient(135deg, #EBF5E9, #F5FAF4)" }}>
                            <th className="px-4 py-3 text-left w-10 text-xs font-bold" style={{ color: "#2D5A27" }}>#</th>
                            <th className="px-4 py-3 text-left w-1/3 text-xs font-bold" style={{ color: "#2D5A27" }}>画面描述</th>
                            <th className="px-4 py-3 text-left text-xs font-bold" style={{ color: "#2D5A27" }}>口播文案</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeItem.scenes?.map((scene, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderTop: "1px solid rgba(45,90,39,0.06)",
                                background: idx % 2 === 0 ? "white" : "#FAFDF9",
                              }}
                            >
                              <td className="px-4 py-3 align-top font-bold text-xs" style={{ color: "#4A8A42" }}>
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 align-top text-sm" style={{ color: "#5C3D1E" }}>
                                <p>{scene.visual}</p>
                                {scene.text_overlay && (
                                  <span
                                    className="inline-block mt-1 text-xs px-2 py-0.5 rounded"
                                    style={{ background: "#FFF8E7", color: "#B85C00" }}
                                  >
                                    字幕：{scene.text_overlay}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top font-medium text-sm" style={{ color: "#1E3D1A" }}>
                                {scene.audio}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div>
                    <div
                      className="p-5 rounded-xl leading-relaxed text-base whitespace-pre-wrap"
                      style={{
                        background: "#F5FAF4",
                        border: "1px solid rgba(45,90,39,0.1)",
                        color: "#1E3D1A",
                        fontWeight: 500,
                        lineHeight: 1.9,
                      }}
                    >
                      {activeItem.content}
                    </div>
                    {activeItem.tags && activeItem.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {activeItem.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-sm px-2.5 py-1 rounded-full"
                            style={{ background: "#EBF0FF", color: "#3B4FA8" }}
                          >
                            #{tag.replace("#", "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 其他角度快速切换提示 */}
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "#F5FAF4", border: "1px solid rgba(45,90,39,0.08)" }}
                >
                  <p className="text-xs font-medium mb-2" style={{ color: "#5C3D1E" }}>
                    切换其他角度继续生成：
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_ANGLES.filter((a) => a.id !== activeAngleId).map((angle) => {
                      const key = `${activeTopic}__${angle.id}`
                      const item = items[key]
                      const isDone = item?.status === "completed"
                      return (
                        <button
                          key={angle.id}
                          onClick={() =>
                            setSelectedAngles((prev) => ({ ...prev, [activeTopic]: angle.id }))
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={{
                            background: isDone ? angle.bg : "white",
                            color: angle.color,
                            border: `1px solid ${angle.border}`,
                          }}
                        >
                          {angle.icon} {angle.label}
                          {isDone && <span className="ml-0.5">✓</span>}
                          {!isDone && <ChevronRight className="w-3 h-3 opacity-50" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

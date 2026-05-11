"use client"

import * as React from "react"
import { Loader2, RefreshCw, Smartphone, MessageCircle, Video, FileDown, Sparkles, ArrowLeft, ArrowRight } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { MatrixRow, StoreFormat } from "./step-2-matrix"
import { fetchWithAIConfig } from "@/lib/ai-client-frontend"
import { toast } from "sonner"

export interface TopicGroup {
  pillar: string
  growth: string[]
  knowledge: string[]
  authority: string[]
  // 小红书专用分类（旧版4类）
  experience?: string[]
  scenario?: string[]
  faq?: string[]
  contrast?: string[]
  // 小红书3H九宫格（新版9格）
  hero_product?: string[]
  hero_scene?: string[]
  hero_brand?: string[]
  hub_product?: string[]
  hub_scene?: string[]
  hub_brand?: string[]
  help_product?: string[]
  help_scene?: string[]
  help_brand?: string[]
}

export interface TopicWithContext {
  topic: string
  pillar_name: string
  content_type: string
  strategy_explanation: string
  store_format?: string
  grid_position?: string
}

interface Step3TopicsProps {
  matrix: MatrixRow[]
  storeFormat?: StoreFormat
  onConfirm: (selectedTopics: TopicWithContext[], platform: Platform) => void
  onBack: () => void
}

type Platform = "xiaohongshu" | "wechat" | "video"

const PLATFORMS = [
  { key: "xiaohongshu" as Platform, icon: Smartphone, label: "小红书", desc: "爆款笔记标题" },
  { key: "wechat" as Platform, icon: MessageCircle, label: "朋友圈", desc: "私域文案" },
  { key: "video" as Platform, icon: Video, label: "短视频", desc: "脚本钩子" },
]

const STRATEGY_CONFIG = [
  { key: "growth" as const, icon: "🚀", label: "增长", color: "#3B4FA8", bg: "#EBF0FF" },
  { key: "knowledge" as const, icon: "📚", label: "知识", color: "#2D5A27", bg: "#EBF5E9" },
  { key: "authority" as const, icon: "👑", label: "权威", color: "#B85C00", bg: "#FFF8E7" },
]

// 小红书3H九宫格选题配置
const XHS_3H_STRATEGY_CONFIG = [
  { key: "hero_product" as const, icon: "🔥", label: "Hero-产品", color: "#DC2626", bg: "#FEF2F2" },
  { key: "hero_scene" as const, icon: "🔥", label: "Hero-场景", color: "#DC2626", bg: "#FEF2F2" },
  { key: "hero_brand" as const, icon: "🔥", label: "Hero-品牌", color: "#DC2626", bg: "#FEF2F2" },
  { key: "hub_product" as const, icon: "🔗", label: "Hub-产品", color: "#D97706", bg: "#FFFBEB" },
  { key: "hub_scene" as const, icon: "🔗", label: "Hub-场景", color: "#D97706", bg: "#FFFBEB" },
  { key: "hub_brand" as const, icon: "🔗", label: "Hub-品牌", color: "#D97706", bg: "#FFFBEB" },
  { key: "help_product" as const, icon: "💡", label: "Help-产品", color: "#059669", bg: "#ECFDF5" },
  { key: "help_scene" as const, icon: "💡", label: "Help-场景", color: "#059669", bg: "#ECFDF5" },
  { key: "help_brand" as const, icon: "💡", label: "Help-品牌", color: "#059669", bg: "#ECFDF5" },
]

// 旧版小红书4类选题配置（兼容）
const XHS_STRATEGY_CONFIG = [
  { key: "experience" as const, icon: "💫", label: "客户体验", color: "#C2185B", bg: "#FCE4EC" },
  { key: "scenario" as const, icon: "🌿", label: "场景推荐", color: "#2D5A27", bg: "#EBF5E9" },
  { key: "faq" as const, icon: "💡", label: "疑问解答", color: "#E8820A", bg: "#FFF8E7" },
  { key: "contrast" as const, icon: "🔥", label: "认知反差", color: "#3B4FA8", bg: "#EBF0FF" },
]

const PILLAR_COLORS = ["#2D5A27", "#E8820A", "#3B4FA8"]

// 业态标签
const STORE_FORMAT_LABELS: Record<string, string> = {
  community: "灵芝水铺·社区店",
  scenic: "灵云小院·景区店",
  business: "葫芦里卖什么·商务区店",
}

export function Step3Topics({ matrix, storeFormat, onConfirm, onBack }: Step3TopicsProps) {
  const [topicsMap, setTopicsMap] = React.useState<Record<Platform, TopicGroup[]>>({
    xiaohongshu: [],
    wechat: [],
    video: [],
  })
  const [selectedTopics, setSelectedTopics] = React.useState<Set<string>>(new Set())
  const [currentPlatform, setCurrentPlatform] = React.useState<Platform>("xiaohongshu")
  const [loadingMap, setLoadingMap] = React.useState<Record<Platform, boolean>>({
    xiaohongshu: false,
    wechat: false,
    video: false,
  })
  const [error, setError] = React.useState<string | null>(null)
  const [topicsPerIdea, setTopicsPerIdea] = React.useState<number>(2)
  const [topicContextMap, setTopicContextMap] = React.useState<Map<string, {pillar_name: string, content_type: string, strategy_explanation: string, store_format?: string, grid_position?: string}>>(new Map())

  const handleGenerate = async (platform: Platform) => {
    setLoadingMap((prev) => ({ ...prev, [platform]: true }))
    setError(null)
    try {
      const response = await fetchWithAIConfig("/api/generate/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix, platform, topicsPerIdea, store_format: storeFormat }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || "生成选题失败")
      }
      const data = await response.json()
      if (data.topics) {
        const topicGroups: TopicGroup[] = Object.keys(data.topics).map((pillarName) => {
          const t = data.topics[pillarName]
          // 检测返回格式：3H九宫格 / 旧版4类 / 通用3列
          const is3H = t.hero_product !== undefined || t.hub_product !== undefined
          const isXhsFormat = t.experience !== undefined || t.scenario !== undefined
          return {
            pillar: pillarName,
            growth: (!is3H && !isXhsFormat) ? (t.growth || []) : [],
            knowledge: (!is3H && !isXhsFormat) ? (t.knowledge || []) : [],
            authority: (!is3H && !isXhsFormat) ? (t.authority || []) : [],
            experience: isXhsFormat ? (t.experience || []) : [],
            scenario: isXhsFormat ? (t.scenario || []) : [],
            faq: isXhsFormat ? (t.faq || []) : [],
            contrast: isXhsFormat ? (t.contrast || []) : [],
            hero_product: is3H ? (t.hero_product || []) : [],
            hero_scene: is3H ? (t.hero_scene || []) : [],
            hero_brand: is3H ? (t.hero_brand || []) : [],
            hub_product: is3H ? (t.hub_product || []) : [],
            hub_scene: is3H ? (t.hub_scene || []) : [],
            hub_brand: is3H ? (t.hub_brand || []) : [],
            help_product: is3H ? (t.help_product || []) : [],
            help_scene: is3H ? (t.help_scene || []) : [],
            help_brand: is3H ? (t.help_brand || []) : [],
          }
        })
        setTopicsMap((prev) => ({ ...prev, [platform]: topicGroups }))
        // 构建 topic 上下文映射
        const newContextMap = new Map(topicContextMap)
        const is3H = topicGroups.some(g => (g.hero_product?.length ?? 0) > 0)
        const strategyKeys = is3H
          ? ['hero_product', 'hero_scene', 'hero_brand', 'hub_product', 'hub_scene', 'hub_brand', 'help_product', 'help_scene', 'help_brand']
          : (platform === 'xiaohongshu'
            ? ['experience', 'scenario', 'faq', 'contrast']
            : ['growth', 'knowledge', 'authority'])
        topicGroups.forEach(group => {
          strategyKeys.forEach(key => {
            const topicsList = (group as any)[key] || []
            topicsList.forEach((t: string) => {
              newContextMap.set(t, {
                pillar_name: group.pillar,
                content_type: key,
                strategy_explanation: '',
                store_format: storeFormat,
                grid_position: key,
              })
            })
          })
        })
        setTopicContextMap(newContextMap)
        toast.success(`${PLATFORMS.find((p) => p.key === platform)?.label}选题生成成功！`)
      } else {
        throw new Error("AI 返回格式异常，请重试")
      }
    } catch (err: any) {
      const msg = err.message || "生成选题失败，请重试"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoadingMap((prev) => ({ ...prev, [platform]: false }))
    }
  }

  const handleExportCSV = () => {
    const platformLabel = PLATFORMS.find((p) => p.key === currentPlatform)?.label || ""
    const topics = topicsMap[currentPlatform]
    if (topics.length === 0) return
    let csvContent = "\uFEFF"
    csvContent += "支柱,策略类型,选题标题\n"
    topics.forEach((group) => {
      // 3H九宫格格式
      const is3H = (group.hero_product?.length ?? 0) > 0
      if (is3H) {
        XHS_3H_STRATEGY_CONFIG.forEach(s => {
          const list = (group as any)[s.key] || []
          list.forEach((t: string) => csvContent += `"${group.pillar}","${s.label}","${t}"\n`)
        })
      } else {
        group.growth.forEach((t) => (csvContent += `"${group.pillar}","增长","${t}"\n`))
        group.knowledge.forEach((t) => (csvContent += `"${group.pillar}","知识","${t}"\n`))
        group.authority.forEach((t) => (csvContent += `"${group.pillar}","权威","${t}"\n`))
        if (group.experience?.length) group.experience.forEach((t) => (csvContent += `"${group.pillar}","客户体验","${t}"\n`))
        if (group.scenario?.length) group.scenario.forEach((t) => (csvContent += `"${group.pillar}","场景推荐","${t}"\n`))
        if (group.faq?.length) group.faq.forEach((t) => (csvContent += `"${group.pillar}","疑问解答","${t}"\n`))
        if (group.contrast?.length) group.contrast.forEach((t) => (csvContent += `"${group.pillar}","认知反差","${t}"\n`))
      }
    })
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `灵芝水铺_${platformLabel}_选题表_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleTopic = (topic: string) => {
    const newSelected = new Set(selectedTopics)
    newSelected.has(topic) ? newSelected.delete(topic) : newSelected.add(topic)
    setSelectedTopics(newSelected)
  }

  const toggleGroup = (topics: string[]) => {
    const newSelected = new Set(selectedTopics)
    const allSelected = topics.every((t) => newSelected.has(t))
    topics.forEach((t) => (allSelected ? newSelected.delete(t) : newSelected.add(t)))
    setSelectedTopics(newSelected)
  }

  const getGroupAllTopics = (g: TopicGroup): string[] => {
    const is3H = (g.hero_product?.length ?? 0) > 0
    if (is3H) {
      return [
        ...(g.hero_product || []), ...(g.hero_scene || []), ...(g.hero_brand || []),
        ...(g.hub_product || []), ...(g.hub_scene || []), ...(g.hub_brand || []),
        ...(g.help_product || []), ...(g.help_scene || []), ...(g.help_brand || []),
      ]
    }
    const isXhs = (g.experience?.length ?? 0) > 0 || (g.scenario?.length ?? 0) > 0
    if (isXhs) {
      return [...(g.experience || []), ...(g.scenario || []), ...(g.faq || []), ...(g.contrast || [])]
    }
    return [...g.growth, ...g.knowledge, ...g.authority]
  }

  const toggleAll = () => {
    const topics = topicsMap[currentPlatform]
    if (topics.length === 0) return
    const allTopics: string[] = []
    topics.forEach((g) => allTopics.push(...getGroupAllTopics(g)))
    const allSelected = allTopics.every((t) => selectedTopics.has(t))
    const newSelected = new Set(selectedTopics)
    allTopics.forEach((t) => (allSelected ? newSelected.delete(t) : newSelected.add(t)))
    setSelectedTopics(newSelected)
  }

  const handleConfirm = () => {
    if (selectedTopics.size > 0) {
      const topicsWithContext: TopicWithContext[] = Array.from(selectedTopics).map(topic => {
        const ctx = topicContextMap.get(topic)
        return {
          topic,
          pillar_name: ctx?.pillar_name || '',
          content_type: ctx?.content_type || '',
          strategy_explanation: ctx?.strategy_explanation || '',
          store_format: ctx?.store_format || storeFormat,
          grid_position: ctx?.grid_position || '',
        }
      })
      onConfirm(topicsWithContext, currentPlatform)
    }
  }

  const currentTopics = topicsMap[currentPlatform]
  const isLoading = loadingMap[currentPlatform]

  return (
    <div className="w-full space-y-5">
      {/* 卡片主体 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(45,90,39,0.12)",
          boxShadow: "0 4px 24px rgba(45,90,39,0.08)",
        }}
      >
        {/* 头部 */}
        <div
          className="px-6 py-5"
          style={{
            background: "linear-gradient(135deg, #EBF5E9 0%, #F5FAF4 100%)",
            borderBottom: "1px solid rgba(45,90,39,0.1)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}>
                步骤三：全媒体选题矩阵
              </h2>
              <p className="text-sm" style={{ color: "#8B6B4A" }}>
                {storeFormat
                  ? `当前业态：${STORE_FORMAT_LABELS[storeFormat] || storeFormat} · 根据不同平台算法逻辑生成定制化选题`
                  : '根据不同平台算法逻辑，生成定制化选题，勾选心仪标题以生成脚本'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* 平台切换 */}
          <div className="grid grid-cols-3 gap-3">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon
              const isActive = currentPlatform === platform.key
              const hasData = topicsMap[platform.key].length > 0
              return (
                <button
                  key={platform.key}
                  onClick={() => setCurrentPlatform(platform.key)}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left"
                  style={{
                    background: isActive ? "linear-gradient(135deg, #EBF5E9, #F5FAF4)" : "rgba(45,90,39,0.03)",
                    border: isActive ? "2px solid #2D5A27" : "2px solid rgba(45,90,39,0.12)",
                    boxShadow: isActive ? "0 0 0 3px rgba(45,90,39,0.08)" : "none",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isActive ? "linear-gradient(135deg, #2D5A27, #4A8A42)" : "rgba(45,90,39,0.1)",
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: isActive ? "white" : "rgba(45,90,39,0.5)" }} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: isActive ? "#1E3D1A" : "#8B6B4A" }}>
                      {platform.label}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(45,90,39,0.45)" }}>
                      {hasData ? "已生成" : platform.desc}
                    </div>
                  </div>
                  {hasData && (
                    <div
                      className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: "#4A8A42" }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* 操作栏 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {selectedTopics.size > 0 && (
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: "#EBF5E9", color: "#2D5A27" }}
                >
                  已选 {selectedTopics.size} 个选题
                </span>
              )}
              {currentTopics.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "rgba(45,90,39,0.08)", color: "#2D5A27" }}
                >
                  {selectedTopics.size > 0 ? "取消全选" : "全选本页"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#5C3D1E" }}>每个创意</span>
                <select
                  value={topicsPerIdea}
                  onChange={(e) => setTopicsPerIdea(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg text-xs"
                  style={{
                    border: "1.5px solid rgba(45,90,39,0.2)",
                    background: "white",
                    color: "#2D5A27",
                  }}
                >
                  <option value={1}>1个选题</option>
                  <option value={2}>2个选题</option>
                  <option value={3}>3个选题</option>
                </select>
              </div>
              {currentTopics.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "rgba(45,90,39,0.08)", color: "#2D5A27", border: "1px solid rgba(45,90,39,0.15)" }}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  导出 CSV
                </button>
              )}
              <button
                onClick={() => handleGenerate(currentPlatform)}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-semibold text-white transition-all"
                style={{
                  background: isLoading
                    ? "rgba(232,130,10,0.4)"
                    : "linear-gradient(135deg, #E8820A, #F59E0B)",
                  boxShadow: isLoading ? "none" : "0 3px 10px rgba(232,130,10,0.3)",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : currentTopics.length > 0 ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {currentTopics.length > 0 ? "重新生成" : "生成选题"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626" }}
            >
              {error}
            </div>
          )}

          {/* 选题内容区 */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
              >
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <p className="text-sm" style={{ color: "#8B6B4A" }}>AI 正在生成选题，请稍候...</p>
            </div>
          ) : currentTopics.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl"
              style={{ border: "2px dashed rgba(45,90,39,0.15)", background: "rgba(45,90,39,0.02)" }}
            >
              {React.createElement(PLATFORMS.find((p) => p.key === currentPlatform)!.icon, {
                className: "w-10 h-10",
                style: { color: "rgba(45,90,39,0.2)" },
              })}
              <p className="text-sm" style={{ color: "rgba(45,90,39,0.5)" }}>
                点击右上角"生成选题"获取{PLATFORMS.find((p) => p.key === currentPlatform)?.label}定制化选题
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {currentTopics.map((group, groupIndex) => {
                const is3H = (group.hero_product?.length ?? 0) > 0
                return (
                  <div
                    key={groupIndex}
                    className="rounded-xl overflow-hidden"
                    style={{ border: `1.5px solid ${PILLAR_COLORS[groupIndex] || "#2D5A27"}25` }}
                  >
                    {/* 支柱标题 */}
                    <div
                      className="px-4 py-3 flex items-center gap-2"
                      style={{
                        background: `${PILLAR_COLORS[groupIndex] || "#2D5A27"}10`,
                        borderBottom: `1px solid ${PILLAR_COLORS[groupIndex] || "#2D5A27"}20`,
                      }}
                    >
                      <span
                        className="font-bold text-sm"
                        style={{ color: PILLAR_COLORS[groupIndex] || "#2D5A27" }}
                      >
                        {group.pillar}
                      </span>
                      <button
                        onClick={() => toggleGroup(getGroupAllTopics(group))}
                        className="ml-auto text-xs px-2.5 py-1 rounded-lg"
                        style={{
                          background: "rgba(45,90,39,0.08)",
                          color: PILLAR_COLORS[groupIndex] || "#2D5A27",
                        }}
                      >
                        全选本组
                      </button>
                    </div>

                    {/* 选题列表 */}
                    {(() => {
                      if (is3H) {
                        // 3H九宫格布局：3行3列
                        return (
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {XHS_3H_STRATEGY_CONFIG.map((strategy) => {
                                const topics: string[] = (group as any)[strategy.key] || []
                                if (topics.length === 0) return null
                                return (
                                  <div key={strategy.key} className="p-3 rounded-lg space-y-2" style={{ background: strategy.bg }}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: `${strategy.color}15`, color: strategy.color }}
                                      >
                                        <span>{strategy.icon}</span>
                                        {strategy.label}
                                      </div>
                                      <button
                                        onClick={() => toggleGroup(topics)}
                                        className="text-xs"
                                        style={{ color: "rgba(45,90,39,0.5)" }}
                                      >
                                        {topics.every((t) => selectedTopics.has(t)) ? "取消" : "全选"}
                                      </button>
                                    </div>
                                    {topics.map((topic, topicIndex) => (
                                      <div
                                        key={topicIndex}
                                        className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all"
                                        style={{
                                          background: selectedTopics.has(topic) ? "white" : "transparent",
                                          border: selectedTopics.has(topic)
                                            ? `1px solid ${strategy.color}30`
                                            : "1px solid transparent",
                                        }}
                                        onClick={() => toggleTopic(topic)}
                                      >
                                        <Checkbox
                                          checked={selectedTopics.has(topic)}
                                          onCheckedChange={() => toggleTopic(topic)}
                                          className="mt-0.5 flex-shrink-0"
                                        />
                                        <Label
                                          className="cursor-pointer text-sm leading-relaxed"
                                          style={{ color: selectedTopics.has(topic) ? strategy.color : "#3D2B1F" }}
                                        >
                                          {topic}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }

                      // 旧版布局（4类或3列）
                      const isXhs = (group.experience?.length ?? 0) > 0 || (group.scenario?.length ?? 0) > 0
                      const config = isXhs ? XHS_STRATEGY_CONFIG : STRATEGY_CONFIG
                      const colClass = isXhs
                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100"
                        : "grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100"
                      return (
                        <div className={colClass}>
                          {config.map((strategy) => {
                            const topics: string[] = (group as any)[strategy.key] || []
                            return (
                              <div key={strategy.key} className="p-4 space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <div
                                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: strategy.bg, color: strategy.color }}
                                  >
                                    <span>{strategy.icon}</span>
                                    {strategy.label}
                                  </div>
                                  <button
                                    onClick={() => toggleGroup(topics)}
                                    className="text-xs"
                                    style={{ color: "rgba(45,90,39,0.5)" }}
                                  >
                                    {topics.length > 0 && topics.every((t) => selectedTopics.has(t)) ? "取消" : "全选"}
                                  </button>
                                </div>
                                {topics.map((topic, topicIndex) => (
                                  <div
                                    key={topicIndex}
                                    className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all"
                                    style={{
                                      background: selectedTopics.has(topic) ? strategy.bg : "transparent",
                                      border: selectedTopics.has(topic)
                                        ? `1px solid ${strategy.color}30`
                                        : "1px solid transparent",
                                    }}
                                    onClick={() => toggleTopic(topic)}
                                  >
                                    <Checkbox
                                      checked={selectedTopics.has(topic)}
                                      onCheckedChange={() => toggleTopic(topic)}
                                      className="mt-0.5 flex-shrink-0"
                                    />
                                    <Label
                                      className="cursor-pointer text-sm leading-relaxed"
                                      style={{ color: selectedTopics.has(topic) ? strategy.color : "#3D2B1F" }}
                                    >
                                      {topic}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 h-11 rounded-xl font-semibold transition-all"
          style={{ background: "white", border: "1.5px solid rgba(45,90,39,0.2)", color: "#2D5A27" }}
        >
          <ArrowLeft className="w-4 h-4" />
          返回上一步
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedTopics.size === 0}
          className="flex-1 h-11 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
          style={{
            background:
              selectedTopics.size === 0
                ? "rgba(45,90,39,0.25)"
                : "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #4A8A42 100%)",
            boxShadow: selectedTopics.size === 0 ? "none" : "0 4px 16px rgba(45,90,39,0.35)",
            cursor: selectedTopics.size === 0 ? "not-allowed" : "pointer",
          }}
        >
          确认选题，生成脚本
          {selectedTopics.size > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              {selectedTopics.size}
            </span>
          )}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

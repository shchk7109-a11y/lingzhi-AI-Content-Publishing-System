"use client"

import * as React from "react"
import { Loader2, Lightbulb, RefreshCw, Grid3X3, ArrowLeft, ArrowRight, Sparkles, Store } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { fetchWithAIConfig } from "@/lib/ai-client-frontend"
import { toast } from "sonner"
import { PillarItem } from "@/components/pipeline/step-1-pillars"

export interface MatrixCell {
  title: string
  explanation: string
  ideas: string[]
}

export interface MatrixRow {
  pillar: string
  growth: MatrixCell
  knowledge: MatrixCell
  authority: MatrixCell
  // 新增：3H九宫格字段（小红书专用）
  hero_product?: MatrixCell
  hero_scene?: MatrixCell
  hero_brand?: MatrixCell
  hub_product?: MatrixCell
  hub_scene?: MatrixCell
  hub_brand?: MatrixCell
  help_product?: MatrixCell
  help_scene?: MatrixCell
  help_brand?: MatrixCell
}

export type StoreFormat = "community" | "scenic" | "business"

interface Step2MatrixProps {
  pillars: PillarItem[] | string[]
  mode?: "brand" | "product"
  productId?: string
  category?: string
  onConfirm: (matrix: MatrixRow[], storeFormat?: StoreFormat) => void
  onBack: () => void
}

// 三业态配置
const STORE_FORMATS = [
  {
    key: "community" as StoreFormat,
    label: "灵芝水铺·社区店",
    desc: "社区养生日常，复购型内容",
    icon: "🏘️",
    color: "#2D5A27",
    bg: "#EBF5E9",
    anchor: "家门口的灵芝水站",
  },
  {
    key: "scenic" as StoreFormat,
    label: "灵云小院·景区店",
    desc: "文旅体验打卡，传播型内容",
    icon: "🏯",
    color: "#7C3D8A",
    bg: "#F5EEFF",
    anchor: "可以喝的非遗文化馆",
  },
  {
    key: "business" as StoreFormat,
    label: "葫芦里卖什么·商务区店",
    desc: "职场效率养生，转化型内容",
    icon: "🏢",
    color: "#3B4FA8",
    bg: "#EBF0FF",
    anchor: "打工人的草本能量站",
  },
]

// 通用三列配置（短视频/朋友圈使用）
const COL_CONFIG = [
  {
    key: "growth" as const,
    label: "增长内容",
    en: "Growth",
    icon: "🚀",
    desc: "吸引眼球 · 爆款选题 · 初学者友好",
    headerBg: "linear-gradient(135deg, #EBF0FF, #F0F4FF)",
    headerBorder: "#6B7FCC",
    headerText: "#3B4FA8",
    cellBg: "#F8F9FF",
    ideaBg: "#EBF0FF",
    badgeColor: "#3B4FA8",
  },
  {
    key: "knowledge" as const,
    label: "知识内容",
    en: "Knowledge",
    icon: "📚",
    desc: "干货教育 · 解决痛点 · 获取粉丝",
    headerBg: "linear-gradient(135deg, #EBF5E9, #F0F9EE)",
    headerBorder: "#4A8A42",
    headerText: "#2D5A27",
    cellBg: "#F5FBF4",
    ideaBg: "#EBF5E9",
    badgeColor: "#2D5A27",
  },
  {
    key: "authority" as const,
    label: "权威内容",
    en: "Authority",
    icon: "👑",
    desc: "建立信任 · 专业背书 · 社会证明",
    headerBg: "linear-gradient(135deg, #FFF8E7, #FFFBF0)",
    headerBorder: "#E8820A",
    headerText: "#B85C00",
    cellBg: "#FFFCF5",
    ideaBg: "#FFF8E7",
    badgeColor: "#B85C00",
  },
]

// 3H九宫格列配置（小红书专用）
const XHS_3H_ROW_CONFIG = [
  {
    key: "hero",
    label: "Hero 爆款层",
    icon: "🔥",
    desc: "高传播 · 情绪共鸣 · 信息差标题",
    color: "#DC2626",
    bg: "#FEF2F2",
  },
  {
    key: "hub",
    label: "Hub 枢纽层",
    icon: "🔗",
    desc: "中频 · 场景种草 · 建立信任",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    key: "help",
    label: "Help 长尾层",
    icon: "💡",
    desc: "搜索截流 · 干货教程 · 截屏感",
    color: "#059669",
    bg: "#ECFDF5",
  },
]

const XHS_3H_COL_CONFIG = [
  {
    key: "product",
    label: "产品维度",
    icon: "🧪",
    desc: "成分/功效/口感",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    key: "scene",
    label: "场景维度",
    icon: "🌿",
    desc: "使用场景/人群痛点",
    color: "#0891B2",
    bg: "#ECFEFF",
  },
  {
    key: "brand",
    label: "品牌维度",
    icon: "✨",
    desc: "品牌故事/价值观",
    color: "#BE185D",
    bg: "#FDF2F8",
  },
]

const PILLAR_COLORS = ["#2D5A27", "#E8820A", "#3B4FA8"]

export function Step2Matrix({ pillars, mode, productId, category, onConfirm, onBack }: Step2MatrixProps) {
  const [matrix, setMatrix] = React.useState<MatrixRow[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [storeFormat, setStoreFormat] = React.useState<StoreFormat>("community")
  const [matrixMode, setMatrixMode] = React.useState<"classic" | "3h">("3h")

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const pillarsPayload = pillars.map((p: any) =>
        typeof p === 'string' ? { pillar: p, source: 'A-痛点' } : p
      )
      const response = await fetchWithAIConfig("/api/generate/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillars: pillarsPayload,
          mode,
          productId,
          category,
          store_format: storeFormat,
          matrix_mode: matrixMode,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败 (${response.status})`)
      }
      const data = await response.json()
      if (data.matrix && Array.isArray(data.matrix)) {
        setMatrix(data.matrix)
        toast.success("九宫格矩阵生成成功！")
      } else {
        throw new Error("AI 返回格式异常，请重试")
      }
    } catch (err: any) {
      const msg = err.message || "生成矩阵失败，请稍后重试"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const updateCell = (
    rowIndex: number,
    colKey: string,
    field: keyof MatrixCell,
    value: any
  ) => {
    const newMatrix = [...matrix]
    const cell = (newMatrix[rowIndex] as any)[colKey]
    if (!cell) return
    if (field === "ideas") {
      cell.ideas = value
    } else {
      cell[field] = value
    }
    setMatrix(newMatrix)
  }

  const handleConfirm = () => {
    if (matrix.length > 0) onConfirm(matrix, storeFormat)
  }

  // 检测是否为3H九宫格数据
  const is3HMatrix = matrix.length > 0 && matrix[0].hero_product !== undefined

  return (
    <div className="w-full space-y-5">
      {/* 卡片头部 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(45,90,39,0.12)",
          boxShadow: "0 4px 24px rgba(45,90,39,0.08)",
        }}
      >
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
              <Grid3X3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}>
                步骤二：生成九宫格内容策略矩阵
              </h2>
              <p className="text-sm" style={{ color: "#8B6B4A" }}>
                {matrixMode === '3h'
                  ? '基于"Hero · Hub · Help × 产品 · 场景 · 品牌"三业态九宫格模型'
                  : '基于"增长 · 知识 · 权威"三维度，构建深度内容策略'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* 业态选择器 */}
          <div className="space-y-2">
            <Label style={{ color: "#3D2B1F", fontWeight: 600 }} className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              选择门店业态
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STORE_FORMATS.map((store) => {
                const isActive = storeFormat === store.key
                return (
                  <button
                    key={store.key}
                    onClick={() => setStoreFormat(store.key)}
                    className="flex flex-col items-start p-4 rounded-xl transition-all duration-200 text-left"
                    style={{
                      background: isActive ? store.bg : "rgba(45,90,39,0.03)",
                      border: isActive ? `2px solid ${store.color}` : "2px solid rgba(45,90,39,0.12)",
                      boxShadow: isActive ? `0 0 0 3px ${store.color}15` : "none",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{store.icon}</span>
                      <span className="font-bold text-sm" style={{ color: isActive ? store.color : "#5C3D1E" }}>
                        {store.label}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: "rgba(45,90,39,0.6)" }}>
                      {store.desc}
                    </div>
                    <div
                      className="text-xs mt-2 px-2 py-0.5 rounded-full"
                      style={{ background: `${store.color}10`, color: store.color }}
                    >
                      {store.anchor}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 矩阵模式切换 */}
          <div className="flex items-center gap-3">
            <Label style={{ color: "#3D2B1F", fontWeight: 600 }}>矩阵模式</Label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid rgba(45,90,39,0.2)" }}>
              <button
                onClick={() => setMatrixMode("3h")}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  background: matrixMode === "3h" ? "#2D5A27" : "white",
                  color: matrixMode === "3h" ? "white" : "#2D5A27",
                }}
              >
                3H九宫格（小红书推荐）
              </button>
              <button
                onClick={() => setMatrixMode("classic")}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  background: matrixMode === "classic" ? "#2D5A27" : "white",
                  color: matrixMode === "classic" ? "white" : "#2D5A27",
                }}
              >
                经典三列（通用）
              </button>
            </div>
          </div>

          {/* 支柱标签 */}
          <div className="space-y-2">
            <Label style={{ color: "#3D2B1F", fontWeight: 600 }}>您选择的内容支柱</Label>
            <div className="flex gap-2 flex-wrap">
              {pillars.map((p: any, i) => {
                const name = typeof p === 'string' ? p : p.pillar
                const src = typeof p === 'string' ? '' : p.source
                return (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5"
                    style={{
                      background: `${PILLAR_COLORS[i]}15`,
                      color: PILLAR_COLORS[i],
                      border: `1.5px solid ${PILLAR_COLORS[i]}30`,
                    }}
                  >
                    {name}
                    {src && (
                      <span className="text-xs opacity-60 font-normal">{src}</span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full h-12 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: isLoading
                ? "rgba(232,130,10,0.4)"
                : "linear-gradient(135deg, #E8820A 0%, #F59E0B 100%)",
              boxShadow: isLoading ? "none" : "0 4px 16px rgba(232,130,10,0.35)",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 生成矩阵中，请稍候...
              </>
            ) : matrix.length > 0 ? (
              <>
                <RefreshCw className="w-4 h-4" />
                重新生成矩阵
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 生成{matrixMode === '3h' ? '三业态' : ''}九宫格矩阵
              </>
            )}
          </button>

          {error && (
            <div
              className="p-4 rounded-xl text-sm"
              style={{
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.2)",
                color: "#DC2626",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* 3H九宫格矩阵表格 */}
      {matrix.length > 0 && is3HMatrix && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(45,90,39,0.12)",
            boxShadow: "0 4px 24px rgba(45,90,39,0.08)",
          }}
        >
          {matrix.map((row, rowIndex) => (
            <div key={rowIndex} className="mb-4 last:mb-0">
              {/* 支柱标题 */}
              <div
                className="px-5 py-3 font-bold text-sm"
                style={{
                  background: `${PILLAR_COLORS[rowIndex]}10`,
                  color: PILLAR_COLORS[rowIndex],
                  borderBottom: `2px solid ${PILLAR_COLORS[rowIndex]}30`,
                }}
              >
                {row.pillar}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th className="w-[100px] p-3" style={{ background: "#F9FAFB" }}></th>
                      {XHS_3H_COL_CONFIG.map((col) => (
                        <th key={col.key} className="p-3 text-left" style={{ background: col.bg }}>
                          <div className="flex items-center gap-1.5">
                            <span>{col.icon}</span>
                            <span className="font-bold text-xs" style={{ color: col.color }}>{col.label}</span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: `${col.color}80` }}>{col.desc}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {XHS_3H_ROW_CONFIG.map((hRow) => (
                      <tr key={hRow.key}>
                        <td className="p-3 align-top" style={{ background: hRow.bg }}>
                          <div className="flex items-center gap-1">
                            <span>{hRow.icon}</span>
                            <span className="font-bold text-xs" style={{ color: hRow.color }}>{hRow.label}</span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: `${hRow.color}80` }}>{hRow.desc}</div>
                        </td>
                        {XHS_3H_COL_CONFIG.map((col) => {
                          const cellKey = `${hRow.key}_${col.key}` as keyof MatrixRow
                          const cell = (row as any)[cellKey] as MatrixCell | undefined
                          if (!cell) return <td key={col.key} className="p-3">-</td>
                          return (
                            <td key={col.key} className="p-3 align-top" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                              <div className="space-y-2">
                                <Input
                                  value={cell.title}
                                  onChange={(e) => updateCell(rowIndex, cellKey, "title", e.target.value)}
                                  className="font-semibold text-xs rounded-lg h-8"
                                  style={{ border: `1px solid ${hRow.color}30`, background: "white" }}
                                  placeholder="策略标题"
                                />
                                <Textarea
                                  value={cell.explanation}
                                  onChange={(e) => updateCell(rowIndex, cellKey, "explanation", e.target.value)}
                                  className="text-xs min-h-[40px] rounded-lg"
                                  style={{ border: `1px solid ${hRow.color}30`, background: "white" }}
                                  placeholder="策略解释"
                                />
                                <div className="space-y-1">
                                  {cell.ideas.map((idea, ideaIdx) => (
                                    <div key={ideaIdx} className="flex gap-1 items-start">
                                      <span className="text-xs font-bold mt-1.5 w-3 flex-shrink-0" style={{ color: hRow.color }}>
                                        {ideaIdx + 1}.
                                      </span>
                                      <Input
                                        value={idea}
                                        onChange={(e) => {
                                          const newIdeas = [...cell.ideas]
                                          newIdeas[ideaIdx] = e.target.value
                                          updateCell(rowIndex, cellKey, "ideas", newIdeas)
                                        }}
                                        className="text-xs h-7 rounded"
                                        style={{ border: `1px solid ${col.color}20`, background: "white" }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 经典三列矩阵表格 */}
      {matrix.length > 0 && !is3HMatrix && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(45,90,39,0.12)",
            boxShadow: "0 4px 24px rgba(45,90,39,0.08)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th
                    className="p-4 text-left"
                    style={{
                      background: "linear-gradient(135deg, #1E3D1A, #2D5A27)",
                      color: "white",
                      width: "140px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}
                  >
                    内容支柱
                  </th>
                  {COL_CONFIG.map((col) => (
                    <th
                      key={col.key}
                      className="p-4 text-left"
                      style={{
                        background: col.headerBg,
                        borderLeft: `3px solid ${col.headerBorder}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{col.icon}</span>
                        <span className="font-bold text-sm" style={{ color: col.headerText }}>
                          {col.label}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: `${col.badgeColor}15`, color: col.badgeColor }}
                        >
                          {col.en}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: `${col.headerText}80` }}>
                        {col.desc}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td
                      className="p-4 align-top"
                      style={{
                        background: `${PILLAR_COLORS[rowIndex]}08`,
                        borderTop: "1px solid rgba(45,90,39,0.08)",
                        borderRight: `3px solid ${PILLAR_COLORS[rowIndex]}40`,
                      }}
                    >
                      <div
                        className="font-bold text-sm leading-tight"
                        style={{ color: PILLAR_COLORS[rowIndex] }}
                      >
                        {row.pillar}
                      </div>
                    </td>
                    {COL_CONFIG.map((col) => (
                      <td
                        key={col.key}
                        className="p-4 align-top"
                        style={{
                          background: col.cellBg,
                          borderTop: "1px solid rgba(45,90,39,0.06)",
                          borderLeft: `1px solid ${col.headerBorder}20`,
                        }}
                      >
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-semibold mb-1" style={{ color: col.headerText }}>
                              策略标题
                            </div>
                            <Input
                              value={row[col.key].title}
                              onChange={(e) => updateCell(rowIndex, col.key, "title", e.target.value)}
                              className="font-semibold text-sm rounded-lg"
                              style={{ border: `1.5px solid ${col.headerBorder}30`, background: "white" }}
                            />
                          </div>
                          <div>
                            <div className="text-xs font-semibold mb-1" style={{ color: col.headerText }}>
                              策略解释
                            </div>
                            <Textarea
                              value={row[col.key].explanation}
                              onChange={(e) => updateCell(rowIndex, col.key, "explanation", e.target.value)}
                              className="text-sm min-h-[60px] rounded-lg"
                              style={{ border: `1.5px solid ${col.headerBorder}30`, background: "white" }}
                            />
                          </div>
                          <div
                            className="p-3 rounded-xl space-y-2"
                            style={{ background: col.ideaBg }}
                          >
                            <div
                              className="flex items-center gap-1 text-xs font-semibold"
                              style={{ color: col.headerText }}
                            >
                              <Lightbulb className="h-3 w-3" />
                              内容创意
                            </div>
                            {row[col.key].ideas.map((idea, ideaIndex) => (
                              <div key={ideaIndex} className="flex gap-2 items-start">
                                <span
                                  className="text-xs font-bold mt-2 w-4 flex-shrink-0"
                                  style={{ color: col.headerText }}
                                >
                                  {ideaIndex + 1}.
                                </span>
                                <Textarea
                                  value={idea}
                                  onChange={(e) => {
                                    const newIdeas = [...row[col.key].ideas]
                                    newIdeas[ideaIndex] = e.target.value
                                    updateCell(rowIndex, col.key, "ideas", newIdeas)
                                  }}
                                  className="text-sm h-9 min-h-[36px] py-1 rounded-lg"
                                  style={{ border: `1.5px solid ${col.headerBorder}30`, background: "white" }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 h-11 rounded-xl font-semibold transition-all duration-200"
          style={{
            background: "white",
            border: "1.5px solid rgba(45,90,39,0.2)",
            color: "#2D5A27",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          返回上一步
        </button>
        <button
          onClick={handleConfirm}
          disabled={matrix.length === 0}
          className="flex-1 h-11 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background:
              matrix.length === 0
                ? "rgba(45,90,39,0.25)"
                : "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #4A8A42 100%)",
            boxShadow: matrix.length === 0 ? "none" : "0 4px 16px rgba(45,90,39,0.35)",
            cursor: matrix.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          确认策略矩阵，进入下一步
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

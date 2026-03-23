"use client"

import * as React from "react"
import { Loader2, Lightbulb, RefreshCw, Grid3X3, ArrowLeft, ArrowRight, Sparkles } from "lucide-react"
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
}

interface Step2MatrixProps {
  pillars: PillarItem[] | string[]
  mode?: "brand" | "product"
  productId?: string
  onConfirm: (matrix: MatrixRow[]) => void
  onBack: () => void
}

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

const PILLAR_COLORS = ["#2D5A27", "#E8820A", "#3B4FA8"]

export function Step2Matrix({ pillars, mode, productId, onConfirm, onBack }: Step2MatrixProps) {
  const [matrix, setMatrix] = React.useState<MatrixRow[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // 将支柱数据序列化为完整对象（兼容旧版字符串格式）
      const pillarsPayload = pillars.map((p: any) =>
        typeof p === 'string' ? { pillar: p, source: 'A-痛点' } : p
      )
      const response = await fetchWithAIConfig("/api/generate/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillars: pillarsPayload, mode, productId }),
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
    colKey: "growth" | "knowledge" | "authority",
    field: keyof MatrixCell,
    value: any
  ) => {
    const newMatrix = [...matrix]
    const cell = newMatrix[rowIndex][colKey]
    if (field === "ideas") {
      cell.ideas = value
    } else {
      // @ts-ignore
      cell[field] = value
    }
    setMatrix(newMatrix)
  }

  const handleConfirm = () => {
    if (matrix.length > 0) onConfirm(matrix)
  }

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
                基于"增长 · 知识 · 权威"三维度，构建深度内容策略
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
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
                AI 生成九宫格矩阵
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

      {/* 矩阵表格 */}
      {matrix.length > 0 && (
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
                  {/* 左上角 */}
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
                    {/* 支柱标签列 */}
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

                    {/* 内容单元格 */}
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

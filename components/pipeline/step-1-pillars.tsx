"use client"

import * as React from "react"
import { Loader2, Leaf, Sparkles, ArrowRight, Package, Building2, Tag, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { KnowledgeBaseData, ProductItem } from "@/lib/knowledge"
import { fetchWithAIConfig } from "@/lib/ai-client-frontend"

export interface PillarItem {
  pillar: string
  source: string
  rationale?: string
}

interface Step1PillarsProps {
  onConfirm: (pillars: PillarItem[], mode?: string, productId?: string, category?: string) => void
}

const PILLAR_COLORS = [
  { bg: "#EBF5E9", border: "#4A8A42", text: "#2D5A27", label: "支柱一" },
  { bg: "#FFF8E7", border: "#E8820A", text: "#B85C00", label: "支柱二" },
  { bg: "#EBF5E9", border: "#4A8A42", text: "#2D5A27", label: "支柱三" },
]

// 话题类别配置
const TOPIC_CATEGORIES = [
  { key: "brand", label: "品牌整体", icon: "🌿", desc: "灵芝水铺品牌故事与价值观" },
  { key: "herbal_tea", label: "草本茶饮", icon: "🍵", desc: "草本茶饮系列产品" },
  { key: "herbal_coffee", label: "草本咖啡", icon: "☕", desc: "草本咖啡系列产品" },
  { key: "explore", label: "探店打卡", icon: "📍", desc: "门店体验与探店内容" },
  { key: "health", label: "养生科普", icon: "💊", desc: "健康养生知识科普" },
  { key: "lifestyle", label: "生活方式", icon: "✨", desc: "都市健康生活方式" },
]

export function Step1Pillars({ onConfirm }: Step1PillarsProps) {
  const [mode, setMode] = React.useState<"brand" | "product">("brand")
  const [selectedProduct, setSelectedProduct] = React.useState<string>("")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("brand")
  const [pillars, setPillars] = React.useState<PillarItem[]>([])
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [products, setProducts] = React.useState<ProductItem[]>([])

  React.useEffect(() => {
    fetch("/api/knowledge")
      .then((res) => res.json())
      .then((data: KnowledgeBaseData) => {
        if (data && data.products) setProducts(data.products)
      })
      .catch(() => toast.error("加载产品列表失败，请刷新页面重试"))
  }, [])

  // 当选择产品时，自动匹配分类
  React.useEffect(() => {
    if (mode === "product" && selectedProduct) {
      const product = products.find((p) => p.name === selectedProduct || p.id === selectedProduct)
      if (product) {
        const cat = product.category?.toLowerCase() || ""
        if (cat.includes("咖啡")) setSelectedCategory("herbal_coffee")
        else if (cat.includes("茶")) setSelectedCategory("herbal_tea")
        else setSelectedCategory("brand")
      }
    }
  }, [selectedProduct, mode, products])

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchWithAIConfig("/api/generate/pillars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          productId: mode === "product" ? selectedProduct : undefined,
          category: selectedCategory,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        if (response.status === 401) {
          throw new Error(errData.error || "请先配置 AI 模型")
        }
        throw new Error(errData.error || `请求失败 (${response.status})`)
      }
      const data = await response.json()
      if (data.pillars && Array.isArray(data.pillars)) {
        const newPillars: PillarItem[] = data.pillars.slice(0, 3).map((p: any) => {
          if (typeof p === 'string') return { pillar: p, source: 'A-痛点', rationale: '' }
          return { pillar: p.pillar || String(p), source: p.source || 'A-痛点', rationale: p.rationale || '' }
        })
        while (newPillars.length < 3) newPillars.push({ pillar: '', source: 'A-痛点', rationale: '' })
        setPillars(newPillars)
        toast.success("内容支柱生成成功，请审查并编辑")
      } else {
        throw new Error("AI 返回格式异常，请重试")
      }
    } catch (err: any) {
      const msg = err.message || "生成失败，请检查 AI 模型配置后重试"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePillarChange = (index: number, value: string) => {
    const newPillars = [...pillars]
    newPillars[index] = { ...newPillars[index], pillar: value }
    setPillars(newPillars)
  }

  const handleConfirm = () => {
    if (pillars.length === 3 && pillars.every((p) => p.pillar.trim() !== "")) {
      onConfirm(pillars, mode, selectedProduct, selectedCategory)
    }
  }

  const canConfirm = pillars.length === 3 && pillars.every((p) => p.pillar.trim() !== "")
  const canGenerate = mode === "brand" || (mode === "product" && !!selectedProduct)

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* 卡片主体 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid rgba(45,90,39,0.12)",
          boxShadow: "0 4px 24px rgba(45,90,39,0.08), 0 1px 4px rgba(45,90,39,0.04)",
        }}
      >
        {/* 卡片头部 */}
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
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2
                className="font-bold text-lg"
                style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}
              >
                步骤一：定义内容支柱
              </h2>
              <p className="text-sm" style={{ color: "#8B6B4A" }}>
                选择话题类别与生成模式，让 AI 精准生成营销支柱
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 话题类别选择 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" style={{ color: "#2D5A27" }} />
              <Label style={{ color: "#3D2B1F", fontWeight: 600 }}>话题类别</Label>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#EBF5E9", color: "#2D5A27" }}
              >
                影响生成方向
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOPIC_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className="flex items-center gap-2 p-3 rounded-xl text-left transition-all duration-200"
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, #EBF5E9, #F5FAF4)"
                        : "rgba(45,90,39,0.03)",
                      border: isActive
                        ? "2px solid #2D5A27"
                        : "2px solid rgba(45,90,39,0.1)",
                      boxShadow: isActive ? "0 0 0 3px rgba(45,90,39,0.08)" : "none",
                    }}
                  >
                    <span className="text-lg leading-none">{cat.icon}</span>
                    <div className="min-w-0">
                      <div
                        className="text-xs font-bold truncate"
                        style={{ color: isActive ? "#1E3D1A" : "#5C3D1E" }}
                      >
                        {cat.label}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "rgba(45,90,39,0.5)" }}
                      >
                        {cat.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 分割线 */}
          <div style={{ borderTop: "1px solid rgba(45,90,39,0.08)" }} />

          {/* 生成模式选择 */}
          <div className="space-y-3">
            <Label style={{ color: "#3D2B1F", fontWeight: 600 }}>生成模式</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "brand", icon: Building2, label: "品牌整体", desc: "基于整体品牌定位生成" },
                { key: "product", icon: Package, label: "指定产品", desc: "针对特定产品深度分析" },
              ].map((item) => {
                const Icon = item.icon
                const isActive = mode === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setMode(item.key as "brand" | "product")}
                    className="flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200"
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, #EBF5E9, #F5FAF4)"
                        : "rgba(45,90,39,0.03)",
                      border: isActive
                        ? "2px solid #2D5A27"
                        : "2px solid rgba(45,90,39,0.12)",
                      boxShadow: isActive ? "0 0 0 3px rgba(45,90,39,0.08)" : "none",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isActive
                          ? "linear-gradient(135deg, #2D5A27, #4A8A42)"
                          : "rgba(45,90,39,0.08)",
                      }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{ color: isActive ? "white" : "rgba(45,90,39,0.5)" }}
                      />
                    </div>
                    <div>
                      <div
                        className="font-semibold text-sm"
                        style={{ color: isActive ? "#1E3D1A" : "#8B6B4A" }}
                      >
                        {item.label}
                      </div>
                      <div className="text-xs" style={{ color: "rgba(45,90,39,0.5)" }}>
                        {item.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 产品选择 */}
          {mode === "product" && (
            <div className="space-y-2">
              <Label style={{ color: "#3D2B1F", fontWeight: 600 }}>选择产品</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger
                  className="h-11 rounded-xl"
                  style={{ border: "1.5px solid rgba(45,90,39,0.2)", background: "white" }}
                >
                  <SelectValue placeholder="请选择一个产品" />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      暂无产品，请先在知识库中添加
                    </SelectItem>
                  ) : (
                    products.map((product) => (
                      <SelectItem key={product.id} value={product.name}>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(45,90,39,0.08)",
                              color: "#2D5A27",
                            }}
                          >
                            {product.category || "产品"}
                          </span>
                          {product.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 当前选择摘要 */}
          <div
            className="flex items-center gap-2 p-3 rounded-xl text-xs"
            style={{
              background: "rgba(45,90,39,0.04)",
              border: "1px solid rgba(45,90,39,0.1)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#E8820A" }} />
            <span style={{ color: "#5C3D1E" }}>
              将生成：
              <strong style={{ color: "#1E3D1A" }}>
                {TOPIC_CATEGORIES.find((c) => c.key === selectedCategory)?.label}
              </strong>
              {" · "}
              <strong style={{ color: "#1E3D1A" }}>
                {mode === "brand"
                  ? "品牌整体"
                  : selectedProduct
                  ? selectedProduct
                  : "请选择产品"}
              </strong>
              {" "}方向的内容支柱
            </span>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={isLoading || !canGenerate}
            className="w-full h-12 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background:
                isLoading || !canGenerate
                  ? "rgba(45,90,39,0.35)"
                  : "linear-gradient(135deg, #E8820A 0%, #F59E0B 100%)",
              boxShadow:
                isLoading || !canGenerate
                  ? "none"
                  : "0 4px 16px rgba(232,130,10,0.35)",
              cursor: isLoading || !canGenerate ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 生成中，请稍候...
              </>
            ) : pillars.length > 0 ? (
              <>
                <RefreshCw className="w-4 h-4" />
                重新生成内容支柱
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 生成内容支柱
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div
              className="p-4 rounded-xl text-sm"
              style={{
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.2)",
                color: "#DC2626",
              }}
            >
              <p className="font-medium">{error}</p>
              <p className="text-xs mt-1 opacity-70">
                请检查右上角的 AI 模型配置是否正确填写了 API Key。
              </p>
            </div>
          )}

          {/* 支柱编辑区 */}
          {pillars.length > 0 && (
            <div
              className="space-y-4 pt-5"
              style={{ borderTop: "1px solid rgba(45,90,39,0.1)" }}
            >
              <div className="flex items-center gap-2">
                <Label style={{ color: "#3D2B1F", fontWeight: 600 }}>审查与编辑支柱</Label>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#EBF5E9", color: "#2D5A27" }}
                >
                  可直接修改
                </span>
              </div>
              {pillars.map((pillarItem, index) => {
                const color = PILLAR_COLORS[index]
                return (
                  <div
                    key={index}
                    className="rounded-xl p-4"
                    style={{ background: color.bg, border: `1.5px solid ${color.border}30` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold tracking-wider" style={{ color: color.text }}>
                        {color.label}
                      </div>
                      {pillarItem.source && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${color.border}20`, color: color.text }}
                        >
                          {pillarItem.source}
                        </span>
                      )}
                    </div>
                    <Input
                      value={pillarItem.pillar}
                      onChange={(e) => handlePillarChange(index, e.target.value)}
                      placeholder={`请输入支柱 ${index + 1}`}
                      className="rounded-lg"
                      style={{
                        background: "white",
                        border: `1.5px solid ${color.border}40`,
                        color: "#1E3D1A",
                        fontWeight: 500,
                      }}
                    />
                    {pillarItem.rationale && (
                      <p className="text-xs mt-1.5" style={{ color: color.text, opacity: 0.75 }}>
                        {pillarItem.rationale}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 确认按钮 */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="w-full h-12 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
        style={{
          background: canConfirm
            ? "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #4A8A42 100%)"
            : "rgba(45,90,39,0.25)",
          boxShadow: canConfirm ? "0 4px 16px rgba(45,90,39,0.35)" : "none",
          cursor: canConfirm ? "pointer" : "not-allowed",
        }}
      >
        确认内容支柱，进入下一步
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

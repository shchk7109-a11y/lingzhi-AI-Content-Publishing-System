"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Save, Plus, Trash2, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

import {
  KnowledgeBaseData,
  BrandInfo,
  FounderInfo,
  ProductItem,
  CustomerPersona,
  BrandTasteAdvantage,
  UniversalPersona,
  ProductTasteAdvantage,
} from "@/lib/knowledge"
import { PromptsConfig } from "@/lib/prompts"

// ─────────────────────────────────────────────
// Default helpers
// ─────────────────────────────────────────────
const defaultBrandTasteAdvantage = (): BrandTasteAdvantage => ({
  core_positioning: "",
  vs_milk_tea: { summary: "", details: [] },
  vs_traditional_herbal: { summary: "", details: [] },
  technology_advantage: "",
  brand_promise: "",
})

const defaultUniversalPersona = (): UniversalPersona => ({
  type: "新人群",
  age: "",
  description: "",
  pain_points: [],
  trigger: "",
})

const defaultProductTasteAdvantage = (): ProductTasteAdvantage => ({
  category_taste_advantage: "",
  core_selling_points: [],
  key_phrases: [],
  objection_handling: {},
})

// ─────────────────────────────────────────────
// Sub-component: Brand Taste Advantage Editor
// ─────────────────────────────────────────────
function BrandTasteAdvantageEditor({
  value,
  onChange,
}: {
  value: BrandTasteAdvantage
  onChange: (v: BrandTasteAdvantage) => void
}) {
  const update = (field: keyof BrandTasteAdvantage, val: any) =>
    onChange({ ...value, [field]: val })

  return (
    <div className="space-y-5 p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
      <div className="space-y-2">
        <Label className="text-amber-800 font-semibold">核心口感定位</Label>
        <Textarea
          value={value.core_positioning}
          onChange={(e) => update("core_positioning", e.target.value)}
          rows={3}
          placeholder="例如：不苦不涩，甘甜顺滑，像喝一杯精品茶饮..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* vs 奶茶 */}
        <div className="space-y-2 p-3 bg-white rounded-md border">
          <Label className="text-sm font-semibold text-rose-700">对比奶茶 (vs 奶茶)</Label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">一句话总结</Label>
            <Input
              value={value.vs_milk_tea.summary}
              onChange={(e) =>
                update("vs_milk_tea", { ...value.vs_milk_tea, summary: e.target.value })
              }
              placeholder="例如：同样好喝，但不含糖精和奶精"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">详细对比点（每行一条）</Label>
            <Textarea
              value={(value.vs_milk_tea.details || []).join("\n")}
              onChange={(e) =>
                update("vs_milk_tea", {
                  ...value.vs_milk_tea,
                  details: e.target.value.split("\n").filter((s) => s.trim()),
                })
              }
              rows={4}
              placeholder={"无糖精，不会有甜腻感\n无奶精，不会有腻口感\n..."}
            />
          </div>
        </div>

        {/* vs 传统草本 */}
        <div className="space-y-2 p-3 bg-white rounded-md border">
          <Label className="text-sm font-semibold text-green-700">对比传统草本 (vs 传统草本)</Label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">一句话总结</Label>
            <Input
              value={value.vs_traditional_herbal.summary}
              onChange={(e) =>
                update("vs_traditional_herbal", {
                  ...value.vs_traditional_herbal,
                  summary: e.target.value,
                })
              }
              placeholder="例如：无苦涩，无药味，像喝精品茶"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">详细对比点（每行一条）</Label>
            <Textarea
              value={(value.vs_traditional_herbal.details || []).join("\n")}
              onChange={(e) =>
                update("vs_traditional_herbal", {
                  ...value.vs_traditional_herbal,
                  details: e.target.value.split("\n").filter((s) => s.trim()),
                })
              }
              rows={4}
              placeholder={"不苦不涩，无需加糖\n不像中药，无药味\n..."}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-amber-800 font-semibold">技术/工艺优势</Label>
        <Textarea
          value={value.technology_advantage}
          onChange={(e) => update("technology_advantage", e.target.value)}
          rows={3}
          placeholder="例如：冷萃技术保留活性成分，低温萃取..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-amber-800 font-semibold">品牌口感承诺</Label>
        <Input
          value={value.brand_promise}
          onChange={(e) => update("brand_promise", e.target.value)}
          placeholder="例如：每一杯都经过30次配方迭代，好喝是我们的底线"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-component: Universal Personas Editor
// ─────────────────────────────────────────────
function UniversalPersonasEditor({
  value,
  onChange,
}: {
  value: UniversalPersona[]
  onChange: (v: UniversalPersona[]) => void
}) {
  const add = () => onChange([...value, defaultUniversalPersona()])

  const update = (idx: number, field: keyof UniversalPersona, val: any) => {
    const next = [...value]
    next[idx] = { ...next[idx], [field]: val }
    onChange(next)
  }

  const remove = (idx: number) => {
    if (!confirm("确定删除此人群画像？")) return
    const next = [...value]
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-amber-800 font-semibold">通用人群画像 (Universal Personas)</Label>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-3 w-3 mr-1" /> 添加人群
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground italic px-2">暂无通用人群画像，点击上方按钮添加。</p>
      )}

      <Accordion type="multiple" className="w-full space-y-2">
        {value.map((persona, idx) => (
          <AccordionItem
            key={idx}
            value={`up-${idx}`}
            className="border rounded-md px-3 bg-white"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                <span className="font-medium text-sm">{persona.type || "未命名人群"}</span>
                {persona.age && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {persona.age}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="link"
                  size="sm"
                  className="text-destructive h-auto p-0"
                  onClick={() => remove(idx)}
                >
                  删除此人群
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">人群类型</Label>
                  <Input
                    value={persona.type}
                    onChange={(e) => update(idx, "type", e.target.value)}
                    placeholder="例如：忙碌的职场妈妈"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">年龄段</Label>
                  <Input
                    value={persona.age}
                    onChange={(e) => update(idx, "age", e.target.value)}
                    placeholder="例如：28-40岁"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">人群描述</Label>
                <Textarea
                  value={persona.description}
                  onChange={(e) => update(idx, "description", e.target.value)}
                  rows={2}
                  placeholder="简要描述该人群的特征..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">核心痛点（每行一条）</Label>
                <Textarea
                  value={(persona.pain_points || []).join("\n")}
                  onChange={(e) =>
                    update(
                      idx,
                      "pain_points",
                      e.target.value.split("\n").filter((s) => s.trim())
                    )
                  }
                  rows={3}
                  placeholder={"痛点1\n痛点2\n..."}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">购买触发点</Label>
                <Input
                  value={persona.trigger}
                  onChange={(e) => update(idx, "trigger", e.target.value)}
                  placeholder="例如：看到朋友分享后产生好奇心..."
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-component: Product Taste Advantage Editor
// ─────────────────────────────────────────────
function ProductTasteAdvantageEditor({
  value,
  onChange,
}: {
  value: ProductTasteAdvantage
  onChange: (v: ProductTasteAdvantage) => void
}) {
  const update = (field: keyof ProductTasteAdvantage, val: any) =>
    onChange({ ...value, [field]: val })

  // objection_handling: Record<string, string>
  const objHandlingEntries = Object.entries(value.objection_handling || {})

  const updateObjKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(value.objection_handling || {})) {
      next[k === oldKey ? newKey : k] = v
    }
    update("objection_handling", next)
  }

  const updateObjVal = (key: string, val: string) => {
    update("objection_handling", { ...(value.objection_handling || {}), [key]: val })
  }

  const addObjEntry = () => {
    const key = `异议${objHandlingEntries.length + 1}`
    update("objection_handling", { ...(value.objection_handling || {}), [key]: "" })
  }

  const removeObjEntry = (key: string) => {
    const next = { ...(value.objection_handling || {}) }
    delete next[key]
    update("objection_handling", next)
  }

  return (
    <div className="space-y-4 p-4 bg-teal-50/50 border border-teal-200 rounded-lg mt-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base font-semibold text-teal-800">口感优势数据 (Taste Advantage)</span>
        <Badge variant="secondary" className="text-xs">AI提示词注入</Badge>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-teal-700 font-semibold">该品类口感优势（一段话）</Label>
        <Textarea
          value={value.category_taste_advantage}
          onChange={(e) => update("category_taste_advantage", e.target.value)}
          rows={3}
          placeholder="例如：草本茶饮系列采用冷萃工艺，保留植物活性成分，口感清甜不苦涩..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-teal-700 font-semibold">核心卖点（每行一条）</Label>
        <Textarea
          value={(value.core_selling_points || []).join("\n")}
          onChange={(e) =>
            update(
              "core_selling_points",
              e.target.value.split("\n").filter((s) => s.trim())
            )
          }
          rows={4}
          placeholder={"卖点1：...\n卖点2：...\n..."}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-teal-700 font-semibold">关键话术短语（每行一条）</Label>
        <Textarea
          value={(value.key_phrases || []).join("\n")}
          onChange={(e) =>
            update(
              "key_phrases",
              e.target.value.split("\n").filter((s) => s.trim())
            )
          }
          rows={3}
          placeholder={"\"甘甜顺滑，喝完还想喝\"\n\"不像中药，更像精品茶\"\n..."}
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs text-teal-700 font-semibold">口感异议处理（问题 → 回答）</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addObjEntry}>
            <Plus className="h-3 w-3 mr-1" /> 添加异议
          </Button>
        </div>
        {objHandlingEntries.length === 0 && (
          <p className="text-xs text-muted-foreground italic">暂无异议处理条目。</p>
        )}
        <div className="space-y-2">
          {objHandlingEntries.map(([key, val]) => (
            <div key={key} className="flex gap-2 items-start">
              <Input
                className="w-1/3 h-8 text-xs"
                value={key}
                onChange={(e) => updateObjKey(key, e.target.value)}
                placeholder="异议问题"
              />
              <Input
                className="flex-1 h-8 text-xs"
                value={val}
                onChange={(e) => updateObjVal(key, e.target.value)}
                placeholder="回答话术"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => removeObjEntry(key)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const [data, setData] = React.useState<KnowledgeBaseData | null>(null)
  const [prompts, setPrompts] = React.useState<PromptsConfig | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch("/api/knowledge").then((res) => res.json()),
      fetch("/api/prompts").then((res) => res.json()),
    ])
      .then(([knowledgeData, promptsData]) => {
        setData(knowledgeData)
        setPrompts(promptsData)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load data", err)
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    if (!data || !prompts) return
    setSaving(true)
    try {
      await Promise.all([
        fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
        fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prompts),
        }),
      ])
      toast.success("知识库与提示词已保存！")
    } catch (err) {
      console.error(err)
      toast.error("保存失败，请重试。")
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers ──────────────────────────────────
  const updateBrand = (field: keyof BrandInfo, value: any) =>
    setData((prev) => (prev ? { ...prev, brand: { ...prev.brand, [field]: value } } : null))

  const updateFounder = (field: keyof FounderInfo, value: string) =>
    setData((prev) =>
      prev ? { ...prev, founder: { ...prev.founder, [field]: value } } : null
    )

  const updatePrompt = (field: keyof PromptsConfig, value: string) =>
    setPrompts((prev) => (prev ? { ...prev, [field]: value } : null))

  const addProduct = () => {
    const newProduct: ProductItem = {
      id: Date.now().toString(),
      name: "新产品",
      category: "",
      ingredients: "",
      function: "",
      value_proposition: "",
      target_audience: "",
      personas: [],
    }
    setData((prev) => (prev ? { ...prev, products: [...prev.products, newProduct] } : null))
  }

  const updateProduct = (index: number, field: keyof ProductItem, value: any) => {
    setData((prev) => {
      if (!prev) return null
      const newProducts = [...prev.products]
      newProducts[index] = { ...newProducts[index], [field]: value }
      return { ...prev, products: newProducts }
    })
  }

  const deleteProduct = (index: number) => {
    if (!confirm("确定删除此产品吗？")) return
    setData((prev) => {
      if (!prev) return null
      const newProducts = [...prev.products]
      newProducts.splice(index, 1)
      return { ...prev, products: newProducts }
    })
  }

  const addPersona = (productIndex: number) => {
    const newPersona: CustomerPersona = {
      role: "新画像",
      demographics: "",
      pain_points: ["", "", "", "", ""],
      unsolved_reasons: ["", "", "", "", ""],
      objections: ["", "", "", "", ""],
      marketing_angles: ["", "", "", "", ""],
    }
    setData((prev) => {
      if (!prev) return null
      const newProducts = [...prev.products]
      if (!newProducts[productIndex].personas) newProducts[productIndex].personas = []
      newProducts[productIndex].personas.push(newPersona)
      return { ...prev, products: newProducts }
    })
  }

  const updatePersona = (
    prodIdx: number,
    pIdx: number,
    field: keyof CustomerPersona,
    value: any
  ) => {
    setData((prev) => {
      if (!prev) return null
      const newProducts = [...prev.products]
      const newPersonas = [...newProducts[prodIdx].personas]
      newPersonas[pIdx] = { ...newPersonas[pIdx], [field]: value }
      newProducts[prodIdx].personas = newPersonas
      return { ...prev, products: newProducts }
    })
  }

  const updatePersonaArrayItem = (
    prodIdx: number,
    pIdx: number,
    field: keyof CustomerPersona,
    arrIdx: number,
    value: string
  ) => {
    setData((prev) => {
      if (!prev) return null
      const newProducts = [...prev.products]
      const newPersonas = [...newProducts[prodIdx].personas]
      const newArray = [...(newPersonas[pIdx][field] as string[])]
      newArray[arrIdx] = value
      // @ts-ignore
      newPersonas[pIdx][field] = newArray
      newProducts[prodIdx].personas = newPersonas
      return { ...prev, products: newProducts }
    })
  }

  const deletePersona = (prodIdx: number, pIdx: number) => {
    if (!confirm("确定删除此画像吗？")) return
    setData((prev) => {
      if (!prev) return null
      const newProducts = [...prev.products]
      newProducts[prodIdx].personas.splice(pIdx, 1)
      return { ...prev, products: newProducts }
    })
  }

  // ── Render ────────────────────────────────────
  if (loading || !data || !prompts) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">知识库管理 (Knowledge Base)</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" /> 保存更改
        </Button>
      </div>

      <Tabs defaultValue="brand" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="brand">品牌信息</TabsTrigger>
          <TabsTrigger value="founder">创始人信息</TabsTrigger>
          <TabsTrigger value="products">产品与客户画像</TabsTrigger>
          <TabsTrigger value="prompts">提示词配置</TabsTrigger>
        </TabsList>

        {/* ── Brand Tab ── */}
        <TabsContent value="brand">
          <div className="space-y-6">
            {/* Basic Brand Info */}
            <Card>
              <CardHeader>
                <CardTitle>品牌基本信息</CardTitle>
                <CardDescription>定义品牌的核心故事与价值观。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>品牌名称</Label>
                  <Input
                    value={data.brand.name}
                    onChange={(e) => updateBrand("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>品牌故事</Label>
                  <Textarea
                    value={data.brand.story}
                    onChange={(e) => updateBrand("story", e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>品牌愿景</Label>
                  <Textarea
                    value={data.brand.vision}
                    onChange={(e) => updateBrand("vision", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>核心价值观 (逗号分隔)</Label>
                  <Textarea
                    value={data.brand.core_values.join(", ")}
                    onChange={(e) =>
                      updateBrand(
                        "core_values",
                        e.target.value.split(",").map((s) => s.trim())
                      )
                    }
                    rows={3}
                    placeholder="例如：药食同源，天然，高效，便捷"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Brand Taste Advantage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  品牌口感优势
                  <Badge className="bg-amber-500 text-white text-xs font-normal">AI注入</Badge>
                </CardTitle>
                <CardDescription>
                  品牌级口感差异化数据，将自动注入到内容支柱和九宫格矩阵的 AI 提示词中。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BrandTasteAdvantageEditor
                  value={data.brand.taste_advantage ?? defaultBrandTasteAdvantage()}
                  onChange={(v) => updateBrand("taste_advantage", v)}
                />
              </CardContent>
            </Card>

            {/* Universal Personas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  通用人群画像
                  <Badge className="bg-amber-500 text-white text-xs font-normal">AI注入</Badge>
                </CardTitle>
                <CardDescription>
                  跨产品的通用客户人群，将作为背景信息注入 AI 提示词，帮助生成更精准的内容。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UniversalPersonasEditor
                  value={data.brand.universal_personas ?? []}
                  onChange={(v) => updateBrand("universal_personas", v)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Founder Tab ── */}
        <TabsContent value="founder">
          <Card>
            <CardHeader>
              <CardTitle>创始人背景</CardTitle>
              <CardDescription>
                创始人的个人经历往往是品牌故事的重要组成部分。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>创始人姓名</Label>
                <Input
                  value={data.founder.name}
                  onChange={(e) => updateFounder("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>创始人故事</Label>
                <Textarea
                  value={data.founder.story}
                  onChange={(e) => updateFounder("story", e.target.value)}
                  rows={4}
                  placeholder="描述创业初衷、关键转折点..."
                />
              </div>
              <div className="space-y-2">
                <Label>专业背景</Label>
                <Textarea
                  value={data.founder.background}
                  onChange={(e) => updateFounder("background", e.target.value)}
                  placeholder="职业经历、专业技能..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Products Tab ── */}
        <TabsContent value="products">
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={addProduct} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" /> 添加新产品
              </Button>
            </div>

            <Accordion type="multiple" className="w-full space-y-4">
              {data.products.map((product, pIndex) => (
                <AccordionItem
                  key={product.id || pIndex}
                  value={`product-${pIndex}`}
                  className="border rounded-lg px-4 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-4 text-left">
                      <span className="text-lg font-bold">{product.name || "新产品"}</span>
                      {product.category && (
                        <Badge variant="secondary" className="font-normal">
                          {product.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-normal">
                        ID: {product.id}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 px-1">
                    <div className="space-y-6">
                      {/* Header */}
                      <div className="flex justify-between items-start gap-4 p-4 bg-muted/20 rounded-md border">
                        <div className="space-y-1 flex-1">
                          <Label className="text-xs text-muted-foreground">产品名称</Label>
                          <Input
                            className="text-lg font-bold h-10"
                            value={product.name}
                            onChange={(e) => updateProduct(pIndex, "name", e.target.value)}
                            placeholder="输入产品名称"
                          />
                        </div>
                        <div className="pt-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProduct(pIndex)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> 删除产品
                          </Button>
                        </div>
                      </div>

                      {/* Product Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md">
                        <div className="space-y-1">
                          <Label className="text-xs">产品分类</Label>
                          <Select
                            value={product.category || ""}
                            onValueChange={(value) => updateProduct(pIndex, "category", value)}
                          >
                            <SelectTrigger className="h-10 bg-background">
                              <SelectValue placeholder="选择产品分类" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="草本茶饮">草本茶饮</SelectItem>
                              <SelectItem value="草本咖啡">草本咖啡</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">产品配方 (Ingredients)</Label>
                          <Textarea
                            value={product.ingredients || ""}
                            onChange={(e) =>
                              updateProduct(pIndex, "ingredients", e.target.value)
                            }
                            placeholder="例如：灵芝（吉林）、陈皮（新会）、枸杞..."
                            className="min-h-[40px] resize-none h-10 py-2"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">功能/功效</Label>
                          <Input
                            value={product.function}
                            onChange={(e) => updateProduct(pIndex, "function", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">价值主张 (Value Proposition)</Label>
                          <Input
                            value={product.value_proposition}
                            onChange={(e) =>
                              updateProduct(pIndex, "value_proposition", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-xs">目标受众 (概括)</Label>
                          <Input
                            value={product.target_audience}
                            onChange={(e) =>
                              updateProduct(pIndex, "target_audience", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      {/* Product Taste Advantage */}
                      <ProductTasteAdvantageEditor
                        value={product.taste_advantage ?? defaultProductTasteAdvantage()}
                        onChange={(v) => updateProduct(pIndex, "taste_advantage", v)}
                      />

                      {/* Personas */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold text-sm">
                            深度客户画像 (Customer Personas)
                          </h3>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => addPersona(pIndex)}
                          >
                            <Plus className="h-3 w-3 mr-1" /> 添加画像
                          </Button>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                          {(product.personas || []).map((persona, psIndex) => (
                            <AccordionItem key={psIndex} value={`item-${psIndex}`}>
                              <AccordionTrigger className="hover:no-underline py-2">
                                <div className="flex items-center gap-2 text-sm w-full text-left">
                                  <span className="font-medium shrink-0">
                                    {persona.role || "未命名画像"}
                                  </span>
                                  <span className="text-muted-foreground font-normal text-xs truncate max-w-[200px] hidden sm:inline-block">
                                    - {persona.demographics}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 bg-card border rounded-md space-y-4 mt-2">
                                <div className="flex justify-end">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="text-destructive h-auto p-0"
                                    onClick={() => deletePersona(pIndex, psIndex)}
                                  >
                                    删除此画像
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label>角色称呼</Label>
                                    <Input
                                      value={persona.role}
                                      onChange={(e) =>
                                        updatePersona(pIndex, psIndex, "role", e.target.value)
                                      }
                                      placeholder="例如：忙碌的职场妈妈"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>基本特性 (年龄/职业/兴趣)</Label>
                                    <Input
                                      value={persona.demographics}
                                      onChange={(e) =>
                                        updatePersona(
                                          pIndex,
                                          psIndex,
                                          "demographics",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <Label className="text-primary font-semibold">
                                      😩 5个痛点 (Pain Points)
                                    </Label>
                                    {persona.pain_points.map((pt, i) => (
                                      <Input
                                        key={i}
                                        value={pt}
                                        onChange={(e) =>
                                          updatePersonaArrayItem(
                                            pIndex,
                                            psIndex,
                                            "pain_points",
                                            i,
                                            e.target.value
                                          )
                                        }
                                        placeholder={`痛点 ${i + 1}`}
                                        className="h-8 text-sm"
                                      />
                                    ))}
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-amber-600 font-semibold">
                                      🚧 5个未解决原因 (Unsolved Reasons)
                                    </Label>
                                    {persona.unsolved_reasons.map((pt, i) => (
                                      <Input
                                        key={i}
                                        value={pt}
                                        onChange={(e) =>
                                          updatePersonaArrayItem(
                                            pIndex,
                                            psIndex,
                                            "unsolved_reasons",
                                            i,
                                            e.target.value
                                          )
                                        }
                                        placeholder={`原因 ${i + 1}`}
                                        className="h-8 text-sm"
                                      />
                                    ))}
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-destructive font-semibold">
                                      ✋ 5个反对意见 (Objections)
                                    </Label>
                                    {persona.objections.map((pt, i) => (
                                      <Input
                                        key={i}
                                        value={pt}
                                        onChange={(e) =>
                                          updatePersonaArrayItem(
                                            pIndex,
                                            psIndex,
                                            "objections",
                                            i,
                                            e.target.value
                                          )
                                        }
                                        placeholder={`反对意见 ${i + 1}`}
                                        className="h-8 text-sm"
                                      />
                                    ))}
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-green-600 font-semibold">
                                      🎯 5个营销角度 (Marketing Angles)
                                    </Label>
                                    {persona.marketing_angles.map((pt, i) => (
                                      <Input
                                        key={i}
                                        value={pt}
                                        onChange={(e) =>
                                          updatePersonaArrayItem(
                                            pIndex,
                                            psIndex,
                                            "marketing_angles",
                                            i,
                                            e.target.value
                                          )
                                        }
                                        placeholder={`角度 ${i + 1}`}
                                        className="h-8 text-sm"
                                      />
                                    ))}
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TabsContent>

        {/* ── Prompts Tab ── */}
        <TabsContent value="prompts">
          <Card>
            <CardHeader>
              <CardTitle>AI 提示词配置 (Prompt Engineering)</CardTitle>
              <CardDescription>
                调整 AI 生成逻辑。支持使用 {"{{variable}}"} 语法引用知识库内容。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

              {/* Pillars Prompts (Step 1) */}
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-bold text-lg">Step 1: 支柱生成 (Pillars)</h3>
                <div className="space-y-2">
                  <Label>System Prompt (系统指令)</Label>
                  <Textarea
                    value={prompts.pillars_system}
                    onChange={(e) => updatePrompt("pillars_system", e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>User Prompt (用户输入)</Label>
                  <Textarea
                    value={prompts.pillars_user}
                    onChange={(e) => updatePrompt("pillars_user", e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    可用变量: {"{{mode}}"}, {"{{context}}"}, {"{{ingredients}}"},{"{{target_audience}}"}
                  </p>
                </div>
              </div>

              {/* Matrix Prompts */}
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-bold text-lg">Step 2: 矩阵生成 (Matrix)</h3>
                <div className="space-y-2">
                  <Label>System Prompt (系统指令)</Label>
                  <Textarea
                    value={prompts.matrix_system}
                    onChange={(e) => updatePrompt("matrix_system", e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>User Prompt (用户输入)</Label>
                  <Textarea
                    value={prompts.matrix_user}
                    onChange={(e) => updatePrompt("matrix_user", e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Topic Skills */}
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-bold text-lg">Step 3: 选题生成技能 (Topic Skills)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>小红书 (Xiaohongshu)</Label>
                    <Textarea
                      value={prompts.skills_xhs}
                      onChange={(e) => updatePrompt("skills_xhs", e.target.value)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>朋友圈 (WeChat)</Label>
                    <Textarea
                      value={prompts.skills_wechat}
                      onChange={(e) => updatePrompt("skills_wechat", e.target.value)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>短视频 (Video)</Label>
                    <Textarea
                      value={prompts.skills_video}
                      onChange={(e) => updatePrompt("skills_video", e.target.value)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Script Generation */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Step 4: 文案生成 (Script Generation)</h3>

                <div className="space-y-2 border-l-4 border-l-red-500 pl-4 mb-4">
                  <Label className="text-red-600">小红书 System Prompt</Label>
                  <Textarea
                    value={prompts.scripts_system_xhs}
                    onChange={(e) => updatePrompt("scripts_system_xhs", e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2 border-l-4 border-l-green-500 pl-4 mb-4">
                  <Label className="text-green-600">朋友圈 System Prompt</Label>
                  <Textarea
                    value={prompts.scripts_system_wechat}
                    onChange={(e) => updatePrompt("scripts_system_wechat", e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2 border-l-4 border-l-blue-500 pl-4 mb-4">
                  <Label className="text-blue-600">短视频 System Prompt</Label>
                  <Textarea
                    value={prompts.scripts_system_video}
                    onChange={(e) => updatePrompt("scripts_system_video", e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>User Prompt (通用用户指令)</Label>
                  <Textarea
                    value={prompts.scripts_user}
                    onChange={(e) => updatePrompt("scripts_user", e.target.value)}
                    rows={2}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    System Prompt 可用变量: {"{{brand_name}}"}, {"{{ingredients}}"},
                    {"{{pain_points}}"}, {"{{marketing_angles}}"}, {"{{topic}}"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

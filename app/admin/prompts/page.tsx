"use client"

import * as React from "react"
import Link from "next/link"
import {
  Loader2,
  Save,
  ArrowLeft,
  Wand2,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Info,
  CheckCircle2,
  Leaf,
} from "lucide-react"
import { toast } from "sonner"
import { PromptsConfig } from "@/lib/prompts"

// 提示词分组配置
const PROMPT_GROUPS = [
  {
    id: "matrix",
    label: "九宫格策略矩阵",
    icon: "🗂️",
    desc: "控制内容策略矩阵（3H × 3支柱）的生成逻辑",
    color: "#2D5A27",
    bg: "#EBF5E9",
    border: "#4A8A42",
    fields: [
      {
        key: "matrix_system",
        label: "系统提示词（Matrix System）",
        desc: "定义AI的角色与矩阵生成规则，影响九宫格整体质量",
        rows: 14,
      },
      {
        key: "matrix_user",
        label: "用户提示词（Matrix User）",
        desc: "传递给AI的具体指令模板，支持变量替换",
        rows: 6,
      },
    ],
  },
  {
    id: "pillars",
    label: "内容支柱生成",
    icon: "🌿",
    desc: "控制步骤一中三大内容支柱的AI生成逻辑",
    color: "#2D5A27",
    bg: "#F0FFF4",
    border: "#4A8A42",
    fields: [
      {
        key: "pillars_system",
        label: "系统提示词（Pillars System）",
        desc: "定义支柱生成的策略框架与品牌定位",
        rows: 10,
      },
      {
        key: "pillars_user",
        label: "用户提示词（Pillars User）",
        desc: "传递品牌信息给AI的模板，支持变量替换",
        rows: 5,
      },
    ],
  },
  {
    id: "topics",
    label: "选题生成（含口感特色版）",
    icon: "💡",
    desc: "控制步骤三中各平台选题的生成策略，已整合口感双重叙事框架（功效叙事+口感叙事）",
    color: "#B85C00",
    bg: "#FFF8E7",
    border: "#E8820A",
    fields: [
      {
        key: "topics_system",
        label: "系统提示词（Topics System）",
        desc: "定义选题生成的平台策略与内容方向",
        rows: 12,
      },
      {
        key: "topics_user",
        label: "用户提示词（Topics User）",
        desc: "传递矩阵数据给AI的模板",
        rows: 4,
      },
    ],
  },
  {
    id: "skills",
    label: "平台技巧（Skills）",
    icon: "🎯",
    desc: "各平台的内容创作技巧，注入到文案生成中",
    color: "#3B4FA8",
    bg: "#EBF8FF",
    border: "#5B6FD8",
    fields: [
      {
        key: "skills_xhs",
        label: "小红书技巧（口感反差版）",
        desc: "小红书爆款标题公式，含口感反差钩子与双重叙事要求",
        rows: 16,
      },
      {
        key: "skills_wechat",
        label: "朋友圈技巧（口感场景版）",
        desc: "朋友圈软植入策略，含口感场景描述与话术库",
        rows: 14,
      },
      {
        key: "skills_video",
        label: "短视频技巧（口感视觉冲击版）",
        desc: "短视频钩子类型，含口感视觉冲击与对比实验方向",
        rows: 14,
      },
    ],
  },
  {
    id: "scripts",
    label: "文案生成（Scripts）",
    icon: "✍️",
    desc: "步骤四中各平台文案与脚本的生成提示词",
    color: "#6B2FA0",
    bg: "#F5F0FF",
    border: "#9B59B6",
    fields: [
      {
        key: "scripts_system_xhs",
        label: "小红书文案系统提示词",
        desc: "控制小红书图文文案的生成质量与风格",
        rows: 16,
      },
      {
        key: "scripts_system_wechat",
        label: "朋友圈文案系统提示词",
        desc: "控制朋友圈文案的真实感与软植入效果",
        rows: 14,
      },
      {
        key: "scripts_system_video",
        label: "短视频脚本系统提示词",
        desc: "控制短视频分镜脚本的结构与钩子质量",
        rows: 14,
      },
      {
        key: "scripts_user",
        label: "通用用户提示词（Scripts User）",
        desc: "传递具体选题给AI的通用模板",
        rows: 3,
      },
    ],
  },
]

export default function PromptsAdminPage() {
  const [prompts, setPrompts] = React.useState<PromptsConfig | null>(null)
  const [originalPrompts, setOriginalPrompts] = React.useState<PromptsConfig | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(["matrix"])
  )
  const [savedAt, setSavedAt] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        setPrompts(data)
        setOriginalPrompts(JSON.parse(JSON.stringify(data)))
        setLoading(false)
      })
      .catch(() => {
        toast.error("加载提示词失败")
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    if (!prompts) return
    setSaving(true)
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      })
      if (!res.ok) throw new Error("保存失败")
      setOriginalPrompts(JSON.parse(JSON.stringify(prompts)))
      setSavedAt(new Date().toLocaleTimeString("zh-CN"))
      toast.success("提示词配置已保存！")
    } catch {
      toast.error("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = (key: string) => {
    if (!originalPrompts || !prompts) return
    setPrompts({
      ...prompts,
      [key]: (originalPrompts as any)[key],
    })
    toast.info("已恢复到上次保存的版本")
  }

  const handleChange = (key: string, value: string) => {
    if (!prompts) return
    setPrompts({ ...prompts, [key]: value })
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isDirty = (key: string) => {
    if (!prompts || !originalPrompts) return false
    return (prompts as any)[key] !== (originalPrompts as any)[key]
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "#2D5A27" }}
          />
          <p className="text-sm" style={{ color: "#8B6B4A" }}>
            加载提示词配置...
          </p>
        </div>
      </div>
    )
  }

  if (!prompts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "#DC2626" }}>加载失败，请刷新页面重试</p>
      </div>
    )
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #F5FAF4 0%, #FFFDF8 60%, #F0F9EE 100%)",
      }}
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
              href="/admin/knowledge"
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: "#2D5A27" }}
            >
              <ArrowLeft className="w-4 h-4" />
              返回知识库
            </Link>
            <div
              className="w-px h-4"
              style={{ background: "rgba(45,90,39,0.2)" }}
            />
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #2D5A27, #4A8A42)",
                }}
              >
                <Wand2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1
                  className="font-bold text-base"
                  style={{ color: "#1E3D1A" }}
                >
                  AI 提示词配置
                </h1>
                <p className="text-xs" style={{ color: "#8B6B4A" }}>
                  {savedAt ? `上次保存：${savedAt}` : "管理员专用 · 修改后即时生效"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: saving
                ? "rgba(45,90,39,0.4)"
                : "linear-gradient(135deg, #2D5A27, #4A8A42)",
              boxShadow: saving ? "none" : "0 3px 12px rgba(45,90,39,0.3)",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "保存中..." : "保存所有配置"}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* 说明卡片 */}
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{
            background: "rgba(59,79,168,0.05)",
            border: "1px solid rgba(59,79,168,0.15)",
          }}
        >
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#3B4FA8" }} />
          <div className="text-sm" style={{ color: "#3B4FA8" }}>
            <p className="font-semibold mb-1">提示词优化指南</p>
            <p className="opacity-80 leading-relaxed">
              提示词模板支持变量替换，常用变量包括：
              <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,79,168,0.1)" }}>
                {"{{brand_name}}"}
              </code>
              <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,79,168,0.1)" }}>
                {"{{ingredients}}"}
              </code>
              <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,79,168,0.1)" }}>
                {"{{pain_points}}"}
              </code>
              <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,79,168,0.1)" }}>
                {"{{platform}}"}
              </code>
              <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,79,168,0.1)" }}>
                {"{{topic}}"}
              </code>
              <code className="mx-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,79,168,0.1)" }}>
                {"{{taste_advantage}}"}
              </code>
              。其中 <strong>taste_advantage</strong> 会自动注入知识库中的口感优势数据（品牌级+产品级），无需手动填写。修改后点击右上角「保存所有配置」立即生效。
            </p>
          </div>
        </div>

        {/* 提示词分组 */}
        {PROMPT_GROUPS.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const hasChanges = group.fields.some((f) => isDirty(f.key))

          return (
            <div
              key={group.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "white",
                border: hasChanges
                  ? `2px solid ${group.border}`
                  : "1px solid rgba(45,90,39,0.1)",
                boxShadow: "0 2px 12px rgba(45,90,39,0.06)",
              }}
            >
              {/* 分组头部 */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all"
                style={{
                  background: isExpanded ? group.bg : "white",
                  borderBottom: isExpanded
                    ? `1px solid ${group.border}30`
                    : "none",
                }}
              >
                <span className="text-xl leading-none">{group.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-base"
                      style={{ color: group.color }}
                    >
                      {group.label}
                    </span>
                    {hasChanges && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: `${group.border}20`,
                          color: group.color,
                        }}
                      >
                        已修改
                      </span>
                    )}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(45,90,39,0.06)",
                        color: "#8B6B4A",
                      }}
                    >
                      {group.fields.length} 个模板
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#8B6B4A" }}>
                    {group.desc}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: group.color }}
                  />
                ) : (
                  <ChevronDown
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: "rgba(45,90,39,0.4)" }}
                  />
                )}
              </button>

              {/* 展开内容 */}
              {isExpanded && (
                <div className="p-5 space-y-6">
                  {group.fields.map((field) => {
                    const value = (prompts as any)[field.key] || ""
                    const changed = isDirty(field.key)

                    return (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <label
                                className="text-sm font-semibold"
                                style={{ color: "#1E3D1A" }}
                              >
                                {field.label}
                              </label>
                              {changed && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: "#FFF8E7",
                                    color: "#B85C00",
                                  }}
                                >
                                  未保存
                                </span>
                              )}
                            </div>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "rgba(45,90,39,0.5)" }}
                            >
                              {field.desc}
                            </p>
                          </div>
                          {changed && (
                            <button
                              onClick={() => handleReset(field.key)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0 transition-all"
                              style={{
                                background: "rgba(45,90,39,0.06)",
                                color: "#2D5A27",
                                border: "1px solid rgba(45,90,39,0.15)",
                              }}
                            >
                              <RotateCcw className="w-3 h-3" />
                              撤销
                            </button>
                          )}
                        </div>
                        <textarea
                          value={value}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          rows={field.rows}
                          className="w-full p-3 rounded-xl text-sm font-mono outline-none resize-y transition-all"
                          style={{
                            background: changed
                              ? "#FFFDF5"
                              : "rgba(45,90,39,0.02)",
                            border: changed
                              ? `1.5px solid ${group.border}60`
                              : "1.5px solid rgba(45,90,39,0.1)",
                            color: "#1E3D1A",
                            lineHeight: 1.6,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          }}
                          spellCheck={false}
                        />
                        <div
                          className="text-xs text-right"
                          style={{ color: "rgba(45,90,39,0.35)" }}
                        >
                          {value.length} 字符
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* 底部保存按钮 */}
        <div className="pb-8 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
            style={{
              background: saving
                ? "rgba(45,90,39,0.4)"
                : "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #4A8A42 100%)",
              boxShadow: saving ? "none" : "0 4px 16px rgba(45,90,39,0.35)",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存所有提示词配置
              </>
            )}
          </button>
          {savedAt && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs" style={{ color: "#2D5A27" }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              上次保存于 {savedAt}
            </div>
          )}
        </div>
      </div>

      {/* 底部装饰 */}
      <footer
        className="text-center py-4 text-xs"
        style={{ color: "rgba(45,90,39,0.35)" }}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Leaf className="w-3 h-3" />
          <span>灵芝水铺 · 管理员后台</span>
          <Leaf className="w-3 h-3" />
        </div>
      </footer>
    </main>
  )
}

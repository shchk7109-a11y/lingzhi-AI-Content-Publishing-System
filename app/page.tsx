"use client"

import * as React from "react"
import { Step1Pillars, PillarItem } from "@/components/pipeline/step-1-pillars"
import { Step2Matrix, MatrixRow } from "@/components/pipeline/step-2-matrix"
import { Step3Topics, TopicWithContext } from "@/components/pipeline/step-3-topics"
import { Step4Scripts } from "@/components/pipeline/step-4-scripts"
import { useAuth } from "@/components/auth-provider"
import { Leaf, Sparkles, Grid3X3, FileText, BookOpen } from "lucide-react"

type Platform = "xiaohongshu" | "wechat" | "video"

const STEPS = [
  { id: 1, label: "内容支柱", icon: Leaf,       desc: "定义品牌核心方向" },
  { id: 2, label: "策略矩阵", icon: Grid3X3,    desc: "生成 9 宫格内容矩阵" },
  { id: 3, label: "话题选取", icon: Sparkles,   desc: "裂变选题创意" },
  { id: 4, label: "脚本生成", icon: FileText,   desc: "一键生成发布文案" },
]

export default function Home() {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = React.useState<number>(1)
  const [pillars, setPillars] = React.useState<PillarItem[]>([])
  const [pillarMode, setPillarMode] = React.useState<string>('brand')
  const [pillarProductId, setPillarProductId] = React.useState<string>('')
  const [matrix, setMatrix] = React.useState<MatrixRow[]>([])
  const [topics, setTopics] = React.useState<TopicWithContext[]>([])
  const [selectedPlatform, setSelectedPlatform] = React.useState<Platform>("video")

  const handlePillarsConfirmed = (newPillars: PillarItem[], mode?: string, productId?: string) => {
    setPillars(newPillars)
    setPillarMode(mode || 'brand')
    setPillarProductId(productId || '')
    setCurrentStep(2)
  }
  const handleMatrixConfirmed = (newMatrix: MatrixRow[]) => {
    setMatrix(newMatrix)
    setCurrentStep(3)
  }
  const handleTopicsConfirmed = (selectedTopics: TopicWithContext[], platform: Platform) => {
    setTopics(selectedTopics)
    setSelectedPlatform(platform)
    setCurrentStep(4)
  }
  const handleBack = () => setCurrentStep((prev) => Math.max(1, prev - 1))

  const handleRestart = () => {
    setPillars([])
    setPillarMode('brand')
    setPillarProductId('')
    setMatrix([])
    setTopics([])
    setSelectedPlatform("video")
    setCurrentStep(1)
  }

  const progressPct = Math.round((currentStep / 4) * 100)

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(160deg, #F5F0E8 0%, #EFF5EC 40%, #FAF6EE 100%)",
      }}
    >
      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #3A6E33 100%)",
          padding: "2.5rem 1rem 3rem",
        }}
      >
        {/* 装饰圆圈 */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #A8D5A2, transparent)", transform: "translate(30%, -30%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #E8820A, transparent)", transform: "translate(-30%, 30%)" }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div
              className="px-3 py-1 rounded-full text-xs font-medium tracking-widest"
              style={{ background: "rgba(255,255,255,0.15)", color: "#A8D5A2", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              AI 内容裂变
            </div>
          </div>
          <h1
            className="text-white mb-2"
            style={{
              fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
              fontFamily: "'Songti SC', 'STSong', serif",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            灵芝水铺 AI 内容策略裂变系统
          </h1>
          <p className="text-green-200/80 text-sm tracking-wide">
            四步流水线 · 从品牌定位到发布文案，一键生成
          </p>
        </div>
      </div>

      {/* ── 步骤进度指示器 ── */}
      <div
        className="sticky top-16 z-40"
        style={{
          background: "rgba(250,246,238,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(45,90,39,0.1)",
          boxShadow: "0 2px 12px rgba(45,90,39,0.06)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* 步骤图标行 */}
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, idx) => {
              const Icon = step.icon
              const isDone = currentStep > step.id
              const isActive = currentStep === step.id
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                      style={{
                        background: isDone
                          ? "linear-gradient(135deg, #2D5A27, #4A8A42)"
                          : isActive
                          ? "linear-gradient(135deg, #E8820A, #F59E0B)"
                          : "rgba(45,90,39,0.08)",
                        border: isActive ? "2px solid #E8820A" : isDone ? "2px solid #2D5A27" : "2px solid rgba(45,90,39,0.15)",
                        boxShadow: isActive ? "0 0 0 3px rgba(232,130,10,0.2)" : isDone ? "0 0 0 3px rgba(45,90,39,0.1)" : "none",
                      }}
                    >
                      {isDone ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <Icon
                          className="w-4 h-4"
                          style={{ color: isActive ? "white" : "rgba(45,90,39,0.4)" }}
                        />
                      )}
                    </div>
                    <div className="text-center hidden sm:block">
                      <div
                        className="text-xs font-semibold"
                        style={{ color: isActive ? "#E8820A" : isDone ? "#2D5A27" : "rgba(45,90,39,0.4)" }}
                      >
                        {step.label}
                      </div>
                    </div>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className="flex-1 h-0.5 mx-2"
                      style={{
                        background: currentStep > step.id
                          ? "linear-gradient(90deg, #2D5A27, #4A8A42)"
                          : "rgba(45,90,39,0.12)",
                        borderRadius: "9999px",
                      }}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>

          {/* 进度文字 */}
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "#8B6B4A" }}>
              第 <span style={{ color: "#E8820A", fontWeight: 700 }}>{currentStep}</span> 步，共 4 步
              <span className="ml-2 text-green-700/60">— {STEPS[currentStep - 1]?.desc}</span>
            </span>
            <span
              className="font-bold"
              style={{ color: "#2D5A27" }}
            >
              {progressPct}%
            </span>
          </div>

          {/* 进度条 */}
          <div
            className="mt-1.5 h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(45,90,39,0.1)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #2D5A27, #4A8A42, #E8820A)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 流水线内容区 ── */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-fade-in-up">
          {currentStep === 1 && <Step1Pillars onConfirm={handlePillarsConfirmed} />}
          {currentStep === 2 && (
            <Step2Matrix pillars={pillars} mode={pillarMode as any} productId={pillarProductId} onConfirm={handleMatrixConfirmed} onBack={handleBack} />
          )}
          {currentStep === 3 && (
            <Step3Topics matrix={matrix} onConfirm={handleTopicsConfirmed} onBack={handleBack} />
          )}
          {currentStep === 4 && (
            <Step4Scripts topics={topics} platform={selectedPlatform} onBack={handleBack} onRestart={handleRestart} />
          )}
        </div>
      </div>

      {/* ── 底部装饰 ── */}
      <footer className="text-center py-6 text-xs" style={{ color: "rgba(45,90,39,0.35)" }}>
        <div className="flex items-center justify-center gap-1.5">
          <Leaf className="w-3 h-3" />
          <span>灵芝水铺 · AI 内容裂变系统</span>
          <Leaf className="w-3 h-3" />
        </div>
      </footer>
    </main>
  )
}

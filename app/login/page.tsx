"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Leaf, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"

export default function LoginPage() {
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPwd, setShowPwd] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "登录失败")
      login(data.user)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: "linear-gradient(160deg, #1E3D1A 0%, #2D5A27 40%, #3A6E33 70%, #4A8A42 100%)",
      }}
    >
      {/* 左侧装饰区 */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* 背景装饰圆 */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #A8D5A2, transparent)", transform: "translate(-30%, -30%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-72 h-72 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #E8820A, transparent)", transform: "translate(30%, 30%)" }}
        />

        <div className="relative text-center">
          {/* Logo */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <Leaf className="w-10 h-10 text-white" />
          </div>

          <h1
            className="text-white text-4xl font-bold mb-3"
            style={{ fontFamily: "'Songti SC', 'STSong', serif", letterSpacing: "0.08em" }}
          >
            灵芝水铺
          </h1>
          <p className="text-green-200/80 text-lg mb-8 tracking-widest">AI 内容策略裂变系统</p>

          {/* 特性标签 */}
          <div className="flex flex-col gap-3 text-left max-w-xs mx-auto">
            {[
              { icon: "🌿", text: "四步流水线，从定位到文案" },
              { icon: "⚡", text: "并行 AI 生成，效率提升 5 倍" },
              { icon: "📱", text: "支持小红书、微信、短视频" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-white/85 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{
            background: "rgba(250,246,238,0.97)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}
        >
          {/* 移动端 Logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
            >
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg" style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}>
                灵芝水铺 AI
              </div>
              <div className="text-xs" style={{ color: "#8B6B4A" }}>内容策略裂变系统</div>
            </div>
          </div>

          <div className="mb-6">
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}
            >
              欢迎登录
            </h2>
            <p className="text-sm" style={{ color: "#8B6B4A" }}>请输入您的账号密码继续</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" style={{ color: "#3D2B1F", fontWeight: 600, fontSize: "0.875rem" }}>
                用户名 / 邮箱
              </Label>
              <Input
                id="username"
                placeholder="请输入用户名或邮箱"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11 rounded-xl"
                style={{
                  background: "white",
                  border: "1.5px solid rgba(45,90,39,0.2)",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" style={{ color: "#3D2B1F", fontWeight: 600, fontSize: "0.875rem" }}>
                密码
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl pr-10"
                  style={{
                    background: "white",
                    border: "1.5px solid rgba(45,90,39,0.2)",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(45,90,39,0.5)" }}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-sm text-center py-2 px-3 rounded-xl"
                style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.2)" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: loading
                  ? "rgba(45,90,39,0.5)"
                  : "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #4A8A42 100%)",
                boxShadow: loading ? "none" : "0 4px 16px rgba(45,90,39,0.35)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <Leaf className="w-4 h-4" />
                  登录系统
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: "#8B6B4A" }}>
              还没有账号？
              <Link
                href="/register"
                className="ml-1 font-semibold hover:underline"
                style={{ color: "#2D5A27" }}
              >
                申请注册
              </Link>
            </p>
          </div>

          <div
            className="mt-6 pt-5 text-center text-xs"
            style={{ borderTop: "1px solid rgba(45,90,39,0.1)", color: "rgba(45,90,39,0.4)" }}
          >
            <Leaf className="w-3 h-3 inline mr-1" />
            灵芝水铺 · 健康生活，智慧营销
          </div>
        </div>
      </div>
    </div>
  )
}

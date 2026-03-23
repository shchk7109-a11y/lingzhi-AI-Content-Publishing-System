"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, Leaf, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RegisterPage() {
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showPwd, setShowPwd] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [success, setSuccess] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "注册失败")
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    background: "linear-gradient(160deg, #1E3D1A 0%, #2D5A27 40%, #3A6E33 70%, #4A8A42 100%)",
  }

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "420px",
    borderRadius: "1.25rem",
    padding: "2rem",
    background: "rgba(250,246,238,0.97)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
  }

  if (success) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle} className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}
          >
            注册成功！
          </h2>
          <p className="text-sm mb-6" style={{ color: "#8B6B4A", lineHeight: 1.8 }}>
            您的账号已创建完成。
            <br />
            请联系管理员激活您的账号后即可登录。
          </p>
          <Link
            href="/login"
            className="block w-full h-11 rounded-xl font-semibold text-white text-center leading-[2.75rem] transition-all"
            style={{
              background: "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 50%, #4A8A42 100%)",
              boxShadow: "0 4px 16px rgba(45,90,39,0.35)",
            }}
          >
            前往登录
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-7">
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
            <div className="text-xs" style={{ color: "#8B6B4A" }}>申请加入内容生产团队</div>
          </div>
        </div>

        <div className="mb-5">
          <h2 className="text-xl font-bold mb-0.5" style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}>
            注册新账号
          </h2>
          <p className="text-sm" style={{ color: "#8B6B4A" }}>注册后需等待管理员审核激活</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" style={{ color: "#3D2B1F", fontWeight: 600, fontSize: "0.875rem" }}>
              用户名
            </Label>
            <Input
              id="username"
              placeholder="请设置用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="h-11 rounded-xl"
              style={{ background: "white", border: "1.5px solid rgba(45,90,39,0.2)" }}
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
                placeholder="请设置密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-xl pr-10"
                style={{ background: "white", border: "1.5px solid rgba(45,90,39,0.2)" }}
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

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" style={{ color: "#3D2B1F", fontWeight: 600, fontSize: "0.875rem" }}>
              确认密码
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 rounded-xl"
              style={{ background: "white", border: "1.5px solid rgba(45,90,39,0.2)" }}
            />
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
                注册中...
              </>
            ) : (
              <>
                <Leaf className="w-4 h-4" />
                提交注册
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm" style={{ color: "#8B6B4A" }}>
            已有账号？
            <Link href="/login" className="ml-1 font-semibold hover:underline" style={{ color: "#2D5A27" }}>
              直接登录
            </Link>
          </p>
        </div>

        <div
          className="mt-5 pt-4 text-center text-xs"
          style={{ borderTop: "1px solid rgba(45,90,39,0.1)", color: "rgba(45,90,39,0.4)" }}
        >
          <Leaf className="w-3 h-3 inline mr-1" />
          灵芝水铺 · 健康生活，智慧营销
        </div>
      </div>
    </div>
  )
}

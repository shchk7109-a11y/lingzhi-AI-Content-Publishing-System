"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, ArrowLeft, Check, X, Trash2, Users, ShieldCheck, Clock, Ban } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  username: string
  role: "ADMIN" | "USER"
  status: "ACTIVE" | "PENDING" | "REJECTED"
  createdAt: string
}

export default function UserManagementPage() {
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      } else {
        toast.error("加载用户列表失败")
      }
    } catch {
      toast.error("网络错误，请刷新页面")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchUsers() }, [])

  const updateUser = async (id: string, updates: Partial<User>, successMsg: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })
      if (res.ok) {
        toast.success(successMsg)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "操作失败")
      }
    } catch {
      toast.error("网络错误，请重试")
    }
  }

  const deleteUser = async (id: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销。`)) return
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        toast.success(`用户 "${username}" 已删除`)
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || "删除失败")
      }
    } catch {
      toast.error("网络错误，请重试")
    }
  }

  const pendingCount = users.filter((u) => u.status === "PENDING").length
  const activeCount = users.filter((u) => u.status === "ACTIVE").length

  const getStatusConfig = (status: User["status"]) => {
    switch (status) {
      case "ACTIVE": return { label: "已激活", bg: "#EBF5E9", color: "#2D5A27", border: "rgba(45,90,39,0.25)" }
      case "PENDING": return { label: "待审核", bg: "#FFF8E7", color: "#B85C00", border: "rgba(232,130,10,0.25)" }
      case "REJECTED": return { label: "已禁用", bg: "rgba(220,38,38,0.08)", color: "#DC2626", border: "rgba(220,38,38,0.2)" }
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #F5F0E8 0%, #EBF5E9 50%, #F0F9EE 100%)" }}>
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        {/* 页面头部 */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "white", border: "1.5px solid rgba(45,90,39,0.15)", color: "#2D5A27" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1E3D1A", fontFamily: "'Songti SC', serif" }}>
              用户授权管理
            </h1>
            {pendingCount > 0 && (
              <p className="text-sm mt-0.5" style={{ color: "#B85C00" }}>
                有 {pendingCount} 个用户待审核
              </p>
            )}
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { icon: Users, label: "总用户数", value: users.length, color: "#2D5A27", bg: "#EBF5E9" },
            { icon: ShieldCheck, label: "已激活", value: activeCount, color: "#2D5A27", bg: "#EBF5E9" },
            { icon: Clock, label: "待审核", value: pendingCount, color: "#B85C00", bg: "#FFF8E7" },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div
                key={i}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: "white", border: "1px solid rgba(45,90,39,0.1)", boxShadow: "0 2px 8px rgba(45,90,39,0.06)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: stat.bg }}
                >
                  <Icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: "#1E3D1A" }}>{stat.value}</div>
                  <div className="text-xs" style={{ color: "#8B6B4A" }}>{stat.label}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 用户表格 */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "white", border: "1px solid rgba(45,90,39,0.12)", boxShadow: "0 4px 24px rgba(45,90,39,0.08)" }}
        >
          <div
            className="px-6 py-4"
            style={{ background: "linear-gradient(135deg, #EBF5E9, #F5FAF4)", borderBottom: "1px solid rgba(45,90,39,0.1)" }}
          >
            <h2 className="font-bold" style={{ color: "#1E3D1A" }}>注册用户列表</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8B6B4A" }}>
              只有"已激活"状态的用户才能登录系统
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)" }}
                >
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                <p className="text-sm" style={{ color: "#8B6B4A" }}>加载中...</p>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="w-10 h-10" style={{ color: "rgba(45,90,39,0.2)" }} />
              <p className="text-sm" style={{ color: "rgba(45,90,39,0.5)" }}>暂无用户</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(45,90,39,0.08)" }}>
                    {["用户名", "注册时间", "角色", "状态", "操作"].map((h, i) => (
                      <th
                        key={i}
                        className="px-5 py-3 text-left text-xs font-bold tracking-wider"
                        style={{ color: "#8B6B4A", background: "rgba(45,90,39,0.02)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => {
                    const statusCfg = getStatusConfig(user.status)
                    return (
                      <tr
                        key={user.id}
                        style={{
                          borderBottom: "1px solid rgba(45,90,39,0.06)",
                          background: idx % 2 === 0 ? "white" : "rgba(45,90,39,0.01)",
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{
                                background: user.role === "ADMIN"
                                  ? "linear-gradient(135deg, #2D5A27, #4A8A42)"
                                  : "linear-gradient(135deg, #E8820A, #F59E0B)",
                                color: "white",
                              }}
                            >
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-sm" style={{ color: "#1E3D1A" }}>
                              {user.username}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs" style={{ color: "#8B6B4A" }}>
                          {new Date(user.createdAt).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{
                              background: user.role === "ADMIN" ? "linear-gradient(135deg, #2D5A27, #4A8A42)" : "rgba(45,90,39,0.08)",
                              color: user.role === "ADMIN" ? "white" : "#2D5A27",
                            }}
                          >
                            {user.role === "ADMIN" ? "管理员" : "普通用户"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            {user.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => updateUser(user.id, { status: "ACTIVE" }, `已批准用户 "${user.username}"`)}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all"
                                  style={{ background: "linear-gradient(135deg, #2D5A27, #4A8A42)", boxShadow: "0 2px 6px rgba(45,90,39,0.3)" }}
                                >
                                  <Check className="w-3 h-3" /> 批准
                                </button>
                                <button
                                  onClick={() => updateUser(user.id, { status: "REJECTED" }, `已拒绝用户 "${user.username}"`)}
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                                  style={{ background: "rgba(220,38,38,0.1)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.2)" }}
                                >
                                  <X className="w-3 h-3" /> 拒绝
                                </button>
                              </>
                            )}
                            {user.status === "ACTIVE" && user.role !== "ADMIN" && (
                              <button
                                onClick={() => updateUser(user.id, { status: "REJECTED" }, `已禁用用户 "${user.username}"`)}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                                style={{ background: "rgba(232,130,10,0.1)", color: "#B85C00", border: "1px solid rgba(232,130,10,0.2)" }}
                              >
                                <Ban className="w-3 h-3" /> 禁用
                              </button>
                            )}
                            {user.status === "REJECTED" && (
                              <button
                                onClick={() => updateUser(user.id, { status: "ACTIVE" }, `已重新激活用户 "${user.username}"`)}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                                style={{ background: "#EBF5E9", color: "#2D5A27", border: "1px solid rgba(45,90,39,0.2)" }}
                              >
                                <Check className="w-3 h-3" /> 重新激活
                              </button>
                            )}
                            {user.role !== "ADMIN" && (
                              <button
                                onClick={() => deleteUser(user.id, user.username)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                                style={{ color: "rgba(220,38,38,0.5)" }}
                                title="删除用户"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

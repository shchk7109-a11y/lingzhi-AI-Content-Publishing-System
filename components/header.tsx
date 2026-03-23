"use client"

import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { LogOut, User, Leaf, Settings, Users, Archive, Wand2 } from "lucide-react"
import { ModelSettings } from "@/components/model-settings"

export function Header() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "linear-gradient(135deg, #1E3D1A 0%, #2D5A27 60%, #3A6E33 100%)",
        borderBottomColor: "rgba(255,255,255,0.1)",
        boxShadow: "0 2px 16px rgba(30,61,26,0.3)",
      }}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <Leaf className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span
              className="font-bold text-white tracking-wide"
              style={{ fontSize: "1rem", fontFamily: "'Songti SC', 'STSong', serif" }}
            >
              灵芝水铺 AI
            </span>
            <span className="text-[10px] text-green-200/70 tracking-widest font-light">
              内容策略裂变系统
            </span>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Admin links */}
          {user.role === "ADMIN" && (
            <div className="flex items-center gap-1 mr-1">
              <Link href="/admin/users">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-100 hover:text-white hover:bg-white/10 text-xs gap-1.5 rounded-full px-3"
                >
                  <Users className="h-3.5 w-3.5" />
                  用户授权
                </Button>
              </Link>
              <Link href="/admin/knowledge">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-100 hover:text-white hover:bg-white/10 text-xs gap-1.5 rounded-full px-3"
                >
                  <Settings className="h-3.5 w-3.5" />
                  知识库
                </Button>
              </Link>
              <Link href="/admin/prompts">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-100 hover:text-white hover:bg-white/10 text-xs gap-1.5 rounded-full px-3"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  提示词
                </Button>
              </Link>
            </div>
          )}

          {/* 资产库入口（所有用户可见） */}
          <Link href="/assets">
            <Button
              variant="ghost"
              size="sm"
              className="text-green-100 hover:text-white hover:bg-white/10 text-xs gap-1.5 rounded-full px-3"
            >
              <Archive className="h-3.5 w-3.5" />
              资产库
            </Button>
          </Link>

          {/* Model Settings */}
          <div
            className="rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ModelSettings />
          </div>

          {/* User info */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <User className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-white/90 text-xs font-medium">{user.username}</span>
            {user.role === "ADMIN" && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: "linear-gradient(135deg, #E8820A, #F59E0B)",
                  color: "white",
                }}
              >
                管理员
              </span>
            )}
          </div>

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-green-100/70 hover:text-white hover:bg-white/10 rounded-full px-3 text-xs gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </Button>
        </div>
      </div>
    </header>
  )
}

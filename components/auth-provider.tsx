"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"

interface User {
  id: string
  username: string
  role: 'ADMIN' | 'USER'
}

interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Check for session on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = (userData: User) => {
    setUser(userData)
    router.push('/')
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null)
    router.push('/login')
  }

  // Route Protection
  React.useEffect(() => {
    if (isLoading) return;

    const publicPaths = ['/login', '/register'];
    const isAdminPath = pathname.startsWith('/admin');

    if (!user && !publicPaths.includes(pathname)) {
      router.push('/login');
    } else if (user && publicPaths.includes(pathname)) {
      router.push('/');
    } else if (user && isAdminPath && user.role !== 'ADMIN') {
      router.push('/');
      toast.error("无权访问管理后台");
    }
  }, [user, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

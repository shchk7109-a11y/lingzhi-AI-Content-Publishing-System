"use client"

import * as React from "react"
import { Settings2, Save, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface AIConfig {
  provider: 'deepseek' | 'kimi' | 'gemini' | 'openai' | 'custom'
  apiKey: string
  baseUrl: string
  modelName: string
}

// ===================== 提供商配置表 =====================
interface ProviderConfig {
  label: string
  badge?: string
  badgeColor?: string
  baseUrl: string
  defaultModel: string
  models: { value: string; label: string; desc?: string }[]
  apiKeyPlaceholder: string
  apiKeyHint?: string
  needsProxy?: boolean
}

const PROVIDERS: Record<string, ProviderConfig> = {
  deepseek: {
    label: "DeepSeek",
    badge: "推荐 · 国内直连",
    badgeColor: "bg-green-100 text-green-700",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek-V3", desc: "最新旗舰对话模型，性价比极高" },
      { value: "deepseek-reasoner", label: "DeepSeek-R1", desc: "深度推理模型，适合复杂任务" },
    ],
    apiKeyPlaceholder: "sk-xxxxxxxxxxxxxxxx",
    apiKeyHint: "前往 platform.deepseek.com 获取",
    needsProxy: false,
  },
  kimi: {
    label: "Kimi (Moonshot)",
    badge: "国内直连",
    badgeColor: "bg-blue-100 text-blue-700",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: [
      { value: "moonshot-v1-8k", label: "Moonshot v1 8K", desc: "快速响应，适合短文案" },
      { value: "moonshot-v1-32k", label: "Moonshot v1 32K", desc: "长上下文，适合批量生成" },
      { value: "moonshot-v1-128k", label: "Moonshot v1 128K", desc: "超长上下文，适合全流水线" },
    ],
    apiKeyPlaceholder: "sk-xxxxxxxxxxxxxxxx",
    apiKeyHint: "前往 platform.moonshot.cn 获取",
    needsProxy: false,
  },
  gemini: {
    label: "Gemini (Google)",
    badge: "谷高中转 · 国内可用",
    badgeColor: "bg-green-100 text-green-700",
    baseUrl: "https://api.gdoubolai.com/v1",
    defaultModel: "gemini-3-flash-preview",
    models: [
      { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", desc: "最新旗舰，速度极快，推荐使用" },
      { value: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash Preview", desc: "强推理能力，适合复杂策略" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", desc: "稳定快速，日常使用" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", desc: "长上下文 100万 token" },
    ],
    apiKeyPlaceholder: "sk-xxxxxxxxxxxxxxxx",
    apiKeyHint: "谷高中转令牌，前往 gugaoapi.com 获取",
    needsProxy: false,
  },
  openai: {
    label: "OpenAI",
    badge: "谷高中转 · 国内可用",
    badgeColor: "bg-green-100 text-green-700",
    baseUrl: "https://api.gdoubolai.com/v1",
    defaultModel: "gpt-5",
    models: [
      { value: "gpt-5", label: "GPT-5", desc: "最新旗舰，综合能力最强，推荐使用" },
    ],
    apiKeyPlaceholder: "sk-xxxxxxxxxxxxxxxx",
    apiKeyHint: "谷高中转令牌，前往 gugaoapi.com 获取",
    needsProxy: false,
  },
  custom: {
    label: "自定义 / 其他",
    baseUrl: "",
    defaultModel: "",
    models: [],
    apiKeyPlaceholder: "输入 API Key",
    needsProxy: false,
  },
}

const PROVIDER_ORDER = ['deepseek', 'kimi', 'gemini', 'openai', 'custom']

export function ModelSettings() {
  const [open, setOpen] = React.useState(false)
  const [config, setConfig] = React.useState<AIConfig>({
    provider: 'deepseek',
    apiKey: '',
    baseUrl: PROVIDERS.deepseek.baseUrl,
    modelName: PROVIDERS.deepseek.defaultModel,
  })
  // 存储所有服务商已保存的配置（key = provider name）
  const [allProviders, setAllProviders] = React.useState<Record<string, { apiKey: string; baseUrl: string; modelName: string }>>({})
  const [isConfigured, setIsConfigured] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [showApiKey, setShowApiKey] = React.useState(false)

  // Load config from server on mount (per-user, persisted in DB)
  React.useEffect(() => {
    fetch('/api/user/ai-config')
      .then(res => res.json())
      .then(data => {
        // 加载所有服务商的已保存配置
        if (data.allProviders) {
          setAllProviders(data.allProviders)
        }
        if (data.config) {
          setConfig(data.config)
          setIsConfigured(!!data.config.apiKey)
        } else {
          // No config found — prompt the user to configure
          const timer = setTimeout(() => {
            toast.warning('请先配置 AI 模型', {
              description: '点击右上角设置图标，填写 API Key 后即可开始生成内容。',
              duration: 6000,
              action: {
                label: '立即配置',
                onClick: () => setOpen(true),
              },
            })
          }, 1500)
          return () => clearTimeout(timer)
        }
      })
      .catch(() => {
        // Fallback to localStorage if server request fails
        const saved = localStorage.getItem('lingzhi_ai_config')
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            setConfig(parsed)
            setIsConfigured(!!parsed.apiKey)
          } catch (e) {}
        }
      })
  }, [])

  const handleProviderChange = (value: string) => {
    const provider = value as AIConfig['provider']
    const providerConf = PROVIDERS[provider]
    // 如果该服务商已有保存的配置，自动回填
    const savedProviderConfig = allProviders[provider]
    const newConfig: AIConfig = {
      provider,
      apiKey: savedProviderConfig?.apiKey ?? '',
      baseUrl: savedProviderConfig?.baseUrl ?? providerConf.baseUrl,
      modelName: savedProviderConfig?.modelName ?? providerConf.defaultModel,
    }
    setConfig(newConfig)
    // 立即同步到 localStorage，确保切换后 API 调用立即使用新配置
    // 只有当该服务商已有保存的 apiKey 时才更新（避免用空 key 覆盖）
    if (savedProviderConfig?.apiKey) {
      localStorage.setItem('lingzhi_ai_config', JSON.stringify(newConfig))
      // 广播 storage 事件，通知同页面其他组件配置已变更
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'lingzhi_ai_config',
        newValue: JSON.stringify(newConfig),
      }))
    }
  }

  const handleModelChange = (value: string) => {
    setConfig(prev => ({ ...prev, modelName: value }))
  }

  const handleSave = async () => {
    if (!config.apiKey.trim()) {
      toast.error("请填写 API Key")
      return
    }
    setIsSaving(true)
    try {
      // Save to server (per-user DB)
      const res = await fetch('/api/user/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('保存失败')

      // Also keep localStorage as fallback
      localStorage.setItem('lingzhi_ai_config', JSON.stringify(config))
      // 广播 storage 事件，通知同页面其他组件配置已变更
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'lingzhi_ai_config',
        newValue: JSON.stringify(config),
      }))
      // 同步更新 allProviders 缓存，使切换时能立即回填
      setAllProviders(prev => ({
        ...prev,
        [config.provider]: {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          modelName: config.modelName,
        },
      }))
      setIsConfigured(true)
      setOpen(false)
      toast.success(`已切换至 ${PROVIDERS[config.provider]?.label || config.provider}`, {
        description: `模型：${config.modelName}，配置已保存到账号，下次登录自动加载。`,
      })
    } catch (e) {
      toast.error("配置保存失败，请重试")
    } finally {
      setIsSaving(false)
    }
  }

  const currentProvider = PROVIDERS[config.provider]
  const hasModels = currentProvider?.models && currentProvider.models.length > 0
  // 当前服务商是否已有保存的 Key
  const currentProviderSaved = !!(allProviders[config.provider]?.apiKey)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="AI 模型设置"
          className="relative text-white hover:bg-white/10"
        >
          <Settings2 className="h-5 w-5" />
          {/* 配置状态指示点 */}
          <span
            className={`absolute top-1 right-1 h-2 w-2 rounded-full ${
              isConfigured ? 'bg-green-400' : 'bg-red-400 animate-pulse'
            }`}
          />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl" style={{ border: '1px solid rgba(45,90,39,0.15)' }}>
        {/* 无障碍访问标题（视觉隐藏，供屏幕阅读器使用） */}
        <DialogTitle className="sr-only">AI 模型配置</DialogTitle>
        <DialogDescription className="sr-only">配置 AI 模型提供商、API Key 和模型名称</DialogDescription>
        {/* 弹窗头部 */}
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #1E3D1A 0%, #2D5A27 60%, #3A6E33 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white" style={{ fontFamily: "'Songti SC', serif" }}>AI 模型配置</h2>
              <p className="text-xs text-green-200/70">配置绑定账号，登录后自动加载，无需重复填写</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* 提供商选择 */}
          <div className="space-y-2">
            <Label style={{ color: '#3D2B1F', fontWeight: 600 }}>模型提供商</Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full h-11 rounded-xl" style={{ border: '1.5px solid rgba(45,90,39,0.2)', background: 'white' }}>
                <SelectValue placeholder="选择提供商" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_ORDER.map((key) => {
                  const p = PROVIDERS[key]
                  const isSaved = !!(allProviders[key]?.apiKey)
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{p.label}</span>
                        {isSaved && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                            ✓ 已配置
                          </span>
                        )}
                        {!isSaved && p.badge && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.badgeColor}`}>
                            {p.badge}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* 谷高中转提示 */}
          {(config.provider === 'gemini' || config.provider === 'openai') && (
            <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: '#F0F7EE', border: '1px solid rgba(45,90,39,0.2)', color: '#2D5A27' }}>
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>已预配置<strong>谷高中转</strong>（api.gdoubolai.com），国内可直接使用。填入谷高令牌即可，无需代理。</span>
            </div>
          )}

          {/* API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey" style={{ color: '#3D2B1F', fontWeight: 600 }}>API Key</Label>
              {currentProviderSaved && (
                <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#EBF5E9', color: '#2D5A27' }}>
                  <CheckCircle2 className="h-3 w-3" />
                  已保存
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder={currentProvider?.apiKeyPlaceholder || '输入 API Key'}
                autoComplete="off"
                className="h-11 rounded-xl pr-11"
                style={{ border: '1.5px solid rgba(45,90,39,0.2)' }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                title={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {currentProvider?.apiKeyHint && (
              <p className="text-[11px]" style={{ color: '#8B6B4A' }}>
                💡 {currentProvider.apiKeyHint}
              </p>
            )}
          </div>

          {/* 模型选择 */}
          <div className="space-y-2">
            <Label htmlFor="modelName" style={{ color: '#3D2B1F', fontWeight: 600 }}>模型</Label>
            {hasModels ? (
              <Select value={config.modelName} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full h-11 rounded-xl" style={{ border: '1.5px solid rgba(45,90,39,0.2)', background: 'white' }}>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {currentProvider.models.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.label}</span>
                        {m.desc && (
                          <span className="text-[11px] text-muted-foreground">{m.desc}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="modelName"
                value={config.modelName}
                onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                placeholder="输入模型名称，如 gpt-4"
                className="h-11 rounded-xl"
                style={{ border: '1.5px solid rgba(45,90,39,0.2)' }}
              />
            )}
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="baseUrl" style={{ color: '#3D2B1F', fontWeight: 600 }}>
              Base URL
              <span className="ml-1 text-[11px] font-normal" style={{ color: '#8B6B4A' }}>（高级 · 中转服务时修改）</span>
            </Label>
            <Input
              id="baseUrl"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://api..."
              className="h-11 rounded-xl"
              style={{ border: '1.5px solid rgba(45,90,39,0.2)' }}
            />
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(45,90,39,0.1)', background: 'rgba(45,90,39,0.02)' }}>
          {isConfigured ? (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#2D5A27' }}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">已配置</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: '#8B6B4A' }}>
              <AlertCircle className="h-4 w-4" />
              <span>尚未配置</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 h-10 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #E8820A, #F59E0B)', boxShadow: '0 3px 10px rgba(232,130,10,0.3)' }}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

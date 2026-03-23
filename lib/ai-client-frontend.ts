import { AIConfig } from "@/components/model-settings";

/**
 * Wraps fetch() with AI config headers loaded from localStorage.
 * All generate API routes use this to receive per-user model configuration.
 */
export async function fetchWithAIConfig(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  const savedConfig = localStorage.getItem('lingzhi_ai_config');
  if (savedConfig) {
    try {
      const config: AIConfig = JSON.parse(savedConfig);
      if (config.apiKey)    headers.set('x-custom-api-key',  config.apiKey);
      if (config.baseUrl)   headers.set('x-custom-base-url', config.baseUrl);
      if (config.modelName) headers.set('x-custom-model',    config.modelName);
      if (config.provider)  headers.set('x-custom-provider', config.provider);
    } catch (e) {
      console.error("Failed to parse AI config from localStorage", e);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Returns the current AI config from localStorage, or null if not set.
 */
export function getAIConfig(): AIConfig | null {
  try {
    const saved = localStorage.getItem('lingzhi_ai_config');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable label for the current provider.
 */
export function getProviderLabel(provider?: string): string {
  const labels: Record<string, string> = {
    deepseek: 'DeepSeek',
    kimi: 'Kimi',
    gemini: 'Gemini',
    claude: 'Claude',
    openai: 'OpenAI',
    custom: '自定义',
  };
  return labels[provider || ''] || provider || '未配置';
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getUserAIConfigs, upsertProviderConfig } from '@/lib/ai-config-db';

const JWT_SECRET = process.env.JWT_SECRET || 'lingzhi-dev-secret-change-in-production';

async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    return decoded.id;
  } catch {
    return null;
  }
}

/**
 * GET /api/user/ai-config
 * 返回用户的全部服务商配置（allProviders map）和当前激活服务商。
 * 前端据此在切换服务商时自动回填已保存的 Key。
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const configs = getUserAIConfigs(userId);
  if (!configs) {
    return NextResponse.json({ config: null, allProviders: {}, activeProvider: null });
  }

  const activeProvider = configs.activeProvider;
  const activePc = configs.providers[activeProvider];

  return NextResponse.json({
    // 向后兼容：当前激活服务商的单条配置
    config: activePc
      ? {
          provider: activeProvider,
          apiKey: activePc.apiKey,
          baseUrl: activePc.baseUrl,
          modelName: activePc.modelName,
        }
      : null,
    // 新增：所有服务商的已保存配置
    allProviders: Object.fromEntries(
      Object.entries(configs.providers).map(([prov, pc]) => [
        prov,
        { apiKey: pc.apiKey, baseUrl: pc.baseUrl, modelName: pc.modelName },
      ])
    ),
    activeProvider,
  });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const body = await request.json();
  const { provider, apiKey, baseUrl, modelName } = body;
  if (!apiKey || !baseUrl || !modelName || !provider) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  const ok = upsertProviderConfig(userId, provider, { apiKey, baseUrl, modelName });
  if (!ok) {
    return NextResponse.json({ error: '保存失败，请重试' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

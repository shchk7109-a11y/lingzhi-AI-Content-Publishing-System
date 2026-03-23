import fs from 'fs';
import path from 'path';

const AI_CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'ai-configs.json');

// ── 单个服务商配置 ──────────────────────────────────────
export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  updatedAt: string;
}

// ── 用户的全部服务商配置（按 provider 键名存储） ──────────
export interface UserAIConfigs {
  userId: string;
  /** 当前激活的服务商 */
  activeProvider: string;
  /** 每个服务商的独立配置，key 为 provider 名称 */
  providers: Record<string, ProviderConfig>;
  updatedAt: string;
}

// ── 旧格式兼容接口 ────────────────────────────────────────
export interface UserAIConfig {
  userId: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────

function ensureDataDir() {
  const dir = path.dirname(AI_CONFIG_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readRawFile(): any[] {
  try {
    if (!fs.existsSync(AI_CONFIG_FILE_PATH)) return [];
    const content = fs.readFileSync(AI_CONFIG_FILE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeRawFile(data: any[]): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(AI_CONFIG_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Error saving ai-configs:", error);
    return false;
  }
}

/**
 * 读取用户的全部服务商配置（新格式）。
 * 若文件中存有旧格式（单条记录），自动迁移为新格式。
 */
export function getUserAIConfigs(userId: string): UserAIConfigs | null {
  const all = readRawFile();

  // 尝试找新格式记录
  const newFmt = all.find((r: any) => r.userId === userId && r.providers !== undefined) as UserAIConfigs | undefined;
  if (newFmt) return newFmt;

  // 尝试找旧格式记录并迁移
  const oldFmt = all.find((r: any) => r.userId === userId && r.providers === undefined) as UserAIConfig | undefined;
  if (oldFmt) {
    const migrated: UserAIConfigs = {
      userId,
      activeProvider: oldFmt.provider,
      providers: {
        [oldFmt.provider]: {
          apiKey: oldFmt.apiKey,
          baseUrl: oldFmt.baseUrl,
          modelName: oldFmt.modelName,
          updatedAt: oldFmt.updatedAt,
        },
      },
      updatedAt: oldFmt.updatedAt,
    };
    // 写回迁移后的数据
    upsertUserAIConfigs(migrated);
    return migrated;
  }

  return null;
}

/**
 * 保存/更新用户的全部服务商配置。
 */
export function upsertUserAIConfigs(configs: UserAIConfigs): boolean {
  const all = readRawFile();
  // 移除同 userId 的旧记录（新旧格式均移除）
  const filtered = all.filter((r: any) => r.userId !== configs.userId);
  filtered.push({ ...configs, updatedAt: new Date().toISOString() });
  return writeRawFile(filtered);
}

/**
 * 保存单个服务商的配置，并将其设为当前激活服务商。
 */
export function upsertProviderConfig(
  userId: string,
  provider: string,
  providerConfig: Omit<ProviderConfig, 'updatedAt'>
): boolean {
  const existing = getUserAIConfigs(userId) ?? {
    userId,
    activeProvider: provider,
    providers: {},
    updatedAt: new Date().toISOString(),
  };

  existing.activeProvider = provider;
  existing.providers[provider] = {
    ...providerConfig,
    updatedAt: new Date().toISOString(),
  };
  existing.updatedAt = new Date().toISOString();

  return upsertUserAIConfigs(existing);
}

// ── 向后兼容：旧调用方式 ──────────────────────────────────

/** @deprecated 请使用 getUserAIConfigs */
export function getAIConfigByUserId(userId: string): UserAIConfig | null {
  const configs = getUserAIConfigs(userId);
  if (!configs) return null;
  const prov = configs.activeProvider;
  const pc = configs.providers[prov];
  if (!pc) return null;
  return {
    userId,
    provider: prov,
    apiKey: pc.apiKey,
    baseUrl: pc.baseUrl,
    modelName: pc.modelName,
    updatedAt: pc.updatedAt,
  };
}

/** @deprecated 请使用 upsertProviderConfig */
export function upsertAIConfig(config: Omit<UserAIConfig, 'updatedAt'>): boolean {
  return upsertProviderConfig(config.userId, config.provider, {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    modelName: config.modelName,
  });
}

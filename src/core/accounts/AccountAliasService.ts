const PLATFORM_PREFIX: Record<string, string> = {
  xiaohongshu: 'xhs'
}

const PINYIN_FALLBACK: Record<string, string> = {
  灵: 'ling',
  芝: 'zhi',
  水: 'shui',
  铺: 'pu',
  一: 'yi',
  号: 'hao'
}

export interface GenerateAccountAliasInput {
  platform: string
  bloggerId: string
  sequence: number
}

export class AccountAliasService {
  generateAlias(input: GenerateAccountAliasInput): string {
    const platform = this.normalizePlatform(input.platform)
    const bloggerSlug = this.normalizeBloggerId(input.bloggerId)
    const sequence = this.normalizeSequence(input.sequence)

    return `${PLATFORM_PREFIX[platform]}_${bloggerSlug}_${sequence}`
  }

  private normalizePlatform(platform: string): string {
    if (typeof platform !== 'string' || platform.trim() === '') {
      throw new Error('platform is required')
    }

    const normalized = platform.trim().toLowerCase()
    if (!PLATFORM_PREFIX[normalized]) {
      throw new Error('platform must be xiaohongshu')
    }

    return normalized
  }

  private normalizeBloggerId(bloggerId: string): string {
    if (typeof bloggerId !== 'string' || bloggerId.trim() === '') {
      throw new Error('bloggerId is required')
    }

    const tokens: string[] = []
    let current = ''

    const flushCurrent = (): void => {
      if (current) {
        tokens.push(current)
        current = ''
      }
    }

    for (const rawChar of bloggerId.trim()) {
      const mapped = PINYIN_FALLBACK[rawChar]
      if (mapped) {
        flushCurrent()
        tokens.push(mapped)
        continue
      }

      const char = rawChar.toLowerCase()
      if (/^[a-z0-9]$/.test(char)) {
        current += char
        continue
      }

      flushCurrent()
    }

    flushCurrent()

    if (tokens.length === 0) {
      throw new Error('bloggerId must contain at least one supported character')
    }

    return tokens.join('_')
  }

  private normalizeSequence(sequence: number): string {
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error('sequence must be a positive integer')
    }

    return String(sequence).padStart(3, '0')
  }
}

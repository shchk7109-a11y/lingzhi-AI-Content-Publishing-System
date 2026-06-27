import { describe, expect, it } from 'vitest'
import { AccountAliasService } from './AccountAliasService'

describe('AccountAliasService', () => {
  const service = new AccountAliasService()

  it('generates stable lowercase aliases for Xiaohongshu accounts', () => {
    expect(service.generateAlias({
      platform: 'xiaohongshu',
      bloggerId: 'Herbal Shop A',
      sequence: 3
    })).toBe('xhs_herbal_shop_a_003')
  })

  it('uses deterministic pinyin fallback for supported Chinese characters', () => {
    expect(service.generateAlias({
      platform: 'xiaohongshu',
      bloggerId: '灵芝水铺-一号!',
      sequence: 12
    })).toBe('xhs_ling_zhi_shui_pu_yi_hao_012')
  })

  it('normalizes whitespace, case, and repeated separators', () => {
    expect(service.generateAlias({
      platform: ' xiaohongshu ',
      bloggerId: '  Herbal---Shop___A  ',
      sequence: 7
    })).toBe('xhs_herbal_shop_a_007')
  })

  it('strips unsupported characters and keeps aliases deterministic', () => {
    expect(service.generateAlias({
      platform: 'xiaohongshu',
      bloggerId: 'A店@#$%B',
      sequence: 1000
    })).toBe('xhs_a_b_1000')
  })

  it('rejects invalid input', () => {
    expect(() => service.generateAlias({ platform: '', bloggerId: 'Herbal', sequence: 1 })).toThrow('platform is required')
    expect(() => service.generateAlias({ platform: 'douyin', bloggerId: 'Herbal', sequence: 1 })).toThrow('platform must be xiaohongshu')
    expect(() => service.generateAlias({ platform: 'xiaohongshu', bloggerId: '', sequence: 1 })).toThrow('bloggerId is required')
    expect(() => service.generateAlias({ platform: 'xiaohongshu', bloggerId: '!!!', sequence: 1 })).toThrow('bloggerId must contain at least one supported character')
    expect(() => service.generateAlias({ platform: 'xiaohongshu', bloggerId: 'Herbal', sequence: 0 })).toThrow('sequence must be a positive integer')
    expect(() => service.generateAlias({ platform: 'xiaohongshu', bloggerId: 'Herbal', sequence: 1.5 })).toThrow('sequence must be a positive integer')
  })
})

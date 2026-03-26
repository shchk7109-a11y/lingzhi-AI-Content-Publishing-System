import { getDatabase } from '../database/db'
import { MATCH_WEIGHTS } from '../shared/constants'
import type { ContentItem, Account, MatchRecord, MatchRule } from '../shared/types'

/**
 * 智能匹配引擎
 * 硬规则过滤 + 软评分 + 轮换均衡 + 溢出处理
 */
export class SmartMatcher {
  /**
   * 执行一轮完整匹配
   * @returns 生成的匹配记录列表
   */
  runMatch(): MatchRecord[] {
    // TODO: implement
    // 1. 加载所有pending状态的内容
    // 2. 加载所有active状态的账号
    // 3. 加载匹配规则
    // 4. 对每个账号，筛选可用内容 → 硬规则过滤 → 软评分排序
    // 5. 按优先级分配，考虑轮换均衡
    // 6. 溢出处理（剩余内容降级分配）
    // 7. 写入match_records表
    return []
  }

  /**
   * 硬规则过滤：排除不符合条件的内容-账号组合
   */
  applyHardRules(content: ContentItem, account: Account, rules: MatchRule[]): boolean {
    // TODO: implement
    // 1. 遍历所有启用的规则
    // 2. 检查content[rule.content_field]和account[rule.account_field]
    // 3. 根据operator执行比较
    // 4. 如果命中exclude规则，返回false
    void content
    void account
    void rules
    return true
  }

  /**
   * 软评分：计算内容与账号的匹配度
   */
  calculateScore(content: ContentItem, account: Account): number {
    let score = 0

    // 性别匹配
    if (content.gender === 'all' || content.gender === account.persona.gender) {
      score += MATCH_WEIGHTS.GENDER
    }

    // 年龄段匹配
    if (content.age_group === 'all' || content.age_group === account.persona.age_group) {
      score += MATCH_WEIGHTS.AGE_GROUP
    }

    // 健康关注匹配
    if (content.health_focus === 'general' || content.health_focus === account.persona.health_focus) {
      score += MATCH_WEIGHTS.HEALTH_FOCUS
    }

    // 产品线匹配
    if (content.product_line === 'all' || content.product_line === account.persona.product_line || account.persona.product_line === 'mixed') {
      score += MATCH_WEIGHTS.PRODUCT_LINE
    }

    return score
  }

  /**
   * 计算新鲜度加分（优先分配新内容和少分配的内容）
   */
  calculateFreshnessBonus(content: ContentItem): number {
    // TODO: implement
    // 基于assign_count和created_at计算新鲜度
    // assign_count越少，bonus越高
    // created_at越新，bonus越高
    void content
    return 0
  }

  /**
   * 轮换均衡：确保账号间发布数量均匀
   */
  balanceDistribution(
    _candidates: Array<{ content: ContentItem; account: Account; score: number }>
  ): Array<{ content_id: number; account_id: number; score: number; freshness: number }> {
    // TODO: implement
    // 1. 按账号的publish_count_week排序（少的优先）
    // 2. 每个账号不超过daily_limit
    // 3. 同一内容不重复分配给同一账号
    return []
  }

  /**
   * 溢出处理：剩余未分配内容的降级策略
   */
  handleOverflow(_unmatched: ContentItem[], _accounts: Account[]): void {
    // TODO: implement
    // 1. 放宽匹配条件（忽略部分画像维度）
    // 2. 或标记为"待人工分配"
  }

  /**
   * 将匹配结果写入数据库
   */
  saveMatchRecords(
    records: Array<{ content_id: number; account_id: number; score: number; freshness: number }>
  ): void {
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT INTO match_records (content_id, account_id, match_score, freshness_bonus, final_priority)
      VALUES (?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction(() => {
      for (const r of records) {
        insert.run(r.content_id, r.account_id, r.score, r.freshness, r.score + r.freshness)
      }
    })

    transaction()
  }
}

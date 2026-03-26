import { Card, Descriptions, Tag } from 'antd'
import type { Account } from '../../shared/types'

interface AccountCardProps {
  account: Account
  onClick?: (account: Account) => void
}

const levelLabels: Record<string, string> = {
  new: '新号',
  growing: '成长期',
  mature: '成熟号'
}

function AccountCard({ account, onClick }: AccountCardProps): JSX.Element {
  return (
    <Card
      hoverable
      size="small"
      onClick={() => onClick?.(account)}
      style={{ marginBottom: 12 }}
      title={account.nickname}
      extra={
        <Tag color={account.status === 'active' ? 'success' : account.status === 'paused' ? 'warning' : 'error'}>
          {account.status}
        </Tag>
      }
    >
      <Descriptions size="small" column={2}>
        <Descriptions.Item label="平台">{account.platform}</Descriptions.Item>
        <Descriptions.Item label="等级">{levelLabels[account.account_level] || account.account_level}</Descriptions.Item>
        <Descriptions.Item label="日限额">{account.daily_limit}</Descriptions.Item>
        <Descriptions.Item label="周发布">{account.publish_count_week}/{account.weekly_target}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}

export default AccountCard

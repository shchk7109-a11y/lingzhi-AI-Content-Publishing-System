import { List, Progress, Tag, Typography } from 'antd'
import type { MatchRecord } from '../../shared/types'

const { Text } = Typography

interface MatchResultItemProps {
  record: MatchRecord & { content_title?: string; account_nickname?: string }
}

const statusColors: Record<string, string> = {
  pending: 'default',
  confirmed: 'processing',
  published: 'success',
  cancelled: 'warning'
}

function MatchResultItem({ record }: MatchResultItemProps): JSX.Element {
  return (
    <List.Item
      extra={
        <Tag color={statusColors[record.status]}>{record.status}</Tag>
      }
    >
      <List.Item.Meta
        title={
          <span>
            <Text strong>{record.content_title || `内容#${record.content_id}`}</Text>
            {' → '}
            <Text>{record.account_nickname || `账号#${record.account_id}`}</Text>
          </span>
        }
        description={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>匹配分: {record.match_score.toFixed(1)}</span>
            <Progress
              percent={Math.min(record.final_priority, 100)}
              size="small"
              style={{ width: 120 }}
              showInfo={false}
            />
            <span>优先级: {record.final_priority.toFixed(1)}</span>
          </div>
        }
      />
    </List.Item>
  )
}

export default MatchResultItem

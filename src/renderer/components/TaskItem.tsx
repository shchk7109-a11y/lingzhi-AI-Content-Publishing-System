import { Button, List, Tag, Typography } from 'antd'
import { RedoOutlined } from '@ant-design/icons'
import type { Task } from '../../shared/types'

const { Text } = Typography

interface TaskItemProps {
  task: Task & { content_title?: string; account_nickname?: string }
  onRetry?: (taskId: number) => void
}

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待执行' },
  queued: { color: 'processing', text: '排队中' },
  running: { color: 'blue', text: '执行中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  timeout: { color: 'warning', text: '超时' }
}

function TaskItem({ task, onRetry }: TaskItemProps): JSX.Element {
  const info = statusMap[task.status] || { color: 'default', text: task.status }

  return (
    <List.Item
      actions={
        task.status === 'failed' || task.status === 'timeout'
          ? [
              <Button key="retry" size="small" icon={<RedoOutlined />} onClick={() => onRetry?.(task.id)}>
                重试
              </Button>
            ]
          : []
      }
    >
      <List.Item.Meta
        title={
          <span>
            <Text strong>{task.content_title || `内容#${task.content_id}`}</Text>
            {' → '}
            <Text>{task.account_nickname || `账号#${task.account_id}`}</Text>
            <Tag color={info.color} style={{ marginLeft: 8 }}>
              {info.text}
            </Tag>
          </span>
        }
        description={
          <span>
            平台: {task.platform} | 重试: {task.retry_count}
            {task.last_step && ` | 最后步骤: ${task.last_step}`}
            {task.error_log && <Text type="danger"> | {task.error_log}</Text>}
          </span>
        }
      />
    </List.Item>
  )
}

export default TaskItem

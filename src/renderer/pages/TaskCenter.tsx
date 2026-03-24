import { useEffect } from 'react'
import { Button, Space, Table, Tag, Typography } from 'antd'
import { CaretRightOutlined, ReloadOutlined, RedoOutlined } from '@ant-design/icons'
import { useTaskStore } from '../stores/taskStore'
import type { Task } from '../../shared/types'

const { Title } = Typography

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待执行' },
  queued: { color: 'processing', text: '排队中' },
  running: { color: 'blue', text: '执行中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  timeout: { color: 'warning', text: '超时' }
}

function TaskCenter(): JSX.Element {
  const { tasks, loading, loadTasks, startTasks, retryTask } = useTaskStore()

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '内容', dataIndex: 'content_title', key: 'content_title', ellipsis: true },
    { title: '账号', dataIndex: 'account_nickname', key: 'account_nickname', width: 120 },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const info = statusMap[v] || { color: 'default', text: v }
        return <Tag color={info.color}>{info.text}</Tag>
      }
    },
    { title: '重试', dataIndex: 'retry_count', key: 'retry_count', width: 60 },
    { title: '计划时间', dataIndex: 'scheduled_at', key: 'scheduled_at', width: 170 },
    { title: '完成时间', dataIndex: 'finished_at', key: 'finished_at', width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: Task) =>
        record.status === 'failed' || record.status === 'timeout' ? (
          <Button size="small" icon={<RedoOutlined />} onClick={() => retryTask(record.id)}>
            重试
          </Button>
        ) : null
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          任务中心
        </Title>
        <Space>
          <Button icon={<CaretRightOutlined />} type="primary" onClick={() => startTasks([])}>
            启动全部待执行
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadTasks()}>
            刷新
          </Button>
        </Space>
      </div>
      <Table<Task & { content_title?: string; account_nickname?: string }>
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
      />
    </div>
  )
}

export default TaskCenter

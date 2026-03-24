import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Typography, Tabs, Empty } from 'antd'
import { CaretRightOutlined, ReloadOutlined, RedoOutlined } from '@ant-design/icons'
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

type TaskRow = Task & { content_title?: string; account_nickname?: string }

function TaskCenter(): JSX.Element {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await window.api.tasks.getAll()
      setTasks(data as TaskRow[])
    } catch {
      // API未就绪
    }
    setLoading(false)
  }

  const handleRetry = async (taskId: number): Promise<void> => {
    try {
      await window.api.tasks.updateStatus(taskId, 'queued', { error_log: '' })
      loadTasks()
    } catch {
      // ignore
    }
  }

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === statusFilter)

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '内容', dataIndex: 'content_title', key: 'content_title', ellipsis: true },
    { title: '账号', dataIndex: 'account_nickname', key: 'account_nickname', width: 120 },
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const info = statusMap[v] || { color: 'default', text: v }
        return <Tag color={info.color}>{info.text}</Tag>
      }
    },
    { title: '重试', dataIndex: 'retry_count', key: 'retry_count', width: 60 },
    { title: '计划时间', dataIndex: 'scheduled_at', key: 'scheduled_at', width: 165 },
    { title: '完成时间', dataIndex: 'finished_at', key: 'finished_at', width: 165 },
    {
      title: '操作', key: 'actions', width: 80,
      render: (_: unknown, record: TaskRow) =>
        record.status === 'failed' || record.status === 'timeout' ? (
          <Button size="small" icon={<RedoOutlined />} onClick={() => handleRetry(record.id)}>重试</Button>
        ) : null
    }
  ]

  const tabItems = [
    { key: 'all', label: `全部 (${tasks.length})` },
    { key: 'queued', label: `排队中 (${tasks.filter((t) => t.status === 'queued' || t.status === 'pending').length})` },
    { key: 'running', label: `运行中 (${tasks.filter((t) => t.status === 'running').length})` },
    { key: 'success', label: `已完成 (${tasks.filter((t) => t.status === 'success').length})` },
    { key: 'failed', label: `失败 (${tasks.filter((t) => t.status === 'failed' || t.status === 'timeout').length})` }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>任务中心</Title>
        <Space>
          <Button icon={<CaretRightOutlined />} type="primary">启动全部待执行</Button>
          <Button icon={<ReloadOutlined />} onClick={loadTasks}>刷新</Button>
        </Space>
      </div>

      <Tabs
        activeKey={statusFilter}
        onChange={(key) => setStatusFilter(key)}
        items={tabItems}
        style={{ marginBottom: 8 }}
      />

      <Table<TaskRow>
        columns={columns}
        dataSource={filteredTasks}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        locale={{ emptyText: <Empty description="暂无任务" /> }}
      />
    </div>
  )
}

export default TaskCenter

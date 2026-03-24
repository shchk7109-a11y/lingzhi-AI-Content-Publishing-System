import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Typography, message } from 'antd'
import { ThunderboltOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import type { MatchRecord } from '../../shared/types'

const { Title } = Typography

const statusColors: Record<string, string> = {
  pending: 'default',
  confirmed: 'processing',
  published: 'success',
  cancelled: 'warning'
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
  { title: '内容', dataIndex: 'content_title', key: 'content_title', ellipsis: true },
  { title: '账号', dataIndex: 'account_nickname', key: 'account_nickname', width: 120 },
  {
    title: '匹配分',
    dataIndex: 'match_score',
    key: 'match_score',
    width: 90,
    render: (v: number) => v.toFixed(1)
  },
  {
    title: '新鲜度',
    dataIndex: 'freshness_bonus',
    key: 'freshness_bonus',
    width: 90,
    render: (v: number) => v.toFixed(1)
  },
  {
    title: '优先级',
    dataIndex: 'final_priority',
    key: 'final_priority',
    width: 90,
    render: (v: number) => v.toFixed(1)
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (v: string) => <Tag color={statusColors[v]}>{v}</Tag>
  },
  { title: '匹配时间', dataIndex: 'matched_at', key: 'matched_at', width: 170 }
]

function SmartMatch(): JSX.Element {
  const [records, setRecords] = useState<(MatchRecord & { content_title?: string; account_nickname?: string })[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await window.api.matchList()
      setRecords(data)
    } catch {
      // 开发模式下API可能未就绪
    }
    setLoading(false)
  }

  const handleRunMatch = async (): Promise<void> => {
    try {
      await window.api.matchRun()
      message.success('匹配完成')
      loadRecords()
    } catch {
      message.error('匹配失败')
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择匹配记录')
      return
    }
    try {
      await window.api.matchConfirm(selectedRowKeys)
      message.success('已确认匹配并创建任务')
      setSelectedRowKeys([])
      loadRecords()
    } catch {
      message.error('确认失败')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          智能匹配
        </Title>
        <Space>
          <Button icon={<ThunderboltOutlined />} type="primary" onClick={handleRunMatch}>
            执行匹配
          </Button>
          <Button icon={<CheckOutlined />} onClick={handleConfirm} disabled={selectedRowKeys.length === 0}>
            确认选中 ({selectedRowKeys.length})
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadRecords}>
            刷新
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[])
        }}
      />
    </div>
  )
}

export default SmartMatch

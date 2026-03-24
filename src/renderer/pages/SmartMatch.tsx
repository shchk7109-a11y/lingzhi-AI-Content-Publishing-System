import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Typography, Card, Col, Row, Statistic, Empty, message } from 'antd'
import { ThunderboltOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import type { MatchRecord } from '../../shared/types'

const { Title } = Typography

const statusColors: Record<string, string> = {
  pending: 'default',
  confirmed: 'processing',
  published: 'success',
  cancelled: 'warning'
}

const statusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
  published: '已发布',
  cancelled: '已取消'
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
  { title: '内容', dataIndex: 'content_title', key: 'content_title', ellipsis: true },
  { title: '账号', dataIndex: 'account_nickname', key: 'account_nickname', width: 120 },
  {
    title: '匹配分', dataIndex: 'match_score', key: 'match_score', width: 80,
    render: (v: number) => <span style={{ color: v >= 80 ? '#1A5C3A' : v >= 50 ? '#D4A853' : '#999' }}>{v?.toFixed(1)}</span>
  },
  {
    title: '新鲜度', dataIndex: 'freshness_bonus', key: 'freshness_bonus', width: 80,
    render: (v: number) => v?.toFixed(1)
  },
  {
    title: '优先级', dataIndex: 'final_priority', key: 'final_priority', width: 80,
    render: (v: number) => <Tag color={v >= 80 ? 'green' : v >= 50 ? 'gold' : 'default'}>{v?.toFixed(1)}</Tag>
  },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 90,
    render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
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
      const data = await window.api.matchRecords.getAll()
      setRecords(data as typeof records)
    } catch {
      // API未就绪
    }
    setLoading(false)
  }

  const handleRunMatch = async (): Promise<void> => {
    message.info('智能匹配引擎开发中，请先导入内容和账号')
  }

  const handleConfirm = async (): Promise<void> => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择匹配记录')
      return
    }
    try {
      for (const id of selectedRowKeys) {
        await window.api.matchRecords.updateStatus(id, 'confirmed')
      }
      message.success(`已确认 ${selectedRowKeys.length} 条匹配`)
      setSelectedRowKeys([])
      loadRecords()
    } catch {
      message.error('确认失败')
    }
  }

  const pendingCount = records.filter((r) => r.status === 'pending').length
  const confirmedCount = records.filter((r) => r.status === 'confirmed').length

  const hasData = records.length > 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>智能匹配</Title>
        <Space>
          <Button icon={<ThunderboltOutlined />} type="primary" onClick={handleRunMatch} disabled={!hasData}>
            开始匹配
          </Button>
          <Button icon={<CheckOutlined />} onClick={handleConfirm} disabled={selectedRowKeys.length === 0}>
            确认选中 ({selectedRowKeys.length})
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadRecords}>刷新</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small"><Statistic title="匹配总数" value={records.length} /></Card>
        </Col>
        <Col span={8}>
          <Card size="small"><Statistic title="待确认" value={pendingCount} valueStyle={{ color: '#D4A853' }} /></Card>
        </Col>
        <Col span={8}>
          <Card size="small"><Statistic title="已确认" value={confirmedCount} valueStyle={{ color: '#1A5C3A' }} /></Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
          getCheckboxProps: (record) => ({ disabled: record.status !== 'pending' })
        }}
        locale={{ emptyText: <Empty description="请先导入内容和账号，再执行匹配" /> }}
      />
    </div>
  )
}

export default SmartMatch

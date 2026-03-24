import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography, Table, Tag } from 'antd'
import {
  FileTextOutlined,
  TeamOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PercentageOutlined
} from '@ant-design/icons'
import LogViewer from '../components/LogViewer'

const { Title } = Typography

interface DashboardStats {
  totalContent: number
  totalAccounts: number
  totalTasks: number
  successTasks: number
  pendingTasks: number
  activeAccounts: number
  successRate: number
}

const defaultStats: DashboardStats = {
  totalContent: 0,
  totalAccounts: 0,
  totalTasks: 0,
  successTasks: 0,
  pendingTasks: 0,
  activeAccounts: 0,
  successRate: 0
}

const recentTaskColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
  { title: '内容', dataIndex: 'content_title', key: 'content_title', ellipsis: true },
  { title: '账号', dataIndex: 'account_nickname', key: 'account_nickname', width: 120 },
  { title: '平台', dataIndex: 'platform', key: 'platform', width: 90, render: (v: string) => <Tag>{v}</Tag> },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 80,
    render: (v: string) => {
      const map: Record<string, { color: string; text: string }> = {
        success: { color: 'success', text: '成功' },
        failed: { color: 'error', text: '失败' },
        running: { color: 'processing', text: '运行中' },
        pending: { color: 'default', text: '待执行' },
        queued: { color: 'warning', text: '排队中' }
      }
      const info = map[v] || { color: 'default', text: v }
      return <Tag color={info.color}>{info.text}</Tag>
    }
  }
]

function Dashboard(): JSX.Element {
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [recentTasks, setRecentTasks] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async (): Promise<void> => {
    try {
      const [statsData, tasksData] = await Promise.all([
        window.api.stats.dashboard(),
        window.api.tasks.getAll()
      ])
      setStats(statsData)
      setRecentTasks((tasksData as Record<string, unknown>[]).slice(0, 10))
    } catch {
      // 开发模式下API可能未就绪
    }
  }

  return (
    <div>
      <Title level={4} style={{ color: '#1A5C3A' }}>发布统计</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="今日发布" value={stats.successTasks} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1A5C3A' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="成功率" value={stats.successRate} suffix="%" prefix={<PercentageOutlined />} valueStyle={{ color: '#D4A853' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="待发布" value={stats.pendingTasks} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="活跃账号" value={stats.activeAccounts} prefix={<TeamOutlined />} valueStyle={{ color: '#1A5C3A' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="内容总数" value={stats.totalContent} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="任务总数" value={stats.totalTasks} prefix={<RocketOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Title level={5}>最近任务</Title>
          <Table
            columns={recentTaskColumns}
            dataSource={recentTasks}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '暂无任务记录' }}
          />
        </Col>
        <Col span={10}>
          <Title level={5}>运行日志</Title>
          <LogViewer />
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard

import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import {
  FileTextOutlined,
  UserOutlined,
  RocketOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import LogViewer from '../components/LogViewer'

const { Title } = Typography

interface DashboardStats {
  totalContent: number
  totalAccounts: number
  totalTasks: number
  successTasks: number
}

function Dashboard(): JSX.Element {
  const [stats, setStats] = useState<DashboardStats>({
    totalContent: 0,
    totalAccounts: 0,
    totalTasks: 0,
    successTasks: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async (): Promise<void> => {
    try {
      const data = await window.api.statsDashboard()
      setStats(data)
    } catch {
      // 开发模式下API可能未就绪
    }
  }

  return (
    <div>
      <Title level={4}>发布统计</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="内容总数" value={stats.totalContent} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="账号总数" value={stats.totalAccounts} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="任务总数" value={stats.totalTasks} prefix={<RocketOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="发布成功"
              value={stats.successTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Title level={4}>实时日志</Title>
      <LogViewer />
    </div>
  )
}

export default Dashboard

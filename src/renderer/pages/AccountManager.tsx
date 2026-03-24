import { useEffect } from 'react'
import { Button, Space, Table, Tag, Typography, Input, Empty } from 'antd'
import { PlusOutlined, ImportOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useAccountStore } from '../stores/accountStore'
import type { Account } from '../../shared/types'

const { Title } = Typography

const levelLabels: Record<string, string> = { new: '新号', growing: '成长期', mature: '成熟号' }
const levelColors: Record<string, string> = { new: 'default', growing: 'processing', mature: 'success' }
const statusLabels: Record<string, string> = { active: '活跃', paused: '暂停', banned: '封禁' }
const statusColors: Record<string, string> = { active: 'success', paused: 'warning', banned: 'error' }

const columns = [
  { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 140 },
  {
    title: '平台', dataIndex: 'platform', key: 'platform', width: 100,
    render: (v: string) => <Tag>{v}</Tag>
  },
  { title: '客户ID', dataIndex: 'customer_id', key: 'customer_id', width: 120, ellipsis: true },
  {
    title: '等级', dataIndex: 'account_level', key: 'account_level', width: 90,
    render: (v: string) => <Tag color={levelColors[v]}>{levelLabels[v] || v}</Tag>
  },
  {
    title: '画像', key: 'persona', width: 160, ellipsis: true,
    render: (_: unknown, record: Record<string, unknown>) => {
      const p = typeof record.persona === 'string' ? JSON.parse(record.persona as string || '{}') : (record.persona || {})
      const parts: string[] = []
      if (p.gender) parts.push(p.gender === 'female' ? '女' : '男')
      if (p.health_focus && p.health_focus !== 'general') parts.push(p.health_focus)
      return parts.join(' / ') || '-'
    }
  },
  { title: '日限额', dataIndex: 'daily_limit', key: 'daily_limit', width: 70 },
  {
    title: '周发布', key: 'weekly', width: 90,
    render: (_: unknown, r: Record<string, unknown>) => `${r.publish_count_week || 0}/${r.weekly_target || 10}`
  },
  { title: '地区', dataIndex: 'region', key: 'region', width: 80 },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 80,
    render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
  }
]

function AccountManager(): JSX.Element {
  const { accounts, loading, loadAccounts, searchText, setSearchText } = useAccountStore()

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>账号管理</Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary">添加账号</Button>
          <Button icon={<ImportOutlined />}>批量导入</Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadAccounts()}>刷新</Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索昵称或客户ID"
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
          allowClear
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); loadAccounts() }}
        />
      </Space>

      <Table<Account>
        columns={columns}
        dataSource={accounts}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        locale={{ emptyText: <Empty description="暂无账号，请添加或批量导入" /> }}
      />
    </div>
  )
}

export default AccountManager

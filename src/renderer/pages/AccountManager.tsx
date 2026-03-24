import { useEffect } from 'react'
import { Button, Space, Table, Tag, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAccountStore } from '../stores/accountStore'
import type { Account } from '../../shared/types'

const { Title } = Typography

const levelColors: Record<string, string> = {
  new: 'default',
  growing: 'processing',
  mature: 'success'
}

const statusColors: Record<string, string> = {
  active: 'success',
  paused: 'warning',
  banned: 'error'
}

const columns = [
  { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
  {
    title: '平台',
    dataIndex: 'platform',
    key: 'platform',
    width: 100,
    render: (v: string) => <Tag>{v}</Tag>
  },
  { title: '客户ID', dataIndex: 'customer_id', key: 'customer_id', width: 120 },
  {
    title: '等级',
    dataIndex: 'account_level',
    key: 'account_level',
    width: 80,
    render: (v: string) => <Tag color={levelColors[v]}>{v}</Tag>
  },
  { title: '日限额', dataIndex: 'daily_limit', key: 'daily_limit', width: 80 },
  { title: '周发布', dataIndex: 'publish_count_week', key: 'publish_count_week', width: 80 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (v: string) => <Tag color={statusColors[v]}>{v}</Tag>
  }
]

function AccountManager(): JSX.Element {
  const { accounts, loading, loadAccounts } = useAccountStore()

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          账号管理
        </Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary">
            添加账号
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadAccounts()}>
            刷新
          </Button>
        </Space>
      </div>
      <Table<Account>
        columns={columns}
        dataSource={accounts}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
      />
    </div>
  )
}

export default AccountManager

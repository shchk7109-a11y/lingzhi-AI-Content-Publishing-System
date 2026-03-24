import { useEffect } from 'react'
import { Button, Space, Table, Tag, Typography, Upload, message } from 'antd'
import { UploadOutlined, ReloadOutlined } from '@ant-design/icons'
import { useContentStore } from '../stores/contentStore'
import type { ContentItem } from '../../shared/types'

const { Title } = Typography

const statusColors: Record<string, string> = {
  pending: 'default',
  matched: 'processing',
  published: 'success',
  failed: 'error',
  error: 'error'
}

const columns = [
  { title: 'ID', dataIndex: 'draft_id', key: 'draft_id', width: 100 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  {
    title: '平台',
    dataIndex: 'platform',
    key: 'platform',
    width: 100,
    render: (v: string) => <Tag>{v}</Tag>
  },
  {
    title: '类型',
    dataIndex: 'media_type',
    key: 'media_type',
    width: 80,
    render: (v: string) => <Tag color={v === 'video' ? 'purple' : 'blue'}>{v}</Tag>
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (v: string) => <Tag color={statusColors[v]}>{v}</Tag>
  },
  { title: '分配次数', dataIndex: 'assign_count', key: 'assign_count', width: 90 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 }
]

function ContentPool(): JSX.Element {
  const { items, loading, loadContents } = useContentStore()

  useEffect(() => {
    loadContents()
  }, [loadContents])

  const handleImport = (): void => {
    // TODO: implement - Excel文件导入处理
    message.info('Excel导入功能开发中')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          内容池管理
        </Title>
        <Space>
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={() => false} onChange={handleImport}>
            <Button icon={<UploadOutlined />} type="primary">
              导入Excel
            </Button>
          </Upload>
          <Button icon={<ReloadOutlined />} onClick={() => loadContents()}>
            刷新
          </Button>
        </Space>
      </div>
      <Table<ContentItem>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
      />
    </div>
  )
}

export default ContentPool

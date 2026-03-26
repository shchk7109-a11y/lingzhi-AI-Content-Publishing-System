import { useEffect } from 'react'
import { Button, Space, Table, Tag, Typography, Upload, Input, Select, Empty, message } from 'antd'
import { UploadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
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

const statusLabels: Record<string, string> = {
  pending: '待匹配',
  matched: '已匹配',
  published: '已发布',
  failed: '失败',
  error: '异常'
}

const columns = [
  { title: 'ID', dataIndex: 'draft_id', key: 'draft_id', width: 100 },
  { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  {
    title: '平台', dataIndex: 'platform', key: 'platform', width: 100,
    render: (v: string) => <Tag>{v === 'all' ? '全平台' : v}</Tag>
  },
  {
    title: '类型', dataIndex: 'media_type', key: 'media_type', width: 80,
    render: (v: string) => <Tag color={v === 'video' ? 'purple' : 'blue'}>{v === 'video' ? '视频' : '图文'}</Tag>
  },
  {
    title: '标签', dataIndex: 'tags', key: 'tags', width: 200, ellipsis: true,
    render: (v: string) => {
      const tags = typeof v === 'string' ? JSON.parse(v || '[]') : (v || [])
      return tags.slice(0, 3).map((t: string) => <Tag key={t} style={{ marginBottom: 2 }}>{t}</Tag>)
    }
  },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 90,
    render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
  },
  { title: '分配', dataIndex: 'assign_count', key: 'assign_count', width: 60 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 }
]

function ContentPool(): JSX.Element {
  const { items, loading, filters, setFilters, loadContents } = useContentStore()

  useEffect(() => {
    loadContents()
  }, [loadContents])

  const handleImport = (): void => {
    message.info('Excel导入功能开发中')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>内容池管理</Title>
        <Space>
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={() => false} onChange={handleImport}>
            <Button icon={<UploadOutlined />} type="primary">导入Excel</Button>
          </Upload>
          <Button icon={<ReloadOutlined />} onClick={() => loadContents()}>刷新</Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索标题或内容"
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          allowClear
          value={filters.search}
          onChange={(e) => { setFilters({ search: e.target.value }); loadContents() }}
        />
        <Select
          placeholder="标签筛选"
          style={{ width: 140 }}
          allowClear
          value={filters.status || undefined}
          onChange={(v) => { setFilters({ status: v }); loadContents() }}
          options={[
            { value: 'pending', label: '待匹配' },
            { value: 'matched', label: '已匹配' },
            { value: 'published', label: '已发布' },
            { value: 'failed', label: '失败' }
          ]}
        />
        <Select
          placeholder="平台"
          style={{ width: 120 }}
          allowClear
          value={filters.platform || undefined}
          onChange={(v) => { setFilters({ platform: v }); loadContents() }}
          options={[
            { value: 'xiaohongshu', label: '小红书' },
            { value: 'douyin', label: '抖音' },
            { value: 'weixin', label: '微信' }
          ]}
        />
      </Space>

      <Table<ContentItem>
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        locale={{ emptyText: <Empty description="内容池为空，请导入Excel" /> }}
      />
    </div>
  )
}

export default ContentPool

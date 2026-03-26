import { useEffect, useState, useCallback } from 'react'
import {
  Button, Space, Table, Tag, Typography, Tabs, Empty, Modal, Form, Input, Select, Radio, List, message
} from 'antd'
import {
  CaretRightOutlined, ReloadOutlined, RedoOutlined, ExperimentOutlined,
  CheckCircleFilled, CloseCircleFilled, LoadingOutlined, ClockCircleOutlined,
  PictureOutlined, FolderOpenOutlined
} from '@ant-design/icons'
import type { Task } from '../../shared/types'

const { Title, Text } = Typography
const { TextArea } = Input

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待执行' },
  queued: { color: 'processing', text: '排队中' },
  running: { color: 'blue', text: '执行中' },
  success: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  timeout: { color: 'warning', text: '超时' }
}

type TaskRow = Task & { content_title?: string; account_nickname?: string }

interface StepStatus {
  step: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: number
  screenshotPath?: string
  error?: string
}

const PUBLISH_STEPS = [
  { key: 'warmup', label: '预热浏览' },
  { key: 'navigate', label: '导航到创作页' },
  { key: 'upload_media', label: '上传图片' },
  { key: 'input_title', label: '填写标题' },
  { key: 'input_content', label: '填写正文' },
  { key: 'add_tags', label: '添加标签' },
  { key: 'publish', label: '发布' },
  { key: 'cooldown', label: '冷却浏览' }
]

interface BitProfile {
  id: string
  name: string
}

function TaskCenter(): JSX.Element {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // 测试发布Modal
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [profiles, setProfiles] = useState<BitProfile[]>([])
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    PUBLISH_STEPS.map((s) => ({ step: s.key, status: 'pending' as const }))
  )
  const [testForm] = Form.useForm()

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await window.api.tasks.getAll()
      setTasks(data as TaskRow[])
    } catch { /* API未就绪 */ }
    setLoading(false)
  }

  const handleRetry = async (taskId: number): Promise<void> => {
    try {
      await window.api.tasks.updateStatus(taskId, 'queued', { error_log: '' })
      loadTasks()
    } catch { /* ignore */ }
  }

  // 加载Bit Profile列表
  const loadProfiles = async (): Promise<void> => {
    try {
      const list = await window.api.bit.getProfileList()
      setProfiles((list as BitProfile[]) || [])
    } catch {
      message.warning('无法获取Bit Profile列表，请确认Bit浏览器已运行')
    }
  }

  // 打开测试Modal
  const openTestModal = (): void => {
    setTestModalOpen(true)
    setPublishing(false)
    setSelectedImages([])
    setStepStatuses(PUBLISH_STEPS.map((s) => ({ step: s.key, status: 'pending' })))
    testForm.resetFields()
    testForm.setFieldsValue({ accountLevel: 'growing' })
    loadProfiles()
  }

  // 选择图片
  const handleSelectImages = async (): Promise<void> => {
    try {
      const paths = await window.api.dialog.selectImages()
      if (paths && paths.length > 0) {
        setSelectedImages(paths)
      }
    } catch {
      message.error('选择图片失败')
    }
  }

  // 监听步骤进度
  const handleStepUpdate = useCallback((data: unknown) => {
    const update = data as { step: string; status: string; duration?: number; screenshotPath?: string; error?: string }
    setStepStatuses((prev) =>
      prev.map((s) =>
        s.step === update.step
          ? { ...s, status: update.status as StepStatus['status'], duration: update.duration, screenshotPath: update.screenshotPath, error: update.error }
          : s
      )
    )
  }, [])

  // 开始测试发布
  const handleStartPublish = async (): Promise<void> => {
    try {
      const values = await testForm.validateFields()
      if (selectedImages.length === 0) {
        message.warning('请先选择至少一张图片')
        return
      }

      setPublishing(true)
      setStepStatuses(PUBLISH_STEPS.map((s) => ({ step: s.key, status: 'pending' })))

      // 注册监听
      window.api.onPublishStepUpdate(handleStepUpdate)

      const tagsArray = values.tags
        ? values.tags.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean)
        : []

      const result = await window.api.publish.test({
        profileId: values.profileId,
        title: values.title,
        content: values.content,
        tags: tagsArray,
        imagePaths: selectedImages,
        accountLevel: values.accountLevel
      }) as { success: boolean; url?: string; error?: string }

      if (result.success) {
        message.success(result.url ? `发布成功! ${result.url}` : '发布成功!')
      } else {
        message.error(`发布失败: ${result.error}`)
      }
    } catch (error) {
      message.error(`测试发布异常: ${(error as Error).message}`)
    } finally {
      setPublishing(false)
      window.api.removePublishStepListener()
    }
  }

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : statusFilter === 'queued'
      ? tasks.filter((t) => t.status === 'queued' || t.status === 'pending')
      : statusFilter === 'failed'
        ? tasks.filter((t) => t.status === 'failed' || t.status === 'timeout')
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

  // 步骤状态图标
  const getStepIcon = (status: StepStatus['status']): JSX.Element => {
    switch (status) {
      case 'completed': return <CheckCircleFilled style={{ color: '#52c41a' }} />
      case 'failed': return <CloseCircleFilled style={{ color: '#ff4d4f' }} />
      case 'running': return <LoadingOutlined style={{ color: '#1890ff' }} spin />
      default: return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>任务中心</Title>
        <Space>
          <Button icon={<ExperimentOutlined />} onClick={openTestModal} style={{ borderColor: '#D4A853', color: '#D4A853' }}>
            测试发布
          </Button>
          <Button icon={<CaretRightOutlined />} type="primary">启动全部待执行</Button>
          <Button icon={<ReloadOutlined />} onClick={loadTasks}>刷新</Button>
        </Space>
      </div>

      <Tabs activeKey={statusFilter} onChange={setStatusFilter} items={tabItems} style={{ marginBottom: 8 }} />

      <Table<TaskRow>
        columns={columns}
        dataSource={filteredTasks}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        locale={{ emptyText: <Empty description="暂无任务" /> }}
      />

      {/* 测试发布 Modal */}
      <Modal
        title="测试发布（小红书图文）"
        open={testModalOpen}
        onCancel={() => { if (!publishing) setTestModalOpen(false) }}
        width={640}
        footer={[
          <Button key="cancel" onClick={() => setTestModalOpen(false)} disabled={publishing}>取消</Button>,
          <Button key="start" type="primary" onClick={handleStartPublish} loading={publishing}
            style={{ background: '#1A5C3A' }}>
            {publishing ? '发布中...' : '开始发布'}
          </Button>
        ]}
      >
        <Form form={testForm} layout="vertical" size="middle" style={{ marginTop: 16 }}>
          <Form.Item label="Bit Profile" name="profileId" rules={[{ required: true, message: '请选择Profile' }]}>
            <Select
              placeholder="选择已有Profile"
              showSearch
              optionFilterProp="label"
              options={profiles.map((p) => ({ value: p.id, label: p.name || p.id }))}
              notFoundContent={profiles.length === 0 ? 'Bit浏览器未连接或无Profile' : '无匹配'}
            />
          </Form.Item>

          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="输入测试标题（最多20字）" maxLength={20} showCount />
          </Form.Item>

          <Form.Item label="正文" name="content" rules={[{ required: true, message: '请输入正文' }]}>
            <TextArea placeholder="输入测试正文" rows={4} showCount maxLength={1000} />
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Input placeholder="灵芝, 养生, 健康（逗号分隔）" />
          </Form.Item>

          <Form.Item label="图片">
            <Space>
              <Button icon={<FolderOpenOutlined />} onClick={handleSelectImages}>选择图片文件</Button>
              {selectedImages.length > 0 && (
                <Tag icon={<PictureOutlined />} color="green">已选 {selectedImages.length} 张</Tag>
              )}
            </Space>
            {selectedImages.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                {selectedImages.map((p, i) => {
                  const name = p.split(/[/\\]/).pop()
                  return <Tag key={i} closable onClose={() => setSelectedImages((prev) => prev.filter((_, idx) => idx !== i))}>{name}</Tag>
                })}
              </div>
            )}
          </Form.Item>

          <Form.Item label="账号级别" name="accountLevel" initialValue="growing">
            <Radio.Group>
              <Radio value="new">新号</Radio>
              <Radio value="growing">成长号</Radio>
              <Radio value="mature">成熟号</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>

        {/* 执行状态 */}
        {publishing && (
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <Text strong style={{ color: '#1A5C3A' }}>执行状态</Text>
            <List
              size="small"
              dataSource={stepStatuses}
              style={{ marginTop: 8 }}
              renderItem={(item) => {
                const stepDef = PUBLISH_STEPS.find((s) => s.key === item.step)
                return (
                  <List.Item style={{ padding: '6px 0' }}>
                    <Space>
                      {getStepIcon(item.status)}
                      <span style={{ width: 100, display: 'inline-block' }}>{stepDef?.label || item.step}</span>
                      {item.duration !== undefined && (
                        <Text type="secondary" style={{ fontSize: 12 }}>{(item.duration / 1000).toFixed(1)}s</Text>
                      )}
                      {item.error && <Text type="danger" style={{ fontSize: 12 }}>{item.error}</Text>}
                      {item.screenshotPath && (
                        <Tag color="blue" style={{ fontSize: 11, cursor: 'pointer' }}>查看截图</Tag>
                      )}
                    </Space>
                  </List.Item>
                )
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TaskCenter

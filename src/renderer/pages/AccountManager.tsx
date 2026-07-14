import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Typography, Input, Empty, Modal, Form, Select, InputNumber, Upload, message } from 'antd'
import { PlusOutlined, ImportOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
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
  { title: '账号别名', dataIndex: 'account_alias', key: 'account_alias', width: 180, ellipsis: true },
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
  const { accounts, loading, loadAccounts, searchText, setSearchText, createAccount } = useAccountStore()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // 端到端测试该账号的粘性代理：下发代理→开窗→校验出口IP
  const handleTestProxy = async (record: Account): Promise<void> => {
    if (!record.bit_profile_id) {
      message.warning('该账号未绑定 Bit Profile ID，无法测试代理')
      return
    }
    setTestingId(record.id)
    try {
      const r = await window.api.proxy.checkAccount(record.id)
      if (r.ok) {
        Modal.success({
          title: '出口IP校验通过',
          content: (
            <div style={{ lineHeight: 2 }}>
              <div>出口IP：<b>{r.exitIp || '-'}</b></div>
              <div>出口城市：<b>{r.city || '-'}</b>{record.region ? `（账号地区：${record.region}）` : ''}</div>
              {r.cityMatched === false && (
                <div style={{ color: '#faad14' }}>⚠ 出口城市与账号地区不一致，建议核对代理配置</div>
              )}
              <div style={{ color: '#999', fontSize: 12 }}>会话ID：{r.sessionId}</div>
            </div>
          )
        })
      } else {
        Modal.error({ title: '代理测试未通过', content: r.error || '未知错误' })
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '代理测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const actionColumn = {
    title: '操作',
    key: 'action',
    width: 110,
    render: (_: unknown, record: Account) => (
      <Button
        size="small"
        loading={testingId === record.id}
        disabled={testingId !== null && testingId !== record.id}
        onClick={() => handleTestProxy(record)}
      >
        测试代理
      </Button>
    )
  }

  const handleOpenAddModal = (): void => {
    form.resetFields()
    form.setFieldsValue({
      platform: 'xiaohongshu',
      account_level: 'new',
      proxy_type: 'pool',
      daily_limit: 2,
      daily_interaction_limit: 20,
      weekly_target: 10,
      sequence: accounts.length + 1
    })
    setAddModalOpen(true)
  }

  const handleGenerateAlias = async (): Promise<void> => {
    const platform = form.getFieldValue('platform') || 'xiaohongshu'
    const bloggerId = form.getFieldValue('blogger_id') || form.getFieldValue('nickname')
    const sequence = form.getFieldValue('sequence')
    if (!bloggerId || !sequence) {
      message.warning('请先填写博主标识和序号')
      return
    }

    try {
      const alias = await window.api.accounts.generateAlias({ platform, bloggerId, sequence })
      form.setFieldValue('account_alias', alias)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '账号别名生成失败')
    }
  }

  const handleCreateAccount = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await createAccount({
        nickname: values.nickname,
        platform: values.platform,
        account_alias: values.account_alias,
        bit_profile_id: values.bit_profile_id || undefined,
        customer_id: values.customer_id || '',
        account_level: values.account_level,
        proxy_type: values.proxy_type,
        region: values.region || '',
        daily_limit: values.daily_limit,
        daily_interaction_limit: values.daily_interaction_limit,
        weekly_target: values.weekly_target,
        persona: {
          gender: values.gender || 'female',
          health_focus: values.health_focus || 'general'
        }
      })
      message.success('账号已添加')
      setAddModalOpen(false)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const normalizeImportRow = async (row: Record<string, unknown>, index: number): Promise<Record<string, unknown>> => {
    const nickname = String(row.nickname || row['昵称'] || '').trim()
    const platform = String(row.platform || row['平台'] || 'xiaohongshu').trim()
    const bloggerId = String(row.blogger_id || row['博主标识'] || nickname).trim()
    const sequence = Number(row.sequence || row['序号'] || index + 1)
    const accountAlias = String(row.account_alias || row['账号别名'] || '').trim() ||
      await window.api.accounts.generateAlias({ platform, bloggerId, sequence })

    if (!nickname) throw new Error(`第 ${index + 2} 行缺少 nickname/昵称`)
    if (!bloggerId) throw new Error(`第 ${index + 2} 行缺少 blogger_id/博主标识`)

    return {
      nickname,
      platform,
      account_alias: accountAlias,
      bit_profile_id: String(row.bit_profile_id || row['Bit Profile ID'] || '').trim() || undefined,
      customer_id: String(row.customer_id || row['客户ID'] || '').trim(),
      account_level: String(row.account_level || row['等级'] || 'new').trim(),
      proxy_type: String(row.proxy_type || row['代理类型'] || 'pool').trim(),
      region: String(row.region || row['地区'] || '').trim(),
      daily_limit: Number(row.daily_limit || row['日限额'] || 2),
      daily_interaction_limit: Number(row.daily_interaction_limit || row['日互动限额'] || 20),
      weekly_target: Number(row.weekly_target || row['周发布'] || 10),
      persona: {
        gender: String(row.gender || row['性别'] || 'female').trim(),
        health_focus: String(row.health_focus || row['健康关注'] || 'general').trim()
      }
    }
  }

  const handleImportAccounts = async (file: File): Promise<boolean> => {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('账号表没有工作表')

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
      if (rows.length === 0) throw new Error('账号表为空')

      const items = await Promise.all(rows.map((row, index) => normalizeImportRow(row, index)))
      const count = await window.api.accounts.batchInsert(items)
      message.success(`账号导入完成：${count} 条`)
      await loadAccounts()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '账号导入失败')
    }

    return false
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>账号管理</Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleOpenAddModal}>添加账号</Button>
          <Upload accept=".xlsx,.xls,.csv" showUploadList={false} beforeUpload={handleImportAccounts}>
            <Button icon={<ImportOutlined />}>批量导入</Button>
          </Upload>
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
        columns={[...columns, actionColumn]}
        dataSource={accounts}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        locale={{ emptyText: <Empty description="暂无账号，请添加或批量导入" /> }}
      />

      <Modal
        title="添加发布账号"
        open={addModalOpen}
        onOk={handleCreateAccount}
        onCancel={() => setAddModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={680}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space align="start" style={{ width: '100%' }} size={16}>
            <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: '请输入昵称' }]} style={{ flex: 1 }}>
              <Input placeholder="例如：灵芝水铺一号" />
            </Form.Item>
            <Form.Item label="平台" name="platform" rules={[{ required: true }]} style={{ width: 160 }}>
              <Select options={[{ value: 'xiaohongshu', label: '小红书' }]} />
            </Form.Item>
          </Space>

          <Space align="start" style={{ width: '100%' }} size={16}>
            <Form.Item label="博主标识" name="blogger_id" tooltip="用于生成 account_alias，可与 tuwen-pro 对齐" style={{ flex: 1 }}>
              <Input placeholder="例如：灵芝水铺-一号" />
            </Form.Item>
            <Form.Item label="序号" name="sequence" style={{ width: 120 }}>
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label=" " style={{ width: 120 }}>
              <Button onClick={handleGenerateAlias}>生成别名</Button>
            </Form.Item>
          </Space>

          <Form.Item label="账号别名 account_alias" name="account_alias" rules={[{ required: true, message: '请生成或填写账号别名' }]}>
            <Input placeholder="例如：xhs_ling_zhi_shui_pu_yi_hao_001" />
          </Form.Item>

          <Space align="start" style={{ width: '100%' }} size={16}>
            <Form.Item label="Bit Profile ID" name="bit_profile_id" style={{ flex: 1 }}>
              <Input placeholder="指纹浏览器 Profile ID，可稍后补" />
            </Form.Item>
            <Form.Item label="客户ID" name="customer_id" style={{ flex: 1 }}>
              <Input placeholder="内部客户或博主编号" />
            </Form.Item>
          </Space>

          <Space align="start" style={{ width: '100%' }} size={16}>
            <Form.Item label="等级" name="account_level" style={{ flex: 1 }}>
              <Select options={[
                { value: 'new', label: '新号' },
                { value: 'growing', label: '成长期' },
                { value: 'mature', label: '成熟号' }
              ]} />
            </Form.Item>
            <Form.Item label="地区" name="region" style={{ flex: 1 }}>
              <Input placeholder="例如：上海" />
            </Form.Item>
            <Form.Item label="代理类型" name="proxy_type" style={{ flex: 1 }}>
              <Select options={[
                { value: 'pool', label: '代理池' },
                { value: 'sticky', label: '固定IP' }
              ]} />
            </Form.Item>
          </Space>

          <Space align="start" style={{ width: '100%' }} size={16}>
            <Form.Item label="日发布限额" name="daily_limit" style={{ flex: 1 }}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="日互动限额" name="daily_interaction_limit" style={{ flex: 1 }}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="周发布目标" name="weekly_target" style={{ flex: 1 }}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space align="start" style={{ width: '100%' }} size={16}>
            <Form.Item label="性别画像" name="gender" style={{ flex: 1 }}>
              <Select options={[
                { value: 'female', label: '女' },
                { value: 'male', label: '男' }
              ]} />
            </Form.Item>
            <Form.Item label="健康关注" name="health_focus" style={{ flex: 1 }}>
              <Select options={[
                { value: 'general', label: '通用' },
                { value: 'sleep', label: '睡眠' },
                { value: 'sugar_control', label: '控糖' },
                { value: 'liver', label: '护肝' },
                { value: 'fitness', label: '健身' }
              ]} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default AccountManager

import { useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Row, Switch, Select, Space, Typography, message, Tag } from 'antd'
import { SaveOutlined, ApiOutlined, CheckCircleFilled, CloseCircleFilled, WarningOutlined } from '@ant-design/icons'
import { Alert } from 'antd'

const { Title } = Typography

const isElectron = !!(window as any).__ELECTRON__

function Settings(): JSX.Element {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [bitConnected, setBitConnected] = useState<boolean | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async (): Promise<void> => {
    try {
      const data = await window.api.settings.get()
      if (data) {
        form.setFieldsValue(data)
      }
    } catch (err) {
      console.error('[Settings] loadSettings error:', err)
    }
  }

  const handleSave = async (): Promise<void> => {
    setLoading(true)
    try {
      const raw = form.getFieldsValue()

      // 清理undefined值，IPC不能序列化undefined
      const values: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (v !== undefined) {
          values[k] = v
        }
      }

      console.log('[Settings] Saving:', JSON.stringify(values))
      const result = await window.api.settings.save(values)
      console.log('[Settings] Save result:', result)
      message.success('设置已保存')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[Settings] Save error:', msg)
      message.error('保存失败: ' + msg)
    }
    setLoading(false)
  }

  const handleTestConnection = async (): Promise<void> => {
    setTestingConnection(true)
    setBitConnected(null)
    try {
      // 先同步端口和Token到主进程
      const port = form.getFieldValue('bitApiPort')
      const token = form.getFieldValue('bitApiToken')

      console.log('[Settings] Testing connection, port:', port, 'token:', token ? '***' : '(empty)')

      if (port) {
        await window.api.settings.update('bitApiPort', Number(port))
      }
      await window.api.settings.update('bitApiToken', token || '')

      const result = await window.api.settings.testBitConnection()
      console.log('[Settings] Test result:', result)
      setBitConnected(result === true)

      if (result === true) {
        message.success('Bit浏览器连接成功')
      } else {
        message.warning('Bit浏览器未运行或端口/Token不正确')
      }
    } catch (err) {
      console.error('[Settings] Test connection error:', err)
      setBitConnected(false)
      message.error('连接失败: ' + (err instanceof Error ? err.message : String(err)))
    }
    setTestingConnection(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#1A5C3A' }}>系统设置</Title>
        <Button icon={<SaveOutlined />} type="primary" onClick={handleSave} loading={loading}>
          保存设置
        </Button>
      </div>

      {!isElectron && (
        <Alert
          message="当前在浏览器中运行，非Electron环境"
          description="请通过 Electron 窗口使用本应用（运行 npm run dev 后会自动弹出Electron窗口）。浏览器中无法连接Bit浏览器和数据库。"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            <Card
              title="Bit浏览器配置"
              size="small"
              style={{ marginBottom: 16 }}
              extra={
                bitConnected === true ? <Tag icon={<CheckCircleFilled />} color="success">已连接</Tag> :
                bitConnected === false ? <Tag icon={<CloseCircleFilled />} color="error">未连接</Tag> : null
              }
            >
              <Form.Item label="API端口" name="bitApiPort">
                <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="54345" />
              </Form.Item>
              <Form.Item label="API Token" name="bitApiToken">
                <Input.Password placeholder="Bit浏览器API鉴权Token" />
              </Form.Item>
              <Form.Item label="最大并发窗口数" name="maxConcurrency">
                <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="5" />
              </Form.Item>
              <Button
                icon={<ApiOutlined />}
                onClick={handleTestConnection}
                loading={testingConnection}
                block
              >
                测试连接
              </Button>
            </Card>

            <Card title="发布参数" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="发布时间段">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="publishTimeStart" noStyle>
                    <Input style={{ width: '45%' }} placeholder="09:00" />
                  </Form.Item>
                  <Input style={{ width: '10%', textAlign: 'center' }} placeholder="~" disabled />
                  <Form.Item name="publishTimeEnd" noStyle>
                    <Input style={{ width: '45%' }} placeholder="22:00" />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
              <Form.Item label="最小发布间隔(ms)" name="publishIntervalMs">
                <InputNumber min={10000} step={5000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="最大重试次数" name="retryLimit">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="代理配置" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="代理供应商" name="proxyProvider">
                <Select placeholder="选择代理供应商" allowClear options={[
                  { value: 'custom', label: '自定义代理' },
                  { value: 'luminati', label: 'Bright Data' },
                  { value: 'smartproxy', label: 'SmartProxy' },
                  { value: 'oxylabs', label: 'Oxylabs' }
                ]} />
              </Form.Item>
              <Form.Item label="API Key" name="proxyApiKey">
                <Input.Password placeholder="输入代理服务API Key" />
              </Form.Item>
            </Card>

            <Card title="系统设置" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="暖号功能" name="warmupEnabled" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="暖号时长(ms)" name="warmupDurationMs">
                <InputNumber min={5000} step={5000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="错误时截图" name="screenshotOnError" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="日志级别" name="logLevel">
                <Select options={[
                  { value: 'debug', label: 'Debug' },
                  { value: 'info', label: 'Info' },
                  { value: 'warn', label: 'Warning' },
                  { value: 'error', label: 'Error' }
                ]} />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  )
}

export default Settings

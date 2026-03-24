import { useEffect } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Row, Switch, Typography, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../stores/settingsStore'

const { Title } = Typography

function Settings(): JSX.Element {
  const [form] = Form.useForm()
  const { settings, loading, loadSettings, saveSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings)
    }
  }, [settings, form])

  const handleSave = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      await saveSettings(values)
      message.success('设置已保存')
    } catch {
      message.error('保存失败')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          系统设置
        </Title>
        <Button icon={<SaveOutlined />} type="primary" onClick={handleSave} loading={loading}>
          保存设置
        </Button>
      </div>

      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={12}>
            <Card title="Bit浏览器配置" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="API地址" name="bitApiUrl">
                <Input placeholder="http://127.0.0.1" />
              </Form.Item>
              <Form.Item label="API端口" name="bitApiPort">
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card title="发布参数" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="最大并发数" name="maxConcurrency">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="发布间隔(ms)" name="publishIntervalMs">
                <InputNumber min={10000} step={5000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="最大重试次数" name="retryLimit">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="养号设置" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="启用暖号" name="warmupEnabled" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="暖号时长(ms)" name="warmupDurationMs">
                <InputNumber min={5000} step={5000} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card title="其他设置" size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="错误时截图" name="screenshotOnError" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="文件服务端口" name="fileServerPort">
                <InputNumber min={1024} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  )
}

export default Settings

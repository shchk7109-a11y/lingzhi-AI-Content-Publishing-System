import { useState } from 'react'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Sider, Content, Header } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '控制台' },
  { key: '/content', icon: <FileTextOutlined />, label: '内容池' },
  { key: '/accounts', icon: <TeamOutlined />, label: '账号管理' },
  { key: '/match', icon: <ThunderboltOutlined />, label: '智能匹配' },
  { key: '/tasks', icon: <RocketOutlined />, label: '任务中心' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' }
]

function AppLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
        style={{ background: '#1A5C3A' }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D4A853',
            fontSize: collapsed ? 16 : 18,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            letterSpacing: collapsed ? 0 : 2
          }}
        >
          {collapsed ? '灵芝' : '灵芝水铺'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#1A5C3A', borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500, color: '#1A5C3A' }}>
            {menuItems.find((item) => item.key === location.pathname)?.label || '控制台'}
          </span>
          <span style={{ color: '#D4A853', fontSize: 12, fontWeight: 500 }}>
            AI多平台智能发布系统 v3.0
          </span>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 'auto',
            overflow: 'auto'
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout

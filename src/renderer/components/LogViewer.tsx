import { useEffect, useRef, useState } from 'react'
import { Card } from 'antd'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

const levelColors: Record<string, string> = {
  info: '#1890ff',
  warn: '#faad14',
  error: '#ff4d4f',
  success: '#52c41a'
}

function LogViewer(): JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: new Date().toISOString(), level: 'info', message: '系统已启动，等待操作...' }
  ])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      window.api.onLog((data) => {
        const entry = data as LogEntry
        setLogs((prev) => [...prev.slice(-200), entry])
      })
    } catch {
      // 开发模式下API可能未就绪
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <Card
      size="small"
      bodyStyle={{
        height: 300,
        overflow: 'auto',
        background: '#1e1e1e',
        padding: '12px 16px',
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: 12
      }}
    >
      {logs.map((log, i) => (
        <div key={i} style={{ color: levelColors[log.level] || '#ccc', marginBottom: 2 }}>
          <span style={{ color: '#666' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
          <span style={{ color: levelColors[log.level] }}>[{log.level.toUpperCase()}]</span>{' '}
          <span style={{ color: '#d4d4d4' }}>{log.message}</span>
        </div>
      ))}
      <div ref={logEndRef} />
    </Card>
  )
}

export default LogViewer

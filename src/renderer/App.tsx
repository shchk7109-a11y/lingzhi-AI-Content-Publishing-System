import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './pages/Dashboard'
import ContentPool from './pages/ContentPool'
import AccountManager from './pages/AccountManager'
import SmartMatch from './pages/SmartMatch'
import TaskCenter from './pages/TaskCenter'
import Settings from './pages/Settings'

function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="content" element={<ContentPool />} />
          <Route path="accounts" element={<AccountManager />} />
          <Route path="match" element={<SmartMatch />} />
          <Route path="tasks" element={<TaskCenter />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App

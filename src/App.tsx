import { Alert, Center, Loader } from '@mantine/core'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ObjectPage } from './pages/ObjectPage'
import { ObjectsPage } from './pages/ObjectsPage'
import { TaskPage } from './pages/TaskPage'
import { TasksPage } from './pages/TasksPage'

/** Пускает дальше только вошедшего пользователя с загруженным профилем. */
function RequireAuth() {
  const { session, profile, loading, profileError, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile) {
    return (
      <Center mih="100vh" p="md">
        <Alert color="red" title="Нет доступа" maw={420}>
          {profileError}{' '}
          <a href="#" onClick={signOut}>
            Выйти
          </a>
        </Alert>
      </Center>
    )
  }
  return <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/objects" replace />} />
              <Route path="/objects" element={<ObjectsPage />} />
              <Route path="/objects/:id" element={<ObjectPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/tasks/:id" element={<TaskPage />} />
              <Route path="*" element={<Navigate to="/objects" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

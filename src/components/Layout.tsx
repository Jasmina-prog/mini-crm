import { AppShell, Badge, Button, Group, Text } from '@mantine/core'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import { useAuth, useMe } from '../auth/useAuth'

const ROLE_LABEL = { manager: 'Постановщик', executor: 'Исполнитель' } as const

function NavButton({ to, children }: { to: string; children: string }) {
  return (
    <RouterNavLink to={to} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <Button variant={isActive ? 'light' : 'subtle'} size="sm">
          {children}
        </Button>
      )}
    </RouterNavLink>
  )
}

export function Layout() {
  const me = useMe()
  const { signOut } = useAuth()

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text fw={700} mr="md" visibleFrom="sm">
              Мини-CRM
            </Text>
            <NavButton to="/objects">Объекты</NavButton>
            <NavButton to="/tasks">{me.role === 'executor' ? 'Мои задачи' : 'Все задачи'}</NavButton>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" visibleFrom="sm">
              {me.full_name}
            </Text>
            <Badge variant="light" color={me.role === 'manager' ? 'grape' : 'cyan'} visibleFrom="xs">
              {ROLE_LABEL[me.role]}
            </Badge>
            <Button variant="default" size="xs" onClick={signOut}>
              Выйти
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main maw={1100} mx="auto">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

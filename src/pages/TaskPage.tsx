import {
  Anchor,
  Breadcrumbs,
  Button,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMe } from '../auth/useAuth'
import { PageState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { TaskFormModal } from '../components/TaskFormModal'
import { TransitionModal } from '../components/TransitionModal'
import { api } from '../lib/api'
import { notifyError, notifyOk } from '../lib/errors'
import { fmtDateTime } from '../lib/format'
import { availableActions, STATUS_COLOR, STATUS_LABEL, type TaskAction } from '../lib/status'
import { useAsync } from '../lib/useAsync'
import type { HistoryEntry } from '../lib/types'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <div>{children}</div>
    </div>
  )
}

function History({ items }: { items: HistoryEntry[] }) {
  if (items.length === 0) return <Text c="dimmed">История пуста</Text>
  return (
    <Timeline active={items.length - 1} bulletSize={14} lineWidth={2}>
      {items.map((h) => (
        <Timeline.Item
          key={h.id}
          color={STATUS_COLOR[h.to_status]}
          title={
            h.from_status
              ? `${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}`
              : `Создана (${STATUS_LABEL[h.to_status]})`
          }
        >
          <Text size="sm" c="dimmed">
            {h.actor?.full_name ?? '—'} · {fmtDateTime(h.created_at)}
          </Text>
          {h.comment && (
            <Text size="sm" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
              «{h.comment}»
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  )
}

export function TaskPage() {
  const { id = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const isManager = me.role === 'manager'

  const task = useAsync(() => api.getTask(id), [id])
  const history = useAsync(() => api.listHistory(id), [id])

  const [action, setAction] = useState<TaskAction | null>(null)
  const [editing, setEditing] = useState(false)

  const reloadAll = () => {
    task.reload()
    history.reload()
  }

  function confirmDelete() {
    modals.openConfirmModal({
      title: 'Удалить задачу?',
      children: (
        <Text size="sm">Задача «{task.data?.title}» и её история будут удалены без возможности восстановления.</Text>
      ),
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.deleteTask(id)
          notifyOk('Задача удалена')
          navigate(task.data ? `/objects/${task.data.object_id}` : '/objects')
        } catch (e) {
          notifyError(e)
        }
      },
    })
  }

  const t = task.data
  const actions = t ? availableActions(t, me) : []

  return (
    <PageState loading={task.loading && !t} error={task.error} notFound={!t}>
      {t && (
        <Stack>
          <Breadcrumbs>
            <Anchor component={Link} to="/objects">
              Объекты
            </Anchor>
            {t.object && (
              <Anchor component={Link} to={`/objects/${t.object.id}`}>
                {t.object.name}
              </Anchor>
            )}
            <Text>{t.title}</Text>
          </Breadcrumbs>

          <Paper withBorder p="md" radius="md">
            <Stack>
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <Title order={2}>{t.title}</Title>
                  <StatusBadge status={t.status} size="lg" />
                </Group>
                {isManager && (
                  <Group gap="xs">
                    <Button variant="default" onClick={() => setEditing(true)}>
                      Редактировать
                    </Button>
                    <Button variant="light" color="red" onClick={confirmDelete}>
                      Удалить
                    </Button>
                  </Group>
                )}
              </Group>

              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Field label="Объект">
                    {t.object ? (
                      <Anchor component={Link} to={`/objects/${t.object.id}`}>
                        {t.object.name}
                      </Anchor>
                    ) : (
                      '—'
                    )}
                  </Field>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Field label="Исполнитель">{t.assignee?.full_name ?? '—'}</Field>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Field label="Автор">{t.author?.full_name ?? '—'}</Field>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Field label="Создана">{fmtDateTime(t.created_at)}</Field>
                </Grid.Col>
              </Grid>

              <Field label="Описание">
                <Text style={{ whiteSpace: 'pre-wrap' }}>{t.description || '—'}</Text>
              </Field>

              {actions.length > 0 && (
                <Group>
                  {actions.map((a) => (
                    <Button key={a.to} color={a.color} onClick={() => setAction(a)}>
                      {a.label}
                    </Button>
                  ))}
                </Group>
              )}
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">
              История статусов
            </Title>
            <PageState loading={history.loading && !history.data} error={history.error}>
              <History items={history.data ?? []} />
            </PageState>
          </Paper>

          <TransitionModal task={t} action={action} onClose={() => setAction(null)} onDone={reloadAll} />
          <TaskFormModal opened={editing} onClose={() => setEditing(false)} task={t} onSaved={reloadAll} />
        </Stack>
      )}
    </PageState>
  )
}

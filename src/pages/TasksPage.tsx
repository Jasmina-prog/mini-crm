import { SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { useMe } from '../auth/useAuth'
import { PageState } from '../components/PageState'
import { TaskTable } from '../components/TaskTable'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import type { TaskStatus } from '../lib/types'

type Filter = 'active' | 'on_review' | 'accepted' | 'all'

const FILTERS: Record<Filter, TaskStatus[] | null> = {
  active: ['new', 'in_progress', 'rework'],
  on_review: ['on_review'],
  accepted: ['accepted'],
  all: null,
}

/**
 * Исполнитель: «Мои задачи». Постановщик: «Все задачи» (удобно искать задачи на проверке).
 * Отдельного фильтра «только мои» для исполнителя не нужно — RLS вернёт только его задачи,
 * но фильтр по assignee_id оставлен явно, чтобы намерение было видно в коде.
 */
export function TasksPage() {
  const me = useMe()
  const isManager = me.role === 'manager'
  const [filter, setFilter] = useState<Filter>(isManager ? 'on_review' : 'active')

  const { data, loading, error } = useAsync(
    () => api.listTasks(isManager ? {} : { assigneeId: me.id }),
    [me.id, isManager],
  )

  const statuses = FILTERS[filter]
  const visible = (data ?? []).filter((t) => !statuses || statuses.includes(t.status))
  const count = (f: Filter) =>
    (data ?? []).filter((t) => !FILTERS[f] || FILTERS[f]!.includes(t.status)).length

  return (
    <Stack>
      <div>
        <Title order={2}>{isManager ? 'Все задачи' : 'Мои задачи'}</Title>
        {isManager && (
          <Text size="sm" c="dimmed">
            Задачи «На проверке» ждут вашего решения
          </Text>
        )}
      </div>

      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        data={[
          { value: 'active', label: `Активные (${count('active')})` },
          { value: 'on_review', label: `На проверке (${count('on_review')})` },
          { value: 'accepted', label: `Принятые (${count('accepted')})` },
          { value: 'all', label: `Все (${count('all')})` },
        ]}
        style={{ alignSelf: 'flex-start' }}
      />

      <PageState loading={loading} error={error}>
        <TaskTable tasks={visible} showObject showAssignee={isManager} emptyText="Задач нет" />
      </PageState>
    </Stack>
  )
}

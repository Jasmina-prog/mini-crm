import { Anchor, Badge, Button, Group, Stack, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMe } from '../auth/useAuth'
import { ObjectFormModal } from '../components/ObjectFormModal'
import { PageState } from '../components/PageState'
import { api } from '../lib/api'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '../lib/status'
import { useAsync } from '../lib/useAsync'
import type { ObjectWithTasks } from '../lib/types'

function StatusSummary({ tasks }: { tasks: ObjectWithTasks['tasks'] }) {
  if (tasks.length === 0) return <Text size="sm" c="dimmed">нет задач</Text>
  return (
    <Group gap={4}>
      {STATUS_ORDER.map((s) => {
        const n = tasks.filter((t) => t.status === s).length
        return n ? (
          <Badge key={s} size="sm" variant="light" color={STATUS_COLOR[s]}>
            {STATUS_LABEL[s]}: {n}
          </Badge>
        ) : null
      })}
    </Group>
  )
}

export function ObjectsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const { data, loading, error } = useAsync(() => api.listObjects(), [])
  const [creating, setCreating] = useState(false)
  const isManager = me.role === 'manager'

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Объекты</Title>
          {!isManager && (
            <Text size="sm" c="dimmed">
              Показаны объекты, в которых у вас есть задачи
            </Text>
          )}
        </div>
        {isManager && <Button onClick={() => setCreating(true)}>Добавить объект</Button>}
      </Group>

      <PageState loading={loading} error={error}>
        {data && data.length === 0 ? (
          <Text c="dimmed">Объектов пока нет</Text>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Адрес</Table.Th>
                  <Table.Th>{isManager ? 'Задачи' : 'Мои задачи'}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.map((o) => (
                  <Table.Tr key={o.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/objects/${o.id}`} fw={500}>
                        {o.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{o.address || '—'}</Table.Td>
                    <Table.Td>
                      <StatusSummary tasks={o.tasks} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </PageState>

      <ObjectFormModal
        opened={creating}
        onClose={() => setCreating(false)}
        onSaved={(o) => navigate(`/objects/${o.id}`)}
      />
    </Stack>
  )
}

import { Anchor, Table, Text } from '@mantine/core'
import { Link } from 'react-router'
import { fmtDate } from '../lib/format'
import type { Task } from '../lib/types'
import { StatusBadge } from './StatusBadge'

export function TaskTable({
  tasks,
  showObject = false,
  showAssignee = true,
  emptyText = 'Задач нет',
}: {
  tasks: Task[]
  showObject?: boolean
  showAssignee?: boolean
  emptyText?: string
}) {
  if (tasks.length === 0) {
    return (
      <Text c="dimmed" py="md">
        {emptyText}
      </Text>
    )
  }

  return (
    <Table.ScrollContainer minWidth={600}>
      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Задача</Table.Th>
            {showObject && <Table.Th>Объект</Table.Th>}
            {showAssignee && <Table.Th>Исполнитель</Table.Th>}
            <Table.Th>Статус</Table.Th>
            <Table.Th>Создана</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((t) => (
            <Table.Tr key={t.id}>
              <Table.Td>
                <Anchor component={Link} to={`/tasks/${t.id}`} fw={500}>
                  {t.title}
                </Anchor>
              </Table.Td>
              {showObject && (
                <Table.Td>
                  {t.object ? (
                    <Anchor component={Link} to={`/objects/${t.object.id}`} c="dimmed" size="sm">
                      {t.object.name}
                    </Anchor>
                  ) : (
                    '—'
                  )}
                </Table.Td>
              )}
              {showAssignee && <Table.Td>{t.assignee?.full_name ?? '—'}</Table.Td>}
              <Table.Td>
                <StatusBadge status={t.status} size="sm" />
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {fmtDate(t.created_at)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

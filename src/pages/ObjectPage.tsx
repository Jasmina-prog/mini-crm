import { Anchor, Breadcrumbs, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMe } from '../auth/useAuth'
import { ObjectFormModal } from '../components/ObjectFormModal'
import { PageState } from '../components/PageState'
import { TaskFormModal } from '../components/TaskFormModal'
import { TaskTable } from '../components/TaskTable'
import { api } from '../lib/api'
import { notifyError, notifyOk } from '../lib/errors'
import { useAsync } from '../lib/useAsync'

export function ObjectPage() {
  const { id = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const isManager = me.role === 'manager'

  const object = useAsync(() => api.getObject(id), [id])
  // RLS сам оставит исполнителю только его задачи в этом объекте
  const tasks = useAsync(() => api.listTasks({ objectId: id }), [id])

  const [editing, setEditing] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)

  function confirmDelete() {
    modals.openConfirmModal({
      title: 'Удалить объект?',
      children: (
        <Text size="sm">
          Объект «{object.data?.name}» будет удалён. Объект с задачами удалить нельзя — сначала удалите
          задачи.
        </Text>
      ),
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.deleteObject(id)
          notifyOk('Объект удалён')
          navigate('/objects')
        } catch (e) {
          notifyError(e)
        }
      },
    })
  }

  return (
    <PageState loading={object.loading} error={object.error} notFound={!object.data}>
      {object.data && (
        <Stack>
          <Breadcrumbs>
            <Anchor component={Link} to="/objects">
              Объекты
            </Anchor>
            <Text>{object.data.name}</Text>
          </Breadcrumbs>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>{object.data.name}</Title>
                <Text c="dimmed">{object.data.address || 'Адрес не указан'}</Text>
              </div>
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
          </Paper>

          <Group justify="space-between">
            <Title order={3}>{isManager ? 'Задачи' : 'Мои задачи на объекте'}</Title>
            {isManager && <Button onClick={() => setCreatingTask(true)}>Новая задача</Button>}
          </Group>

          <PageState loading={tasks.loading} error={tasks.error}>
            <TaskTable tasks={tasks.data ?? []} showAssignee={isManager} emptyText="На объекте пока нет задач" />
          </PageState>

          <ObjectFormModal
            opened={editing}
            onClose={() => setEditing(false)}
            object={object.data}
            onSaved={object.reload}
          />
          <TaskFormModal
            opened={creatingTask}
            onClose={() => setCreatingTask(false)}
            defaultObjectId={id}
            onSaved={tasks.reload}
          />
        </Stack>
      )}
    </PageState>
  )
}

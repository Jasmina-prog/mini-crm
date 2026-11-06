import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { notifyError, notifyOk } from '../lib/errors'
import { useAsync } from '../lib/useAsync'
import type { Task } from '../lib/types'

interface Props {
  opened: boolean
  onClose: () => void
  /** Если передана — режим редактирования */
  task?: Task | null
  defaultObjectId?: string
  onSaved: (t: Task) => void
}

export function TaskFormModal(props: Props) {
  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.task ? 'Редактировать задачу' : 'Новая задача'}
      size="lg"
    >
      {/* Форма монтируется при каждом открытии — поля берут свежие значения из props */}
      {props.opened && <TaskForm {...props} />}
    </Modal>
  )
}

function TaskForm({ onClose, task, defaultObjectId, onSaved }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [objectId, setObjectId] = useState<string | null>(task?.object_id ?? defaultObjectId ?? null)
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assignee_id ?? null)
  const [saving, setSaving] = useState(false)

  const options = useAsync(() => Promise.all([api.listObjects(), api.listExecutors()]), [])
  const [objects, executors] = options.data ?? [[], []]

  const valid = title.trim() && objectId && assigneeId

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!objectId || !assigneeId) return
    setSaving(true)
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        object_id: objectId,
        assignee_id: assigneeId,
      }
      const saved = task ? await api.updateTask(task.id, input) : await api.createTask(input)
      notifyOk(task ? 'Задача сохранена' : 'Задача создана')
      onSaved(saved)
      onClose()
    } catch (err) {
      notifyError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput
          label="Название"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          data-autofocus
        />
        <Textarea
          label="Описание"
          autosize
          minRows={3}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Select
          label="Объект"
          required
          searchable
          disabled={options.loading}
          data={objects.map((o) => ({ value: o.id, label: o.name }))}
          value={objectId}
          onChange={setObjectId}
        />
        <Select
          label="Исполнитель"
          required
          searchable
          disabled={options.loading}
          error={options.error}
          data={executors.map((p) => ({ value: p.id, label: `${p.full_name} (${p.email})` }))}
          value={assigneeId}
          onChange={setAssigneeId}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={saving} disabled={!valid}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

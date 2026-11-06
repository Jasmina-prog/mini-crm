import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { notifyError, notifyOk } from '../lib/errors'
import { STATUS_LABEL, type TaskAction } from '../lib/status'
import type { Task } from '../lib/types'

interface Props {
  task: Task
  action: TaskAction | null
  onClose: () => void
  onDone: () => void
}

/** Подтверждение смены статуса с комментарием (обязательным для «На доработке»). */
export function TransitionModal({ task, action, onClose, onDone }: Props) {
  if (!action) return null
  return (
    <Modal opened onClose={onClose} title={action.label}>
      <TransitionForm task={task} action={action} onClose={onClose} onDone={onDone} />
    </Modal>
  )
}

function TransitionForm({ task, action, onClose, onDone }: Props & { action: TaskAction }) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const missingComment = action.commentRequired && !comment.trim()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (missingComment) return
    setSaving(true)
    try {
      await api.changeStatus(task.id, action.to, comment)
      notifyOk(`Статус: ${STATUS_LABEL[action.to]}`)
      onDone()
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
        <Text size="sm">
          «{STATUS_LABEL[task.status]}» → «{STATUS_LABEL[action.to]}»
        </Text>
        <Textarea
          label={action.commentRequired ? 'Комментарий (что нужно исправить)' : 'Комментарий (необязательно)'}
          required={action.commentRequired}
          autosize
          minRows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" color={action.color} loading={saving} disabled={missingComment}>
            {action.label}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

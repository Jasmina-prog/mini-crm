import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { notifyError, notifyOk } from '../lib/errors'
import type { CrmObject } from '../lib/types'

interface Props {
  opened: boolean
  onClose: () => void
  /** Если передан — режим редактирования */
  object?: CrmObject | null
  onSaved: (o: CrmObject) => void
}

export function ObjectFormModal(props: Props) {
  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.object ? 'Редактировать объект' : 'Новый объект'}
    >
      {/* Форма монтируется при каждом открытии — поля берут свежие значения из props */}
      {props.opened && <ObjectForm {...props} />}
    </Modal>
  )
}

function ObjectForm({ onClose, object, onSaved }: Props) {
  const [name, setName] = useState(object?.name ?? '')
  const [address, setAddress] = useState(object?.address ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const input = { name: name.trim(), address: address.trim() }
      const saved = object ? await api.updateObject(object.id, input) : await api.createObject(input)
      notifyOk(object ? 'Объект сохранён' : 'Объект создан')
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
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          label="Адрес"
          maxLength={500}
          value={address}
          onChange={(e) => setAddress(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

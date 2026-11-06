import type { Profile, Task, TaskStatus } from './types'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

export const STATUS_COLOR: Record<TaskStatus, string> = {
  new: 'gray',
  in_progress: 'blue',
  on_review: 'yellow',
  accepted: 'green',
  rework: 'red',
}

export const STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'on_review', 'rework', 'accepted']

export interface TaskAction {
  to: TaskStatus
  label: string
  color: string
  commentRequired: boolean
}

/**
 * Какие кнопки показать текущему пользователю.
 *
 * Это зеркало правил из функции БД public.change_task_status() — нужно только
 * для интерфейса. Решение о допустимости перехода всё равно принимает база.
 */
export function availableActions(
  task: Pick<Task, 'status' | 'assignee_id'>,
  me: Profile,
): TaskAction[] {
  const isAssignee = me.role === 'executor' && task.assignee_id === me.id
  const isManager = me.role === 'manager'

  switch (task.status) {
    case 'new':
    case 'rework':
      return isAssignee
        ? [{ to: 'in_progress', label: 'Взять в работу', color: 'blue', commentRequired: false }]
        : []
    case 'in_progress':
      return isAssignee
        ? [{ to: 'on_review', label: 'Отправить на проверку', color: 'yellow', commentRequired: false }]
        : []
    case 'on_review':
      return isManager
        ? [
            { to: 'accepted', label: 'Принять', color: 'green', commentRequired: false },
            { to: 'rework', label: 'Вернуть на доработку', color: 'red', commentRequired: true },
          ]
        : []
    case 'accepted':
      return []
  }
}

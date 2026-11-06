export type Role = 'manager' | 'executor'

export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'accepted' | 'rework'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
}

export interface PersonRef {
  id: string
  full_name: string
}

export interface CrmObject {
  id: string
  name: string
  address: string
  created_at: string
}

export interface ObjectWithTasks extends CrmObject {
  tasks: { status: TaskStatus }[]
}

export interface Task {
  id: string
  object_id: string
  title: string
  description: string
  assignee_id: string
  status: TaskStatus
  author_id: string
  created_at: string
  updated_at: string
  object: { id: string; name: string } | null
  assignee: PersonRef | null
  author: PersonRef | null
}

export interface HistoryEntry {
  id: number
  task_id: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  actor: PersonRef | null
}

export interface TaskInput {
  object_id: string
  title: string
  description: string
  assignee_id: string
}

export interface ObjectInput {
  name: string
  address: string
}

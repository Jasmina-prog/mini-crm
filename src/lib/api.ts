import { supabase } from './supabase'
import type {
  CrmObject,
  HistoryEntry,
  ObjectInput,
  ObjectWithTasks,
  Profile,
  Task,
  TaskInput,
  TaskStatus,
} from './types'

/**
 * Все обращения к Supabase собраны здесь.
 * Важно: фильтры по правам здесь НЕ нужны — их применяет RLS в базе.
 * Исполнитель, запросив «все задачи», получит только свои.
 */

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** Для update/delete: RLS молча отфильтрует чужие строки, поэтому проверяем, что строка затронута. */
function ensureAffected<T>(rows: T[]): T {
  if (rows.length === 0) throw new Error('Запись не найдена или недостаточно прав')
  return rows[0]
}

const TASK_FIELDS = `
  id, object_id, title, description, assignee_id, status, author_id, created_at, updated_at,
  object:objects(id, name),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  author:profiles!tasks_author_id_fkey(id, full_name)
`

export const api = {
  // ---------- Профили ----------
  async getProfile(id: string): Promise<Profile | null> {
    return unwrap(
      await supabase.from('profiles').select('id, email, full_name, role').eq('id', id).maybeSingle(),
    )
  },

  async listExecutors(): Promise<Profile[]> {
    return unwrap(
      await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('role', 'executor')
        .order('full_name'),
    )
  },

  // ---------- Объекты ----------
  async listObjects(): Promise<ObjectWithTasks[]> {
    return unwrap(
      await supabase
        .from('objects')
        .select('id, name, address, created_at, tasks(status)')
        .order('created_at'),
    )
  },

  async getObject(id: string): Promise<CrmObject | null> {
    return unwrap(
      await supabase.from('objects').select('id, name, address, created_at').eq('id', id).maybeSingle(),
    )
  },

  async createObject(input: ObjectInput): Promise<CrmObject> {
    return unwrap(await supabase.from('objects').insert(input).select().single())
  },

  async updateObject(id: string, input: ObjectInput): Promise<CrmObject> {
    return ensureAffected(
      unwrap<CrmObject[]>(await supabase.from('objects').update(input).eq('id', id).select()),
    )
  },

  async deleteObject(id: string): Promise<void> {
    ensureAffected(unwrap<unknown[]>(await supabase.from('objects').delete().eq('id', id).select('id')))
  },

  // ---------- Задачи ----------
  async listTasks(filter: { objectId?: string; assigneeId?: string } = {}): Promise<Task[]> {
    let q = supabase.from('tasks').select(TASK_FIELDS).order('created_at', { ascending: false })
    if (filter.objectId) q = q.eq('object_id', filter.objectId)
    if (filter.assigneeId) q = q.eq('assignee_id', filter.assigneeId)
    return unwrap(await q)
  },

  async getTask(id: string): Promise<Task | null> {
    return unwrap(await supabase.from('tasks').select(TASK_FIELDS).eq('id', id).maybeSingle())
  },

  async createTask(input: TaskInput): Promise<Task> {
    // status, author_id, created_at не передаём — их ставит база
    return unwrap(await supabase.from('tasks').insert(input).select(TASK_FIELDS).single())
  },

  async updateTask(id: string, input: TaskInput): Promise<Task> {
    return ensureAffected(
      unwrap<Task[]>(await supabase.from('tasks').update(input).eq('id', id).select(TASK_FIELDS)),
    )
  },

  async deleteTask(id: string): Promise<void> {
    ensureAffected(unwrap<unknown[]>(await supabase.from('tasks').delete().eq('id', id).select('id')))
  },

  /** Единственный способ сменить статус — серверная функция с проверкой правил. */
  async changeStatus(taskId: string, to: TaskStatus, comment?: string): Promise<void> {
    unwrap(
      await supabase.rpc('change_task_status', {
        p_task_id: taskId,
        p_new_status: to,
        p_comment: comment?.trim() || null,
      }),
    )
  },

  // ---------- История ----------
  async listHistory(taskId: string): Promise<HistoryEntry[]> {
    return unwrap(
      await supabase
        .from('task_history')
        .select(
          'id, task_id, from_status, to_status, comment, created_at, actor:profiles!task_history_actor_id_fkey(id, full_name)',
        )
        .eq('task_id', taskId)
        .order('id'),
    )
  },
}

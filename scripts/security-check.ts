/**
 * Проверка защиты «в обход интерфейса»: ходим в Supabase напрямую тем же
 * публичным ключом, что и браузер, и пытаемся сделать запрещённое.
 *
 *   npm run security-check
 *
 * Нужны данные из `npm run seed`. Скрипт ничего не меняет, если защита работает.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { anonClient, env, login, USERS } from './lib.ts'

const PASSWORD = env('SEED_PASSWORD')

let failed = 0
function check(name: string, ok: boolean, details = '') {
  if (!ok) failed++
  console.log(`${ok ? '✅' : '❌'} ${name}${details ? `  — ${details}` : ''}`)
}

/** Ожидаем, что операция будет отклонена (ошибка) или не затронет ни одной строки. */
async function expectBlocked(
  name: string,
  op: PromiseLike<{ error: { message: string } | null; data?: unknown }>,
) {
  const { error, data } = await op
  const rows = Array.isArray(data) ? data.length : data ? 1 : 0
  check(name, !!error || rows === 0, error ? error.message : `затронуто строк: ${rows}`)
}

async function uid(c: SupabaseClient) {
  return (await c.auth.getUser()).data.user!.id
}

async function main() {
  const anon = anonClient()
  const manager = await login(USERS.manager.email, PASSWORD)
  const w1 = await login(USERS.worker1.email, PASSWORD)
  const w1id = await uid(w1)

  // Данные для проверок берём глазами постановщика
  const { data: all } = await manager.from('tasks').select('id, status, assignee_id, object_id')
  const tasks = all ?? []
  const foreign = tasks.find((t) => t.assignee_id !== w1id)
  const own = tasks.find((t) => t.assignee_id === w1id)
  const onReview = tasks.find((t) => t.status === 'on_review')
  // Для проверок переходов берём задачи в «правильном» исходном статусе,
  // чтобы отказ означал именно запрет по роли, а не недопустимый переход.
  const ownOnReview = tasks.find((t) => t.assignee_id === w1id && t.status === 'on_review')
  const anyNew = tasks.find((t) => t.status === 'new')
  if (!foreign || !own || !ownOnReview || !anyNew) throw new Error('Нет данных — сначала запустите npm run seed')

  console.log('\n— Без входа (anon)')
  await expectBlocked('anon не читает задачи', anon.from('tasks').select('id'))
  await expectBlocked('anon не читает объекты', anon.from('objects').select('id'))
  await expectBlocked('anon не читает историю', anon.from('task_history').select('id'))
  await expectBlocked(
    'anon не вызывает смену статуса',
    anon.rpc('change_task_status', { p_task_id: own.id, p_new_status: 'in_progress' }),
  )

  console.log('\n— Регистрация')
  const { data: su, error: suErr } = await anon.auth.signUp({
    email: `intruder-${Date.now()}@example.com`,
    password: 'Intruder-123456',
  })
  check('открытая регистрация отключена', !!suErr && !su.user, suErr?.message ?? 'пользователь создан!')

  console.log('\n— Исполнитель (worker1)')
  const { data: visible } = await w1.from('tasks').select('id, assignee_id')
  check(
    'видит только свои задачи',
    !!visible && visible.length > 0 && visible.every((t) => t.assignee_id === w1id),
    `видно задач: ${visible?.length}, из них чужих: ${visible?.filter((t) => t.assignee_id !== w1id).length}`,
  )
  const { data: w1Objects } = await w1.from('objects').select('id')
  const { data: allObjects } = await manager.from('objects').select('id')
  const ownObjectIds = new Set(tasks.filter((t) => t.assignee_id === w1id).map((t) => t.object_id))
  check(
    'видит только объекты, где у него есть задачи',
    !!w1Objects && w1Objects.length === ownObjectIds.size && w1Objects.every((o) => ownObjectIds.has(o.id)),
    `видно объектов: ${w1Objects?.length} из ${allObjects?.length}`,
  )
  await expectBlocked('не читает чужую задачу по id', w1.from('tasks').select('id').eq('id', foreign.id))
  await expectBlocked('не читает историю чужой задачи', w1.from('task_history').select('id').eq('task_id', foreign.id))
  await expectBlocked(
    'не меняет статус напрямую (UPDATE status)',
    w1.from('tasks').update({ status: 'accepted' }).eq('id', own.id).select(),
  )
  await expectBlocked(
    'не редактирует свою задачу (название)',
    w1.from('tasks').update({ title: 'взлом' }).eq('id', own.id).select(),
  )
  await expectBlocked(
    'не переназначает задачу на себя',
    w1.from('tasks').update({ assignee_id: w1id }).eq('id', foreign.id).select(),
  )
  await expectBlocked(
    'не принимает свою задачу сам (На проверке → Принята)',
    w1.rpc('change_task_status', { p_task_id: ownOnReview.id, p_new_status: 'accepted' }),
  )
  await expectBlocked(
    'не двигает чужую задачу (RPC)',
    w1.rpc('change_task_status', { p_task_id: foreign.id, p_new_status: 'in_progress' }),
  )
  await expectBlocked(
    'не пишет в историю',
    w1.from('task_history').insert({ task_id: own.id, actor_id: w1id, from_status: 'on_review', to_status: 'accepted' }).select(),
  )
  await expectBlocked('не удаляет историю', w1.from('task_history').delete().eq('task_id', own.id).select())
  await expectBlocked('не создаёт объекты', w1.from('objects').insert({ name: 'взлом' }).select())
  await expectBlocked('не удаляет задачи', w1.from('tasks').delete().eq('id', own.id).select())
  await expectBlocked(
    'не повышает себе роль',
    w1.from('profiles').update({ role: 'manager' }).eq('id', w1id).select(),
  )

  console.log('\n— Постановщик')
  await expectBlocked(
    'не меняет статус напрямую (UPDATE status)',
    manager.from('tasks').update({ status: 'accepted' }).eq('id', own.id).select(),
  )
  await expectBlocked(
    'не подделывает автора задачи',
    manager.from('tasks').update({ author_id: w1id }).eq('id', own.id).select(),
  )
  await expectBlocked(
    'не берёт задачу в работу за исполнителя (Новая → В работе)',
    manager.rpc('change_task_status', { p_task_id: anyNew.id, p_new_status: 'in_progress' }),
  )
  if (onReview) {
    await expectBlocked(
      'не возвращает на доработку без комментария',
      manager.rpc('change_task_status', { p_task_id: onReview.id, p_new_status: 'rework', p_comment: '  ' }),
    )
  }
  await expectBlocked(
    'не изменяет историю',
    manager.from('task_history').update({ comment: 'подделка' }).eq('task_id', own.id).select(),
  )
  await expectBlocked('не удаляет историю', manager.from('task_history').delete().eq('task_id', own.id).select())
  await expectBlocked(
    'не создаёт записи истории',
    manager.from('task_history').insert({ task_id: own.id, actor_id: w1id, to_status: 'accepted' }).select(),
  )

  console.log(failed ? `\n❌ Провалено проверок: ${failed}` : '\n✅ Все проверки пройдены')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('Ошибка:', e.message ?? e)
  process.exit(1)
})

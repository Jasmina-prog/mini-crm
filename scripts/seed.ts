/**
 * Наполнение базы демо-данными.
 *
 *   npm run seed            — создать пользователей и данные (если объектов ещё нет)
 *   npm run seed -- --reset — удалить все объекты/задачи и создать заново
 *
 * Service-role ключ нужен ТОЛЬКО для создания пользователей (регистрация закрыта).
 * Объекты, задачи и смена статусов выполняются через обычный API от имени
 * постановщика и исполнителей — те же проверки, что и в интерфейсе,
 * поэтому история статусов получается настоящей.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, env, login, USERS, type UserKey } from './lib.ts'

const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const PASSWORD = env('SEED_PASSWORD')
const RESET = process.argv.includes('--reset')

type Step = 'in_progress' | 'on_review' | 'accepted' | { rework: string }

interface TaskSeed {
  title: string
  description: string
  assignee: Exclude<UserKey, 'manager'>
  steps: Step[]
}

const DATA: { name: string; address: string; tasks: TaskSeed[] }[] = [
  {
    name: 'ЖК «Северный парк»',
    address: 'г. Москва, ул. Северная, 12',
    tasks: [
      {
        title: 'Залить фундамент секции А',
        description: 'Бетон B25, армирование по проекту КЖ-1. Перед заливкой — приёмка арматуры.',
        assignee: 'worker1',
        steps: ['in_progress', 'on_review', 'accepted'],
      },
      {
        title: 'Смонтировать опалубку перекрытия 2 этажа',
        description: 'Щитовая опалубка, отметка +3.300.',
        assignee: 'worker1',
        steps: ['in_progress', 'on_review'],
      },
      {
        title: 'Принять и складировать арматуру',
        description: 'Поставка 12 т, проверить сертификаты.',
        assignee: 'worker2',
        steps: [],
      },
    ],
  },
  {
    name: 'Бизнес-центр «Меридиан»',
    address: 'г. Москва, Ленинградский пр-т, 47',
    tasks: [
      {
        title: 'Кладка перегородок 3 этажа',
        description: 'Газобетон D500, толщина 100 мм.',
        assignee: 'worker2',
        steps: ['in_progress'],
      },
      {
        title: 'Гидроизоляция подвала',
        description: 'Обмазочная гидроизоляция стен и пола, примыкания усилить лентой.',
        assignee: 'worker1',
        steps: ['in_progress', 'on_review', { rework: 'У северной стены мокрое пятно — переделать примыкание пола к стене.' }],
      },
      {
        title: 'Установка оконных блоков',
        description: 'Блоки ПВХ, 24 шт. Монтажный шов — по ГОСТ 30971.',
        assignee: 'worker2',
        steps: ['in_progress', 'on_review', { rework: 'Не заполнены швы на 4 окнах.' }, 'in_progress'],
      },
    ],
  },
  {
    name: 'Школа №12 (реконструкция)',
    address: 'г. Подольск, ул. Школьная, 3',
    tasks: [
      {
        title: 'Демонтаж старой кровли',
        description: 'Вывоз мусора — контейнер 27 м³.',
        assignee: 'worker2',
        steps: ['in_progress', 'on_review', 'accepted'],
      },
      {
        title: 'Монтаж новой кровли',
        description: 'Профнастил Н60, утеплитель 200 мм.',
        assignee: 'worker2',
        steps: [],
      },
    ],
  },
]

async function ensureUsers() {
  const admin = adminClient(SERVICE_KEY)
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  for (const u of Object.values(USERS)) {
    const existing = data.users.find((x) => x.email === u.email)
    const attrs = {
      password: PASSWORD,
      email_confirm: true,
      // Роль — в app_metadata: пользователь не может изменить её сам
      app_metadata: { role: u.role, full_name: u.full_name },
    }
    let id: string
    if (existing) {
      const { error: e } = await admin.auth.admin.updateUserById(existing.id, attrs)
      if (e) throw e
      id = existing.id
    } else {
      const { data: created, error: e } = await admin.auth.admin.createUser({ email: u.email, ...attrs })
      if (e) throw e
      id = created.user.id
    }
    // Профиль создаёт триггер на auth.users, но Supabase дописывает app_metadata уже
    // после вставки строки — поэтому роль и имя в профиле выставляем явно.
    const { data: synced, error: pe } = await admin
      .from('profiles')
      .update({ role: u.role, full_name: u.full_name })
      .eq('id', id)
      .select('id')
    if (pe) throw pe
    if (!synced?.length) throw new Error(`нет профиля для ${u.email} — применены ли миграции?`)
    console.log(existing ? `  пользователь ${u.email} уже есть — обновлён` : `  создан пользователь ${u.email} (${u.role})`)
  }
}

async function userId(c: SupabaseClient): Promise<string> {
  const { data } = await c.auth.getUser()
  if (!data.user) throw new Error('нет пользователя в сессии')
  return data.user.id
}

async function changeStatus(c: SupabaseClient, taskId: string, to: string, comment?: string) {
  const { error } = await c.rpc('change_task_status', {
    p_task_id: taskId,
    p_new_status: to,
    p_comment: comment ?? null,
  })
  if (error) throw new Error(`переход в ${to}: ${error.message}`)
}

async function main() {
  console.log('1) Пользователи')
  await ensureUsers()

  const manager = await login(USERS.manager.email, PASSWORD)
  const workers = {
    worker1: await login(USERS.worker1.email, PASSWORD),
    worker2: await login(USERS.worker2.email, PASSWORD),
  }
  const workerIds = {
    worker1: await userId(workers.worker1),
    worker2: await userId(workers.worker2),
  }

  const { data: existing, error: le } = await manager.from('objects').select('id')
  if (le) throw le
  if (existing.length > 0) {
    if (!RESET) {
      console.log(`В базе уже есть объекты (${existing.length}). Чтобы пересоздать данные: npm run seed -- --reset`)
      return
    }
    console.log('2) Очистка (--reset)')
    // Удаляем от имени постановщика — через обычные права
    const { error: te } = await manager.from('tasks').delete().not('id', 'is', null)
    if (te) throw te
    const { error: oe } = await manager.from('objects').delete().not('id', 'is', null)
    if (oe) throw oe
  }

  console.log('3) Объекты, задачи и смена статусов')
  for (const obj of DATA) {
    const { data: o, error: oe } = await manager
      .from('objects')
      .insert({ name: obj.name, address: obj.address })
      .select('id')
      .single()
    if (oe) throw oe
    console.log(`  объект: ${obj.name}`)

    for (const t of obj.tasks) {
      const { data: task, error: te } = await manager
        .from('tasks')
        .insert({
          object_id: o.id,
          title: t.title,
          description: t.description,
          assignee_id: workerIds[t.assignee],
        })
        .select('id')
        .single()
      if (te) throw te

      for (const step of t.steps) {
        if (typeof step === 'object') {
          await changeStatus(manager, task.id, 'rework', step.rework)
        } else if (step === 'accepted') {
          await changeStatus(manager, task.id, 'accepted')
        } else {
          await changeStatus(workers[t.assignee], task.id, step)
        }
      }
      console.log(`    задача: ${t.title} (${t.assignee}, шагов: ${t.steps.length})`)
    }
  }

  console.log('\nГотово. Учётные записи (пароль — SEED_PASSWORD):')
  for (const u of Object.values(USERS)) console.log(`  ${u.email}  — ${u.full_name}, ${u.role}`)
}

main().catch((e) => {
  console.error('\nОшибка:', e.message ?? e)
  process.exit(1)
})

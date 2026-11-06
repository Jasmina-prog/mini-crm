import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import ws from 'ws'

export function env(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Не задана переменная окружения ${name} (см. .env.example)`)
    process.exit(1)
  }
  return v
}

export const SUPABASE_URL = env('VITE_SUPABASE_URL')
export const ANON_KEY = env('VITE_SUPABASE_ANON_KEY')

/** Демо-пользователи. Пароль у всех один — из SEED_PASSWORD. */
export const USERS = {
  manager: { email: 'manager@example.com', full_name: 'Иван Петров', role: 'manager' },
  worker1: { email: 'worker1@example.com', full_name: 'Алексей Смирнов', role: 'executor' },
  worker2: { email: 'worker2@example.com', full_name: 'Мария Кузнецова', role: 'executor' },
} as const

export type UserKey = keyof typeof USERS

// В Node < 22 нет встроенного WebSocket, а supabase-js создаёт realtime-клиент сразу.
type Options = SupabaseClientOptions<'public'>
type Transport = NonNullable<NonNullable<Options['realtime']>['transport']>
const noPersist: Options = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as Transport },
}

/** Клиент с публичным ключом — ровно то, что доступно браузеру. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, noPersist)
}

/** Вход под пользователем через обычный публичный API. */
export async function login(email: string, password: string): Promise<SupabaseClient> {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Не удалось войти как ${email}: ${error.message}`)
  return c
}

export function adminClient(serviceKey: string): SupabaseClient {
  return createClient(SUPABASE_URL, serviceKey, noPersist)
}

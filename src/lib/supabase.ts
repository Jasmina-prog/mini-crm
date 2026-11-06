import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (см. .env.example)')
}

/** Роль из JWT-ключа (для старых ключей вида eyJ...). */
function jwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).role ?? null
  } catch {
    return null
  }
}

// Страховка: во фронтенд должен попадать только публичный ключ (anon / publishable).
// Секретный ключ обходит RLS, поэтому с ним приложение просто не запустится.
if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
  throw new Error('Во фронтенде нельзя использовать секретный ключ (service_role / sb_secret_)')
}

export const supabase = createClient(url, key)

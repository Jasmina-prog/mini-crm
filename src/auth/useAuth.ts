import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../lib/types'

export interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** true, пока не известно, вошёл ли пользователь и какой у него профиль */
  loading: boolean
  profileError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Профиль текущего пользователя — только внутри защищённых маршрутов. */
export function useMe(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('useMe() вызван без авторизации')
  return profile
}

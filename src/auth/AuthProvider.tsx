import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Profile } from '../lib/types'
import { AuthContext, type AuthContextValue } from './useAuth'

interface ProfileState {
  userId: string
  profile: Profile | null
  error: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [loaded, setLoaded] = useState<ProfileState | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    // Внутри колбэка не вызываем supabase — только обновляем состояние
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .getProfile(userId)
      .then((profile) =>
        setLoaded({
          userId,
          profile,
          error: profile ? null : 'Профиль пользователя не найден. Обратитесь к администратору.',
        }),
      )
      .catch((e) => !cancelled && setLoaded({ userId, profile: null, error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [userId])

  // Профиль актуален, только если загружен для текущего пользователя
  const current = userId && loaded?.userId === userId ? loaded : null

  const value: AuthContextValue = {
    session,
    profile: current?.profile ?? null,
    profileError: current?.error ?? null,
    loading: !sessionReady || (!!userId && !current),
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

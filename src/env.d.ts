interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Публичный ключ: anon (eyJ...) или publishable (sb_publishable_...) */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

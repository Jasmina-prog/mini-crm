import { notifications } from '@mantine/notifications'

const hasCyrillic = (s: string) => /[а-яё]/i.test(s)

/** Переводит ошибку Supabase/Postgres в понятное пользователю сообщение. */
export function errorMessage(e: unknown): string {
  const err = (e ?? {}) as { code?: string; message?: string }
  const msg = err.message ?? String(e)

  // Сообщения из наших функций в БД уже на русском — показываем как есть
  if (hasCyrillic(msg)) return msg

  switch (err.code) {
    case '23503':
      return 'Нельзя удалить: есть связанные задачи. Сначала удалите задачи этого объекта.'
    case '42501':
      return 'Недостаточно прав для этого действия'
    case 'PGRST116':
      return 'Запись не найдена или нет доступа'
  }
  if (/row-level security/i.test(msg)) return 'Недостаточно прав для этого действия'
  if (/invalid login credentials/i.test(msg)) return 'Неверный email или пароль'
  if (/failed to fetch/i.test(msg)) return 'Нет связи с сервером'
  return msg
}

export function notifyError(e: unknown) {
  notifications.show({ color: 'red', title: 'Ошибка', message: errorMessage(e) })
}

export function notifyOk(message: string) {
  notifications.show({ color: 'green', message })
}

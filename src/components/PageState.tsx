import { Alert, Center, Loader } from '@mantine/core'
import type { ReactNode } from 'react'

/** Общий «загрузка / ошибка / не найдено» для страниц. */
export function PageState({
  loading,
  error,
  notFound,
  children,
}: {
  loading: boolean
  error?: string
  notFound?: boolean
  children: ReactNode
}) {
  if (error) return <Alert color="red" title="Ошибка">{error}</Alert>
  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    )
  }
  if (notFound) {
    return (
      <Alert color="gray" title="Не найдено">
        Запись не существует или у вас нет к ней доступа.
      </Alert>
    )
  }
  return <>{children}</>
}

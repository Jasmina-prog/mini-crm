import dayjs from 'dayjs'
import 'dayjs/locale/ru'

dayjs.locale('ru')

export const fmtDateTime = (iso: string) => dayjs(iso).format('DD.MM.YYYY HH:mm')
export const fmtDate = (iso: string) => dayjs(iso).format('DD.MM.YYYY')

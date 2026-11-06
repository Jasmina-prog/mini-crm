import { Badge } from '@mantine/core'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/status'
import type { TaskStatus } from '../lib/types'

export function StatusBadge({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" size={size}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

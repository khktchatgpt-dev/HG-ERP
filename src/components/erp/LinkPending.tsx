'use client'

import { useLinkStatus } from 'next/link'
import { Spinner } from './Spinner'

/**
 * Hiện spinner khi <Link> cha đang điều hướng; ngược lại hiện `fallback` (icon tĩnh).
 * Đặt làm con của <Link> — useLinkStatus đọc trạng thái từ Link gần nhất.
 * Next 16 App Router.
 */
export function LinkPending({
  size = 12,
  fallback,
}: {
  size?: number
  fallback?: React.ReactNode
}) {
  const { pending } = useLinkStatus()
  if (pending) return <Spinner size={size} className="text-current" />
  return <>{fallback ?? null}</>
}

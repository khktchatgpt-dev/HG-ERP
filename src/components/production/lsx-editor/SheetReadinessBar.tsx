'use client'

import { Clock3, CircleAlert, TriangleAlert } from 'lucide-react'
import { Checkbox } from '@/components/shadcn/checkbox'
import type { SheetReadiness } from '@/modules/dept/production/lsx-line-fill'

/**
 * Tổng quan độ đầy đủ của cả phiếu + lối tắt "chỉ hiện dòng còn thiếu".
 * Lệnh thật có tới 69 dòng — không có bộ lọc thì Sales cuộn mù để tìm chỗ hở.
 */
export function SheetReadinessBar({
  readiness,
  onlyIncomplete,
  onToggle,
}: {
  readiness: SheetReadiness
  onlyIncomplete: boolean
  onToggle: (v: boolean) => void
}) {
  const { total, ok, blocked, warned, pending } = readiness
  if (!total) return null
  const pct = Math.round((ok / total) * 100)
  const incomplete = blocked.length + warned.length

  return (
    <div className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 shadow-xs">
      <div className="flex min-w-48 flex-1 items-center gap-2">
        <span className="text-xs font-medium whitespace-nowrap">Đủ thông tin</span>
        <span className="bg-muted h-1.5 min-w-24 flex-1 overflow-hidden rounded-full">
          <span
            className={`block h-full ${blocked.length ? 'bg-red-500' : incomplete ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="text-xs whitespace-nowrap tabular-nums">
          <b>{ok}</b>/{total} dòng
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {blocked.length > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
            <TriangleAlert className="size-3.5" aria-hidden />
            {blocked.length} dòng thiếu bắt buộc
          </span>
        )}
        {warned.length > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <CircleAlert className="size-3.5" aria-hidden />
            {warned.length} dòng thiếu mục nên có
          </span>
        )}
        {pending > 0 && (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden />
            {pending} ô chờ chốt
          </span>
        )}
        {!incomplete && !pending && (
          <span className="text-emerald-700 dark:text-emerald-400">
            Mọi dòng đã đủ thông tin
          </span>
        )}
      </div>

      {incomplete > 0 && (
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs whitespace-nowrap">
          <Checkbox
            checked={onlyIncomplete}
            onCheckedChange={(v) => onToggle(v === true)}
          />
          Chỉ hiện dòng còn thiếu
        </label>
      )}
    </div>
  )
}

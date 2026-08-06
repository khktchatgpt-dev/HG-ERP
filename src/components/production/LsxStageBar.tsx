import { Badge } from '@/components/shadcn/badge'
import { LSX_STATUS } from '@/lib/lsx-status'

/**
 * Thanh vòng đời lệnh sản xuất (style v2) — 4 đoạn Phát → Duyệt → SX → Xong,
 * đoạn hiện tại mang màu trạng thái. rejected/cancelled là rẽ ngang, hiện Badge.
 * Dùng ở trang danh sách + hồ sơ lệnh cho cùng một ngôn ngữ.
 */

// 5 chặng kể từ 0117: lệnh mới nằm ở NHÁP cho Sales soạn dòng, gửi duyệt mới
// sang chặng 2. rejected/cancelled là rẽ ngang, không nằm trên trục.
const STAGES = ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Sản xuất', 'Hoàn thành'] as const

export const STAGE_OF: Record<string, number> = {
  draft: 0,
  pending_approval: 1,
  approved: 2,
  in_progress: 3,
  completed: 4,
}
const STAGE_BAR: Record<string, string> = {
  draft: 'bg-stone-400',
  pending_approval: 'bg-amber-500',
  approved: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  completed: 'bg-emerald-500',
}
const STAGE_TEXT: Record<string, string> = {
  draft: 'text-muted-foreground',
  pending_approval: 'text-amber-700 dark:text-amber-400',
  approved: 'text-blue-700 dark:text-blue-400',
  in_progress: 'text-amber-700 dark:text-amber-400',
  completed: 'text-emerald-700 dark:text-emerald-400',
}

export function StageBar({
  status,
  className = 'w-[140px]',
}: {
  status: string
  className?: string
}) {
  const stage = STAGE_OF[status]
  if (stage === undefined) {
    // Ngoài trục: từ chối (đỏ) / huỷ theo đơn (xám).
    return status === 'rejected' ? (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
      >
        Bị từ chối
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-muted-foreground">
        {LSX_STATUS[status as keyof typeof LSX_STATUS]?.label ?? status}
      </Badge>
    )
  }
  const label = LSX_STATUS[status as keyof typeof LSX_STATUS]?.label ?? status
  return (
    <div
      className={className}
      title={STAGES.map((s, i) => `${i <= stage ? '●' : '○'} ${s}`).join('   ')}
    >
      <div className="flex gap-[3px]">
        {STAGES.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= stage ? STAGE_BAR[status] : 'bg-muted'}`}
          />
        ))}
      </div>
      <div className={`mt-1 text-xs font-medium ${STAGE_TEXT[status]}`}>
        {label} · {stage + 1}/{STAGES.length}
      </div>
    </div>
  )
}

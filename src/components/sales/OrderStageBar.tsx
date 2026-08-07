import { Badge } from '@/components/shadcn/badge'
import { LIFECYCLE_STEPS, STATUS_LABEL } from '@/lib/order-progress'

/**
 * Thanh vòng đời ĐƠN HÀNG (style v2) — 6 đoạn Xác nhận → Chờ duyệt LSX → Phát
 * LSX → Sản xuất → Hoàn thành → Đã giao, đoạn đã qua mang màu trạng thái.
 *
 * Vì sao thay Badge: bảng đơn hàng thật gần như toàn "Đã phát LSX", 30 badge
 * cùng một sắc hổ phách nhạt xếp dọc thì không đọc ra đơn nào đi tới đâu. Thanh
 * đoạn cho biết vị trí trên trục ngay từ xa, badge chỉ nói được tên chặng.
 *
 * Song sinh với `LsxStageBar` (lệnh sản xuất) — cùng bảng màu để hai màn đọc
 * như một. Bước lấy từ `LIFECYCLE_STEPS` (@/lib/order-progress) nên thêm/bớt
 * chặng chỉ sửa một chỗ.
 */

const STAGE_OF: Record<string, number> = Object.fromEntries(
  LIFECYCLE_STEPS.map((s, i) => [s.status, i]),
)

/** Màu theo "ai đang giữ việc": xanh dương = trôi chảy, hổ phách = đang chờ. */
const BAR: Record<string, string> = {
  confirmed: 'bg-blue-500',
  lsx_pending: 'bg-amber-500',
  lsx_issued: 'bg-blue-500',
  in_production: 'bg-amber-500',
  completed: 'bg-emerald-500',
  delivered: 'bg-emerald-500',
}
const TEXT: Record<string, string> = {
  confirmed: 'text-blue-700 dark:text-blue-400',
  lsx_pending: 'text-amber-700 dark:text-amber-400',
  lsx_issued: 'text-blue-700 dark:text-blue-400',
  in_production: 'text-amber-700 dark:text-amber-400',
  completed: 'text-emerald-700 dark:text-emerald-400',
  delivered: 'text-emerald-700 dark:text-emerald-400',
}

export function OrderStageBar({
  status,
  className = 'w-[150px]',
}: {
  status: string
  className?: string
}) {
  const stage = STAGE_OF[status]
  // Ngoài trục: huỷ đơn là rẽ ngang, không có vị trí trên vòng đời.
  if (stage === undefined) {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        {STATUS_LABEL[status] ?? status}
      </Badge>
    )
  }
  const label = STATUS_LABEL[status] ?? status
  return (
    <div
      className={className}
      title={LIFECYCLE_STEPS.map((s, i) => `${i <= stage ? '●' : '○'} ${s.label}`).join(
        '   ',
      )}
    >
      <div className="flex gap-[3px]">
        {LIFECYCLE_STEPS.map((s, i) => (
          <span
            key={s.status}
            className={`h-1.5 flex-1 rounded-full ${i <= stage ? BAR[status] : 'bg-muted'}`}
          />
        ))}
      </div>
      <div className={`mt-1 truncate text-xs font-medium ${TEXT[status]}`}>
        {label} · {stage + 1}/{LIFECYCLE_STEPS.length}
      </div>
    </div>
  )
}

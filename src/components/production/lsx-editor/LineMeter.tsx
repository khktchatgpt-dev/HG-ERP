import { Boxes, CalendarClock, ClipboardCheck, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Meter, MeterState } from '@/modules/dept/production/lsx-line-fill'

/**
 * Dải 4 ô "dòng này đủ thông tin chưa" — thay nút "Chi tiết N/11" cũ (phân số
 * gộp 11 ô nặng nhẹ khác nhau, mẫu số lại đổi theo mẫu cột của khách).
 *
 * Bê nguyên quy ước màu của dải hồ sơ SP bên Kỹ thuật (`DocMeter`): có = màu
 * đặc, dở dang = hổ phách, thiếu = ô rỗng có viền. Cùng một thứ tiếng trong
 * toàn app thì nhìn quen mắt hơn là mỗi màn một kiểu.
 *
 * Cố ý KHÔNG hiện mức "bắt buộc" (mã SP/SL/ĐVT) ở đây — thiếu mấy cái đó là
 * chặn gửi duyệt, phải nổi hơn hẳn: hàng có viền trái đỏ + icon cảnh báo.
 */

const TONE: Record<MeterState, string> = {
  ok: 'bg-emerald-600 text-white',
  partial: 'bg-amber-500 text-white',
  missing: 'text-muted-foreground/60 ring-1 ring-inset ring-border',
}

const ICON: Record<string, LucideIcon> = {
  specs: Boxes,
  packing: Package,
  ship: CalendarClock,
  checks: ClipboardCheck,
}

export function LineMeter({ meters }: { meters: Meter[] }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={meters.map((m) => m.title).join('; ')}
    >
      {meters.map((m) => {
        const Icon = ICON[m.key] ?? Boxes
        return (
          <span
            key={m.key}
            title={m.title}
            className={`flex size-5 items-center justify-center rounded ${TONE[m.state]}`}
          >
            <Icon className="size-3" aria-hidden />
          </span>
        )
      })}
    </span>
  )
}

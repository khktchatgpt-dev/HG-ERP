import Link from 'next/link'
import { CalendarDays, ChevronRight, User } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { DocChip } from '@/components/erp/DocChip'
import {
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  poSpineColor,
  isPoStatus,
} from '@/lib/po-status'
import type { WatchPo } from '../_data/watch'

const money = (n: number) => n.toLocaleString('vi-VN')

function dmy(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

/** Số ngày giữa 2 chuỗi yyyy-mm-dd (b − a). */
function daysBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000)
}

/**
 * MỘT DÒNG ĐƠN trong hai màn theo dõi — cùng một hình để người dùng chỉ phải
 * học đọc một lần. Vạch sống mép trái + mã chứng từ + tiền mono, đúng ngôn ngữ
 * của /design-lab.
 *
 * `note` là chỗ mỗi màn tự nói thêm điều riêng của mình (vd "quá hẹn 3 ngày",
 * "còn 2 ngày") — phần chung không đoán hộ.
 */
export function PoWatchRow({ po, note }: { po: WatchPo; note?: React.ReactNode }) {
  const status = isPoStatus(po.status) ? po.status : null
  return (
    <Link
      href={`/planning/pos/${po.id}`}
      className="spine flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-0 hover:bg-[var(--accent)]/50"
      style={
        {
          '--spine': status ? poSpineColor(status) : 'transparent',
        } as React.CSSProperties
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <DocChip className="text-[11px]">{po.code}</DocChip>
          <span className="t-body truncate font-medium">{po.supplier_name}</span>
          {po.lsx_code && (
            <span className="text-muted-foreground t-data text-[11px]">
              {po.lsx_code}
            </span>
          )}
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" strokeWidth={1.8} />
            {po.assignee_name ?? 'chưa giao ai'}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" strokeWidth={1.8} />
            hẹn {dmy(po.expected_at)}
          </span>
          {po.lines_total > 0 && (
            <span className="t-data text-[11px]">
              về {po.lines_done}/{po.lines_total} dòng
            </span>
          )}
          {note}
        </div>
      </div>

      <span className="t-data hidden shrink-0 text-right sm:block">
        {money(po.total)}
        <span className="text-muted-foreground ml-1 text-[11px]">{po.currency}</span>
      </span>
      {status && (
        <span className="hidden shrink-0 md:block">
          <Badge tone={PO_STATUS_TONE[status]}>{PO_STATUS_LABEL[status]}</Badge>
        </span>
      )}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  )
}

/** Ghi chú "quá hẹn N ngày" / "còn N ngày" — hai màn đều cần, tính một chỗ. */
export function EtaNote({ po, today }: { po: WatchPo; today: string }) {
  if (!po.expected_at) {
    return <span className="font-medium text-[var(--warn)]">chưa hẹn ngày</span>
  }
  const eta = po.expected_at.slice(0, 10)
  if (eta < today) {
    return (
      <span className="font-medium text-[var(--stop)]">
        quá hẹn {daysBetween(eta, today)} ngày
      </span>
    )
  }
  const left = daysBetween(today, eta)
  if (left === 0)
    return <span className="font-medium text-[var(--warn)]">đến hẹn hôm nay</span>
  if (left <= 7) return <span className="text-[var(--warn)]">còn {left} ngày</span>
  return null
}

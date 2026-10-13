import {
  ClipboardList,
  Factory,
  FileText,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import { money } from '../approval-helpers'
import type { LoaiPhieu } from '@/lib/loai-phieu-duyet'
import type { SignItem } from '@/modules/core/exec/exec.service'

/**
 * Đồ dùng chung của Hộp ký (`/exec/approvals` + "Chờ tôi ký" bên Mua hàng).
 * Màn viết tay, không dùng kit (14/10/2026) — icon lấy thẳng lucide-react.
 */

export const KIND_ICON: Record<LoaiPhieu, LucideIcon> = {
  po: ShoppingCart,
  dnm: ClipboardList,
  lsx: Factory,
  quote: FileText,
}

/** Lớp màu của loại (`hop-ky.css`: .lp-po, .lp-dnm…) — đặt `--c` / `--w`. */
export const LOP_MAU: Record<LoaiPhieu, string> = {
  po: 'lp-po',
  dnm: 'lp-dnm',
  lsx: 'lp-lsx',
  quote: 'lp-quote',
}

/** Cộng tiền theo TỪNG tiền tệ — USD và VND không bao giờ cộng chung. */
export function sumByCurrency(items: readonly SignItem[]): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value)
  return [...m.entries()]
}

export const moneyText = (items: readonly SignItem[]) =>
  sumByCurrency(items)
    .filter(([, v]) => v > 0)
    .map(([cur, v]) => money(v, cur))
    .join(' · ') || '—'

/** Tiền gọn cho ô đếm: "412,3 tr", "1,8 tr", "48.600 USD". */
export function moneyShort(items: readonly SignItem[]): string {
  return (
    sumByCurrency(items)
      .filter(([, v]) => v > 0)
      .map(([cur, v]) =>
        cur === 'VND' && v >= 1_000_000
          ? `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
          : money(v, cur),
      )
      .join(' + ') || ''
  )
}

/** "30/08" năm nay, "30/08/2025" năm khác. */
export function dm(iso: string, today: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`
}

export const itemKey = (i: SignItem) => `${i.kind}-${i.id}`

import type { IcoName } from '@/components/kit'
import { money } from '../approval-helpers'
import type { LoaiPhieu } from '@/lib/loai-phieu-duyet'
import type { SignItem } from '@/modules/core/exec/exec.service'

/**
 * Đồ dùng chung của Hộp ký (`/exec/approvals` + "Chờ tôi ký" bên Mua hàng).
 * File KHÔNG 'use client' — chỉ hàm thuần + hằng.
 */

export const KIND_ICON: Record<LoaiPhieu, IcoName> = {
  lsx: 'lenh',
  po: 'don',
  quote: 'baoGia',
  dnm: 'vattu',
}

/** Số cột của bảng Hộp ký — THead, GroupRow, hàng tiêu đề khối, chân bảng dùng chung. */
export const COLS = 8

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

/** "30/08" năm nay, "30/08/2025" năm khác. */
export function dm(iso: string, today: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`
}

export const itemKey = (i: SignItem) => `${i.kind}-${i.id}`

/**
 * ĐỒNG BỘ DÒNG LỆNH TỪ DÒNG ĐƠN (07/10/2026). Sửa đơn sau khi có lệnh chỉ
 * phát thông báo; màn soạn dòng lại bảo "muốn thêm/bớt mặt hàng thì sửa ĐƠN" —
 * ngõ cụt. Hàm này SO từng nhóm (nhóm gắn `sales_order_id`) với dòng của đơn
 * đó, ra danh sách việc để người dùng XEM rồi mới áp:
 *   · add    : SP có trong đơn, chưa có trong nhóm → thêm dòng
 *   · remove : dòng trong nhóm mà đơn không còn SP đó → bỏ dòng
 *   · qty    : một dòng duy nhất của SP trong nhóm, SL khác đơn → đổi SL
 *   · split  : SP tách nhiều dòng (nhiều đợt) mà Σ khác đơn → KHÔNG tự chia,
 *              báo để Sale chỉnh tay
 * Logic thuần, không chạm DB.
 */

export type DonLine = { product_id: string; product_code: string; qty: number }
export type LenhLine = {
  id: string
  product_id: string | null
  product_code: string
  qty: number
}
export type LenhGroup = { id: string; sales_order_id: string | null; lines: LenhLine[] }

export type SyncItem =
  | {
      kind: 'add'
      group_id: string
      product_id: string
      product_code: string
      qty: number
    }
  | {
      kind: 'remove'
      group_id: string
      line_id: string
      product_code: string
      qty: number
    }
  | {
      kind: 'qty'
      group_id: string
      line_id: string
      product_code: string
      from: number
      to: number
    }
  | {
      kind: 'split'
      group_id: string
      product_code: string
      lines: number
      from: number
      to: number
    }

const key = (productId: string | null, code: string) =>
  productId ?? `code:${code.replace(/\s+/g, ' ').trim().toLowerCase()}`

/** So nhóm ↔ đơn. `ordersLines`: dòng đơn theo id đơn. */
export function diffLsxAgainstOrders(
  groups: readonly LenhGroup[],
  ordersLines: ReadonlyMap<string, readonly DonLine[]>,
): SyncItem[] {
  const out: SyncItem[] = []
  for (const g of groups) {
    if (!g.sales_order_id) continue
    const don = ordersLines.get(g.sales_order_id)
    if (!don) continue
    // Đơn: gộp theo SP (một SP nhiều dòng — D2).
    const wantBy = new Map<string, { code: string; qty: number }>()
    for (const l of don) {
      const k = key(l.product_id, l.product_code)
      const cur = wantBy.get(k) ?? { code: l.product_code, qty: 0 }
      cur.qty += l.qty
      wantBy.set(k, cur)
    }
    // Lệnh: dòng theo SP trong nhóm.
    const haveBy = new Map<string, LenhLine[]>()
    for (const l of g.lines) {
      const k = key(l.product_id, l.product_code)
      const arr = haveBy.get(k) ?? []
      arr.push(l)
      haveBy.set(k, arr)
    }
    for (const [k, want] of wantBy) {
      const have = haveBy.get(k)
      if (!have) {
        out.push({ kind: 'add', group_id: g.id, product_id: k.startsWith('code:') ? '' : k, product_code: want.code, qty: want.qty }) // prettier-ignore
        continue
      }
      const sum = have.reduce((s, l) => s + l.qty, 0)
      if (Math.abs(sum - want.qty) < 1e-9) continue
      if (have.length === 1) {
        out.push({ kind: 'qty', group_id: g.id, line_id: have[0].id, product_code: have[0].product_code, from: sum, to: want.qty }) // prettier-ignore
      } else {
        out.push({ kind: 'split', group_id: g.id, product_code: have[0].product_code, lines: have.length, from: sum, to: want.qty }) // prettier-ignore
      }
    }
    for (const [k, have] of haveBy) {
      if (wantBy.has(k)) continue
      for (const l of have) {
        out.push({ kind: 'remove', group_id: g.id, line_id: l.id, product_code: l.product_code, qty: l.qty }) // prettier-ignore
      }
    }
  }
  return out
}

/** Câu người đọc hiểu cho một việc. */
export function describeSyncItem(it: SyncItem): string {
  switch (it.kind) {
    case 'add':
      return `Thêm ${it.product_code} × ${it.qty.toLocaleString('vi-VN')} (đơn có, lệnh chưa)`
    case 'remove':
      return `Bỏ ${it.product_code} × ${it.qty.toLocaleString('vi-VN')} (đơn không còn)`
    case 'qty':
      return `${it.product_code}: SL ${it.from.toLocaleString('vi-VN')} → ${it.to.toLocaleString('vi-VN')}`
    case 'split':
      return `${it.product_code} đang tách ${it.lines} đợt (Σ ${it.from.toLocaleString('vi-VN')}), đơn là ${it.to.toLocaleString('vi-VN')} — chỉnh tay từng đợt`
  }
}

/** Việc tự áp được (split phải chỉnh tay). */
export const isAutoApplicable = (it: SyncItem) => it.kind !== 'split'

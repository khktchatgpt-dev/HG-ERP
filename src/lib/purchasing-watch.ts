import { classifyTodo, type SupplyTodoKind, type SupplyWatchInput } from './supply-watch'
import { poOwner } from './supply-scope'
import { supplierShortName } from './po-list-labels'

/**
 * GIÁM SÁT MUA HÀNG cho Ban Giám đốc — phép tính THUẦN (27/09/2026, artboard 6).
 *
 * Câu hỏi của màn: "phòng Cung ứng đang kẹt ở đâu, ai đang cầm gì, công ty đã
 * cam kết bao nhiêu tiền với ai". Mọi con số đếm bằng ĐÚNG hàm của trang đích:
 * ô việc = làn tương ứng của Hộp thư (`classifyTodo`), "chờ ký" = hộp ký
 * (trạng thái `pending_approval`). Bấm ô nào ra đúng chừng ấy dòng.
 *
 * "Đã cam kết" = đơn ĐÃ GỬI NCC mà chưa về đủ (ordered/confirmed/in_transit/
 * partial) — đơn chưa gửi thì chưa ràng buộc gì với nhà cung cấp.
 */

export type WatchInput = SupplyWatchInput & {
  id: string
  status: string
  currency: string
  total: number
  assigned_to: string | null
  created_by?: string | null
  supplier_id: string
  supplier_name: string
}

export const SENT_STATUSES: ReadonlySet<string> = new Set([
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
])

export type MoneyByCurrency = { currency: string; value: number }[]

export type BuyerRow = {
  id: string | null
  pending: number
  unsent: number
  sent: number
  unconfirmed: number
  no_eta: number
  overdue: number
  committed: MoneyByCurrency
}

export type SupplierRow = {
  id: string
  name: string
  short: string
  count: number
  committed: MoneyByCurrency
}

export type PurchasingWatch = {
  open: number
  tiles: Record<'pending' | SupplyTodoKind, number>
  buyers: BuyerRow[]
  suppliers: SupplierRow[]
  committed: MoneyByCurrency
}

function addMoney(acc: Map<string, number>, currency: string, v: number) {
  acc.set(currency, (acc.get(currency) ?? 0) + v)
}
const toList = (m: Map<string, number>): MoneyByCurrency =>
  [...m.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => (a[0] === 'VND' ? -1 : b[0] === 'VND' ? 1 : a[0].localeCompare(b[0])))
    .map(([currency, value]) => ({ currency, value }))

export function buildPurchasingWatch(pos: WatchInput[], today: string): PurchasingWatch {
  // Đơn đang mở với Giám đốc: đã rời nháp, chưa về đủ, chưa huỷ.
  const open = pos.filter(
    (p) => p.status !== 'draft' && p.status !== 'received' && p.status !== 'cancelled',
  )
  const tiles = {
    pending: 0,
    overdue: 0,
    unconfirmed: 0,
    unsent: 0,
    no_eta: 0,
    partial: 0,
    draft: 0,
  } as PurchasingWatch['tiles']
  const byBuyer = new Map<string, BuyerRow & { _m: Map<string, number> }>()
  const bySup = new Map<string, SupplierRow & { _m: Map<string, number> }>()
  const all = new Map<string, number>()

  for (const p of open) {
    const kind = p.status === 'pending_approval' ? null : classifyTodo(p, today)
    if (p.status === 'pending_approval') tiles.pending++
    if (kind) tiles[kind]++

    const owner = poOwner({ assigned_to: p.assigned_to, created_by: p.created_by })
    const bk = owner ?? '@none'
    const b =
      byBuyer.get(bk) ??
      ({ id: owner, pending: 0, unsent: 0, sent: 0, unconfirmed: 0, no_eta: 0, overdue: 0, committed: [], _m: new Map() } as BuyerRow & { _m: Map<string, number> }) // prettier-ignore
    byBuyer.set(bk, b)
    if (p.status === 'pending_approval') b.pending++
    if (kind === 'unsent') b.unsent++
    if (kind === 'unconfirmed') b.unconfirmed++
    if (kind === 'no_eta') b.no_eta++
    if (kind === 'overdue') b.overdue++

    if (SENT_STATUSES.has(p.status)) {
      b.sent++
      addMoney(b._m, p.currency, p.total)
      addMoney(all, p.currency, p.total)
      const s =
        bySup.get(p.supplier_id) ??
        ({ id: p.supplier_id, name: p.supplier_name, short: supplierShortName(p.supplier_name), count: 0, committed: [], _m: new Map() } as SupplierRow & { _m: Map<string, number> }) // prettier-ignore
      bySup.set(p.supplier_id, s)
      s.count++
      addMoney(s._m, p.currency, p.total)
    }
  }

  const strip = <T extends { _m: Map<string, number>; committed: MoneyByCurrency }>(
    x: T,
  ) => {
    const { _m, ...rest } = x
    return { ...rest, committed: toList(_m) }
  }
  // VND quy về một con số để XẾP (không để hiển thị): NCC/người mua lớn trước.
  const weight = (m: MoneyByCurrency) => m.reduce((s, x) => s + (x.currency === 'VND' ? x.value : x.value * 25_000), 0) // prettier-ignore

  return {
    open: open.length,
    tiles,
    buyers: [...byBuyer.values()]
      .map(strip)
      .sort((a, b) => b.pending + b.sent + b.unsent - (a.pending + a.sent + a.unsent)),
    suppliers: [...bySup.values()]
      .map(strip)
      .sort((a, b) => weight(b.committed) - weight(a.committed)),
    committed: toList(all),
  }
}

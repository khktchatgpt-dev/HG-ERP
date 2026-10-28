/**
 * ĐIỀU CHỈNH ĐƠN MUA ĐÃ GỬI — phép tính thuần: so bản đang chạy với bản mới,
 * ra (1) những gì phải ghi, (2) ảnh chụp cũ → mới từng dòng, (3) PHÁT SINH
 * tiền tách vì giá / vì lượng, (4) lý do chặn nếu có.
 *
 * Chốt 25/09/2026 (canvas thiết kế, artboard 9–9g): điều chỉnh ÁP DỤNG NGAY,
 * không duyệt lại; phần chênh là "phát sinh lần N" riêng cho kế toán. Hàm DB
 * `supply_po_apply_adjustment` (0210) kiểm LẠI các ràng buộc cứng dưới khoá —
 * ở đây kiểm trước để nói lý do bằng lời người, theo từng dòng.
 *
 * Tách vì giá / vì lượng của một dòng (q = SL tính tiền, p = đơn giá):
 *   vì giá   = q_mới × (p_mới − p_cũ)
 *   vì lượng = (q_mới − q_cũ) × p_cũ
 * Cộng hai phần đúng bằng q_mới·p_mới − q_cũ·p_cũ. Dòng mới / dòng bỏ tính cả
 * vào "vì lượng". q là qty2 khi dòng tính giá theo đơn vị 2 (kg, m², m³).
 */
import { poLineAmount, poMoney, roundMoney, type PriceBasis } from './po-line'

/** Ô nhập của dòng đem ra so để biết dòng có đổi không (ngoài SL và giá). */
export const ADJ_COMPARE_FIELDS = [
  'line_name',
  'line_unit',
  'line_kind',
  'spec',
  'note',
  'material_grade',
  'dm_per_sp',
  'qty_demand',
  'qty_on_hand',
  'die_code',
  'weight_per_m',
  'bar_length_m',
  'dimension_text',
  'finish',
  'weight_per_unit',
  'm3_per_unit',
  'warranty_text',
  'print_spec',
  'open_style',
  'pcs_per_ctn',
  'inner_l_mm',
  'inner_w_mm',
  'inner_h_mm',
  'area_m2',
  'price_per_m2',
  'print_fee',
  'carton_basis',
  'pack_size',
  'pack_unit',
  'unit2_per_unit',
] as const

export type LsxSplitRow = { production_order_id: string; qty: number }

type LineCore = {
  material_id: string | null
  qty_ordered: number
  unit_price: number | null
  price_basis: PriceBasis
  qty2: number | null
  lsx_split?: LsxSplitRow[] | null
  /** Các ô khác của dòng, theo `ADJ_COMPARE_FIELDS`. */
  [k: string]: unknown
}

/** Dòng ĐANG CHẠY, kèm các con số đã bám vào nó. */
export type AdjBeforeLine = LineCore & {
  id: string
  code: string | null
  name: string
  unit: string | null
  /** Đã nhận thuần (nhập + bị loại − trả), cùng phép tính `supply_po_line_status`. */
  received: number
  /** Σ SL trong các đợt giao còn sống (planned / arrived). */
  planned: number
  /** Dòng đã nằm trên hoá đơn NCC. */
  invoiced: boolean
}

/** Dòng BẢN MỚI — `id` có = sửa dòng cũ, không có = dòng thêm. */
export type AdjAfterLine = LineCore & {
  id?: string | null
  code: string | null
  name: string
  unit: string | null
}

export type AdjHeader = { vatRate: number | null; discount: number | null }

export type AdjChangeKind = 'changed' | 'added' | 'removed'

export type AdjChange = {
  kind: AdjChangeKind
  line_id: string | null
  /** Số thứ tự dòng trên lưới (1-based) — theo bản mới, dòng bỏ thì theo bản cũ. */
  no: number
  code: string | null
  name: string
  unit: string | null
  qty_before: number | null
  qty_after: number | null
  price_before: number | null
  price_after: number | null
  amount_before: number
  amount_after: number
  by_price: number
  by_qty: number
  /** Ô đổi ngoài SL / giá (spec, note, …) — cho dòng "chỉ sửa quy cách". */
  fields: string[]
}

export type AdjPlan = {
  errors: string[]
  changes: AdjChange[]
  headerChanges: {
    vat_rate?: [number | null, number | null]
    discount_amount?: [number, number]
  } | null
  updates: (AdjAfterLine & { id: string; sort_order: number })[]
  inserts: (AdjAfterLine & { sort_order: number })[]
  deleteIds: string[]
  money: { before: ReturnType<typeof poMoney>; after: ReturnType<typeof poMoney> }
  delta: { subtotal: number; vat: number; total: number; byPrice: number; byQty: number }
}

const blank = (v: unknown) => v === null || v === undefined || v === ''
function same(a: unknown, b: unknown): boolean {
  if (blank(a) && blank(b)) return true
  if (blank(a) || blank(b)) return false
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a)
    const y = Number(b)
    if (Number.isFinite(x) && Number.isFinite(y)) return Math.abs(x - y) < 1e-9
  }
  return String(a).trim() === String(b).trim()
}
function sameSplit(a?: LsxSplitRow[] | null, b?: LsxSplitRow[] | null): boolean {
  const k = (s?: LsxSplitRow[] | null) =>
    (s ?? [])
      .map((r) => `${r.production_order_id}:${Number(r.qty)}`)
      .sort()
      .join('|')
  return k(a) === k(b)
}
/** SL tính tiền của dòng: qty2 khi giá theo đơn vị 2, không thì SL đặt. */
const billQty = (l: LineCore) =>
  l.price_basis === 'unit2' ? Number(l.qty2 ?? 0) : Number(l.qty_ordered)
const amountOf = (l: LineCore) =>
  poLineAmount({
    qty_ordered: l.qty_ordered,
    unit_price: l.unit_price,
    price_basis: l.price_basis,
    qty2: l.qty2,
  })
const label = (l: { code: string | null; name: string }) =>
  l.code ? `${l.code} ${l.name}` : l.name
const fmtQ = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

export function planAdjustment(input: {
  currency: string | null
  priceIncludesVat: boolean
  before: { lines: AdjBeforeLine[]; header: AdjHeader }
  after: { lines: AdjAfterLine[]; header: AdjHeader }
}): AdjPlan {
  const { currency } = input
  const r = (n: number) => roundMoney(n, currency)
  const errors: string[] = []
  const changes: AdjChange[] = []
  const updates: AdjPlan['updates'] = []
  const inserts: AdjPlan['inserts'] = []
  const beforeById = new Map(input.before.lines.map((l) => [l.id, l]))
  const kept = new Set<string>()
  let rawByPrice = 0

  if (input.after.lines.length === 0) {
    errors.push('Đơn phải còn ít nhất một dòng — muốn bỏ cả đơn thì dùng "Huỷ đơn"')
  }

  // Dòng MỚI cùng vật tư với dòng đã có KHÔNG chặn (30/09/2026 — thông lệ ERP:
  // dòng định danh bằng số dòng; nhôm cùng cây khác chiều dài cắt là hàng khác).
  // Trùng thật (cùng mã + quy cách + chiều dài) chỉ cảnh báo trên lưới — xem
  // lib/po-line-dup + trung-dong.tsx.

  input.after.lines.forEach((a, i) => {
    const no = i + 1
    if (a.id) {
      const b = beforeById.get(a.id)
      if (!b) {
        errors.push(`Dòng ${no}: không thuộc đơn này — tải lại đơn rồi sửa tiếp`)
        return
      }
      if (kept.has(a.id)) {
        errors.push(`Dòng ${no}: trùng dòng với một dòng khác trên lưới`)
        return
      }
      kept.add(a.id)
      updates.push({ ...a, id: a.id, sort_order: i })
      if (!same(a.material_id, b.material_id)) {
        errors.push(
          `Dòng ${no} (${label(b)}): không đổi vật tư của dòng đang chạy — bỏ dòng và thêm dòng mới`,
        )
      }
      if (a.qty_ordered < b.received - 1e-9) {
        errors.push(
          `Dòng ${no} (${label(b)}): đã nhận ${fmtQ(b.received)} — không đặt thấp hơn. NCC không giao nữa thì dùng "Chốt thiếu"`,
        )
      }
      if (a.qty_ordered < b.planned - 1e-9) {
        errors.push(
          `Dòng ${no} (${label(b)}): các đợt giao đã hẹn ${fmtQ(b.planned)} — sửa đợt giao ở tab Giao & nhận hàng trước`,
        )
      }
      const fields = ADJ_COMPARE_FIELDS.filter((f) => !same(a[f], b[f])) as string[]
      if (!sameSplit(a.lsx_split, b.lsx_split)) fields.push('lsx_split')
      const qtyChanged = !same(a.qty_ordered, b.qty_ordered)
      const priceChanged = !same(a.unit_price, b.unit_price)
      const basisChanged = a.price_basis !== b.price_basis || !same(a.qty2, b.qty2)
      if (!qtyChanged && !priceChanged && !basisChanged && fields.length === 0) return
      const amtB = amountOf(b)
      const amtA = amountOf(a)
      const pB = Number(b.unit_price ?? 0)
      const pA = Number(a.unit_price ?? 0)
      // Đổi cơ sở tính giá (theo thùng ↔ theo m²) thì không tách được giá/lượng
      // một cách có nghĩa — cả phần chênh tính vào "vì giá".
      const byPrice =
        a.price_basis === b.price_basis ? billQty(a) * (pA - pB) : amtA - amtB
      rawByPrice += byPrice
      changes.push({
        kind: 'changed',
        line_id: a.id,
        no,
        code: b.code,
        name: b.name,
        unit: b.unit,
        qty_before: b.qty_ordered,
        qty_after: a.qty_ordered,
        price_before: b.unit_price,
        price_after: a.unit_price,
        amount_before: r(amtB),
        amount_after: r(amtA),
        by_price: r(byPrice),
        by_qty: r(amtA - amtB - byPrice),
        fields,
      })
      return
    }
    // Dòng thêm.
    inserts.push({ ...a, sort_order: i })
    const amt = amountOf(a)
    changes.push({
      kind: 'added',
      line_id: null,
      no,
      code: a.code,
      name: a.name,
      unit: a.unit,
      qty_before: null,
      qty_after: a.qty_ordered,
      price_before: null,
      price_after: a.unit_price,
      amount_before: 0,
      amount_after: r(amt),
      by_price: 0,
      by_qty: r(amt),
      fields: [],
    })
  })

  // Dòng bỏ.
  const deleteIds: string[] = []
  input.before.lines.forEach((b, i) => {
    if (kept.has(b.id)) return
    deleteIds.push(b.id)
    if (b.received > 1e-9) {
      errors.push(
        `${label(b)}: không bỏ được — đã nhận ${fmtQ(b.received)}. NCC không giao nữa thì dùng "Chốt thiếu"`,
      )
    } else if (b.invoiced) {
      errors.push(`${label(b)}: không bỏ được — dòng đã nằm trên hoá đơn NCC`)
    } else if (b.planned > 1e-9) {
      errors.push(
        `${label(b)}: không bỏ được — đang nằm trong đợt giao, gỡ khỏi đợt trước`,
      )
    }
    const amt = amountOf(b)
    changes.push({
      kind: 'removed',
      line_id: b.id,
      no: i + 1,
      code: b.code,
      name: b.name,
      unit: b.unit,
      qty_before: b.qty_ordered,
      qty_after: null,
      price_before: b.unit_price,
      price_after: null,
      amount_before: r(amt),
      amount_after: 0,
      by_price: 0,
      by_qty: r(-amt),
      fields: [],
    })
  })

  const hB = input.before.header
  const hA = input.after.header
  const headerChanges: NonNullable<AdjPlan['headerChanges']> = {}
  if (!same(hA.vatRate, hB.vatRate)) headerChanges.vat_rate = [hB.vatRate, hA.vatRate]
  if (!same(hA.discount ?? 0, hB.discount ?? 0)) {
    headerChanges.discount_amount = [Number(hB.discount ?? 0), Number(hA.discount ?? 0)]
  }
  const hasHeader = Object.keys(headerChanges).length > 0
  if (changes.length === 0 && !hasHeader)
    errors.push('Chưa có thay đổi nào so với đơn đang chạy')

  const sum = (ls: LineCore[]) => ls.reduce((s, l) => s + amountOf(l), 0)
  const money = {
    before: poMoney({
      subtotalRaw: sum(input.before.lines),
      discount: hB.discount,
      vatRate: hB.vatRate,
      priceIncludesVat: input.priceIncludesVat,
      currency,
    }),
    after: poMoney({
      subtotalRaw: sum(input.after.lines),
      discount: hA.discount,
      vatRate: hA.vatRate,
      priceIncludesVat: input.priceIncludesVat,
      currency,
    }),
  }
  const subtotal = r(money.after.subtotal - money.before.subtotal)
  // "Vì lượng" lấy phần còn lại để hai phần cộng ĐÚNG bằng chênh tiền hàng đã
  // làm tròn — làm tròn từng phần riêng thì có lúc lệch nhau 1 đồng.
  const byPrice = r(rawByPrice)
  return {
    errors,
    changes,
    headerChanges: hasHeader ? headerChanges : null,
    updates,
    inserts,
    deleteIds,
    money,
    delta: {
      subtotal,
      vat: r(money.after.vatAmount - money.before.vatAmount),
      total: r(money.after.grandTotal - money.before.grandTotal),
      byPrice,
      byQty: r(subtotal - byPrice),
    },
  }
}

/**
 * Đơn ở bước nào thì điều chỉnh được. Nháp / chờ duyệt: sửa thẳng (hoặc rút
 * về nháp) — chưa ai cầm bản đó. Huỷ: khoá. Lý do khoá NÓI ĐƯỜNG ĐI TIẾP.
 *
 * VỀ ĐỦ (28/10/2026, 0280): điều chỉnh được nhưng CHỈ GIÁ (`chiGia`) — NCC đối
 * chiếu công nợ báo giá khác sau khi hàng đã nhập kho. Chốt 25/09 từng khoá hẳn
 * và chỉ sang "đối chiếu hoá đơn", nhưng hệ thống chưa có tờ hoá đơn NCC nào nên
 * Cung ứng bị kẹt (PO-2026-0109). Luật chỉ giá ở `loiChiGia`.
 */
export function canAdjust(
  status: string,
): { ok: true; chiGia: boolean } | { ok: false; reason: string } {
  switch (status) {
    case 'approved':
    case 'ordered':
    case 'confirmed':
    case 'in_transit':
    case 'partial':
      return { ok: true, chiGia: false }
    case 'received':
      return { ok: true, chiGia: true }
    case 'draft':
      return {
        ok: false,
        reason: 'Đơn còn nháp — bấm "Sửa" để sửa thẳng, không cần điều chỉnh',
      }
    case 'pending_approval':
      return { ok: false, reason: 'Đơn đang chờ duyệt — bấm "Rút về nháp để sửa"' }
    case 'cancelled':
      return {
        ok: false,
        reason: 'Đơn đã huỷ — muốn mua tiếp thì Nhân bản thành đơn mới',
      }
    default:
      return { ok: false, reason: `Đơn ở bước "${status}" không điều chỉnh được` }
  }
}

/**
 * CHỈ GIÁ ĐƯỢC GHI cho đơn đã VỀ ĐỦ (0280) — gạt khỏi bản điều chỉnh các dòng
 * chỉ lệch Ô PHỤ (ghi chú, quy cách, cột ẩn của mẫu đơn…). Hàm DB 0280 chỉ ghi
 * đơn giá + VAT / chiết khấu, nên những lệch đó không bao giờ vào đơn; để lại
 * thì sổ phát sinh ghi "đổi carton_basis" trên mọi dòng của đơn mẫu kính — đo
 * thật 28/10 trên PO-2026-0065: cả 10 dòng lệch `carton_basis` dù không ai sửa.
 */
export function locChiGia(plan: AdjPlan): AdjPlan {
  const changes = plan.changes
    .filter(
      (c) =>
        c.kind !== 'changed' ||
        !same(c.qty_before, c.qty_after) ||
        !same(c.price_before, c.price_after) ||
        Math.abs(c.amount_after - c.amount_before) > 0.005,
    )
    .map((c) => ({ ...c, fields: [] }))
  return { ...plan, changes }
}

/**
 * LUẬT "CHỈ GIÁ" cho đơn đã VỀ ĐỦ (0280, chốt Q1/Q4 bản vẽ 28/10/2026) — chạy
 * trên bản đã qua `locChiGia`.
 *
 * Được: đơn giá từng dòng, thuế suất, chiết khấu. Không được: SL (hàng đã nhập
 * kho theo SL đó — lệch số lượng là việc của Kho), thêm / bỏ dòng, đổi cơ sở
 * tính giá. Dòng đã lên hoá đơn NCC: không đổi giá ở đây — sổ công nợ theo hoá
 * đơn và theo hàng nhận sẽ lệch nhau.
 *
 * Mỗi lỗi nói dòng nào và cách gỡ, như `planAdjustment`.
 */
export function loiChiGia(
  plan: AdjPlan,
  before: readonly Pick<AdjBeforeLine, 'id' | 'price_basis' | 'qty2' | 'invoiced'>[],
): string[] {
  const byId = new Map(before.map((l) => [l.id, l]))
  const errors: string[] = []
  const ten = (c: AdjChange) => `Dòng ${c.no} (${c.code ?? c.name})`
  for (const c of plan.changes) {
    if (c.kind === 'added') {
      errors.push(`${ten(c)}: đơn đã về đủ — không thêm dòng; mua thêm thì tạo đơn mới`)
      continue
    }
    if (c.kind === 'removed') {
      errors.push(
        `${ten(c)}: đơn đã về đủ — không bỏ dòng; hàng đã nhập kho theo dòng này`,
      )
      continue
    }
    if (!same(c.qty_before, c.qty_after) || Math.abs(c.by_qty) > 0.005)
      errors.push(`${ten(c)}: đơn đã về đủ — SL giữ theo phiếu nhập; lệch số lượng xử lý ở Kho (phiếu điều chỉnh / trả hàng)`) // prettier-ignore
    const after = plan.updates.find((u) => u.id === c.line_id)
    const b = c.line_id ? byId.get(c.line_id) : undefined
    if (after && b && (after.price_basis !== b.price_basis || !same(after.qty2, b.qty2)))
      errors.push(
        `${ten(c)}: đơn đã về đủ — không đổi cách tính giá (theo ĐVT / theo kg, m²…)`,
      )
    if (b?.invoiced && !same(c.price_before, c.price_after))
      errors.push(`${ten(c)}: đã lên hoá đơn NCC — sửa giá ở hoá đơn trong Tài chính, hoặc nhờ Kế toán huỷ hoá đơn rồi điều chỉnh ở đây`) // prettier-ignore
  }
  const doiGia = plan.changes.some(
    (c) => c.kind === 'changed' && !same(c.price_before, c.price_after),
  )
  if (!doiGia && !plan.headerChanges && errors.length === 0)
    errors.push('Chưa đổi giá dòng nào — gõ giá mới vào ô Đơn giá của dòng NCC tính lại')
  return errors
}

/**
 * Giá phiếu nhập của một dòng đơn — tiền dòng ÷ SL đặt, làm tròn 2 số lẻ. ĐÚNG
 * công thức `poLineUnitCosts` (lúc ghi phiếu) và hàm DB 0280 (lúc định giá lại).
 */
export function giaPhieuNhap(l: {
  qty_ordered: number
  unit_price: number | null
  price_basis: PriceBasis | null
  qty2: number | null
}): number | null {
  if (!(l.qty_ordered > 0) || l.unit_price == null) return null
  const amount = poLineAmount({ qty_ordered: l.qty_ordered, unit_price: l.unit_price, price_basis: l.price_basis, qty2: l.qty2 }) // prettier-ignore
  if (!(amount > 0)) return null
  return Math.round((amount / l.qty_ordered) * 100) / 100
}

/**
 * Bản điều chỉnh tính trên MÀN theo bước của đơn: đơn đã về đủ thì chỉ giá được
 * ghi (`locChiGia`) và vướng gì thì nói tại chỗ (`loiChiGia`) — cùng luật server
 * 0280. Chưa đổi gì thì không bày lỗi (Lưu khi đó chỉ ghi điều khoản).
 */
export function theoBuocDon(
  status: string,
  before: readonly Pick<AdjBeforeLine, 'id' | 'price_basis' | 'qty2' | 'invoiced'>[],
  plan: AdjPlan,
): AdjPlan {
  if (status !== 'received') return plan
  const loc = locChiGia(plan)
  if (loc.changes.length === 0 && !loc.headerChanges) return loc
  return { ...loc, errors: [...loc.errors, ...loiChiGia(loc, before)] }
}

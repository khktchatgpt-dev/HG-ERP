import { assessPoLate } from '@/lib/late-risk'
import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import {
  productionRepo,
  listOrderLineProducts,
} from '@/modules/dept/production/production.repo'
import { posService } from './pos.service'
import { posRepo } from './pos.repo'

/**
 * VẬT TƯ THEO LỆNH — một dòng cho mỗi lệnh sản xuất đang chạy, kèm mọi đơn mua
 * phục vụ lệnh đó.
 *
 * Tách khỏi `(workspace)/planning/lsx/page.tsx` (31/08/2026) để MÀN HÌNH và FILE
 * XUẤT dùng chung đúng một phép tính. Trước đó phần gom này nằm thẳng trong
 * page; thêm một đường xuất Excel là lập tức có hai chỗ đếm "đơn nào còn mở",
 * và hai chỗ đó sẽ lệch nhau ở lần sửa thứ nhất.
 */
export type LsxSupplyRow = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  materials_due_at: string | null
  materials_received_at: string | null
  priority: number
  /** Sản phẩm phải làm của cả lệnh (đã cộng dồn qua các đơn). */
  products: { code: string; name: string; qty: number }[]
  pos: {
    id: string
    code: string
    supplier_name: string
    status: string
    expected_at: string | null
    currency: string
    /** Mốc gửi đơn cho NCC — cột 'Ngày đặt' của báo cáo họp. */
    ordered_at: string | null
    note: string | null
    /** Người phụ trách đơn (0128) — cột 'Người theo dõi'. */
    assignee_name: string | null
    /** Đơn MUA CHUNG của lệnh khác, có mua hộ lệnh này (0125). */
    shared: boolean
    late: boolean
  }[]
  posTotal: number
  posUnsent: number
  posOpen: number
  posLate: number
}

/**
 * SỐ LIỆU CHI TIẾT của một đơn mua — chỉ dùng cho BÁO CÁO HỌP, không cho màn
 * hình. Tách riêng vì mỗi trường ở đây là một truy vấn gộp thêm; màn `/planning/
 * lsx` không cần và không nên trả giá cho chúng.
 *
 * Khuôn theo sheet "Thao_THĐH" của phòng Cung ứng (file TIEN DO LSX_IBIZA) —
 * đó là bảng người ta thật sự đọc trong họp, nên lấy đúng bộ cột đó thay vì
 * nghĩ ra bộ mới.
 */
export type PoReportDetail = {
  /** Nhóm vật tư xuất hiện nhiều nhất trên đơn — cột "Nhóm VT chính". */
  material_group: string | null
  /** Ngày nhận CUỐI CÙNG ghi nhận được; null = chưa nhận đợt nào. */
  received_at: string | null
  qty_ordered: number
  qty_received: number
  /** Số MÃ (dòng) còn thiếu — đếm dòng, KHÔNG cộng số lượng chéo đơn vị. */
  lines_missing: number
  amount: number
  paid: number
}

export type PoReportDetails = Record<string, PoReportDetail>

/**
 * Bổ sung số liệu chi tiết cho một tập đơn — 4 truy vấn gộp, không N+1.
 *
 * Tiền ĐÃ TRẢ lấy từ `accounting_supplier_payments` (có sẵn cột `po_id`), tức
 * là Cung ứng và Kế toán đọc CÙNG một con số. Trước đó bảng tổng hợp phải gõ
 * tay cột "đã trả" và nó lệch với sổ kế toán ngay tuần đầu.
 */
export async function loadPoReportDetails(poIds: string[]): Promise<PoReportDetails> {
  if (poIds.length === 0) return {}

  const [lineStatus, lines, payments, totals] = await Promise.all([
    db()
      .from('supply_po_line_status')
      .select('po_id, qty_ordered, qty_received, qty_missing, last_received_at')
      .in('po_id', poIds),
    db()
      .from('supply_purchase_order_lines')
      .select('po_id, material_id')
      .in('po_id', poIds),
    db().from('accounting_supplier_payments').select('po_id, amount').in('po_id', poIds),
    posRepo.totalsByPoIds(poIds),
  ])

  // Nhóm vật tư: tra tên nhóm cho các mã VT có mặt trên những đơn này.
  const materialIds = [
    ...new Set(
      ((lines.data ?? []) as { material_id: string | null }[])
        .map((l) => l.material_id)
        .filter((v): v is string => !!v),
    ),
  ]
  const groupById = new Map<string, string>()
  if (materialIds.length > 0) {
    const { data } = await db()
      .from('warehouse_materials')
      .select('id, group_name')
      .in('id', materialIds)
    for (const m of (data ?? []) as { id: string; group_name: string | null }[]) {
      if (m.group_name) groupById.set(m.id, m.group_name)
    }
  }

  const out: PoReportDetails = {}
  const blank = (): PoReportDetail => ({
    material_group: null,
    received_at: null,
    qty_ordered: 0,
    qty_received: 0,
    lines_missing: 0,
    amount: 0,
    paid: 0,
  })
  for (const id of poIds) out[id] = blank()

  for (const r of (lineStatus.data ?? []) as {
    po_id: string
    qty_ordered: number | null
    qty_received: number | null
    qty_missing: number | null
    last_received_at: string | null
  }[]) {
    const d = out[r.po_id]
    if (!d) continue
    d.qty_ordered += r.qty_ordered ?? 0
    d.qty_received += r.qty_received ?? 0
    if ((r.qty_missing ?? 0) > 0) d.lines_missing += 1
    // Mốc nhận GẦN NHẤT trong các dòng — "ngày về thực tế" của cả đơn.
    if (r.last_received_at && (!d.received_at || r.last_received_at > d.received_at)) {
      d.received_at = r.last_received_at
    }
  }

  // Nhóm VT chính = nhóm có nhiều dòng nhất trên đơn.
  const groupCount = new Map<string, Map<string, number>>()
  for (const l of (lines.data ?? []) as { po_id: string; material_id: string | null }[]) {
    const g = l.material_id ? groupById.get(l.material_id) : undefined
    if (!g) continue
    const m = groupCount.get(l.po_id) ?? new Map<string, number>()
    m.set(g, (m.get(g) ?? 0) + 1)
    groupCount.set(l.po_id, m)
  }
  for (const [poId, m] of groupCount) {
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]
    if (out[poId] && top) out[poId].material_group = top[0]
  }

  for (const p of (payments.data ?? []) as { po_id: string | null; amount: number }[]) {
    if (p.po_id && out[p.po_id]) out[p.po_id].paid += p.amount ?? 0
  }
  for (const [poId, amount] of Object.entries(totals)) {
    if (out[poId]) out[poId].amount = amount
  }

  return out
}

/** Một lệnh + mọi đơn mua phục vụ nó, như người mua cần đọc. */
export type LsxSupplyDetail = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  status: string
  priority: number
  ship_date: string | null
  materials_due_at: string | null
  materials_received_at: string | null
  products: { code: string; name: string; qty: number }[]
  pos: {
    id: string
    code: string
    supplier_name: string
    status: string
    ordered_at: string | null
    expected_at: string | null
    currency: string
    note: string | null
    assignee_name: string | null
    /** Đơn của lệnh KHÁC có mua hộ lệnh này (0125). */
    shared: boolean
    shared_with: string[]
    late: boolean
    amount: number
    paid: number
    qty_ordered: number
    qty_received: number
    lines_missing: number
    received_at: string | null
    material_group: string | null
  }[]
}

/**
 * CHI TIẾT MỘT LỆNH cho Cung ứng — trang "lệnh này có những đơn nào" (03/09/
 * 2026, user: "1 LSX có nhiều đơn hàng đi theo… biết đơn nào tình trạng ra sao
 * và ai là người đảm nhận").
 *
 * Đơn lấy qua `posRepo.list({ production_order_id })` vì hàm đó ĐÃ gộp sẵn đơn
 * mua chung (0125): đơn ghi "LSX 2+3" có lệnh chính là 2, nhưng người đang xem
 * lệnh 3 vẫn phải thấy nó — bỏ sót là tưởng lệnh 3 chưa ai mua rồi đặt trùng.
 *
 * Số tiền/đã nhận dùng lại `loadPoReportDetails` của báo cáo họp: màn hình và
 * file Excel đọc CÙNG một phép tính, không đẻ ra hai định nghĩa "đã về".
 */
export async function buildLsxSupplyDetail(
  user: User,
  lsxId: string,
  today: string,
): Promise<LsxSupplyDetail | null> {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) return null

  const [{ rows: pos }, productLines] = await Promise.all([
    posService.list(user, { production_order_id: lsxId, page: 1, page_size: 200 }),
    listOrderLineProducts(lsx.order_ids),
  ])

  const [details, extraLsx] = await Promise.all([
    loadPoReportDetails(pos.map((p) => p.id)),
    posRepo.extraLsxByPoIds(pos.map((p) => p.id)),
  ])

  const products: LsxSupplyDetail['products'] = []
  for (const pl of productLines) {
    const hit = products.find((x) => x.code === pl.code)
    if (hit) hit.qty += pl.qty
    else products.push({ code: pl.code, name: pl.name, qty: pl.qty })
  }

  return {
    id: lsx.id,
    code: lsx.code,
    customer_name: lsx.customer_name,
    order_codes: lsx.order_codes,
    status: lsx.status,
    priority: lsx.priority,
    ship_date: lsx.ship_date,
    materials_due_at: lsx.materials_due_at,
    materials_received_at: lsx.materials_received_at,
    products,
    pos: pos.map((p) => {
      const d = details[p.id]
      const extras = extraLsx.get(p.id) ?? []
      return {
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        status: p.status,
        ordered_at: p.ordered_at,
        expected_at: p.expected_at,
        currency: p.currency,
        note: p.note,
        assignee_name: p.assignee_name,
        // "Mua hộ" nhìn TỪ LỆNH ĐANG XEM: đơn thuộc lệnh khác mà có phục vụ
        // lệnh này. Cờ này quyết định người mua có được sửa đơn ở đây không.
        shared: p.production_order_id !== lsxId,
        shared_with: extras.filter((e) => e.id !== lsxId).map((e) => e.code),
        late: assessPoLate(p, today) === 'overdue',
        amount: d?.amount ?? 0,
        paid: d?.paid ?? 0,
        qty_ordered: d?.qty_ordered ?? 0,
        qty_received: d?.qty_received ?? 0,
        lines_missing: d?.lines_missing ?? 0,
        received_at: d?.received_at ?? null,
        material_group: d?.material_group ?? null,
      }
    }),
  }
}

/**
 * BỐN TRUY VẤN cho cả tập, không N+1:
 *   1. LSX đang chạy (kèm khách, hạn vật tư, ngày giao).
 *   2. Dòng SP của mọi đơn thuộc các lệnh đó — một lượt, gom theo lệnh.
 *   3. Đơn mua (một lượt) → tự đếm và gom theo lệnh.
 *   4. LSX phụ của đơn (0125) — đơn mua chung tính cho CẢ các lệnh nó phục vụ.
 */
export async function buildLsxSupplyRows(
  user: User,
  today: string,
): Promise<LsxSupplyRow[]> {
  const [lsxs, { rows: pos }] = await Promise.all([
    productionRepo.listActive(),
    posService.list(user, { page: 1, page_size: 1000 }),
  ])

  const [productLines, extraLsx] = await Promise.all([
    listOrderLineProducts(lsxs.flatMap((l) => l.order_ids)),
    posRepo.extraLsxByPoIds(pos.map((p) => p.id)),
  ])

  // Sản phẩm về theo LỆNH: một lệnh gộp nhiều đơn (0113) nên cộng dồn cùng mã.
  const lsxIdByOrderId = new Map<string, string>()
  for (const l of lsxs) for (const oid of l.order_ids) lsxIdByOrderId.set(oid, l.id)
  const productsByLsx = new Map<string, { code: string; name: string; qty: number }[]>()
  for (const pl of productLines) {
    const lsxId = lsxIdByOrderId.get(pl.order_id)
    if (!lsxId) continue
    const list = productsByLsx.get(lsxId) ?? []
    const hit = list.find((x) => x.code === pl.code)
    if (hit) hit.qty += pl.qty
    else list.push({ code: pl.code, name: pl.name, qty: pl.qty })
    productsByLsx.set(lsxId, list)
  }

  /*
   * Đơn mua gom theo LỆNH. Không lấy `pos_*` của v_order_tracking: view trả mỗi
   * ĐƠN HÀNG một dòng nên lệnh gộp nhiều đơn bị cộng trùng, và view chỉ nhìn
   * cột `production_order_id` nên bỏ sót đơn mua chung nhiều lệnh (0125).
   */
  type PoBrief = LsxSupplyRow['pos'][number]
  const posByLsx = new Map<string, PoBrief[]>()
  const attach = (lsxId: string, p: (typeof pos)[number], shared: boolean) => {
    const list = posByLsx.get(lsxId) ?? []
    list.push({
      id: p.id,
      code: p.code,
      supplier_name: p.supplier_name,
      status: p.status,
      expected_at: p.expected_at,
      currency: p.currency,
      ordered_at: p.ordered_at,
      note: p.note,
      assignee_name: p.assignee_name,
      shared,
      late: assessPoLate(p, today) === 'overdue',
    })
    posByLsx.set(lsxId, list)
  }
  for (const p of pos) {
    if (p.production_order_id) attach(p.production_order_id, p, false)
    for (const ex of extraLsx.get(p.id) ?? []) {
      if (ex.id !== p.production_order_id) attach(ex.id, p, true)
    }
  }

  return lsxs.map((l) => {
    const list = posByLsx.get(l.id) ?? []
    const live = list.filter((p) => p.status !== 'cancelled')
    return {
      id: l.id,
      code: l.code,
      customer_name: l.customer_name,
      order_codes: l.order_codes,
      ship_date: l.ship_date,
      materials_due_at: l.materials_due_at,
      materials_received_at: l.materials_received_at,
      priority: l.priority,
      products: productsByLsx.get(l.id) ?? [],
      pos: list,
      posTotal: live.length,
      posUnsent: live.filter(
        (p) => p.status === 'draft' || p.status === 'pending_approval',
      ).length,
      posOpen: live.filter(
        (p) =>
          p.status !== 'draft' &&
          p.status !== 'pending_approval' &&
          p.status !== 'received',
      ).length,
      posLate: live.filter((p) => p.late).length,
    }
  })
}

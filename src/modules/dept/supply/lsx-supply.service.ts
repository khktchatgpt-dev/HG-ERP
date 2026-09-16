import { assessPoLate } from '@/lib/late-risk'
import { groupPosByLsx, summarizePos } from '@/lib/lsx-supply'
import { buildMeeting } from '@/lib/supply-meeting'
import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { withProductImage } from '@/modules/dept/production/lsx-lines.service'
import { posService } from './pos.service'
import { posRepo } from './pos.repo'
import { supplyRepo } from './supply.repo'
import { stockInfoMany } from '@/modules/dept/warehouse/stock.repo'
import { smartLsxNeeds, reservedByOtherLsx } from '@/modules/dept/warehouse/stock.service'
import { suggestForMaterial } from '@/lib/po-suggestion'

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
  /** Số DÒNG trên đơn — đơn 5 dòng và đơn 59 dòng là hai việc khác nhau. */
  line_count: number
  /** Dòng chưa điền đơn giá — đơn nháp kiểu này gửi duyệt là gửi đơn hụt tiền. */
  unpriced_lines: number
  /** Số ĐH của NCC ghi trên tờ giấy — cái người mua đọc khi gọi điện. */
  supplier_doc_no: string | null
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
      .select('po_id, material_id, unit_price')
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
    line_count: 0,
    unpriced_lines: 0,
    supplier_doc_no: null,
  })
  for (const id of poIds) out[id] = blank()

  // Đếm dòng + dòng chưa có giá, ngay trên tập `lines` đã lấy sẵn.
  for (const l of (lines.data ?? []) as { po_id: string; unit_price: unknown }[]) {
    const d = out[l.po_id]
    if (!d) continue
    d.line_count++
    if (!Number(l.unit_price)) d.unpriced_lines++
  }

  // Số ĐH của NCC không nằm trong COLS của pos.repo (cột đọc dùng chung, không
  // đụng vào), nên lấy riêng ở đây cho đúng phạm vi màn báo cáo.
  const { data: docNos } = await db()
    .from('supply_purchase_orders')
    .select('id, supplier_doc_no')
    .in('id', poIds)
  for (const r of (docNos ?? []) as { id: string; supplier_doc_no: string | null }[]) {
    const d = out[r.id]
    if (d) d.supplier_doc_no = r.supplier_doc_no
  }

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
export type LsxSupplyCoverage = {
  /** Số MÃ vật tư lệnh còn cần (đã trừ phần đã xuất kho). */
  needed: number
  /** Số mã đã đủ: tồn khả dụng + đã đặt ≥ còn cần. */
  covered: number
  /** Số mã còn hụt — chính là số mã phải lên đơn tiếp. */
  missing: number
  missing_top: { code: string; name: string; unit: string; qty: number }[]
}

export type LsxSupplyDetail = {
  coverage: LsxSupplyCoverage
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  status: string
  priority: number
  ship_date: string | null
  materials_due_at: string | null
  materials_received_at: string | null
  /**
   * SẢN PHẨM PHẢI LÀM — mang theo id + ảnh (15/09/2026). Bản trước chỉ có
   * mã/tên/số lượng, nên màn chi tiết lệnh chỉ đếm được "17 SP" mà không bày
   * ra được cái gì; chủ dự án báo thiếu ảnh đúng chỗ này.
   */
  products: {
    product_id: string | null
    code: string
    name: string
    qty: number
    image_file_id: string | null
  }[]
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
    line_count: number
    unpriced_lines: number
    supplier_doc_no: string | null
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
/**
 * ĐỘ PHỦ NHU CẦU của lệnh — "đã mua đủ chưa", câu hỏi số một của người mua.
 *
 * Trang chi tiết lệnh trước đây chỉ đếm ĐƠN (12 đơn) — mà 12 đơn không nói được
 * lệnh còn thiếu vật tư nào. Muốn biết phải bấm sang màn soạn đơn rồi mở tab
 * Nhu cầu, tức là bước vào màn TẠO chỉ để TRA. Ở đây tính sẵn, cùng công thức
 * với màn soạn đơn (`suggestForMaterial`) để hai chỗ không nói hai con số.
 *
 * "Đủ" = còn cần ≤ khả dụng + đã đặt. Chưa đủ thì gợi ý mua chính là phần hụt.
 */
async function buildCoverage(lsxId: string): Promise<LsxSupplyCoverage> {
  const needs = await smartLsxNeeds(lsxId)
  const matIds = needs.map((n) => n.material_id)
  if (matIds.length === 0) return { needed: 0, covered: 0, missing: 0, missing_top: [] }

  const [stock, reserved, orderedPending] = await Promise.all([
    stockInfoMany(matIds),
    reservedByOtherLsx([lsxId], matIds),
    supplyRepo.orderedPendingByLsxSet([lsxId]),
  ])
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))

  const missing: LsxSupplyCoverage['missing_top'] = []
  let covered = 0
  for (const n of needs) {
    const op = orderedPending.get(n.material_id)
    const s = suggestForMaterial({
      material_id: n.material_id,
      needed: n.qty_remaining,
      on_hand: onHand.get(n.material_id) ?? 0,
      reserved_others: reserved.get(n.material_id) ?? 0,
      ordered: op?.ordered ?? 0,
      pending: op?.pending ?? 0,
    })
    if (s.suggest > 0)
      missing.push({
        code: n.material_code,
        name: n.material_name,
        unit: n.unit,
        qty: s.suggest,
      })
    else covered++
  }
  missing.sort((a, b) => b.qty - a.qty)
  return {
    needed: needs.length,
    covered,
    missing: missing.length,
    missing_top: missing.slice(0, 8),
  }
}

export async function buildLsxSupplyDetail(
  user: User,
  lsxId: string,
  today: string,
): Promise<LsxSupplyDetail | null> {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) return null

  const [{ rows: pos }, productLines, coverage] = await Promise.all([
    posService.list(user, { production_order_id: lsxId, page: 1, page_size: 200 }),
    /*
      SẢN PHẨM LẤY TỪ DÒNG LỆNH, KHÔNG TỪ DÒNG ĐƠN HÀNG (15/09/2026).

      Dòng lệnh là thứ Bán hàng soạn ra và là thứ Sale / Sản xuất / phiếu in
      đều đọc. Lấy từ đơn hàng thì hai màn nói khác nhau về CÙNG một lệnh: đo
      được 5 lệnh đang chạy chưa gắn đơn khách nào — Sale bày 6 sản phẩm, còn
      màn này bày 0 và đổ lỗi cho Bán hàng. `withProductImage` cũng chỉ có
      nghĩa trên dòng lệnh.
    */
    lsxLinesRepo.listLines(lsxId).then(withProductImage),
    buildCoverage(lsxId),
  ])

  const [details, extraLsx] = await Promise.all([
    loadPoReportDetails(pos.map((p) => p.id)),
    posRepo.extraLsxByPoIds(pos.map((p) => p.id)),
  ])

  const products: LsxSupplyDetail['products'] = []
  for (const pl of productLines) {
    // Một mã SP nằm nhiều dòng (tách đợt xuất) — cộng dồn, như màn cũ vẫn làm.
    const hit = products.find((x) => x.code === pl.product_code)
    if (hit) hit.qty += pl.qty
    else
      products.push({
        product_id: pl.product_id,
        code: pl.product_code,
        name: pl.name_vi ?? pl.product_code,
        qty: pl.qty,
        image_file_id: pl.image_file_id,
      })
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
    coverage,
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
        line_count: d?.line_count ?? 0,
        unpriced_lines: d?.unpriced_lines ?? 0,
        supplier_doc_no: d?.supplier_doc_no ?? null,
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
    // Cùng nguồn với màn chi tiết — DÒNG LỆNH, không phải dòng đơn hàng. Hai
    // nơi đếm "lệnh này làm mấy mã" mà đọc hai bảng là sớm muộn lệch nhau.
    lsxLinesRepo.listLinesBulk(lsxs.map((l) => l.id)),
    posRepo.extraLsxByPoIds(pos.map((p) => p.id)),
  ])

  // Sản phẩm về theo LỆNH: một lệnh gộp nhiều đơn (0113) nên cộng dồn cùng mã.
  const productsByLsx = new Map<string, { code: string; name: string; qty: number }[]>()
  for (const pl of productLines) {
    const list = productsByLsx.get(pl.production_order_id) ?? []
    const hit = list.find((x) => x.code === pl.product_code)
    if (hit) hit.qty += pl.qty
    else
      list.push({
        code: pl.product_code,
        name: pl.name_vi ?? pl.product_code,
        qty: pl.qty,
      })
    productsByLsx.set(pl.production_order_id, list)
  }

  /*
   * Đơn mua gom theo LỆNH. Không lấy `pos_*` của v_order_tracking: view trả mỗi
   * ĐƠN HÀNG một dòng nên lệnh gộp nhiều đơn bị cộng trùng, và view chỉ nhìn
   * cột `production_order_id` nên bỏ sót đơn mua chung nhiều lệnh (0125).
   */
  // Gom đơn theo LỆNH bằng helper thuần (dùng chung với badge sidebar) rồi
  // rút về bộ cột màn hình cần.
  const grouped = groupPosByLsx(pos, extraLsx, today)
  const posByLsx = new Map<string, LsxSupplyRow['pos'][number][]>()
  for (const [lsxId, list] of grouped) {
    posByLsx.set(
      lsxId,
      list.map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        status: p.status,
        expected_at: p.expected_at,
        currency: p.currency,
        ordered_at: p.ordered_at,
        note: p.note,
        assignee_name: p.assignee_name,
        shared: p.shared,
        late: p.late,
      })),
    )
  }

  return lsxs.map((l) => {
    const list = posByLsx.get(l.id) ?? []
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
      ...summarizePos(list),
    }
  })
}

/**
 * SỐ LỆNH CẦN NÊU TRONG HỌP — cho badge sidebar "Vấn đề cần xử lý" (13/09/2026).
 *
 * Cùng phép tính với ba trang họp (`buildMeeting`.issues: mọi mức trừ Đang về
 * và Đủ) nhưng đi đường NHẸ: không join NCC/người phụ trách, không nạp dòng
 * sản phẩm — badge chạy trên mọi lần mở trang của khu Cung ứng. Không nhận
 * `user` vì sidebar chỉ hiện trong khu này và số đếm không tuỳ người xem.
 */
export async function countMeetingIssues(today: string): Promise<number> {
  // Ba truy vấn SONG SONG (không đợi id đơn rồi mới hỏi lệnh phụ) — badge
  // trả về trong một vòng mạng thay vì hai.
  const [lsxs, pos, extraLsx] = await Promise.all([
    productionRepo.listActive(),
    posRepo.listMeetingFields(),
    posRepo.listAllExtraLsx(),
  ])
  const grouped = groupPosByLsx(pos, extraLsx, today)
  const inputs = lsxs.map((l) => {
    const list = grouped.get(l.id) ?? []
    return {
      code: l.code,
      materials_received_at: l.materials_received_at,
      materials_due_at: l.materials_due_at,
      ship_date: l.ship_date,
      pos: list.map((p) => ({ status: p.status, expected_at: p.expected_at })),
      ...summarizePos(list),
    }
  })
  return buildMeeting(inputs, today).issues.length
}

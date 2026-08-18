import { db } from '@/server/db'

/**
 * Repo phần giao Kho ↔ Cung ứng: đọc PO đang mở để nhập theo đơn (FR-WMS-02)
 * + cập nhật trạng thái partial/received từ sổ kho (BR-08).
 * CRUD PO/NCC nằm ở pos.repo.ts / suppliers (supply.repo cùng module).
 */

export type OpenPo = {
  id: string
  code: string
  status: string
  supplier_name: string
  /** null = PO ngoài LSX (0076). */
  lsx_code: string | null
  /** Hẹn giao (đồng bộ theo đợt sớm nhất 0152) — trang Đơn NCC của Kho cần. */
  expected_at: string | null
}

export type PoLineStatus = {
  id: string
  po_id: string
  /** null = DÒNG TỰ DO (0134) — nghiệm thu ngoài sổ kho, không có movement. */
  material_id: string | null
  qty_ordered: number
  qty_received: number
  /** QC loại cộng dồn (BR-08 — đã tính trong qty_received). */
  qty_rejected: number
  /** Thiếu THẬT so với đặt (đối chiếu/in ấn) — GIỮ NGUYÊN nghĩa dù đã chốt thiếu. */
  qty_missing: number
  /**
   * Phần còn CHỜ VỀ (0154): = max(qty_missing, 0), riêng dòng ĐÃ CHỐT THIẾU = 0.
   * Mọi chỗ hỏi "còn chờ bao nhiêu" (trạng thái đơn, đề xuất mua, prefill PNK)
   * đọc cột này, KHÔNG đọc qty_missing.
   */
  qty_open: number
  /** Mốc Cung ứng chốt "phần thiếu không giao nữa" — null = dòng còn mở. */
  closed_short_at: string | null
  material_code: string
  material_name: string
  material_unit: string
  /** Dung sai nhận vượt % của vật tư (0156) — nuôi guard OVER_RECEIPT. */
  over_tolerance_pct: number
}

/** PO nhận hàng được: đã đặt trở đi, chưa về đủ / chưa huỷ. */
export const RECEIVABLE = [
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
] as const

export const supplyRepo = {
  async listOpenPos(): Promise<OpenPo[]> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select(
        // FK đích danh — 0125 thêm bảng nối supply_po_extra_lsx nên embed
        // production_orders không hint là mơ hồ, PostgREST trả rỗng.
        'id, code, status, expected_at, supplier:supply_suppliers(name), lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code)',
      )
      .in('status', [...RECEIVABLE])
      .order('created_at', { ascending: false })
      .limit(200)
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const sp = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
      const lx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
      return {
        id: r.id as string,
        code: r.code as string,
        status: r.status as string,
        supplier_name: (sp as { name?: string } | null)?.name ?? '?',
        lsx_code: (lx as { code?: string } | null)?.code ?? null,
        expected_at: (r.expected_at as string | null) ?? null,
      }
    })
  },

  /**
   * Tiến độ VỀ KHO theo DÒNG cho cả trang đơn — 1 truy vấn gộp, không N+1.
   * Đếm dòng (xong = còn thiếu ≤ 0) chứ không cộng số lượng: 500 con + 3 kg là
   * con số vô nghĩa. Nuôi cột "Về kho x/y dòng" của màn theo dõi (0126).
   */
  async lineDoneByPoIds(
    ids: string[],
  ): Promise<Map<string, { done: number; total: number }>> {
    const out = new Map<string, { done: number; total: number }>()
    if (ids.length === 0) return out
    // qty_open (0154): dòng ĐÃ CHỐT THIẾU đếm là "xong" — không còn ai chờ nó về.
    const { data } = await db()
      .from('supply_po_line_status')
      .select('po_id, qty_open')
      .in('po_id', ids.slice(0, 400))
      .limit(10000)
    for (const r of (data ?? []) as { po_id: string; qty_open: unknown }[]) {
      const cur = out.get(r.po_id) ?? { done: 0, total: 0 }
      cur.total++
      if (Number(r.qty_open ?? 0) <= 0) cur.done++
      out.set(r.po_id, cur)
    }
    return out
  },

  /**
   * Mã LSX PHỤ (0125 — đơn mua chung) theo đơn: trang Đơn NCC của Kho nhóm
   * theo LSX phải thấy đơn mua hộ ở MỌI lệnh nó phục vụ, không riêng lệnh chính.
   */
  async extraLsxCodesByPoIds(poIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (poIds.length === 0) return out
    const { data } = await db()
      .from('supply_po_extra_lsx')
      .select('po_id, lsx:production_orders(code)')
      .in('po_id', poIds)
    for (const r of (data ?? []) as {
      po_id: string
      lsx: { code: string } | { code: string }[] | null
    }[]) {
      const lx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
      if (!lx?.code) continue
      out.set(r.po_id, [...(out.get(r.po_id) ?? []), lx.code])
    }
    return out
  },

  /** PO chứa các dòng này (K1 phiếu đảo: từ movements lần về đơn để refresh). */
  async poIdsByLineIds(lineIds: string[]): Promise<string[]> {
    if (lineIds.length === 0) return []
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select('po_id')
      .in('id', lineIds)
    return [...new Set(((data ?? []) as { po_id: string }[]).map((r) => r.po_id))]
  },

  /** Dòng PO + đã nhận/còn thiếu — từ view supply_po_line_status (BR-08). */
  async lineStatus(poId: string): Promise<PoLineStatus[]> {
    const { data } = await db()
      .from('supply_po_line_status')
      .select(
        'id, po_id, material_id, qty_ordered, qty_received, qty_rejected, qty_missing, qty_open, closed_short_at',
      )
      .eq('po_id', poId)
      .order('sort_order')
    const lines = (data ?? []) as Omit<
      PoLineStatus,
      'material_code' | 'material_name' | 'material_unit'
    >[]
    if (lines.length === 0) return []

    // Dòng tự do (material_id null) không có gì để tra trong danh mục.
    const ids = [
      ...new Set(lines.map((l) => l.material_id).filter((x): x is string => x != null)),
    ]
    const { data: mats } = await db()
      .from('warehouse_materials')
      .select('id, code, name, unit, over_tolerance_pct')
      .in('id', ids)
    type M = {
      id: string
      code: string
      name: string
      unit: string
      over_tolerance_pct: number | null
    }
    const byId = new Map(((mats ?? []) as M[]).map((m) => [m.id, m]))
    return lines.map((l) => {
      const m = l.material_id ? byId.get(l.material_id) : undefined
      return {
        ...l,
        qty_ordered: Number(l.qty_ordered ?? 0),
        qty_received: Number(l.qty_received ?? 0),
        qty_rejected: Number(l.qty_rejected ?? 0),
        qty_missing: Number(l.qty_missing ?? 0),
        qty_open: Number(l.qty_open ?? 0),
        material_code: m?.code ?? '?',
        material_name: m?.name ?? '?',
        material_unit: m?.unit ?? '',
        over_tolerance_pct: Number(m?.over_tolerance_pct ?? 0),
      }
    })
  },

  /**
   * Tính lại trạng thái PO sau khi nhập kho / TRẢ HÀNG NCC (0080) / CHỐT THIẾU
   * (0154): mọi dòng qty_open ≤ 0 → received, ngược lại partial (view là nguồn
   * đối chiếu — §7). Dùng qty_open chứ không qty_missing: dòng Cung ứng đã chốt
   * "phần thiếu không giao nữa" coi như xong — không thì đơn kẹt 'partial'
   * vĩnh viễn chờ thứ không bao giờ về.
   * 'received' nằm trong danh sách cập nhật để phiếu trả kéo PO quay lại
   * partial (NCC giao bù); vẫn không đè cancelled/pending_approval.
   */
  async refreshStatusFromReceipts(poId: string): Promise<'partial' | 'received' | null> {
    const lines = await this.lineStatus(poId)
    /*
     * Sổ kho chỉ quyết theo DÒNG VẬT TƯ KHO. Dòng tự do (material_id null —
     * gỗ/gia công 0134) nghiệm thu ngoài sổ, không bao giờ có movement: tính cả
     * chúng thì đơn hỗn hợp không bao giờ đạt "về đủ" (kẹt 'partial' vĩnh viễn,
     * trong khi nút nghiệm thu tay lại bị chặn vì đơn "còn dòng vật tư kho").
     * Đơn TOÀN dòng tự do → null: trạng thái do người nghiệm thu quyết, không
     * phải sổ kho.
     */
    const stockLines = lines.filter((l) => l.material_id != null)
    if (stockLines.length === 0) return null
    const done = stockLines.every((l) => l.qty_open <= 0)
    const status = done ? 'received' : 'partial'
    const { error } = await db()
      .from('supply_purchase_orders')
      .update({ status })
      .eq('id', poId)
      .in('status', [...RECEIVABLE, 'received'])
    if (error) throw new Error(error.message)
    return status
  },

  /**
   * PHIẾU KHO của một đơn (timeline GĐ3 plan-po-giao-nhan): gom movements gắn
   * dòng đơn theo doc — mỗi phiếu một mốc "PNK-… nhận 98 / PXK-… trả 5".
   * direction out + po_line = phiếu TRẢ NCC (0080).
   */
  async docsByPo(poId: string): Promise<
    {
      doc_id: string
      code: string
      kind: 'receipt' | 'return'
      qty_total: number
      at: string
    }[]
  > {
    const { data: lineRows } = await db()
      .from('supply_purchase_order_lines')
      .select('id')
      .eq('po_id', poId)
    const lineIds = ((lineRows ?? []) as { id: string }[]).map((r) => r.id)
    if (lineIds.length === 0) return []
    const { data } = await db()
      .from('warehouse_movements')
      .select(
        'doc_id, direction, qty, qty_rejected, created_at, doc:warehouse_docs(code)',
      )
      .in('po_line_id', lineIds)
      .not('doc_id', 'is', null)
      .limit(2000)
    type R = {
      doc_id: string
      direction: 'in' | 'out'
      qty: unknown
      qty_rejected: unknown
      created_at: string
      doc: { code: string } | { code: string }[] | null
    }
    const byDoc = new Map<
      string,
      {
        doc_id: string
        code: string
        kind: 'receipt' | 'return'
        qty_total: number
        at: string
      }
    >()
    for (const r of (data ?? []) as unknown as R[]) {
      const d = Array.isArray(r.doc) ? r.doc[0] : r.doc
      const cur = byDoc.get(r.doc_id) ?? {
        doc_id: r.doc_id,
        code: d?.code ?? '?',
        kind: r.direction === 'in' ? ('receipt' as const) : ('return' as const),
        qty_total: 0,
        at: r.created_at,
      }
      // "Đã nhận" cùng công thức BR-08: đạt + QC loại (NCC đã giao số đó).
      cur.qty_total +=
        r.direction === 'in'
          ? Number(r.qty ?? 0) + Number(r.qty_rejected ?? 0)
          : Number(r.qty ?? 0)
      if (r.created_at < cur.at) cur.at = r.created_at
      byDoc.set(r.doc_id, cur)
    }
    return [...byDoc.values()].sort((a, b) => a.at.localeCompare(b.at))
  },

  /**
   * KPI GIAO HÀNG của một NCC (P5.2) — tự tính từ lịch sử, thay chấm tay.
   * Toàn bộ là ĐẾM đơn/dòng, KHÔNG cộng số lượng chéo đơn vị (500 con + 3 kg
   * là con số vô nghĩa — nguyên tắc sẵn của dự án):
   *   - đúng hẹn: đơn received có hẹn giao mà ngày NHẬN CUỐI ≤ hẹn.
   *   - QC loại / chốt thiếu: đếm DÒNG từng dính.
   *   - trả hàng: đếm ĐƠN có phiếu trả (movement out gắn dòng đơn).
   */
  async supplierDeliveryKpis(supplierId: string): Promise<{
    po_total: number
    po_received: number
    po_with_expected: number
    po_on_time: number
    po_returned: number
    lines_total: number
    lines_rejected: number
    lines_closed_short: number
  }> {
    const { data: pos } = await db()
      .from('supply_purchase_orders')
      .select('id, status, expected_at')
      .eq('supplier_id', supplierId)
      // Đơn ĐÃ THÀNH cam kết với NCC — nháp/chờ duyệt/huỷ không đo được NCC.
      .in('status', [...RECEIVABLE, 'received'])
      .limit(1000)
    type P = { id: string; status: string; expected_at: string | null }
    const poRows = (pos ?? []) as P[] satisfies P[]
    const out = {
      po_total: poRows.length,
      po_received: poRows.filter((p) => p.status === 'received').length,
      po_with_expected: 0,
      po_on_time: 0,
      po_returned: 0,
      lines_total: 0,
      lines_rejected: 0,
      lines_closed_short: 0,
    }
    if (poRows.length === 0) return out

    const { data: lines } = await db()
      .from('supply_po_line_status')
      .select('id, po_id, qty_rejected, closed_short_at, last_received_at')
      .in(
        'po_id',
        poRows.map((p) => p.id),
      )
      .limit(10000)
    type L = {
      id: string
      po_id: string
      qty_rejected: unknown
      closed_short_at: string | null
      last_received_at: string | null
    }
    const lineRows = (lines ?? []) as L[] satisfies L[]
    out.lines_total = lineRows.length
    out.lines_rejected = lineRows.filter((l) => Number(l.qty_rejected ?? 0) > 0).length
    out.lines_closed_short = lineRows.filter((l) => l.closed_short_at != null).length

    // Đúng hẹn: ngày nhận CUỐI của đơn (max last_received_at các dòng) ≤ hẹn giao.
    const lastByPo = new Map<string, string>()
    for (const l of lineRows) {
      if (!l.last_received_at) continue
      const cur = lastByPo.get(l.po_id)
      if (!cur || l.last_received_at > cur) lastByPo.set(l.po_id, l.last_received_at)
    }
    for (const p of poRows) {
      if (p.status !== 'received' || !p.expected_at) continue
      const last = lastByPo.get(p.id)
      if (!last) continue // received tay (dòng tự do) — không có mốc sổ kho, bỏ khỏi mẫu số
      out.po_with_expected++
      if (last.slice(0, 10) <= p.expected_at.slice(0, 10)) out.po_on_time++
    }

    // Trả hàng: đơn có movement OUT gắn dòng đơn (phiếu trả 0080).
    if (lineRows.length > 0) {
      const lineToPo = new Map(lineRows.map((l) => [l.id, l.po_id]))
      const { data: returns } = await db()
        .from('warehouse_movements')
        .select('po_line_id')
        .eq('direction', 'out')
        .in('po_line_id', [...lineToPo.keys()])
        .limit(5000)
      const poWithReturn = new Set<string>()
      for (const r of (returns ?? []) as { po_line_id: string }[]) {
        const poId = lineToPo.get(r.po_line_id)
        if (poId) poWithReturn.add(poId)
      }
      out.po_returned = poWithReturn.size
    }
    return out
  },

  /**
   * PO trả hàng NCC được (⑤): đã có hàng về — partial hoặc received.
   * Kèm tên NCC để phiếu xuất trả ghi đúng người nhận (mẫu 02-VT).
   */
  async listReturnablePos(): Promise<
    { id: string; code: string; status: string; supplier_name: string }[]
  > {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('id, code, status, supplier:supply_suppliers(name)')
      .in('status', ['partial', 'received'])
      .order('created_at', { ascending: false })
      .limit(200)
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const sp = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
      return {
        id: r.id as string,
        code: r.code as string,
        status: r.status as string,
        supplier_name: (sp as { name?: string } | null)?.name ?? '?',
      }
    })
  },

  /**
   * Đã đặt / chờ duyệt của MỘT BỘ LSX gộp theo vật tư (đề xuất mua §P1, Cách 2):
   *  - ordered = Σ còn CHỜ VỀ (qty_open — 0154, dòng chốt thiếu không đếm) của
   *    PO ĐÃ DUYỆT (RECEIVABLE). Không dùng qty_ordered để khỏi đếm trùng phần
   *    đã về — hàng đã về nằm trong tồn (on_hand) rồi.
   *  - pending = Σ qty_ordered của PO còn chờ GĐ duyệt (chỉ cảnh báo, không trừ).
   * `excludePoId` = PO đang sửa (không tự đếm chính nó).
   *
   * NHẬN CẢ BỘ LỆNH và dedupe theo PO — hai lý do, đều là lỗi thật nếu làm khác:
   *  1. ĐƠN MUA CHUNG (0125): đơn của lệnh A có mua hộ lệnh B (bảng nối
   *     supply_po_extra_lsx). Bản cũ chỉ nhìn cột production_order_id nên khi
   *     lập đơn riêng cho B không thấy phần đã được mua hộ → đề xuất ĐẶT TRÙNG
   *     thứ đã đặt rồi.
   *  2. Gọi từng lệnh rồi CỘNG các map (cách cũ của route needs) sẽ đếm đơn gộp
   *     HAI lần khi cả A lẫn B cùng nằm trong bộ đang tính.
   *
   * Giới hạn nói thẳng: dòng đơn không tách được "phần của lệnh nào", nên đơn
   * phục vụ nhiều lệnh được đếm TRỌN phần chưa về vào "đã đặt" của bộ này. Lệnh
   * phụ đứng một mình vì thế có thể thấy "đã đặt" cao hơn phần thật của nó —
   * nghiêng về KHÔNG giục mua trùng; cột "đã đặt" hiển thị trên form nên người
   * mua vẫn thấy số mà tự quyết (suggest chỉ là đề xuất, không phải lệnh).
   */
  async orderedPendingByLsxSet(
    productionOrderIds: string[],
    excludePoId?: string | null,
  ): Promise<Map<string, { ordered: number; pending: number }>> {
    const out = new Map<string, { ordered: number; pending: number }>()
    if (productionOrderIds.length === 0) return out
    const [main, extra] = await Promise.all([
      db()
        .from('supply_purchase_orders')
        .select('id, status')
        .in('production_order_id', productionOrderIds),
      db()
        .from('supply_po_extra_lsx')
        .select('po:supply_purchase_orders!inner(id, status)')
        .in('production_order_id', productionOrderIds),
    ])
    type P = { id: string; status: string }
    const seen = new Set<string>()
    const committed: string[] = []
    const pending: string[] = []
    const take = (p: P | null | undefined) => {
      if (!p || seen.has(p.id)) return
      seen.add(p.id)
      if (excludePoId && p.id === excludePoId) return
      if ((RECEIVABLE as readonly string[]).includes(p.status)) committed.push(p.id)
      else if (p.status === 'pending_approval') pending.push(p.id)
    }
    for (const p of (main.data as P[] | null) ?? []) take(p)
    for (const r of (extra.data as { po: P | P[] | null }[] | null) ?? []) {
      take(Array.isArray(r.po) ? r.po[0] : r.po)
    }
    const bump = (mid: string, k: 'ordered' | 'pending', v: number) => {
      const e = out.get(mid) ?? { ordered: 0, pending: 0 }
      e[k] += v
      out.set(mid, e)
    }
    if (committed.length > 0) {
      // qty_open (0154): dòng đã CHỐT THIẾU không còn "đang đặt" — phần NCC bỏ
      // phải được đề xuất mua lại chỗ khác, không để số ảo đè lên suggest.
      const { data } = await db()
        .from('supply_po_line_status')
        .select('material_id, qty_open')
        .in('po_id', committed)
      for (const r of (data as { material_id: string; qty_open: number }[] | null) ??
        []) {
        bump(r.material_id, 'ordered', Math.max(Number(r.qty_open) || 0, 0))
      }
    }
    if (pending.length > 0) {
      const { data } = await db()
        .from('supply_purchase_order_lines')
        .select('material_id, qty_ordered')
        .in('po_id', pending)
      for (const r of (data as { material_id: string; qty_ordered: number }[] | null) ??
        []) {
        bump(r.material_id, 'pending', Number(r.qty_ordered) || 0)
      }
    }
    return out
  },

  /**
   * Đã đặt / chờ duyệt trên MỌI PO đang mở (cả theo LSX lẫn ngoài LSX) — gộp
   * theo vật tư. Nguồn "vị thế tồn" cho mua bù tồn (nghiệp vụ ①): ordered =
   * Σ qty_open của PO đã duyệt (0154 — dòng chốt thiếu không đếm); pending =
   * Σ qty_ordered PO chờ duyệt (cảnh báo).
   */
  async orderedPendingAll(): Promise<Map<string, { ordered: number; pending: number }>> {
    const out = new Map<string, { ordered: number; pending: number }>()
    const { data: pos } = await db()
      .from('supply_purchase_orders')
      .select('id, status')
      .in('status', [...RECEIVABLE, 'pending_approval'])
      .limit(2000)
    const committed: string[] = []
    const pending: string[] = []
    for (const p of (pos as { id: string; status: string }[] | null) ?? []) {
      if (p.status === 'pending_approval') pending.push(p.id)
      else committed.push(p.id)
    }
    const bump = (mid: string, k: 'ordered' | 'pending', v: number) => {
      const e = out.get(mid) ?? { ordered: 0, pending: 0 }
      e[k] += v
      out.set(mid, e)
    }
    if (committed.length > 0) {
      // qty_open (0154): dòng đã CHỐT THIẾU không còn "đang đặt" — phần NCC bỏ
      // phải được đề xuất mua lại chỗ khác, không để số ảo đè lên suggest.
      const { data } = await db()
        .from('supply_po_line_status')
        .select('material_id, qty_open')
        .in('po_id', committed)
      for (const r of (data as { material_id: string; qty_open: number }[] | null) ??
        []) {
        bump(r.material_id, 'ordered', Math.max(Number(r.qty_open) || 0, 0))
      }
    }
    if (pending.length > 0) {
      const { data } = await db()
        .from('supply_purchase_order_lines')
        .select('material_id, qty_ordered')
        .in('po_id', pending)
      for (const r of (data as { material_id: string; qty_ordered: number }[] | null) ??
        []) {
        bump(r.material_id, 'pending', Number(r.qty_ordered) || 0)
      }
    }
    return out
  },

  async findPoCode(poId: string): Promise<string | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('code')
      .eq('id', poId)
      .maybeSingle()
    return (data as { code: string } | null)?.code ?? null
  },

  /**
   * code + status + NGƯỜI PHỤ TRÁCH của PO — guard nhập kho theo đơn (chỉ
   * RECEIVABLE) và để báo hàng về cho đúng người (0128: chủ đơn là
   * `assigned_to`, đơn cũ chưa backfill thì rơi về `created_by`).
   */
  async poStatus(poId: string): Promise<{
    code: string
    status: string
    assigned_to: string | null
    created_by: string | null
  } | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('code, status, assigned_to, created_by')
      .eq('id', poId)
      .maybeSingle()
    return (
      (data as {
        code: string
        status: string
        assigned_to: string | null
        created_by: string | null
      } | null) ?? null
    )
  },
}

// ── Nhà cung cấp (FR-SUP-06) ────────────────────────────────────────────────

export type Supplier = {
  id: string
  code: string | null
  name: string
  short_name: string | null
  type: string | null
  status: string
  // Pháp lý
  company_name: string | null
  tax_no: string | null
  business_license: string | null
  founded_on: string | null
  legal_rep: string | null
  country: string | null
  registered_address: string | null
  // Liên hệ
  email: string | null
  phone: string | null
  address: string | null
  trading_address: string | null
  warehouse_address: string | null
  website: string | null
  // Thanh toán
  payment_terms: string | null
  currency: string | null
  bank_name: string | null
  bank_account: string | null
  swift_code: string | null
  invoice_terms: string | null
  // Mua hàng
  moq: string | null
  lead_time_days: number | null
  incoterms: string | null
  delivery_method: string | null
  return_policy: string | null
  warranty_policy: string | null
  // Phân loại
  region: string | null
  import_export: string | null
  priority: string | null
  rating: string | null
  // Đánh giá (M5 — chấm tay; KPI giao hàng tính live từ PO)
  quality_score: number | null
  service_score: number | null
  price_score: number | null
  complaint_count: number
  evaluated_at: string | null
  evaluated_by: string | null
  // Admin
  buyer_id: string | null
  can_order: boolean
  lock_reason: string | null
  is_active: boolean
  note: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

const SUPPLIER_COLS =
  'id, code, name, short_name, type, status, company_name, tax_no, business_license, founded_on, legal_rep, country, registered_address, email, phone, address, trading_address, warehouse_address, website, payment_terms, currency, bank_name, bank_account, swift_code, invoice_terms, moq, lead_time_days, incoterms, delivery_method, return_policy, warranty_policy, region, import_export, priority, rating, quality_score, service_score, price_score, complaint_count, evaluated_at, evaluated_by, buyer_id, can_order, lock_reason, is_active, note, created_by, updated_by, created_at, updated_at'

export const suppliersRepo = {
  async list(filter: {
    q?: string
    active_only: boolean
    page: number
    page_size: number
  }): Promise<{ rows: Supplier[]; total: number }> {
    let q = db()
      .from('supply_suppliers')
      .select(SUPPLIER_COLS, { count: 'exact' })
      .order('name')
    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.q) q = q.or(`name.ilike.%${filter.q}%,code.ilike.%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: (data ?? []) as Supplier[], total: count ?? 0 }
  },

  async findById(id: string): Promise<Supplier | null> {
    const { data } = await db()
      .from('supply_suppliers')
      .select(SUPPLIER_COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Supplier | null) ?? null
  },

  async insert(row: Partial<Supplier> & Pick<Supplier, 'name'>): Promise<Supplier> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .insert(row)
      .select(SUPPLIER_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert supplier failed')
    return data as Supplier
  },

  async patch(id: string, patch: Partial<Supplier>): Promise<Supplier> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .update(patch)
      .eq('id', id)
      .select(SUPPLIER_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update supplier failed')
    return data as Supplier
  },
}

// ── Chứng chỉ NCC (M3, supplier_certs — 0047, không theo dõi hạn) ────────────

export type SupplierCert = {
  id: string
  supplier_id: string
  cert_type: string
  cert_no: string | null
  issued_on: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

const CERT_COLS =
  'id, supplier_id, cert_type, cert_no, issued_on, note, created_by, created_at'

export const certsRepo = {
  async list(supplierId: string): Promise<SupplierCert[]> {
    const { data } = await db()
      .from('supplier_certs')
      .select(CERT_COLS)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
    return (data ?? []) as SupplierCert[]
  },

  async insert(row: Omit<SupplierCert, 'id' | 'created_at'>): Promise<SupplierCert> {
    const { data, error } = await db()
      .from('supplier_certs')
      .insert(row)
      .select(CERT_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert cert failed')
    return data as SupplierCert
  },

  async remove(id: string): Promise<void> {
    const { error } = await db().from('supplier_certs').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}

// ── Nhóm hàng NCC cung cấp (M4, n–n với catalog_items type='material_group') ──

export type MaterialGroup = { id: string; code: string; label: string }

export const materialGroupsRepo = {
  /** Danh mục nhóm vật tư (master dùng chung). */
  async options(): Promise<MaterialGroup[]> {
    const { data } = await db()
      .from('catalog_items')
      .select('id, code, label')
      .eq('type', 'material_group')
      .eq('is_active', true)
      .order('sort_order')
    return (data ?? []) as MaterialGroup[]
  },

  /** Id các nhóm mà 1 NCC cung cấp. */
  async forSupplier(supplierId: string): Promise<string[]> {
    const { data } = await db()
      .from('supplier_material_groups')
      .select('group_id')
      .eq('supplier_id', supplierId)
    return ((data ?? []) as { group_id: string }[]).map((r) => r.group_id)
  },

  /** Nhãn nhóm hàng theo lô cho nhiều NCC — cho chips ở danh sách. */
  async labelsBySuppliers(supplierIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (supplierIds.length === 0) return out
    const { data } = await db()
      .from('supplier_material_groups')
      .select('supplier_id, group:catalog_items(label, sort_order)')
      .in('supplier_id', supplierIds)
    type Raw = {
      supplier_id: string
      group:
        | { label: string; sort_order: number }
        | { label: string; sort_order: number }[]
        | null
    }
    for (const r of (data ?? []) as Raw[]) {
      const g = Array.isArray(r.group) ? r.group[0] : r.group
      if (!g) continue
      const arr = out.get(r.supplier_id) ?? []
      arr.push(g.label)
      out.set(r.supplier_id, arr)
    }
    return out
  },

  /** Đặt lại toàn bộ nhóm của NCC = danh sách mới (xoá hết + chèn). */
  async setForSupplier(supplierId: string, groupIds: string[]): Promise<void> {
    const del = await db()
      .from('supplier_material_groups')
      .delete()
      .eq('supplier_id', supplierId)
    if (del.error) throw new Error(del.error.message)
    if (groupIds.length === 0) return
    const { error } = await db()
      .from('supplier_material_groups')
      .insert(groupIds.map((group_id) => ({ supplier_id: supplierId, group_id })))
    if (error) throw new Error(error.message)
  },
}

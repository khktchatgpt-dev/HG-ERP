import { db } from '@/server/db'
import { canCanKg } from '@/lib/can-kg'
import { DAU_SUA_PHIEU, suaLaiTu } from '@/lib/da-ve'
import type { DongNhanVe, PhieuNhanVe } from '@/lib/da-ve'

/** Một lần nhận hàng theo đơn mua — một dòng của màn Theo dõi đơn hàng › Đã về. */
export type DaVeRow = {
  doc_id: string
  code: string
  doc_date: string
  supplier_doc_no: string | null
  nguoi_nhan: string | null
  po_id: string
  po_code: string
  lsx_code: string | null
  supplier_name: string
  /** Người phụ trách đơn (chưa giao ai thì người lập) — cho phạm vi "của tôi". */
  owner_id: string | null
  owner_name: string | null
  /** SỬA PHIẾU NHẬP (02/10/2026): phiếu này lập lại phiếu nào (đọc từ ghi chú "Sửa lại PNK-…"). */
  sua_lai_tu: string | null
  /** Người giao + ghi chú phiếu — cho hộp Sửa thông tin (B). */
  counterparty: string | null
  ghi_chu: string | null
  /** Phiếu này đã được lập lại bằng phiếu nào. */
  thay_boi: string | null
  /** Dòng của phiếu kèm mã vật tư — để hộp ghi kg cân bày ra. */
  lines: (DongNhanVe & { material_name: string })[]
  phieu: PhieuNhanVe
}

const num = (v: unknown) => (v == null ? 0 : Number(v))
const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

/**
 * ĐÃ VỀ — phiếu nhập THEO ĐƠN MUA từ `since` (01/10/2026, bản vẽ G3).
 *
 * Một phiếu = một dòng. Kết quả (thiếu kg, còn thiếu, sai quy cách, vượt, chênh
 * kg) KHÔNG tính ở đây — repo chỉ gom đủ dữ kiện cho `lib/da-ve` đọc, để luật
 * nằm một chỗ và có test.
 *
 * Gom theo LÔ (`in(...)`), không hỏi từng phiếu. Phiếu nhập ngoài đơn / hoàn
 * kho không có dòng đơn mua nên tự rơi khỏi tập (không phải việc của Cung ứng).
 */
export async function loadDaVe(since: string): Promise<{
  rows: DaVeRow[]
  truncatedAt: number | null
}> {
  const LIMIT = 500
  const { data: docs, error } = await db()
    .from('warehouse_docs')
    .select(
      'id, code, doc_date, supplier_doc_no, counterparty, note, actor:users!warehouse_docs_created_by_fkey(name)',
    )
    .eq('kind', 'receipt')
    .eq('status', 'posted')
    .gte('doc_date', since)
    .order('doc_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (error) throw new Error(error.message)
  const docRows = (docs ?? []) as {
    id: string
    code: string
    doc_date: string
    supplier_doc_no: string | null
    note: string | null
    counterparty: string | null
    actor: { name: string | null } | { name: string | null }[] | null
  }[]
  if (docRows.length === 0) return { rows: [], truncatedAt: null }
  const docIds = docRows.map((d) => d.id)

  // Mọi truy vấn đều kiểm lỗi: lỗi embed (FK mơ hồ…) mà nuốt là màn rỗng câm.
  const ok = <T extends { error: { message: string } | null }>(r: T): T => {
    if (r.error) throw new Error(r.error.message)
    return r
  }
  const [{ data: mvs }, { data: rev }] = (
    await Promise.all([
      db()
        .from('warehouse_movements')
        .select(
          'id, doc_id, po_line_id, qty, stock_status, qty2_actual, material:warehouse_materials(code, name, unit)',
        )
        .in('doc_id', docIds)
        .not('po_line_id', 'is', null),
      db()
        .from('warehouse_docs')
        .select('reversal_of_doc_id, reason')
        .in('reversal_of_doc_id', docIds),
    ])
  ).map(ok)
  const movements = (mvs ?? []) as {
    id: string
    doc_id: string
    po_line_id: string
    qty: unknown
    stock_status: string | null
    qty2_actual: unknown
    material:
      | { code: string; name: string; unit: string }
      | { code: string; name: string; unit: string }[]
      | null
  }[]
  const revRows = (rev ?? []) as {
    reversal_of_doc_id: string | null
    reason: string | null
  }[]
  const reversed = new Set(
    revRows.map((r) => r.reversal_of_doc_id).filter((v): v is string => !!v),
  )
  // Đảo trong hộp "Sửa phiếu" (lý do mang dấu) — chờ lập lại cho tới khi có phiếu mới.
  const daoDeSua = new Set(revRows.filter((r) => r.reason?.includes(DAU_SUA_PHIEU)).map((r) => r.reversal_of_doc_id)) // prettier-ignore
  const thayBoi = new Map<string, string>()
  for (const d of docRows) {
    const goc = suaLaiTu(d.note)
    if (goc) thayBoi.set(goc, d.code)
  }
  const lineIds = [...new Set(movements.map((m) => m.po_line_id))]
  if (lineIds.length === 0) return { rows: [], truncatedAt: null }

  const { data: pls } = ok(
    await db()
      .from('supply_purchase_order_lines')
      .select('id, po_id, qty_ordered, price_basis, unit2, qty2')
      .in('id', lineIds),
  )
  const poLines = new Map(
    (
      (pls ?? []) as {
        id: string
        po_id: string
        qty_ordered: unknown
        price_basis: string | null
        unit2: string | null
        qty2: unknown
      }[]
    ).map((l) => [l.id, l]),
  )
  const poIds = [...new Set([...poLines.values()].map((l) => l.po_id))]

  const [{ data: pos }, { data: status }] = (
    await Promise.all([
      db()
        .from('supply_purchase_orders')
        .select(
          // BẪY: hai FK sang production_orders — embed trần là "more than one
          // relationship", PostgREST trả lỗi. Hint đích danh FK lệnh chính.
          'id, code, status, template, assigned_to, created_by, supplier:supply_suppliers(name), lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code)',
        )
        .in('id', poIds),
      db()
        .from('supply_po_line_status')
        .select('id, po_id, qty_ordered, qty_received, qty_open, closed_short_at')
        .in('po_id', poIds),
    ])
  ).map(ok)
  type PoRow = {
    id: string
    code: string
    status: string
    template: string | null
    assigned_to: string | null
    created_by: string | null
    supplier: { name: string } | { name: string }[] | null
    lsx: { code: string } | { code: string }[] | null
  }
  const poById = new Map(((pos ?? []) as PoRow[]).map((p) => [p.id, p]))
  const ownerIds = [
    ...new Set(
      [...poById.values()].map((p) => p.assigned_to ?? p.created_by).filter(Boolean),
    ),
  ] as string[]
  const { data: users } = ownerIds.length
    ? await db().from('users').select('id, name').in('id', ownerIds)
    : { data: [] }
  const userName = new Map(
    ((users ?? []) as { id: string; name: string | null }[]).map((u) => [u.id, u.name]),
  )

  const statusRows = (status ?? []) as {
    id: string
    po_id: string
    qty_ordered: unknown
    qty_received: unknown
    qty_open: unknown
    closed_short_at: string | null
  }[]
  const openByPo = new Map<string, number>()
  const overLine = new Set<string>()
  for (const s of statusRows) {
    if (num(s.qty_open) > 1e-9 && !s.closed_short_at)
      openByPo.set(s.po_id, (openByPo.get(s.po_id) ?? 0) + 1)
    if (num(s.qty_received) > num(s.qty_ordered) + 1e-9) overLine.add(s.id)
  }

  // Phiếu MỚI NHẤT còn hiệu lực của mỗi đơn (docRows đã xếp mới → cũ).
  const mvByDoc = new Map<string, typeof movements>()
  for (const m of movements) mvByDoc.set(m.doc_id, [...(mvByDoc.get(m.doc_id) ?? []), m])
  const latestOfPo = new Map<string, string>()
  for (const d of docRows) {
    const first = mvByDoc.get(d.id)?.[0]
    const poId = first ? poLines.get(first.po_line_id)?.po_id : undefined
    if (poId && !reversed.has(d.id) && !latestOfPo.has(poId)) latestOfPo.set(poId, d.id)
  }

  const rows: DaVeRow[] = []
  for (const d of docRows) {
    const ms = mvByDoc.get(d.id) ?? []
    if (ms.length === 0) continue // nhập ngoài đơn / hoàn kho — không thuộc màn này
    const poId = poLines.get(ms[0].po_line_id)?.po_id
    const po = poId ? poById.get(poId) : undefined
    if (!po) continue
    const lines = ms.map((m) => {
      const pl = poLines.get(m.po_line_id)
      const mat = one(m.material)
      return {
        movement_id: m.id,
        material_code: mat?.code ?? '—',
        material_name: mat?.name ?? '',
        unit: mat?.unit ?? '',
        qty: num(m.qty),
        stock_status: m.stock_status ?? 'ok',
        qty2_actual: m.qty2_actual == null ? null : num(m.qty2_actual),
        can_kg: pl ? canCanKg(po.template, pl) : false,
        qty_ordered: num(pl?.qty_ordered),
        kg_don: pl?.qty2 == null ? null : num(pl.qty2),
      }
    })
    const ownerId = po.assigned_to ?? po.created_by
    rows.push({
      doc_id: d.id,
      code: d.code,
      doc_date: d.doc_date,
      supplier_doc_no: d.supplier_doc_no,
      nguoi_nhan: one(d.actor)?.name ?? null,
      po_id: po.id,
      po_code: po.code,
      lsx_code: one(po.lsx)?.code ?? null,
      supplier_name: one(po.supplier)?.name ?? '',
      owner_id: ownerId,
      owner_name: ownerId ? (userName.get(ownerId) ?? null) : null,
      sua_lai_tu: suaLaiTu(d.note),
      counterparty: d.counterparty,
      ghi_chu: d.note,
      thay_boi: thayBoi.get(d.code) ?? null,
      lines,
      phieu: {
        doc_id: d.id,
        reversed: reversed.has(d.id),
        cho_lap_lai: daoDeSua.has(d.id) && !thayBoi.has(d.code),
        lines,
        po_status: po.status,
        latest_for_po: latestOfPo.get(po.id) === d.id,
        po_open_lines: openByPo.get(po.id) ?? 0,
        over_lines: ms.filter((m) => overLine.has(m.po_line_id)).length,
      },
    })
  }
  return { rows, truncatedAt: docRows.length >= LIMIT ? LIMIT : null }
}

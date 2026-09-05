import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { assessMeetingRisk } from '@/lib/supply-meeting'
import { assessPoLate } from '@/lib/late-risk'
import { buildLsxSupplyDetail } from './lsx-supply.service'
import type { LsxDetailReport, LsxReportBatch, LsxReportLine } from './lsx-detail-excel'

/**
 * NẠP DỮ LIỆU cho hồ sơ cung ứng một lệnh (`lsx-detail-excel`): lệnh + đơn đã
 * có ở `buildLsxSupplyDetail`; ở đây nạp thêm TỪNG DÒNG vật tư của mọi đơn và
 * TỪNG ĐỢT nhận (phiếu nhập kho) — ba truy vấn gộp cho cả tập đơn, không N+1.
 *
 * Số dòng đọc từ view `supply_po_line_status` (BR-08: thiếu = đặt − nhận, tính
 * từ sổ kho) — cùng nguồn với màn chi tiết đơn, không tự trừ lại.
 */
export async function loadLsxDetailReport(
  user: User,
  lsxId: string,
  today: string,
): Promise<LsxDetailReport | null> {
  const lsx = await buildLsxSupplyDetail(user, lsxId, today)
  if (!lsx) return null

  const risk = assessMeetingRisk(
    {
      materials_received_at: lsx.materials_received_at,
      materials_due_at: lsx.materials_due_at,
      ship_date: lsx.ship_date,
      pos: lsx.pos.map((p) => ({ status: p.status, expected_at: p.expected_at })),
      posTotal: lsx.pos.filter((p) => p.status !== 'cancelled').length,
      posUnsent: lsx.pos.filter(
        (p) => p.status === 'draft' || p.status === 'pending_approval',
      ).length,
      posOpen: lsx.pos.filter(
        (p) =>
          p.status !== 'draft' &&
          p.status !== 'pending_approval' &&
          p.status !== 'received' &&
          p.status !== 'cancelled',
      ).length,
      posLate: lsx.pos.filter((p) => assessPoLate(p, today) === 'overdue').length,
    },
    today,
  )

  const poIds = lsx.pos.map((p) => p.id)
  const lines: Record<string, LsxReportLine[]> = {}
  const batches: Record<string, LsxReportBatch[]> = {}
  for (const id of poIds) {
    lines[id] = []
    batches[id] = []
  }
  if (poIds.length === 0) return { today, lsx, risk, lines, batches }

  const [{ data: statusRows }, { data: lineRows }] = await Promise.all([
    db()
      .from('supply_po_line_status')
      .select(
        'id, po_id, material_id, qty_ordered, qty_received, qty_rejected, qty_missing, closed_short_at, last_received_at, unit_price, spec, qty2, unit2, note, sort_order',
      )
      .in('po_id', poIds),
    // Tên/ĐVT: vật tư kho hoặc cặp tự gõ của dòng tự do (0134).
    db()
      .from('supply_purchase_order_lines')
      .select('id, line_name, line_unit, material:warehouse_materials(code, name, unit)')
      .in('po_id', poIds),
  ])

  type Mat = { code: string; name: string; unit: string }
  const nameById = new Map<string, { code: string; name: string; unit: string }>()
  for (const r of (lineRows ?? []) as {
    id: string
    line_name: string | null
    line_unit: string | null
    material: Mat | Mat[] | null
  }[]) {
    const m = Array.isArray(r.material) ? r.material[0] : r.material
    nameById.set(r.id, {
      code: m?.code ?? '',
      name: m?.name ?? r.line_name ?? '?',
      unit: m?.unit ?? r.line_unit ?? '',
    })
  }

  type S = {
    id: string
    po_id: string
    qty_ordered: unknown
    qty_received: unknown
    qty_rejected: unknown
    qty_missing: unknown
    closed_short_at: string | null
    last_received_at: string | null
    unit_price: unknown
    spec: string | null
    qty2: unknown
    unit2: string | null
    note: string | null
    sort_order: number
  }
  const num = (v: unknown) => (v == null ? null : Number(v))
  const sorted = ((statusRows ?? []) as S[]).sort((a, b) => a.sort_order - b.sort_order)
  const lineIds: string[] = []
  for (const s of sorted) {
    const n = nameById.get(s.id)
    lineIds.push(s.id)
    lines[s.po_id]?.push({
      id: s.id,
      material_code: n?.code ?? '',
      material_name: n?.name ?? '?',
      spec: s.spec,
      unit: n?.unit ?? '',
      qty_ordered: num(s.qty_ordered) ?? 0,
      qty_received: num(s.qty_received) ?? 0,
      qty_rejected: num(s.qty_rejected) ?? 0,
      qty_missing: num(s.qty_missing) ?? 0,
      closed_short_at: s.closed_short_at,
      last_received_at: s.last_received_at,
      unit_price: num(s.unit_price),
      qty2: num(s.qty2),
      unit2: s.unit2,
      note: s.note,
    })
  }
  if (lineIds.length === 0) return { today, lsx, risk, lines, batches }

  // ĐỢT NHẬN = phiếu nhập kho. Movement không gắn phiếu (dữ liệu cũ) gom theo
  // NGÀY tạo — vẫn là một đợt, chỉ không có số phiếu.
  const { data: mvRows } = await db()
    .from('warehouse_movements')
    .select('po_line_id, doc_id, qty, qty_rejected, created_at')
    .eq('direction', 'in')
    .in('po_line_id', lineIds)
    .limit(10000)
  type Mv = {
    po_line_id: string
    doc_id: string | null
    qty: unknown
    qty_rejected: unknown
    created_at: string
  }
  const mvs = (mvRows ?? []) as Mv[]
  const docIds = [...new Set(mvs.map((m) => m.doc_id).filter((v): v is string => !!v))]
  const docById = new Map<
    string,
    { code: string; doc_date: string; supplier_doc_no: string | null }
  >()
  if (docIds.length > 0) {
    const { data: docs } = await db()
      .from('warehouse_docs')
      .select('id, code, doc_date, supplier_doc_no')
      .in('id', docIds)
    for (const d of (docs ?? []) as {
      id: string
      code: string
      doc_date: string
      supplier_doc_no: string | null
    }[]) {
      docById.set(d.id, d)
    }
  }

  const poByLine = new Map<string, string>()
  for (const s of sorted) poByLine.set(s.id, s.po_id)
  // key đợt: theo phiếu nếu có, không thì theo ngày.
  const batchMap = new Map<string, Map<string, LsxReportBatch>>()
  for (const m of mvs) {
    const poId = poByLine.get(m.po_line_id)
    if (!poId) continue
    const doc = m.doc_id ? docById.get(m.doc_id) : undefined
    const date = (doc?.doc_date ?? m.created_at).slice(0, 10)
    const key = doc ? `doc:${m.doc_id}` : `day:${date}`
    const perPo = batchMap.get(poId) ?? new Map<string, LsxReportBatch>()
    const b = perPo.get(key) ?? {
      date,
      doc_code: doc?.code ?? null,
      supplier_doc_no: doc?.supplier_doc_no ?? null,
      by_line: {},
    }
    const cur = b.by_line[m.po_line_id] ?? { qty: 0, rejected: 0 }
    const rej = num(m.qty_rejected) ?? 0
    b.by_line[m.po_line_id] = {
      qty: cur.qty + (num(m.qty) ?? 0) + rej,
      rejected: cur.rejected + rej,
    }
    perPo.set(key, b)
    batchMap.set(poId, perPo)
  }
  for (const [poId, perPo] of batchMap) {
    batches[poId] = [...perPo.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  return { today, lsx, risk, lines, batches }
}

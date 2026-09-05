import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { assessMeetingRisk } from '@/lib/supply-meeting'
import { assessPoLate } from '@/lib/late-risk'
import { buildLsxSupplyDetail } from './lsx-supply.service'
import { loadReceiptBatches } from './po-receipts.service'
import { loadLsxBangKe } from './lsx-bang-ke.service'
import type { LsxDetailReport, LsxReportLine } from './lsx-detail-excel'

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
  /** Xuất kèm cả định mức chưa xác nhận (khớp công tắc trên màn bảng kê). */
  includeDraft = false,
): Promise<LsxDetailReport | null> {
  const [lsx, bk] = await Promise.all([
    buildLsxSupplyDetail(user, lsxId, today),
    loadLsxBangKe(user, lsxId, today, includeDraft),
  ])
  if (!lsx) return null
  const bangKe = bk
    ? {
        rows: bk.rows,
        blocked: bk.blocked,
        include_draft: bk.include_draft,
        unconfirmed_products: bk.products
          .filter((p) => !p.bom_confirmed && p.coded_parts > 0)
          .map((p) => ({ code: p.code, name: p.name, qty: p.qty })),
      }
    : undefined

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
  for (const id of poIds) lines[id] = []
  if (poIds.length === 0) return { today, lsx, risk, lines, batches: {}, bangKe }

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
  if (lineIds.length === 0) return { today, lsx, risk, lines, batches: {}, bangKe }

  // ĐỢT NHẬN = phiếu nhập kho — cùng hàm với tab Đợt giao của chi tiết đơn.
  const batches = await loadReceiptBatches(poIds)
  return { today, lsx, risk, lines, batches, bangKe }
}

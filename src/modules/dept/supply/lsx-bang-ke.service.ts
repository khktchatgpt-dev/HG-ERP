import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { stockInfoMany } from '@/modules/dept/warehouse/stock.repo'
import { reservedByOtherLsx } from '@/modules/dept/warehouse/stock.service'
import { componentMaterialNeeds } from '@/modules/dept/production/components.service'
import { issuedByLsx } from '@/modules/dept/warehouse/stock.repo'
import { lsxBomNeeds } from './lsx-bom-needs.repo'
import { assessPoLate } from '@/lib/late-risk'
import {
  buildBangKe,
  summarizeBangKe,
  type BangKeFacts,
  type BangKeNeed,
  type BangKeRow,
} from '@/lib/lsx-bang-ke'
import { posService } from './pos.service'
import { supplyRepo, RECEIVABLE } from './supply.repo'
import { lsxNeedsRepo } from './lsx-needs.repo'
import type { BangKeManual } from '@/lib/lsx-bang-ke'

export type LsxBangKe = {
  lsx: {
    id: string
    code: string
    customer_name: string
    order_codes: string[]
    ship_date: string | null
    materials_due_at: string | null
    materials_received_at: string | null
  }
  rows: BangKeRow[]
  summary: ReturnType<typeof summarizeBangKe>
  /** Nhóm vật tư có mặt — cho ô lọc. */
  groups: string[]
  /** Nguồn cần của lệnh: có định hình gắn mã / định mức / không có gì. */
  need_source: 'components' | 'bom' | 'none'
  /** Đang tính cả định mức từ BOM chưa xác nhận? */
  include_draft: boolean
  /**
   * Dòng định mức KHÔNG quy đổi được sang đơn vị mua (thiếu chiều dài cây,
   * thiếu khối lượng…) — số của chúng KHÔNG vào bảng, phải nói ra.
   */
  blocked: {
    product_code: string
    material_code: string
    material_name: string
    unit: string
    part_name: string
    reason: string
  }[]
  /** SP của lệnh kèm trạng thái chốt định mức — nói rõ ai cần làm nốt. */
  products: { id: string; code: string; name: string; qty: number; bom_confirmed: boolean; coded_parts: number }[]
  /** Số dòng nhập tay đang có. */
  manual_count: number
  /** Bảng nhập tay chưa đọc được (chưa áp migration 0184) — UI nói thẳng, không giấu. */
  manual_error: string | null
}

/**
 * NẠP BẢNG KÊ VẬT TƯ CỦA MỘT LỆNH (B1, 05/09/2026) — nguồn cần đọc qua đúng
 * `smartLsxNeeds` mà form soạn đơn dùng (định hình gắn mã → định mức); tồn, giữ
 * chỗ, đã đặt / chờ ký cũng đúng hàm của form. Thêm hai thứ form không cần mà
 * người mua cần: SL trên đơn NHÁP (kẻo tưởng chưa ai làm gì) và đơn nào đang
 * mua mã nào (kể cả đơn mua chung 0125 — `posService.list` đã gộp sẵn).
 *
 * Dòng nhập tay (B2) hiện chưa có bảng — truyền rỗng, lõi thuần đã sẵn chỗ.
 */
export async function loadLsxBangKe(
  user: User,
  lsxId: string,
  today: string,
  /** Bật để tính cả định mức chưa xác nhận (công tắc trên màn hình). */
  includeDraft = false,
): Promise<LsxBangKe | null> {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) return null

  const [bom, comp, issued, { rows: pos }, manualRes] = await Promise.all([
    // ĐỊNH MỨC tách theo SP + trạng thái xác nhận (user chốt 05/09/2026: chỉ
    // BOM đã xác nhận mới được dùng để mua).
    lsxBomNeeds(lsxId),
    // Bảng định hình của Sản xuất — chỉ dùng khi có dòng ĐÃ gắn mã vật tư.
    componentMaterialNeeds(lsxId),
    issuedByLsx(lsxId),
    posService.list(user, { production_order_id: lsxId, page: 1, page_size: 200 }),
    // Bảng nhập tay (0184). Chưa áp migration thì bảng chưa có — trang vẫn phải
    // mở được với phần định mức, và nói rõ vì sao thiếu phần tay.
    lsxNeedsRepo.listByLsx(lsxId).then(
      (rows) => ({ rows, error: null as string | null }),
      (e: unknown) => ({ rows: [], error: e instanceof Error ? e.message : String(e) }),
    ),
  ])
  const manual: BangKeManual[] = manualRes.rows.map((m) => ({
    material_id: m.material_id,
    material_code: m.material_code,
    material_name: m.material_name,
    unit: m.unit,
    group_name: m.group_name,
    qty_needed: m.qty_needed,
    note: m.note,
    edited_by: m.updated_by_name,
    edited_at: m.updated_at,
  }))

  // Gộp định mức theo VẬT TƯ, giữ riêng phần đã xác nhận và phần còn nháp.
  const byMat = new Map<string, BangKeNeed>()
  for (const l of bom.lines) {
    const cur = byMat.get(l.material_id) ?? {
      material_id: l.material_id,
      material_code: l.material_code,
      material_name: l.material_name,
      unit: l.unit,
      group_name: l.group_name,
      qty_needed: 0,
      qty_needed_draft: 0,
      qty_issued: 0,
      qty_remaining: 0,
      source: 'bom' as const,
      from_products: [],
    }
    if (l.bom_confirmed) cur.qty_needed += l.qty_needed
    else cur.qty_needed_draft = (cur.qty_needed_draft ?? 0) + l.qty_needed
    cur.from_products = [
      ...(cur.from_products ?? []),
      {
        code: l.product_code,
        name: l.product_name,
        qty: l.product_qty,
        per: l.qty_per_unit,
        confirmed: l.bom_confirmed,
        explain: l.explain,
      },
    ]
    byMat.set(l.material_id, cur)
  }
  // Bảng định hình ĐÈ lên định mức cho những mã nó nói được (số của xưởng sát
  // thực tế hơn); mã nó không nhắc tới vẫn theo định mức.
  for (const c of comp ?? []) {
    const qty = c.bars_needed ?? c.kg_needed ?? c.total_components
    byMat.set(c.material_id, {
      material_id: c.material_id,
      material_code: c.material_code,
      material_name: c.material_name,
      unit: c.unit,
      qty_needed: qty,
      qty_needed_draft: 0,
      qty_issued: 0,
      qty_remaining: 0,
      source: 'components' as const,
      incomplete: c.incomplete,
      from_products: byMat.get(c.material_id)?.from_products ?? [],
    })
  }
  const needs: BangKeNeed[] = [...byMat.values()].map((n) => {
    const qtyIssued = Math.max(issued.get(n.material_id) ?? 0, 0)
    const total = n.qty_needed + (includeDraft ? (n.qty_needed_draft ?? 0) : 0)
    return { ...n, qty_issued: qtyIssued, qty_remaining: Math.max(total - qtyIssued, 0) }
  })

  // Dòng của mọi đơn thuộc lệnh — đơn nháp lấy từ bảng dòng (view status
  // không cần cho nháp), đơn đã ký lấy từ view để có qty_open / qty_received.
  const live = pos.filter((p) => p.status !== 'cancelled')
  const poIds = live.map((p) => p.id)
  const poById = new Map(live.map((p) => [p.id, p]))
  type L = {
    po_id: string
    material_id: string | null
    qty_ordered: unknown
    qty_received?: unknown
  }
  const { data: lineRows } =
    poIds.length > 0
      ? await db()
          .from('supply_po_line_status')
          .select('po_id, material_id, qty_ordered, qty_received')
          .in('po_id', poIds)
      : { data: [] as L[] }
  const lines = ((lineRows ?? []) as L[]).filter((l) => l.material_id)

  const matIds = [
    ...new Set([
      ...needs.map((n) => n.material_id),
      ...manual.map((m) => m.material_id),
      ...lines.map((l) => l.material_id!),
    ]),
  ]
  const [stock, reserved, orderedPending, { data: mats }] = await Promise.all([
    stockInfoMany(matIds),
    reservedByOtherLsx([lsxId], matIds),
    supplyRepo.orderedPendingByLsxSet([lsxId]),
    matIds.length > 0
      ? db()
          .from('warehouse_materials')
          .select('id, code, name, unit, group_name')
          .in('id', matIds)
      : Promise.resolve({ data: [] }),
  ])
  const stockById = new Map(stock.map((s) => [s.material_id, s]))
  type M = {
    id: string
    code: string
    name: string
    unit: string
    group_name: string | null
  }
  const matById = new Map(((mats ?? []) as M[]).map((m) => [m.id, m]))
  for (const n of needs) n.group_name = matById.get(n.material_id)?.group_name ?? null

  const facts = new Map<string, BangKeFacts>()
  const factOf = (id: string): BangKeFacts => {
    const cur = facts.get(id)
    if (cur) return cur
    const op = orderedPending.get(id)
    const m = matById.get(id)
    const f: BangKeFacts = {
      on_hand: stockById.get(id)?.on_hand ?? 0,
      reserved_others: reserved.get(id) ?? 0,
      ordered: op?.ordered ?? 0,
      pending: op?.pending ?? 0,
      draft: 0,
      received: 0,
      pos: [],
      material: m
        ? {
            material_code: m.code,
            material_name: m.name,
            unit: m.unit,
            group_name: m.group_name,
          }
        : undefined,
    }
    facts.set(id, f)
    return f
  }
  for (const id of matIds) factOf(id)
  for (const l of lines) {
    const p = poById.get(l.po_id)
    if (!p) continue
    const f = factOf(l.material_id!)
    const qtyOrdered = Number(l.qty_ordered) || 0
    const qtyReceived = Number(l.qty_received) || 0
    if (p.status === 'draft') f.draft += qtyOrdered
    if ((RECEIVABLE as readonly string[]).includes(p.status) || p.status === 'received') {
      f.received += qtyReceived
    }
    // Một đơn có thể có HAI dòng cùng mã (hai quy cách) — gộp về một mục đơn,
    // không thì key trùng và người đọc thấy đơn hiện hai lần.
    const dup = f.pos.find((x) => x.id === p.id)
    if (dup) {
      dup.qty_ordered += qtyOrdered
      dup.qty_received += qtyReceived
    } else {
      f.pos.push({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        status: p.status,
        expected_at: p.expected_at,
        qty_ordered: qtyOrdered,
        qty_received: qtyReceived,
        late: assessPoLate(p, today) === 'overdue',
      })
    }
  }

  const rows = buildBangKe({ needs, manual, facts, includeDraft })
  const groups = [
    ...new Set(rows.map((r) => r.group_name).filter((g): g is string => !!g)),
  ].sort((a, b) => a.localeCompare(b, 'vi'))
  return {
    lsx: {
      id: lsx.id,
      code: lsx.code,
      customer_name: lsx.customer_name,
      order_codes: lsx.order_codes,
      ship_date: lsx.ship_date,
      materials_due_at: lsx.materials_due_at,
      materials_received_at: lsx.materials_received_at,
    },
    rows,
    summary: summarizeBangKe(rows),
    groups,
    manual_count: manual.length,
    include_draft: includeDraft,
    blocked: bom.blocked.map((b) => ({
      product_code: b.product_code,
      material_code: b.material_code,
      material_name: b.material_name,
      unit: b.unit,
      part_name: b.part_name,
      reason: b.reason,
    })),
    products: bom.products,
    manual_error: manualRes.error,
    need_source:
      needs.length === 0
        ? 'none'
        : needs.some((n) => n.source === 'components')
          ? 'components'
          : 'bom',
  }
}

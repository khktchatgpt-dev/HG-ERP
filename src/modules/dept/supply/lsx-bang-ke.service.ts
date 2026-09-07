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
import { posRepo } from './pos.repo'
import { qtyForLsx } from '@/lib/po-lsx-split'
import { supplyRepo, RECEIVABLE } from './supply.repo'
import { lsxNeedsRepo } from './lsx-needs.repo'
import { pricesRepo } from './prices.repo'
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
  products: {
    id: string
    code: string
    name: string
    qty: number
    bom_confirmed: boolean
    coded_parts: number
  }[]
  /** Số dòng nhập tay đang có. */
  manual_count: number
  /** Bảng nhập tay chưa đọc được (chưa áp migration 0184) — UI nói thẳng, không giấu. */
  manual_error: string | null
  /**
   * Đơn GỘP lệnh này nhưng CHƯA CHIA số (0185) — phần của lệnh đang tính là 0.
   * Phải nói ra: im lặng cho ra 0 thì người xem tưởng chưa ai đặt gì và đặt
   * chồng thêm một đơn nữa.
   */
  unsplit_pos: { po_code: string; lsx_chinh: string | null }[]
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
      kind: l.kind,
      positions: [],
      from_products: [],
    }
    if (l.bom_confirmed) cur.qty_needed += l.qty_needed
    else cur.qty_needed_draft = (cur.qty_needed_draft ?? 0) + l.qty_needed
    // Một mã có thể nằm ở nhiều SP; loại lấy của dòng ĐẦU TIÊN nói được. Cùng
    // một con vít thì mọi hồ sơ đều xếp NGU_KIM, lệch nhau là lỗi nhập ở hồ sơ
    // SP — bảng kê không phải chỗ sửa việc đó.
    cur.kind = cur.kind ?? l.kind
    // Vị trí lắp ráp gộp qua mọi SP, bỏ trùng: cùng một con vít thường bắt vào
    // cùng một chỗ ở nhiều sản phẩm cùng dòng.
    for (const p of l.part_names) {
      if (!cur.positions!.includes(p)) cur.positions!.push(p)
    }
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
      kind: byMat.get(c.material_id)?.kind ?? null,
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
    id: string
    po_id: string
    material_id: string | null
    qty_ordered: unknown
    qty_received?: unknown
  }
  const { data: lineRows } =
    poIds.length > 0
      ? await db()
          .from('supply_po_line_status')
          .select('id, po_id, material_id, qty_ordered, qty_received')
          .in('po_id', poIds)
      : { data: [] as L[] }
  const lines = ((lineRows ?? []) as L[]).filter((l) => l.material_id)
  /*
    CHIA SL THEO LỆNH (0185). Một đơn mua chung cho nhiều lệnh thì mỗi lệnh chỉ
    được tính PHẦN CỦA MÌNH — trước đây cả hai lệnh đều nhận trọn số trên đơn
    (đo trên PO-2026-0065: đơn 1.350 tấm, bảng kê lệnh 08 và 09 đều ghi 1.350),
    nên "còn phải đặt" bị trừ thừa và người mua đặt thiếu.

    Dòng chưa chia = 100% thuộc LSX chính. Với lệnh PHỤ thì phần đó là 0 — và
    đó là lúc phải NÓI RA (chuaChia bên dưới), không im lặng cho ra 0.
  */
  const splits = await posRepo.lineSplitsByPoIds(poIds)
  const chuaChia: { po_code: string; lsx_chinh: string | null }[] = []

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
    const phan = splits.get(l.id) ?? []
    const qtyOrdered = qtyForLsx(lsxId, {
      qty_ordered: Number(l.qty_ordered) || 0,
      main_lsx_id: p.production_order_id ?? null,
      allocations: phan,
    })
    // Tỉ lệ dùng chung cho SL đã nhận: hàng về của một dòng chia cho các lệnh
    // theo đúng tỉ lệ đã chia, không thể chia kiểu khác mà vẫn cộng đủ.
    const tyLe =
      Number(l.qty_ordered) > 0 ? qtyOrdered / (Number(l.qty_ordered) || 1) : 0
    const qtyReceived = (Number(l.qty_received) || 0) * tyLe
    if (
      phan.length === 0 &&
      (p.production_order_id ?? null) !== lsxId &&
      !chuaChia.some((c) => c.po_code === p.code)
    ) {
      chuaChia.push({ po_code: p.code, lsx_chinh: p.lsx_code ?? null })
    }
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
  await enrichRows(rows)
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
    unsplit_pos: chuaChia,
    need_source:
      needs.length === 0
        ? 'none'
        : needs.some((n) => n.source === 'components')
          ? 'components'
          : 'bom',
  }
}

/**
 * BƠM QUY CÁCH + GIÁ MUA GẦN NHẤT vào các dòng bảng kê.
 *
 * Hai thứ này không thuộc phép tính "cần bao nhiêu" nên không nằm trong
 * `buildBangKe` (hàm thuần, có test riêng) — chúng chỉ là dữ kiện tra thêm để
 * người mua khỏi phải mở tab khác: đi hỏi giá cần QUY CÁCH, ước tiền và biết
 * gọi ai cần GIÁ và TÊN NCC của lần mua gần nhất.
 *
 * Hỏng thì NUỐT LỖI: bảng kê vẫn phải mở được khi tra giá lỗi — đây là thông
 * tin phụ, không phải số để mua.
 */
async function enrichRows(rows: BangKeRow[]): Promise<void> {
  const ids = rows.map((r) => r.material_id).filter(Boolean)
  if (ids.length === 0) return
  try {
    const [specs, prices] = await Promise.all([
      db().from('warehouse_materials').select('id, spec, sub_group').in('id', ids),
      pricesRepo.lastPurchases(ids),
    ])
    const infoById = new Map(
      (specs.data ?? []).map((m) => [
        m.id as string,
        {
          spec: (m.spec as string | null) ?? null,
          sub_group: (m.sub_group as string | null) ?? null,
        },
      ]),
    )
    const priceById = new Map(prices.map((p) => [p.material_id, p]))
    for (const r of rows) {
      const info = infoById.get(r.material_id)
      r.spec = info?.spec ?? null
      r.sub_group = info?.sub_group ?? null
      const p = priceById.get(r.material_id)
      r.last_price = p
        ? {
            unit_price: p.unit_price,
            currency: p.currency,
            supplier_id: p.supplier_id,
            supplier_name: p.supplier_name,
            po_code: p.po_code,
            at: p.at,
          }
        : null
    }
  } catch {
    // Không có giá/quy cách thì bảng vẫn dùng được — cột để trống.
  }
}

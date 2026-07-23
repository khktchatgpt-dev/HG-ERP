import {
  stockRepo,
  movementsRepo,
  docsRepo,
  warehousesRepo,
  insertMovements,
  onHandMany,
  stockInfoMany,
  issuedByLsx,
  issuedByLsxIds,
  lsxRemainingByIds,
  lsxNeeds as lsxNeedsRepo,
  stocktakeRepo,
  type LsxNeed,
  type StockRow,
  type DocKind,
} from './stock.repo'
import { componentMaterialNeeds } from '@/modules/dept/production/components.service'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { computeReservedByMaterial } from '@/lib/reserved-stock'
import { materialsRepo } from './warehouse.repo'
import { canViewWarehouse } from './warehouse.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { supplyRepo, RECEIVABLE } from '@/modules/dept/supply/supply.repo'
import { SUPPLY_DEPT_NAMES } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

type ReceiveInput = {
  material_id: string
  qty: number // số ĐẠT vào kho
  qty_rejected?: number
  qc_status?: 'pass' | 'partial' | 'fail'
  ref_type: 'po' | 'external'
  ref_no?: string | null
  shelf_location?: string | null
  note?: string | null
}

type IssueInput = {
  material_id: string
  qty: number
  ref_type: 'lsx' | 'daily'
  ref_no?: string | null
  shelf_location?: string | null
  note?: string | null
}

/**
 * Nhu cầu vật tư LSX — ƯU TIÊN bảng chi tiết nhập tay (plan-lsx-components P3):
 * gộp theo vật tư kèm kg + số cây; qty theo số cây khi có hệ số, không thì kg,
 * không nữa thì số chi tiết — hiển thị tham khảo, người mua tự quyết (không tự
 * trừ). Chưa nhập bảng → fallback BOM×SL (view) như cũ.
 * KHÔNG guard user — dùng ở route needs (mọi NV đọc) lẫn stockService (có guard).
 */
export async function smartLsxNeeds(productionOrderId: string): Promise<LsxNeed[]> {
  const comp = await componentMaterialNeeds(productionOrderId)
  if (!comp) return lsxNeedsRepo(productionOrderId)

  const issued = await issuedByLsx(productionOrderId)
  return comp.map((c) => {
    const qtyNeeded = c.bars_needed ?? c.kg_needed ?? c.total_components
    const qtyIssued = issued.get(c.material_id) ?? 0
    return {
      production_order_id: productionOrderId,
      material_id: c.material_id,
      material_code: c.material_code,
      material_name: c.material_name,
      unit: c.unit,
      qty_needed: qtyNeeded,
      qty_issued: qtyIssued,
      qty_remaining: Math.max(qtyNeeded - qtyIssued, 0),
      kg_needed: c.kg_needed,
      bars_needed: c.bars_needed,
      incomplete: c.incomplete,
      source: 'components' as const,
    }
  })
}

/**
 * Tồn ĐẶT TRƯỚC theo vật tư (bước 2 Kho): Σ nhu cầu còn lại của các LSX đã
 * cam kết (approved|in_progress), tính đúng như smartLsxNeeds nhưng gom bằng
 * 3-4 truy vấn hàng loạt (không lặp N lần theo LSX — chạy được ở hot path
 * màn Tồn kho). Logic gộp thuần nằm ở @/lib/reserved-stock (có test).
 */
export async function reservedByCommittedLsx(
  excludeLsxId?: string,
): Promise<Map<string, number>> {
  const ids = (await productionRepo.listCommittedIds()).filter(
    (id) => id !== excludeLsxId,
  )
  if (ids.length === 0) return new Map()
  const compRows = await componentsRepo.listForReserve(ids)
  const compLsxIds = [...new Set(compRows.map((r) => r.production_order_id))]
  const bomIds = ids.filter((id) => !compLsxIds.includes(id))
  const [issuedRows, bomRows] = await Promise.all([
    issuedByLsxIds(compLsxIds),
    lsxRemainingByIds(bomIds),
  ])
  return computeReservedByMaterial(compRows, issuedRows, bomRows)
}

/**
 * Nhu cầu còn lại của các LSX KHÁC đã cam kết — gộp theo vật tư, để trừ khỏi
 * tồn khả dụng khi đề xuất mua (Cách 2, plan-don-dat-hang §P1). Chỉ giữ các
 * vật tư quan tâm (materialIds của LSX đang lập đơn).
 */
export async function reservedByOtherLsx(
  excludeLsxId: string,
  materialIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (materialIds.length === 0) return out
  const want = new Set(materialIds)
  const all = await reservedByCommittedLsx(excludeLsxId)
  for (const [materialId, qty] of all) {
    if (want.has(materialId)) out.set(materialId, qty)
  }
  return out
}

/** Dòng tồn kho kèm đặt trước/khả dụng (bước 2 Kho). available âm = thiếu cho LSX. */
export type StockRowAvail = StockRow & {
  reserved: number
  available: number
}

export const stockService = {
  async listStock(
    user: User,
    opts: { q?: string; group_name?: string; low_only?: boolean },
  ): Promise<StockRowAvail[]> {
    if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    const [rows, reserved] = await Promise.all([
      stockRepo.list({
        q: opts.q,
        group_name: opts.group_name,
        low_only: opts.low_only ?? false,
      }),
      reservedByCommittedLsx(),
    ])
    return rows.map((r) => {
      const res = reserved.get(r.material_id) ?? 0
      return { ...r, reserved: res, available: r.on_hand - res }
    })
  },

  /** Nhập kho (FR-WMS-02/04). qty = số ĐẠT; qty_rejected (QC không đạt) không vào tồn (BR-10). */
  async receive(user: User, input: ReceiveInput): Promise<{ id: string }> {
    await assertAction(user, 'warehouse.stock.write')
    const mat = await materialsRepo.findById(input.material_id)
    if (!mat) throw NotFound('Vật tư không tồn tại')
    if (!mat.is_active) throw BadRequest('Vật tư đã ngừng sử dụng, không nhập được')

    return movementsRepo.insert({
      material_id: input.material_id,
      direction: 'in',
      qty: input.qty,
      qty_rejected: input.qty_rejected ?? 0,
      qc_status: input.qc_status ?? null,
      ref_type: input.ref_type,
      ref_no: input.ref_no ?? null,
      shelf_location: input.shelf_location ?? mat.shelf_location,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  /** Xuất kho (FR-WMS-05/06). Không cho xuất quá tồn hiện có. */
  async issue(user: User, input: IssueInput): Promise<{ id: string }> {
    await assertAction(user, 'warehouse.stock.write')
    const mat = await materialsRepo.findById(input.material_id)
    if (!mat) throw NotFound('Vật tư không tồn tại')

    const onHand = await stockRepo.onHand(input.material_id)
    if (input.qty > onHand) {
      throw BadRequest(
        `Không đủ tồn để xuất: cần ${input.qty}, còn ${onHand} ${mat.unit}`,
      )
    }

    return movementsRepo.insert({
      material_id: input.material_id,
      direction: 'out',
      qty: input.qty,
      ref_type: input.ref_type,
      ref_no: input.ref_no ?? null,
      shelf_location: input.shelf_location ?? mat.shelf_location,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  async listMovements(
    user: User,
    opts: {
      material_id?: string
      direction?: 'in' | 'out'
      page: number
      page_size: number
    },
  ) {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    return movementsRepo.list({
      material_id: opts.material_id,
      direction: opts.direction,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  // ── Phiếu kho nhiều dòng (0017) ──

  async listDocs(user: User, opts: { kind?: DocKind; page: number; page_size: number }) {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    return docsRepo.list(opts)
  },

  async docDetail(user: User, id: string) {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    const doc = await docsRepo.findById(id)
    if (!doc) throw NotFound('Phiếu không tồn tại')
    const [lines, stocktake_lines] = await Promise.all([
      docsRepo.listLines(id),
      // Phiếu KK: biên bản đầy đủ (mọi dòng đã đếm) — movements chỉ chứa dòng lệch.
      doc.kind === 'stocktake' ? stocktakeRepo.listByDoc(id) : Promise.resolve([]),
    ])
    return { doc, lines, stocktake_lines }
  },

  /** Nhu cầu vật tư còn phải xuất cho 1 LSX (FR-WMS-05 — cần vs đã xuất). */
  async lsxNeeds(user: User, productionOrderId: string): Promise<LsxNeed[]> {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    return smartLsxNeeds(productionOrderId)
  },

  /** Dữ liệu cho form nhập theo đơn: PO đang mở + dòng còn thiếu (FR-WMS-02). */
  async poOptions(user: User) {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    return supplyRepo.listOpenPos()
  },

  async poLines(user: User, poId: string) {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    return supplyRepo.lineStatus(poId)
  },

  /**
   * Lập PHIẾU NHẬP nhiều dòng (PNK — FR-WMS-02/03/04, BR-08/10).
   * Theo PO: gắn po_line_id từng dòng, sau ghi tính lại trạng thái PO
   * (partial/received) từ view sổ cái. Mua ngoài: ref_type 'external'.
   */
  async createReceiptDoc(
    user: User,
    input: {
      po_id?: string | null
      counterparty?: string | null
      note?: string | null
      lines: {
        material_id: string
        qty: number
        qty_rejected?: number
        qc_status?: 'pass' | 'partial' | 'fail' | null
        po_line_id?: string | null
        shelf_location?: string | null
        note?: string | null
      }[]
    },
  ): Promise<{ id: string; code: string; po_status: string | null }> {
    await assertAction(user, 'warehouse.stock.write')
    const matIds = [...new Set(input.lines.map((l) => l.material_id))]
    for (const id of matIds) {
      const mat = await materialsRepo.findById(id)
      if (!mat) throw NotFound('Vật tư không tồn tại')
      if (!mat.is_active) throw BadRequest(`Vật tư "${mat.name}" đã ngừng sử dụng`)
    }
    if (input.po_id && input.lines.some((l) => !l.po_line_id)) {
      throw BadRequest('Nhập theo đơn đặt: mỗi dòng phải gắn dòng PO tương ứng')
    }
    // Guard trạng thái PO (vòng đời theo thực tế): UI chỉ liệt kê PO mở, nhưng
    // API phải tự chặn — PO chưa duyệt / đã huỷ / đã về đủ không nhận hàng được.
    if (input.po_id) {
      const po = await supplyRepo.poStatus(input.po_id)
      if (!po) throw NotFound('Đơn đặt (PO) không tồn tại')
      if (!(RECEIVABLE as readonly string[]).includes(po.status)) {
        throw BadRequest(
          `PO ${po.code} không ở trạng thái nhận hàng được (chưa duyệt, đã huỷ hoặc đã về đủ)`,
        )
      }
    }

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('PNK'),
      warehousesRepo.mainId(),
    ])
    const doc = await docsRepo.insert({
      code,
      kind: 'receipt',
      counterparty: input.counterparty ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
    await insertMovements(
      input.lines.map((l) => ({
        material_id: l.material_id,
        direction: 'in' as const,
        qty: l.qty,
        qty_rejected: l.qty_rejected ?? 0,
        qc_status: l.qc_status ?? null,
        ref_type: l.po_line_id ? 'po' : 'external',
        shelf_location: l.shelf_location ?? null,
        note: l.note ?? null,
        created_by: user.id,
        doc_id: doc.id,
        warehouse_id: warehouseId,
        po_line_id: l.po_line_id ?? null,
      })),
    )

    let poStatus: string | null = null
    let poCode: string | null = null
    if (input.po_id) {
      poStatus = await supplyRepo.refreshStatusFromReceipts(input.po_id)
      poCode = await supplyRepo.findPoCode(input.po_id)
    }

    const managers = (await usersRepo.list()).filter(
      (u) => (u.role === 'admin' || u.role === 'manager') && u.id !== user.id,
    )
    await emit({
      name: 'warehouse.receipt.created',
      doc_id: doc.id,
      code: doc.code,
      po_code: poCode,
      created_by: user.id,
      notify_ids: managers.map((m) => m.id),
    })
    return { id: doc.id, code: doc.code, po_status: poStatus }
  },

  /**
   * Lập PHIẾU XUẤT nhiều dòng (PXK — FR-WMS-05/06, BR-09).
   * Guard tồn từng vật tư; sau xuất kiểm tồn min → emit cảnh báo (FR-WMS-08).
   */
  async createIssueDoc(
    user: User,
    input: {
      kind: 'lsx' | 'daily'
      production_order_id?: string | null
      counterparty?: string | null
      reason?: string | null
      note?: string | null
      lines: {
        material_id: string
        qty: number
        shelf_location?: string | null
        note?: string | null
      }[]
    },
  ): Promise<{ id: string; code: string }> {
    await assertAction(user, 'warehouse.stock.write')
    if (input.kind === 'lsx') {
      if (!input.production_order_id) {
        throw BadRequest('BR-09: xuất theo LSX phải gắn LSX')
      }
      // Guard trạng thái LSX (vòng đời theo thực tế): chỉ xuất vật tư cho LSX
      // đã duyệt / đang sản xuất — chặn chưa duyệt, bị từ chối, hoàn thành, đã huỷ.
      const lsx = await productionRepo.findById(input.production_order_id)
      if (!lsx) throw NotFound('LSX không tồn tại')
      if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
        throw BadRequest(
          `LSX ${lsx.code} không ở trạng thái xuất vật tư được — chỉ xuất cho LSX đã duyệt hoặc đang sản xuất`,
        )
      }
    }

    const need = new Map<string, number>()
    for (const l of input.lines) {
      need.set(l.material_id, (need.get(l.material_id) ?? 0) + l.qty)
    }
    const onHand = await onHandMany([...need.keys()])
    for (const [matId, qty] of need) {
      const have = onHand.get(matId) ?? 0
      if (qty > have) {
        const mat = await materialsRepo.findById(matId)
        throw BadRequest(
          `Không đủ tồn để xuất "${mat?.name ?? matId}": cần ${qty}, còn ${have}`,
        )
      }
    }

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('PXK'),
      warehousesRepo.mainId(),
    ])
    const doc = await docsRepo.insert({
      code,
      kind: 'issue',
      counterparty: input.counterparty ?? null,
      reason: input.reason ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
    await insertMovements(
      input.lines.map((l) => ({
        material_id: l.material_id,
        direction: 'out' as const,
        qty: l.qty,
        ref_type: input.kind,
        shelf_location: l.shelf_location ?? null,
        note: l.note ?? null,
        created_by: user.id,
        doc_id: doc.id,
        warehouse_id: warehouseId,
        production_order_id:
          input.kind === 'lsx' ? (input.production_order_id ?? null) : null,
      })),
    )

    const after = await stockInfoMany([...need.keys()])
    const lows = after.filter((r) => r.on_hand < r.min_stock && r.min_stock > 0)
    await notifyLowStock(user, lows)
    return { id: doc.id, code: doc.code }
  },

  /**
   * Lập PHIẾU KIỂM KÊ (KK — 0077): server đọc lại tồn sổ từng vật tư (không tin
   * client), lưu biên bản đầy đủ; dòng LỆCH sinh movement 'adjust' (in = thừa,
   * out = thiếu) → tồn sau kiểm = số đếm thực tế. Trả về tổng kết chênh lệch.
   */
  async createStocktakeDoc(
    user: User,
    input: {
      reason?: string | null
      note?: string | null
      lines: { material_id: string; counted_qty: number; note?: string | null }[]
    },
  ): Promise<{ id: string; code: string; diff_count: number }> {
    await assertAction(user, 'warehouse.stock.write')
    const matIds = input.lines.map((l) => l.material_id)
    for (const id of matIds) {
      const mat = await materialsRepo.findById(id)
      if (!mat) throw NotFound('Vật tư không tồn tại')
    }
    // Tồn sổ tại thời điểm ghi — vật tư chưa từng có movement thì coi là 0.
    const systemQty = await onHandMany(matIds)

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('KK'),
      warehousesRepo.mainId(),
    ])
    const doc = await docsRepo.insert({
      code,
      kind: 'stocktake',
      reason: input.reason ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })

    const lines = input.lines.map((l) => {
      const system = systemQty.get(l.material_id) ?? 0
      return { ...l, system_qty: system, diff: l.counted_qty - system }
    })
    await stocktakeRepo.insertLines(
      lines.map((l) => ({
        doc_id: doc.id,
        material_id: l.material_id,
        system_qty: l.system_qty,
        counted_qty: l.counted_qty,
        diff: l.diff,
        note: l.note ?? null,
      })),
    )

    const diffs = lines.filter((l) => l.diff !== 0)
    if (diffs.length > 0) {
      await insertMovements(
        diffs.map((l) => ({
          material_id: l.material_id,
          direction: l.diff > 0 ? ('in' as const) : ('out' as const),
          qty: Math.abs(l.diff),
          ref_type: 'adjust',
          note: `Kiểm kê ${doc.code}: sổ ${l.system_qty}, đếm ${l.counted_qty}`,
          created_by: user.id,
          doc_id: doc.id,
          warehouse_id: warehouseId,
        })),
      )
      // Điều chỉnh GIẢM có thể kéo tồn xuống dưới mức tối thiểu → cảnh báo như xuất kho.
      const after = await stockInfoMany(diffs.map((l) => l.material_id))
      await notifyLowStock(
        user,
        after.filter((r) => r.on_hand < r.min_stock && r.min_stock > 0),
      )
    }
    return { id: doc.id, code: doc.code, diff_count: diffs.length }
  },
}

/**
 * FR-WMS-08: cảnh báo tồn dưới mức tối thiểu + đề xuất mua gửi Cung ứng.
 * Người nhận = admin/manager + nhân viên phòng Cung ứng (nhận diện theo
 * department, không có role riêng). KHÔNG loại người gây ra — cứ báo cho tất cả.
 * Dùng chung cho xuất kho và điều chỉnh giảm sau kiểm kê.
 */
async function notifyLowStock(
  user: User,
  lows: {
    material_id: string
    code: string
    name: string
    on_hand: number
    min_stock: number
  }[],
): Promise<void> {
  if (lows.length === 0) return
  const [depts, users] = await Promise.all([departmentsRepo.list(), usersRepo.list()])
  const supplyDeptIds = new Set(
    depts.filter((d) => SUPPLY_DEPT_NAMES.has(d.name)).map((d) => d.id),
  )
  const recipientIds = users
    .filter(
      (u) =>
        u.role === 'admin' ||
        u.role === 'manager' ||
        (u.department_id != null && supplyDeptIds.has(u.department_id)),
    )
    .map((u) => u.id)
  for (const low of lows) {
    await emit({
      name: 'warehouse.stock.low',
      material_id: low.material_id,
      material_code: low.code,
      material_name: low.name,
      on_hand: low.on_hand,
      min_stock: low.min_stock,
      caused_by: user.id,
      notify_ids: recipientIds,
    })
  }
}

import {
  stockRepo,
  movementsRepo,
  docsRepo,
  warehousesRepo,
  insertMovements,
  onHandMany,
  stockInfoMany,
  lsxNeeds as lsxNeedsRepo,
  type DocKind,
} from './stock.repo'
import { materialsRepo } from './warehouse.repo'
import { isWarehouseUser } from './warehouse.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/** Chỉ Kho + admin/manager được ghi phiếu nhập/xuất. */
function canEdit(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

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

export const stockService = {
  async listStock(
    user: User,
    opts: { q?: string; group_name?: string; low_only?: boolean },
  ) {
    if (!(await isWarehouseUser(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    return stockRepo.list({
      q: opts.q,
      group_name: opts.group_name,
      low_only: opts.low_only ?? false,
    })
  },

  /** Nhập kho (FR-WMS-02/04). qty = số ĐẠT; qty_rejected (QC không đạt) không vào tồn (BR-10). */
  async receive(user: User, input: ReceiveInput): Promise<{ id: string }> {
    if (!(await isWarehouseUser(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ quản lý Kho / admin nhập kho được')
    }
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
    if (!(await isWarehouseUser(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ quản lý Kho / admin xuất kho được')
    }
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
    if (!(await isWarehouseUser(user))) throw Forbidden()
    return movementsRepo.list({
      material_id: opts.material_id,
      direction: opts.direction,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  // ── Phiếu kho nhiều dòng (0017) ──

  async listDocs(user: User, opts: { kind?: DocKind; page: number; page_size: number }) {
    if (!(await isWarehouseUser(user))) throw Forbidden()
    return docsRepo.list(opts)
  },

  async docDetail(user: User, id: string) {
    if (!(await isWarehouseUser(user))) throw Forbidden()
    const doc = await docsRepo.findById(id)
    if (!doc) throw NotFound('Phiếu không tồn tại')
    const lines = await docsRepo.listLines(id)
    return { doc, lines }
  },

  /** Nhu cầu vật tư còn phải xuất cho 1 LSX (FR-WMS-05 — cần vs đã xuất). */
  async lsxNeeds(user: User, productionOrderId: string) {
    if (!(await isWarehouseUser(user))) throw Forbidden()
    return lsxNeedsRepo(productionOrderId)
  },

  /** Dữ liệu cho form nhập theo đơn: PO đang mở + dòng còn thiếu (FR-WMS-02). */
  async poOptions(user: User) {
    if (!(await isWarehouseUser(user))) throw Forbidden()
    return supplyRepo.listOpenPos()
  },

  async poLines(user: User, poId: string) {
    if (!(await isWarehouseUser(user))) throw Forbidden()
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
    if (!(await isWarehouseUser(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ quản lý Kho / admin nhập kho được')
    }
    const matIds = [...new Set(input.lines.map((l) => l.material_id))]
    for (const id of matIds) {
      const mat = await materialsRepo.findById(id)
      if (!mat) throw NotFound('Vật tư không tồn tại')
      if (!mat.is_active) throw BadRequest(`Vật tư "${mat.name}" đã ngừng sử dụng`)
    }
    if (input.po_id && input.lines.some((l) => !l.po_line_id)) {
      throw BadRequest('Nhập theo đơn đặt: mỗi dòng phải gắn dòng PO tương ứng')
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
    if (!(await isWarehouseUser(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ quản lý Kho / admin xuất kho được')
    }
    if (input.kind === 'lsx' && !input.production_order_id) {
      throw BadRequest('BR-09: xuất theo LSX phải gắn LSX')
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
    if (lows.length > 0) {
      const managers = (await usersRepo.list()).filter(
        (u) => u.role === 'admin' || u.role === 'manager',
      )
      for (const low of lows) {
        await emit({
          name: 'warehouse.stock.low',
          material_id: low.material_id,
          material_code: low.code,
          material_name: low.name,
          on_hand: low.on_hand,
          min_stock: low.min_stock,
          caused_by: user.id,
          notify_ids: managers.map((m) => m.id),
        })
      }
    }
    return { id: doc.id, code: doc.code }
  },
}

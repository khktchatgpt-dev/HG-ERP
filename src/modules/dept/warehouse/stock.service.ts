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
  bomAllocationByCode,
  stocktakeRepo,
  type LsxNeed,
  type StockRow,
  type DocKind,
  type StocktakeLine,
} from './stock.repo'
import {
  componentAllocationByCode,
  componentMaterialNeeds,
} from '@/modules/dept/production/components.service'
import type { MaterialAllocation } from '@/lib/po-allocation'
import {
  checkReceiptAgainstPo,
  describeOverReceipt,
  withinToleranceNote,
} from '@/lib/po-receipt'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { computeReservedByMaterial } from '@/lib/reserved-stock'
import { materialsRepo } from './warehouse.repo'
import { canViewWarehouse } from './warehouse.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { supplyRepo, RECEIVABLE } from '@/modules/dept/supply/supply.repo'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { SUPPLY_DEPT_NAMES } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

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
 * PHÂN BỔ THEO SẢN PHẨM của từng vật tư (khoá = MÃ VT) — nguồn ghi chú
 * "300 Bàn 65 gỗ (4c/sp)" trên dòng đơn. Ưu tiên bảng chi tiết (cùng nguồn với
 * smartLsxNeeds); lệnh chưa nhập bảng → BOM × SL đơn (cùng nguồn với view).
 */
export async function lsxAllocationByCode(
  productionOrderId: string,
): Promise<Map<string, MaterialAllocation[]>> {
  const comp = await componentAllocationByCode(productionOrderId)
  if (comp.size > 0) return comp
  return bomAllocationByCode(productionOrderId)
}

/**
 * Tồn ĐẶT TRƯỚC theo vật tư (bước 2 Kho): Σ nhu cầu còn lại của các LSX đã
 * cam kết (approved|in_progress), tính đúng như smartLsxNeeds nhưng gom bằng
 * 3-4 truy vấn hàng loạt (không lặp N lần theo LSX — chạy được ở hot path
 * màn Tồn kho). Logic gộp thuần nằm ở @/lib/reserved-stock (có test).
 */
export async function reservedByCommittedLsx(
  excludeLsxIds: string[] = [],
): Promise<Map<string, number>> {
  // Loại NHIỀU lệnh (0125 — một đơn gộp nhiều LSX): tính khả dụng cho một BỘ
  // LSX thì mọi lệnh trong bộ đều không được tự giữ chỗ chống lại chính mình.
  const exclude = new Set(excludeLsxIds)
  const ids = (await productionRepo.listCommittedIds()).filter((id) => !exclude.has(id))
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
  excludeLsxIds: string[],
  materialIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (materialIds.length === 0) return out
  const want = new Set(materialIds)
  const all = await reservedByCommittedLsx(excludeLsxIds)
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
    const [lines, stLines] = await Promise.all([
      docsRepo.listLines(id),
      // Phiếu KK: biên bản đầy đủ (mọi dòng đã đếm) — movements chỉ chứa dòng lệch.
      doc.kind === 'stocktake' ? stocktakeRepo.listByDoc(id) : Promise.resolve([]),
    ])
    /*
     * Biên bản CHỜ DUYỆT (0157): kèm tồn HIỆN TẠI từng dòng — người duyệt phải
     * thấy "lúc đếm lệch bao nhiêu, giờ lệch bao nhiêu" vì chênh sẽ áp theo tồn
     * lúc duyệt, không phải snapshot.
     */
    let stocktake_lines: (StocktakeLine & { current_qty?: number })[] = stLines
    if (doc.kind === 'stocktake' && doc.status === 'pending' && stLines.length > 0) {
      const current = await onHandMany([...new Set(stLines.map((l) => l.material_id))])
      stocktake_lines = stLines.map((l) => ({
        ...l,
        current_qty: current.get(l.material_id) ?? 0,
      }))
    }
    // K1: phiếu này ĐÃ bị đảo chưa — UI ẩn nút đảo + hiện quan hệ hai chiều.
    const reversed_by =
      doc.kind === 'receipt' || doc.kind === 'issue'
        ? await docsRepo.findReversalOf(id)
        : null
    return { doc, lines, stocktake_lines, reversed_by }
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

  /** PO trả hàng NCC được (⑤): đã có hàng về (partial/received) — form phiếu trả. */
  async poReturnOptions(user: User) {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    return supplyRepo.listReturnablePos()
  },

  /**
   * ĐÃ CẤP còn lại (net) của một LSX — prefill form HOÀN KHO (K2): xưởng trả
   * thừa thì chỉ trả được thứ đã lĩnh, tối đa bằng phần đã lĩnh chưa hoàn.
   */
  async lsxIssuedForReturn(
    user: User,
    productionOrderId: string,
  ): Promise<
    { material_id: string; code: string; name: string; unit: string; issued: number }[]
  > {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    const issued = await issuedByLsx(productionOrderId)
    const out: {
      material_id: string
      code: string
      name: string
      unit: string
      issued: number
    }[] = []
    for (const [matId, qty] of issued) {
      if (qty <= 1e-9) continue // đã hoàn hết / chưa từng lĩnh
      const mat = await materialsRepo.findById(matId)
      out.push({
        material_id: matId,
        code: mat?.code ?? '?',
        name: mat?.name ?? '?',
        unit: mat?.unit ?? '',
        issued: qty,
      })
    }
    return out.sort((a, b) => a.code.localeCompare(b.code, 'vi'))
  },

  /**
   * Lập PHIẾU NHẬP nhiều dòng (PNK — FR-WMS-02/03/04, BR-08/10).
   * Theo PO: gắn po_line_id từng dòng, sau ghi tính lại trạng thái PO
   * (partial/received) từ view sổ cái. Mua ngoài: ref_type 'external'.
   * HOÀN KHO TỪ LSX (K2): xưởng dùng không hết trả về — production_order_id
   * gắn từng movement, ref 'lsx'; issuedByLsx (net) tự trừ "đã cấp".
   */
  async createReceiptDoc(
    user: User,
    input: {
      po_id?: string | null
      /** Nhận cho ĐỢT GIAO nào (0153) — null = không theo đợt (flow cũ). */
      shipment_id?: string | null
      /** HOÀN KHO từ LSX (K2) — loại trừ với po_id. */
      production_order_id?: string | null
      counterparty?: string | null
      /** Số phiếu giao / hoá đơn NCC (K3) — đối chiếu 3 chiều. */
      supplier_doc_no?: string | null
      /** Ngày chứng từ (K3) — hàng về chiều tối, sáng sau mới nhập máy. */
      doc_date?: string | null
      note?: string | null
      /** Xác nhận vẫn nhập dù vượt số còn thiếu của đơn (kèm lý do). */
      allow_over?: boolean
      over_reason?: string | null
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
    if (input.po_id && input.production_order_id) {
      throw BadRequest(
        'Một phiếu hoặc nhận từ NCC (theo PO) hoặc hoàn kho từ LSX — không trộn',
      )
    }
    /*
     * HOÀN KHO TỪ LSX (K2): xưởng lĩnh 100 dùng 95 trả 5. Guard: LSX phải đã
     * qua cổng ký (kể cả 'completed' — SX xong mới gom trả thừa là chuyện
     * thường); mỗi vật tư trả ≤ phần ĐÃ CẤP còn lại (net) — trả thứ chưa từng
     * lĩnh là nhập nhầm nguồn, chặn từ cửa.
     */
    if (input.production_order_id) {
      const lsx = await productionRepo.findById(input.production_order_id)
      if (!lsx) throw NotFound('LSX không tồn tại')
      if (!['approved', 'in_progress', 'completed'].includes(lsx.status)) {
        throw BadRequest(`LSX ${lsx.code} chưa qua duyệt / đã huỷ — không có gì để hoàn`)
      }
      if (input.lines.some((l) => l.po_line_id)) {
        throw BadRequest('Phiếu hoàn kho không gắn dòng đơn đặt NCC')
      }
      if (input.lines.some((l) => (l.qty_rejected ?? 0) > 0)) {
        throw BadRequest('Hoàn kho không có khái niệm QC loại — hàng lỗi xử ở xưởng')
      }
      const issued = await issuedByLsx(input.production_order_id)
      const back = new Map<string, number>()
      for (const l of input.lines) {
        back.set(l.material_id, (back.get(l.material_id) ?? 0) + l.qty)
      }
      for (const [matId, qty] of back) {
        const remain = issued.get(matId) ?? 0
        if (qty - remain > 1e-6) {
          const mat = await materialsRepo.findById(matId)
          throw BadRequest(
            `"${mat?.name ?? matId}": hoàn ${qty} nhưng lệnh chỉ còn ghi đã cấp ${remain}`,
          )
        }
      }
    }

    /*
     * ĐỢT GIAO (0153): đợt phải thuộc đúng PO và còn nhận được. Đợt 'received'
     * / 'cancelled' không nhận thêm — nhận bù thì Cung ứng khai đợt mới, để mỗi
     * đợt đối chiếu được trọn vẹn "NCC hứa X, giao Y".
     */
    let shipment: Awaited<ReturnType<typeof poShipmentsRepo.findById>> = null
    if (input.shipment_id) {
      shipment = await poShipmentsRepo.findById(input.shipment_id)
      if (!shipment) throw NotFound('Đợt giao không tồn tại')
      if (shipment.po_id !== input.po_id) {
        throw BadRequest('Đợt giao không thuộc đơn đặt đang chọn')
      }
      if (shipment.status !== 'planned' && shipment.status !== 'arrived') {
        throw BadRequest('Đợt này đã nhận xong / đã huỷ — chọn đợt khác hoặc bỏ chọn đợt')
      }
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
    // Mua ngoài mà vẫn kèm po_line_id: view đối chiếu sẽ ghi có cho một PO nào
    // đó, nhưng không ai tính lại trạng thái của PO ấy — sổ lệch trong im lặng.
    // Chặn thẳng thay vì âm thầm bỏ qua.
    if (!input.po_id && input.lines.some((l) => l.po_line_id)) {
      throw BadRequest(
        'Phiếu mua ngoài không được gắn dòng đơn đặt — chọn PO ở ô "Nguồn nhập"',
      )
    }
    // Guard trạng thái PO (vòng đời theo thực tế): UI chỉ liệt kê PO mở, nhưng
    // API phải tự chặn — PO chưa duyệt / đã huỷ / đã về đủ không nhận hàng được.
    let po: Awaited<ReturnType<typeof supplyRepo.poStatus>> = null
    /** Dòng vượt-trong-dung-sai (0156): po_line_id → note "[Vượt x%...]". */
    let toleranceNotes = new Map<string, string>()
    if (input.po_id) {
      po = await supplyRepo.poStatus(input.po_id)
      if (!po) throw NotFound('Đơn đặt (PO) không tồn tại')
      if (!(RECEIVABLE as readonly string[]).includes(po.status)) {
        throw BadRequest(
          `PO ${po.code} không ở trạng thái nhận hàng được (chưa duyệt, đã huỷ hoặc đã về đủ)`,
        )
      }
      toleranceNotes = await assertReceiptLinesMatchPo(
        input.po_id,
        input.lines,
        input.allow_over ?? false,
      )
    }

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('PNK'),
      warehousesRepo.mainId(),
    ])
    // Ghi vết khi cố ý nhận vượt số còn thiếu — để hậu kiểm đối chiếu với NCC.
    const docNote = input.allow_over
      ? `${input.note ? `${input.note} · ` : ''}[Nhận vượt] ${input.over_reason ?? ''}`.trim()
      : (input.note ?? null)
    const doc = await docsRepo.insert({
      code,
      kind: 'receipt',
      counterparty: input.counterparty ?? null,
      note: docNote,
      shipment_id: shipment?.id ?? null,
      supplier_doc_no: input.supplier_doc_no?.trim() || null,
      ...(input.doc_date ? { doc_date: input.doc_date } : {}),
      created_by: user.id,
    })
    await insertMovements(
      input.lines.map((l) => {
        // Vết dung sai (0156) dán vào note dòng — mỗi movement của dòng PO vượt
        // trong ngưỡng đều mang vết, hậu kiểm không phải cộng tay.
        const tol = l.po_line_id ? toleranceNotes.get(l.po_line_id) : undefined
        return {
          material_id: l.material_id,
          direction: 'in' as const,
          qty: l.qty,
          qty_rejected: l.qty_rejected ?? 0,
          qc_status: l.qc_status ?? null,
          // 'lsx' = HOÀN KHO (K2) — issuedByLsx net trừ lại "đã cấp" của lệnh.
          ref_type: l.po_line_id ? 'po' : input.production_order_id ? 'lsx' : 'external',
          shelf_location: l.shelf_location ?? null,
          note: tol ? `${l.note ? `${l.note} · ` : ''}${tol}` : (l.note ?? null),
          created_by: user.id,
          doc_id: doc.id,
          warehouse_id: warehouseId,
          po_line_id: l.po_line_id ?? null,
          production_order_id: input.production_order_id ?? null,
        }
      }),
    )

    let poStatus: string | null = null
    if (input.po_id) {
      poStatus = await supplyRepo.refreshStatusFromReceipts(input.po_id)
    }

    /*
     * CHỐT ĐỢT (0153): so THỰC NHẬN của phiếu này với SL đợt theo TỪNG DÒNG —
     * mọi dòng nhận đủ → 'received'; thiếu dòng nào → 'arrived' (xe đã tới, Kho
     * đang nhận, phần thiếu chờ NCC giao bù và Cung ứng thấy ngay trên Kế hoạch
     * giao). "Thực nhận" tính cả hàng QC loại — NCC ĐÃ giao số đó, đạt hay loại
     * là chuyện giữa mình với chất lượng, không phải NCC chưa giao (cùng cách
     * đếm với qty_received của supply_po_line_status). Trạng thái PO thì vẫn
     * 100% do refreshStatusFromReceipts ở trên — BR-08 không đổi một ly.
     */
    if (shipment) {
      const receivedByLine = new Map<string, number>()
      for (const l of input.lines) {
        if (!l.po_line_id) continue
        receivedByLine.set(
          l.po_line_id,
          (receivedByLine.get(l.po_line_id) ?? 0) + l.qty + (l.qty_rejected ?? 0),
        )
      }
      const covered = shipment.lines.every(
        (sl) => (receivedByLine.get(sl.po_line_id) ?? 0) >= sl.qty - 1e-4,
      )
      await poShipmentsRepo.patch(shipment.id, {
        status: covered ? 'received' : 'arrived',
      })
    }

    // Người NHẬN tin hàng về: admin/quản lý + NGƯỜI PHỤ TRÁCH đơn (0128). Trước
    // đây chỉ bắn cho admin/manager — người đang ngồi đợi đúng lô hàng này lại
    // là người duy nhất không được báo.
    const managers = (await usersRepo.list()).filter(
      (u) => (u.role === 'admin' || u.role === 'manager') && u.id !== user.id,
    )
    const notifyIds = new Set(managers.map((m) => m.id))
    const ownerId = po?.assigned_to ?? po?.created_by ?? null
    if (ownerId && ownerId !== user.id) notifyIds.add(ownerId)
    await emit({
      name: 'warehouse.receipt.created',
      doc_id: doc.id,
      code: doc.code,
      po_code: po?.code ?? null,
      created_by: user.id,
      notify_ids: [...notifyIds],
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
      /** Ngày chứng từ (K3) — xuất chiều tối, sáng sau mới nhập máy. */
      doc_date?: string | null
      note?: string | null
      /** Xác nhận vẫn xuất dù lấn phần đang giữ cho LSX khác (kèm lý do). */
      override_reserved?: boolean
      override_reason?: string | null
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

    // ── Guard KHẢ DỤNG (bước 2 Kho) ─────────────────────────────────────────
    // Tồn thực tế có thể đang GIỮ cho LSX khác đã cam kết — lấn vào đó là lấy
    // vật tư của xưởng khác. Mặc định chặn 409 RESERVED_CONFLICT; người dùng
    // xác nhận thì gửi lại kèm lý do (ghi vào ghi chú phiếu để hậu kiểm).
    // Xuất cho LSX X: phần giữ của CHÍNH X không tính là bị chiếm.
    if (!input.override_reserved) {
      const reserved = await reservedByCommittedLsx(
        input.kind === 'lsx' && input.production_order_id
          ? [input.production_order_id]
          : [],
      )
      const clashes: { matId: string; qty: number; avail: number; res: number }[] = []
      for (const [matId, qty] of need) {
        const have = onHand.get(matId) ?? 0
        const res = reserved.get(matId) ?? 0
        const avail = have - res
        if (qty > avail) clashes.push({ matId, qty, avail, res })
      }
      if (clashes.length > 0) {
        const named = await Promise.all(
          clashes.map(async (c) => {
            const mat = await materialsRepo.findById(c.matId)
            return `"${mat?.name ?? c.matId}": cần ${c.qty}, khả dụng ${c.avail} (đang giữ ${c.res})`
          }),
        )
        throw Conflict(
          `Vượt tồn khả dụng — phần này đang giữ cho LSX khác: ${named.join('; ')}`,
          'RESERVED_CONFLICT',
        )
      }
    }

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('PXK'),
      warehousesRepo.mainId(),
    ])
    // Ghi vết khi cố ý xuất lấn phần đang giữ — để hậu kiểm ai lấy của ai.
    const note = input.override_reserved
      ? `${input.note ? `${input.note} · ` : ''}[Vượt khả dụng] ${input.override_reason ?? ''}`.trim()
      : (input.note ?? null)
    const doc = await docsRepo.insert({
      code,
      kind: 'issue',
      counterparty: input.counterparty ?? null,
      reason: input.reason ?? null,
      note,
      ...(input.doc_date ? { doc_date: input.doc_date } : {}),
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
   * Lập PHIẾU KIỂM KÊ (KK — 0077, vòng duyệt 0157): server đọc lại tồn sổ từng
   * vật tư (không tin client), lưu biên bản đầy đủ ở trạng thái CHỜ DUYỆT —
   * tồn CHƯA đổi một gam nào. Quản lý Kho duyệt (`approveStocktake`) mới sinh
   * movement 'adjust'; từ chối thì biên bản đóng. system_qty trên dòng là
   * snapshot LÚC ĐẾM — để màn duyệt đối chiếu, không phải số sẽ áp.
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
    // Tồn sổ tại thời điểm ĐẾM — vật tư chưa từng có movement thì coi là 0.
    const systemQty = await onHandMany(matIds)

    const code = await docsRepo.nextCode('KK')
    const doc = await docsRepo.insert({
      code,
      kind: 'stocktake',
      reason: input.reason ?? null,
      note: input.note ?? null,
      status: 'pending',
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

    // Báo người có quyền duyệt — không notify thì biên bản nằm chờ vô danh.
    await notifyStocktake(user, doc.code, 'created')
    const diffs = lines.filter((l) => l.diff !== 0)
    return { id: doc.id, code: doc.code, diff_count: diffs.length }
  },

  /**
   * DUYỆT KIỂM KÊ (0157): áp số đếm như SỰ THẬT TUYỆT ĐỐI — chênh áp = số đếm −
   * tồn HIỆN TẠI (không phải snapshot lúc đếm: tồn có thể đã trôi vì phiếu
   * nhập/xuất chen giữa; áp theo snapshot là ghi đè các phiếu đó). Chặn TỰ DUYỆT
   * biên bản mình lập (trừ admin) — hai con dấu là nghĩa của vòng duyệt.
   */
  async approveStocktake(
    user: User,
    docId: string,
  ): Promise<{ code: string; applied: number }> {
    await assertAction(user, 'warehouse.stocktake.approve')
    const doc = await docsRepo.findById(docId)
    if (!doc) throw NotFound('Biên bản không tồn tại')
    if (doc.kind !== 'stocktake') throw BadRequest('Chỉ biên bản kiểm kê có vòng duyệt')
    if (doc.status !== 'pending') {
      throw BadRequest(
        doc.status === 'posted' ? 'Biên bản đã áp sổ rồi' : 'Biên bản đã bị từ chối',
      )
    }
    if (user.role !== 'admin' && doc.created_by === user.id) {
      throw Forbidden('Không tự duyệt biên bản mình lập — nhờ quản lý Kho khác')
    }

    const lines = await stocktakeRepo.listByDoc(docId)
    const matIds = [...new Set(lines.map((l) => l.material_id))]
    const [current, warehouseId] = await Promise.all([
      onHandMany(matIds),
      warehousesRepo.mainId(),
    ])
    const adjusts = lines
      .map((l) => {
        const now = current.get(l.material_id) ?? 0
        return { ...l, now, apply: l.counted_qty - now }
      })
      .filter((l) => Math.abs(l.apply) > 1e-9)
    if (adjusts.length > 0) {
      await insertMovements(
        adjusts.map((l) => ({
          material_id: l.material_id,
          direction: l.apply > 0 ? ('in' as const) : ('out' as const),
          qty: Math.abs(l.apply),
          ref_type: 'adjust',
          note: `Kiểm kê ${doc.code}: đếm ${l.counted_qty}, sổ lúc duyệt ${l.now}${
            l.now !== l.system_qty ? ` (lúc đếm ${l.system_qty})` : ''
          }`,
          created_by: user.id,
          doc_id: doc.id,
          warehouse_id: warehouseId,
        })),
      )
    }
    await docsRepo.patchStatus(docId, {
      status: 'posted',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    // Điều chỉnh GIẢM có thể kéo tồn xuống dưới mức tối thiểu → cảnh báo như xuất kho.
    if (adjusts.length > 0) {
      const after = await stockInfoMany(adjusts.map((l) => l.material_id))
      await notifyLowStock(
        user,
        after.filter((r) => r.on_hand < r.min_stock && r.min_stock > 0),
      )
    }
    if (doc.created_by && doc.created_by !== user.id) {
      await notifyStocktake(user, doc.code, 'approved', doc.created_by)
    }
    return { code: doc.code, applied: adjusts.length }
  },

  /** Từ chối biên bản kiểm kê (0157) — bắt lý do, tồn không đụng. */
  async rejectStocktake(user: User, docId: string, reason: string): Promise<void> {
    await assertAction(user, 'warehouse.stocktake.approve')
    const doc = await docsRepo.findById(docId)
    if (!doc) throw NotFound('Biên bản không tồn tại')
    if (doc.kind !== 'stocktake' || doc.status !== 'pending') {
      throw BadRequest('Chỉ từ chối được biên bản kiểm kê đang chờ duyệt')
    }
    if (user.role !== 'admin' && doc.created_by === user.id) {
      throw Forbidden('Không tự xử biên bản mình lập — nhờ quản lý Kho khác')
    }
    if (!reason.trim()) throw BadRequest('Từ chối phải kèm lý do')
    await docsRepo.patchStatus(docId, {
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      reject_reason: reason.trim(),
    })
    if (doc.created_by && doc.created_by !== user.id) {
      await notifyStocktake(user, doc.code, 'rejected', doc.created_by, reason.trim())
    }
  },

  /**
   * PHIẾU TRẢ HÀNG NCC (⑤, 0080): hàng đã nhập kho rồi mới phát hiện lỗi →
   * xuất trả. Là phiếu xuất 02-VT bình thường, mỗi dòng gắn po_line_id với
   * direction='out' — view đối chiếu TRỪ vào "đã về" → PO received quay lại
   * partial (NCC giao bù). Guard: PO phải đã có hàng về; trả ≤ số đã về;
   * trả ≤ tồn hiện có.
   */
  async createReturnDoc(
    user: User,
    input: {
      po_id: string
      reason: string
      note?: string | null
      lines: {
        material_id: string
        po_line_id: string
        qty: number
        note?: string | null
      }[]
    },
  ): Promise<{ id: string; code: string; po_status: string | null }> {
    await assertAction(user, 'warehouse.stock.write')
    const po = await supplyRepo.poStatus(input.po_id)
    if (!po) throw NotFound('Đơn đặt (PO) không tồn tại')
    if (po.status !== 'partial' && po.status !== 'received') {
      throw BadRequest(`PO ${po.code} chưa có hàng về — không có gì để trả NCC`)
    }

    // Trả ≤ số đã về của từng dòng (view 0080 đã trừ các lần trả trước).
    const status = await supplyRepo.lineStatus(input.po_id)
    const receivedByLine = new Map(status.map((l) => [l.id, l]))
    for (const l of input.lines) {
      const line = receivedByLine.get(l.po_line_id)
      if (!line) throw BadRequest('Có dòng không thuộc PO này')
      if (line.material_id !== l.material_id) {
        throw BadRequest('Dòng trả không khớp vật tư của dòng PO')
      }
      if (l.qty > line.qty_received) {
        throw BadRequest(
          `"${line.material_name}": trả ${l.qty} vượt số đã về (${line.qty_received})`,
        )
      }
    }
    // Và ≤ tồn hiện có (hàng có thể đã xuất cho sản xuất).
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
          `Không đủ tồn để trả "${mat?.name ?? matId}": cần ${qty}, còn ${have}`,
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
      counterparty: null,
      reason: `Trả hàng NCC — ${po.code}: ${input.reason}`,
      note: input.note ?? null,
      created_by: user.id,
    })
    await insertMovements(
      input.lines.map((l) => ({
        material_id: l.material_id,
        direction: 'out' as const,
        qty: l.qty,
        ref_type: 'po', // out + po_line_id = trả NCC (nhập theo PO luôn là in)
        note: l.note ?? null,
        created_by: user.id,
        doc_id: doc.id,
        warehouse_id: warehouseId,
        po_line_id: l.po_line_id,
      })),
    )
    const poStatus = await supplyRepo.refreshStatusFromReceipts(input.po_id)

    const managers = (await usersRepo.list()).filter(
      (u) => (u.role === 'admin' || u.role === 'manager') && u.id !== user.id,
    )
    await emit({
      name: 'warehouse.return.created',
      doc_id: doc.id,
      code: doc.code,
      po_code: po.code,
      reason: input.reason,
      created_by: user.id,
      notify_ids: managers.map((m) => m.id),
    })
    return { id: doc.id, code: doc.code, po_status: poStatus }
  },

  /**
   * PHIẾU ĐẢO (0161 — plan-kho-nhap-xuat-go-live K1): gõ nhầm 1.000 thay vì
   * 100 thì KHÔNG sửa đè, KHÔNG xoá — lập phiếu ghi NGƯỢC toàn bộ movement của
   * phiếu gốc, kèm lý do. Đảo PNK sinh phiếu kind 'issue' (mã PXK) và ngược
   * lại — đúng bản chất sổ, không thêm kind mới. Movement đảo giữ nguyên
   * po_line_id / production_order_id nên mọi view đối chiếu (tồn,
   * supply_po_line_status BR-08, issuedByLsx net K2) tự đúng, không sửa view.
   *
   * Luật:
   *  - Chỉ phiếu receipt/issue đã posted; mỗi phiếu đảo MỘT lần; phiếu đảo
   *    không đảo tiếp (sai nữa thì lập phiếu thường).
   *  - Phiếu có QC LOẠI (qty_rejected > 0) KHÔNG đảo tự động: phần loại nằm
   *    trong đối chiếu "NCC đã giao" (BR-08) nhưng chưa từng vào tồn — đảo máy
   *    móc là lệch một trong hai sổ. Ca hiếm này xử bằng phiếu trả NCC.
   *  - Đảo PNK mà hàng đã xuất đi (tồn không đủ) → 409 nói rõ thiếu bao nhiêu.
   *  - PNK theo PO: refresh trạng thái đơn (received quay partial), đợt 0153
   *    đã 'received' quay 'arrived'. Notify quản lý Kho + owner đơn.
   */
  async reverseDoc(
    user: User,
    docId: string,
    reason: string,
  ): Promise<{ id: string; code: string }> {
    await assertAction(user, 'warehouse.stock.write')
    if (!reason.trim()) throw BadRequest('Đảo phiếu phải kèm lý do')
    const doc = await docsRepo.findById(docId)
    if (!doc) throw NotFound('Phiếu không tồn tại')
    if (doc.kind !== 'receipt' && doc.kind !== 'issue') {
      throw BadRequest(
        'Chỉ đảo được phiếu nhập / phiếu xuất — kiểm kê có vòng duyệt riêng',
      )
    }
    if (doc.status !== 'posted') throw BadRequest('Phiếu chưa áp sổ — không có gì để đảo')
    if (doc.reversal_of_doc_id) {
      throw BadRequest('Đây là phiếu đảo — sai nữa thì lập phiếu nhập/xuất thường')
    }
    const existing = await docsRepo.findReversalOf(docId)
    if (existing) {
      throw BadRequest(`Phiếu đã được đảo bởi ${existing.code} — không đảo lần hai`)
    }
    const lines = await docsRepo.listLines(docId)
    if (lines.length === 0) throw BadRequest('Phiếu không có dòng nào')
    if (lines.some((l) => (l.qty_rejected ?? 0) > 0)) {
      throw BadRequest(
        'Phiếu có hàng QC loại — không đảo tự động được (phần loại đã vào đối chiếu NCC nhưng chưa vào tồn). Xử bằng phiếu trả NCC.',
      )
    }

    // Đảo PNK = xuất hàng ra — hàng phải còn trong kho.
    if (doc.kind === 'receipt') {
      const need = new Map<string, number>()
      for (const l of lines)
        need.set(l.material_id, (need.get(l.material_id) ?? 0) + l.qty)
      const onHand = await onHandMany([...need.keys()])
      const misses: string[] = []
      for (const [matId, qty] of need) {
        const have = onHand.get(matId) ?? 0
        if (qty > have) {
          const mat = await materialsRepo.findById(matId)
          misses.push(`"${mat?.name ?? matId}": cần đảo ${qty}, tồn còn ${have}`)
        }
      }
      if (misses.length > 0) {
        throw Conflict(
          `Hàng của phiếu này đã xuất đi — thu hồi trước rồi mới đảo được: ${misses.join('; ')}`,
          'REVERSAL_STOCK_SHORT',
        )
      }
    }

    const reverseKind = doc.kind === 'receipt' ? ('issue' as const) : ('receipt' as const)
    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode(reverseKind === 'receipt' ? 'PNK' : 'PXK'),
      warehousesRepo.mainId(),
    ])
    const rev = await docsRepo.insert({
      code,
      kind: reverseKind,
      reason: `Đảo ${doc.code}: ${reason.trim()}`,
      reversal_of_doc_id: doc.id,
      created_by: user.id,
    })
    await insertMovements(
      lines.map((l) => ({
        material_id: l.material_id,
        direction: (l.direction === 'in' ? 'out' : 'in') as 'in' | 'out',
        qty: l.qty,
        // ref 'adjust': đây là bút toán sửa sổ, không phải nghiệp vụ nhận/cấp mới.
        ref_type: 'adjust',
        shelf_location: l.shelf_location ?? null,
        note: `Đảo ${doc.code}`,
        created_by: user.id,
        doc_id: rev.id,
        warehouse_id: warehouseId,
        po_line_id: l.po_line_id ?? null,
        production_order_id: l.production_order_id ?? null,
      })),
    )

    // Phiếu gốc dính PO → trạng thái đơn + đợt giao phải lùi theo sự thật mới.
    const poLineIds = [
      ...new Set(lines.map((l) => l.po_line_id).filter((x): x is string => x != null)),
    ]
    let poOwnerId: string | null = null
    if (poLineIds.length > 0) {
      const poIds = await supplyRepo.poIdsByLineIds(poLineIds)
      for (const poId of poIds) {
        await supplyRepo.refreshStatusFromReceipts(poId)
        const po = await supplyRepo.poStatus(poId)
        poOwnerId = po?.assigned_to ?? po?.created_by ?? poOwnerId
      }
    }
    if (doc.kind === 'receipt') {
      const shipment = await docsRepo.findShipmentId(docId)
      if (shipment) {
        const s = await poShipmentsRepo.findById(shipment)
        if (s?.status === 'received') {
          await poShipmentsRepo.patch(s.id, { status: 'arrived' })
        }
      }
    }

    const [users, editIds] = await Promise.all([
      usersRepo.list(),
      rbacRepo.userIdsWithPermission('warehouse.edit'),
    ])
    const notifyIds = new Set(editIds)
    for (const u of users) {
      if (u.role === 'admin' || u.role === 'manager') notifyIds.add(u.id)
    }
    if (poOwnerId) notifyIds.add(poOwnerId)
    notifyIds.delete(user.id)
    await emit({
      name: 'warehouse.doc.reversed',
      original_code: doc.code,
      reversal_code: rev.code,
      reason: reason.trim(),
      reversed_by: user.id,
      notify_ids: [...notifyIds],
    })
    return rev
  },
}

/**
 * Đối chiếu dòng phiếu nhập với dòng PO — logic thuần + test ở
 * `@/lib/po-receipt`, ở đây chỉ dịch kết quả ra lỗi HTTP.
 *
 * Vượt số còn thiếu là 409 chứ không phải 400: NCC giao dư vài cây là chuyện có
 * thật, người nhận xác nhận kèm lý do thì vẫn ghi được — cùng lối với
 * RESERVED_CONFLICT của phiếu xuất, không bắt người dùng đi cửa sau.
 */
async function assertReceiptLinesMatchPo(
  poId: string,
  lines: {
    material_id: string
    qty: number
    qty_rejected?: number
    po_line_id?: string | null
  }[],
  allowOver: boolean,
): Promise<Map<string, string>> {
  const poLines = await supplyRepo.lineStatus(poId)
  /*
   * Chỉ đối chiếu với DÒNG VẬT TƯ KHO. Dòng tự do (material_id null — 0134)
   * nghiệm thu ngoài sổ, không nhận qua PNK: phiếu trỏ vào dòng tự do sẽ rơi
   * vào 'unknown_line' — đúng ý, chặn từ cửa.
   */
  const stockLines = poLines.filter(
    (l): l is (typeof poLines)[number] & { material_id: string } => l.material_id != null,
  )
  const check = checkReceiptAgainstPo(lines, stockLines)
  if (!check.ok) {
    throw BadRequest(
      check.reason === 'unknown_line'
        ? 'Có dòng không thuộc đơn đặt này — chọn lại nguồn nhập rồi lấy lại dòng hàng'
        : `Dòng nhập không khớp vật tư của dòng PO ("${check.po_line.material_name}")`,
    )
  }
  if (!allowOver && check.over.length > 0) {
    throw Conflict(
      `Nhận vượt số còn thiếu của đơn — ${describeOverReceipt(check.over)}`,
      'OVER_RECEIPT',
    )
  }
  // Vượt TRONG DUNG SAI (0156): cho qua nhưng ghi vết vào note từng dòng —
  // caller dán vào movement để hậu kiểm biết lệch bao nhiêu mà không cần hỏi ai.
  return new Map(check.within.map((w) => [w.po_line_id, withinToleranceNote(w)]))
}

/**
 * Vòng duyệt kiểm kê (0157): lập → báo người có quyền duyệt (admin/quản lý +
 * người Kho có quyền edit — cùng tập với rule của action approve); duyệt/từ
 * chối → báo đích danh người lập.
 */
async function notifyStocktake(
  actor: User,
  code: string,
  event: 'created' | 'approved' | 'rejected',
  recipientId?: string,
  reason?: string,
): Promise<void> {
  if (event === 'created') {
    const [users, editIds] = await Promise.all([
      usersRepo.list(),
      rbacRepo.userIdsWithPermission('warehouse.edit'),
    ])
    const ids = new Set(editIds)
    for (const u of users) {
      if (u.role === 'admin' || u.role === 'manager') ids.add(u.id)
    }
    ids.delete(actor.id) // người lập không cần được báo về chính mình
    if (ids.size === 0) return
    await emit({
      name: 'warehouse.stocktake.pending',
      code,
      created_by: actor.id,
      notify_ids: [...ids],
    })
    return
  }
  if (!recipientId) return
  await emit({
    name: 'warehouse.stocktake.decided',
    code,
    decision: event,
    decided_by: actor.id,
    recipient_id: recipientId,
    reason,
  })
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

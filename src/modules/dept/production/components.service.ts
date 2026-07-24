import { componentsRepo, type ComponentInput, type ComponentRow } from './components.repo'
import { entriesRepo } from './entries.repo'
import { jobsRepo } from './jobs.repo'
import { productionRepo } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { bomLinesRepo, productsRepo } from '@/modules/dept/technical/technical.repo'
import { canEditComponents } from './perms'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import {
  aggregateMaterialNeeds,
  calcComponent,
  type MaterialNeed,
} from '@/lib/component-needs'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'

/**
 * BẢNG ĐỊNH HÌNH chi tiết theo LSX (vai THỐNG KÊ xưởng — user chốt 07/2026):
 * nháp từ BOM Kỹ thuật trong hệ → thống kê sửa → chốt SNAPSHOT per lệnh
 * (sửa BOM sau không đổi lệnh đang chạy). Đại lượng dẫn xuất tính ở service
 * (src/lib/component-needs.ts).
 */

// Guard nằm ở perms.ts (dùng chéo với access.ts không vòng import).
export { canEditComponents }

export type ComponentOrderLine = {
  id: string
  product_id: string
  product_code: string
  product_name: string
  qty: number
}

async function lsxWithLines(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  const orderLines = await ordersRepo.listLines(lsx.sales_order_id)
  const lines: ComponentOrderLine[] = orderLines.map((l) => ({
    id: l.id,
    product_id: l.product_id,
    product_code: l.product_code,
    product_name: l.product_name,
    qty: l.qty,
  }))
  return { lsx, orderLines: lines }
}

/** Lộ trình per dòng SP từ kế hoạch (jobs theo seq) — thay bảng routes cũ. */
async function jobStagesByLine(lsxId: string): Promise<Map<string, string[]>> {
  const jobs = await jobsRepo.listByLsx(lsxId)
  const map = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = map.get(j.order_line_id) ?? []
    arr.push(j.stage)
    map.set(j.order_line_id, arr)
  }
  return map
}

export const componentsService = {
  /** Đọc: mọi NV đã đăng nhập (xưởng xem việc phải làm, kho/GĐ tra cứu). */
  async list(_user: User, lsxId: string) {
    const { lsx, orderLines } = await lsxWithLines(lsxId)
    const [lines, lockedByEntries] = await Promise.all([
      componentsRepo.listByLsx(lsxId),
      // Báo TRƯỚC cho UI khoá bảng (banner) thay vì để người nhập bấm Lưu rồi
      // mới ăn 400 — save vẫn chặn ở dưới làm lớp cuối.
      entriesRepo.existsForLsx(lsxId),
    ])
    return {
      lsx_status: lsx.status,
      locked_by_entries: lockedByEntries,
      order_lines: orderLines,
      lines,
    }
  },

  /** Ghi đè trọn bộ bảng định hình (pattern BOM editor). */
  async save(user: User, lsxId: string, input: ComponentInput[]): Promise<void> {
    await assertAction(user, 'production.shaping.manage')
    const { lsx, orderLines } = await lsxWithLines(lsxId)
    if (lsx.status === 'completed' || lsx.status === 'cancelled') {
      throw BadRequest('LSX đã kết thúc — bảng định hình chỉ còn để tra cứu')
    }
    // Đã có sổ số liệu → ghi đè bảng sẽ cascade mất sổ. Chốt bảng trước khi
    // nhập sổ; sai thì xoá hết bản ghi sổ trước.
    if (await entriesRepo.existsForLsx(lsxId)) {
      throw BadRequest(
        'LSX đã có sổ số liệu — không ghi đè bảng định hình được (xoá sổ trước nếu thật sự cần sửa)',
      )
    }
    const validLineIds = new Set(orderLines.map((l) => l.id))
    for (const l of input) {
      if (!validLineIds.has(l.order_line_id)) {
        throw BadRequest('Có dòng chi tiết gắn vào dòng SP không thuộc lệnh này')
      }
    }
    // Công đoạn cuối per chi tiết phải thuộc kế hoạch dòng SP (nếu đã lên KH)
    // — nếu lọt, %HT của chi tiết không bao giờ đạt vì sổ chặn công đoạn đó.
    const stagesByLine = await jobStagesByLine(lsxId)
    for (const l of input) {
      const allowed = stagesByLine.get(l.order_line_id)
      if (allowed && l.final_stage && !allowed.includes(l.final_stage)) {
        throw BadRequest(
          `Chi tiết "${l.name}": công đoạn cuối không thuộc kế hoạch của SP — đổi công đoạn cuối hoặc sửa kế hoạch trước`,
        )
      }
    }
    await componentsRepo.replaceAll(lsxId, input)
  },

  /**
   * LƯU NGƯỢC bảng định hình của 1 dòng SP thành BOM KỸ THUẬT của SP (user
   * chốt 07/2026: thống kê tự tạo BOM từ định hình — lần sau "Gợi ý từ BOM"
   * là có sẵn). Chỉ dòng có VẬT TƯ mới lên BOM (BOM = định mức vật tư/SP);
   * nhiều chi tiết cùng vật tư được GỘP (unique product×material), ghi chú
   * giữ tên chi tiết để truy ngược. GHI ĐÈ BOM hiện có — UI phải confirm.
   */
  async saveAsBom(
    user: User,
    lsxId: string,
    orderLineId: string,
  ): Promise<{ product_code: string; bom_lines: number; skipped_no_material: number }> {
    await assertAction(user, 'production.shaping.manage')
    const { orderLines } = await lsxWithLines(lsxId)
    const line = orderLines.find((l) => l.id === orderLineId)
    if (!line) throw BadRequest('Dòng SP không thuộc lệnh này')

    const comps = (await componentsRepo.listByLsx(lsxId)).filter(
      (c) => c.order_line_id === orderLineId,
    )
    if (comps.length === 0) {
      throw BadRequest('SP chưa có dòng chi tiết nào — nhập bảng định hình trước')
    }
    const withMat = comps.filter((c) => c.material_id)
    if (withMat.length === 0) {
      throw BadRequest(
        'Chưa dòng nào gắn vật tư — BOM là định mức vật tư/SP, gắn vật tư trước khi lưu làm BOM',
      )
    }

    // Gộp theo vật tư: qty_per_unit = Σ CT/SP; note = các chi tiết dùng nó.
    const byMat = new Map<string, { qty: number; names: string[] }>()
    for (const c of withMat) {
      const cur = byMat.get(c.material_id!) ?? { qty: 0, names: [] }
      cur.qty += Number(c.qty_per_unit)
      cur.names.push(`${c.name} ×${c.qty_per_unit}`)
      byMat.set(c.material_id!, cur)
    }
    await bomLinesRepo.replaceAll(
      line.product_id,
      [...byMat.entries()].map(([material_id, v]) => ({
        material_id,
        qty_per_unit: v.qty,
        note: `Từ định hình LSX: ${v.names.join(', ')}`,
      })),
    )
    // BOM giờ đã có thật → cờ SP sang 'done' (đầu vào cảnh báo BR-07).
    await productsRepo.patch(line.product_id, { bom_status: 'done' })
    return {
      product_code: line.product_code,
      bom_lines: byMat.size,
      skipped_no_material: comps.length - withMat.length,
    }
  },

  /**
   * Gợi ý điền sẵn — KHÔNG ghi DB, trả dòng cho grid để thống kê sửa:
   *  - 'bom': từ BOM kỹ thuật trong hệ của từng SP (nguồn chính — user chốt).
   *  - 'previous': chép bảng từ LSX gần nhất có cùng SP (SP lặp lại nhiều lệnh).
   */
  async suggest(
    user: User,
    lsxId: string,
    source: 'bom' | 'previous',
  ): Promise<ComponentInput[]> {
    await assertAction(user, 'production.shaping.manage')
    const { orderLines } = await lsxWithLines(lsxId)

    if (source === 'bom') {
      const out: ComponentInput[] = []
      for (const line of orderLines) {
        const bom = await bomLinesRepo.listWithMaterials(line.product_id)
        for (const b of bom) {
          out.push({
            order_line_id: line.id,
            cluster: null,
            name: b.material_name, // tên tạm — người nhập đổi thành tên chi tiết
            material_id: b.material_id,
            qty_per_unit: b.qty_per_unit,
            dm_kg: null,
            pcs_per_bar: null,
            note: b.note ?? null,
          })
        }
      }
      return out
    }

    // 'previous': lấy bảng của LSX MỚI NHẤT có chứa SP tương ứng, remap sang
    // dòng đơn hiện tại theo product_id.
    const productIds = [...new Set(orderLines.map((l) => l.product_id))]
    const prev = await componentsRepo.listPreviousByProducts(productIds, lsxId)
    const lineByProduct = new Map(orderLines.map((l) => [l.product_id, l.id]))
    // Hàng đã sort created_at desc — LSX đầu tiên gặp per product là mới nhất.
    const pickedLsxByProduct = new Map<string, string>()
    const out: ComponentInput[] = []
    for (const row of prev) {
      if (!row.product_id) continue
      const targetLineId = lineByProduct.get(row.product_id)
      if (!targetLineId) continue
      const picked = pickedLsxByProduct.get(row.product_id)
      if (picked && picked !== row.production_order_id) continue
      pickedLsxByProduct.set(row.product_id, row.production_order_id)
      out.push({
        order_line_id: targetLineId,
        cluster: row.cluster,
        name: row.name,
        material_id: row.material_id,
        material_type: row.material_type,
        spec_thickness_mm: row.spec_thickness_mm,
        spec_width_mm: row.spec_width_mm,
        spec_length_mm: row.spec_length_mm,
        qty_per_unit: row.qty_per_unit,
        dm_kg: row.dm_kg,
        pcs_per_bar: row.pcs_per_bar,
        final_stage: row.final_stage,
        note: row.note,
      })
    }
    return out
  },
}

export type ComponentMaterialNeed = MaterialNeed & {
  material_code: string
  material_name: string
  unit: string
}

/**
 * Nhu cầu vật tư GỘP từ bảng định hình của LSX — null nếu lệnh chưa nhập bảng
 * (caller fallback BOM×SL). KHÔNG guard user — hàm nội bộ cho
 * stockService.lsxNeeds (đã guard ở đó).
 */
export async function componentMaterialNeeds(
  lsxId: string,
): Promise<ComponentMaterialNeed[] | null> {
  const rows = await componentsRepo.listByLsx(lsxId)
  if (rows.length === 0) return null
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  const orderLines = await ordersRepo.listLines(lsx.sales_order_id)
  const qtyByLine = new Map(orderLines.map((l) => [l.id, l.qty]))

  const agg = aggregateMaterialNeeds(
    rows.map((r) => ({
      material_id: r.material_id,
      calc: calcComponent(
        { qty_per_unit: r.qty_per_unit, dm_kg: r.dm_kg, pcs_per_bar: r.pcs_per_bar },
        qtyByLine.get(r.order_line_id) ?? 0,
      ),
    })),
  )
  const infoByMat = new Map(
    rows
      .filter((r) => r.material_id)
      .map((r) => [
        r.material_id as string,
        {
          code: r.material_code ?? '?',
          name: r.material_name ?? '?',
          unit: r.material_unit ?? '',
        },
      ]),
  )
  return agg.map((a) => ({
    ...a,
    material_code: infoByMat.get(a.material_id)?.code ?? '?',
    material_name: infoByMat.get(a.material_id)?.name ?? '?',
    unit: infoByMat.get(a.material_id)?.unit ?? '',
  }))
}

export type { ComponentRow }

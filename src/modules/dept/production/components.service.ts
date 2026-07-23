import { componentsRepo, type ComponentInput, type ComponentRow } from './components.repo'
import { outputsRepo } from './outputs.repo'
import { productionRepo } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { bomLinesRepo } from '@/modules/dept/technical/technical.repo'
import { canEditComponents } from './perms'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { routesService } from './routes.service'
import {
  aggregateMaterialNeeds,
  calcComponent,
  type MaterialNeed,
} from '@/lib/component-needs'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'

/**
 * Bảng chi tiết theo LSX (plan-lsx-components P1). Nguyên tắc: NHẬP TAY bởi
 * Kế hoạch (phòng KH-CƯ) — BOM kỹ thuật/lệnh trước chỉ là nguồn GỢI Ý điền
 * sẵn; snapshot per lệnh, không tham chiếu sống vào BOM.
 */

// Guard định hình nằm ở perms.ts (tránh vòng import với routes.service);
// re-export để caller cũ (access.ts, shaping pages) không phải đổi.
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

export const componentsService = {
  /** Đọc: mọi NV đã đăng nhập (xưởng xem chi tiết phải làm, kho/GĐ tra cứu). */
  async list(_user: User, lsxId: string) {
    const { lsx, orderLines } = await lsxWithLines(lsxId)
    const [lines, lockedByOutputs] = await Promise.all([
      componentsRepo.listByLsx(lsxId),
      // Báo TRƯỚC cho UI khoá bảng (banner) thay vì để người nhập bấm Lưu rồi
      // mới ăn 400 — save vẫn chặn ở dưới làm lớp cuối.
      outputsRepo.existsForLsx(lsxId),
    ])
    return {
      lsx_status: lsx.status,
      locked_by_outputs: lockedByOutputs,
      order_lines: orderLines,
      lines,
    }
  },

  /** Ghi đè trọn bộ bảng chi tiết (pattern BOM editor). */
  async save(user: User, lsxId: string, input: ComponentInput[]): Promise<void> {
    await assertAction(user, 'production.components.edit')
    const { lsx, orderLines } = await lsxWithLines(lsxId)
    if (lsx.status === 'completed' || lsx.status === 'cancelled') {
      throw BadRequest('LSX đã kết thúc — bảng chi tiết chỉ còn để tra cứu')
    }
    // Đã có sổ sản lượng → ghi đè bảng chi tiết sẽ cascade mất sổ (0039). Chốt
    // bảng trước khi nhập sản lượng; sai thì xoá hết bản ghi sản lượng trước.
    if (await outputsRepo.existsForLsx(lsxId)) {
      throw BadRequest(
        'LSX đã có sản lượng — không ghi đè bảng chi tiết được (xoá sổ sản lượng trước nếu thật sự cần sửa)',
      )
    }
    const validLineIds = new Set(orderLines.map((l) => l.id))
    for (const l of input) {
      if (!validLineIds.has(l.order_line_id)) {
        throw BadRequest('Có dòng chi tiết gắn vào dòng SP không thuộc lệnh này')
      }
    }
    // Công đoạn cuối per chi tiết (0041) phải thuộc lộ trình đã chốt (0063) —
    // nếu lọt, %HT của chi tiết không bao giờ đạt vì sổ chặn nhập giai đoạn đó.
    const allowedByLine = await routesService.allowedStagesByLine(lsxId)
    for (const l of input) {
      const allowed = allowedByLine.get(l.order_line_id)
      if (allowed && l.final_stage && !allowed.has(l.final_stage)) {
        throw BadRequest(
          `Chi tiết "${l.name}": công đoạn cuối không thuộc lộ trình đã chốt của SP — đổi công đoạn cuối hoặc sửa lộ trình trước`,
        )
      }
    }
    await componentsRepo.replaceAll(lsxId, input)
  },

  /**
   * Gợi ý điền sẵn — KHÔNG ghi DB, trả dòng cho grid để người nhập sửa:
   *  - 'bom': từ BOM kỹ thuật của từng SP (mỗi dòng BOM → 1 dòng chi tiết thô,
   *    tên tạm = tên vật tư — nhắc rõ đây chỉ là khung, BOM có thể sai/thiếu).
   *  - 'previous': chép bảng chi tiết từ LSX gần nhất có cùng SP (nguồn nhập
   *    nhanh thực tế nhất — ~17 mã SP lặp lại nhiều lệnh).
   */
  async suggest(
    user: User,
    lsxId: string,
    source: 'bom' | 'previous',
  ): Promise<ComponentInput[]> {
    await assertAction(user, 'production.components.edit')
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
 * Nhu cầu vật tư GỘP từ bảng chi tiết của LSX (plan-lsx-components P3) —
 * null nếu lệnh chưa nhập bảng (caller fallback BOM×SL). KHÔNG guard user —
 * hàm nội bộ cho stockService.lsxNeeds (đã guard ở đó).
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

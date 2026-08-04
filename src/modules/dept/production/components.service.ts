import { componentsRepo, type ComponentInput, type ComponentRow } from './components.repo'
import { entriesRepo } from './entries.repo'
import { jobsRepo } from './jobs.repo'
import { productionRepo } from './production.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { productProfileRepo } from '@/modules/dept/technical/technical.repo'
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
  /** id DÒNG LỆNH (production_order_lines) — 0114. */
  id: string
  product_id: string | null
  product_code: string
  product_name: string
  qty: number
}

async function lsxWithLines(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  const orderLines = await lsxLinesRepo.listLines(lsxId)
  const lines: ComponentOrderLine[] = orderLines.map((l) => ({
    id: l.id,
    product_id: l.product_id,
    product_code: l.product_code,
    product_name: l.name_vi ?? l.product_code,
    qty: l.qty,
  }))
  return { lsx, orderLines: lines }
}

/** Lộ trình per dòng SP từ kế hoạch (jobs theo seq) — thay bảng routes cũ. */
async function jobStagesByLine(lsxId: string): Promise<Map<string, string[]>> {
  const jobs = await jobsRepo.listByLsx(lsxId)
  const map = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = map.get(j.production_order_line_id) ?? []
    arr.push(j.stage)
    map.set(j.production_order_line_id, arr)
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
      if (!validLineIds.has(l.production_order_line_id)) {
        throw BadRequest('Có dòng chi tiết gắn vào dòng SP không thuộc lệnh này')
      }
    }
    // Công đoạn cuối per chi tiết phải thuộc kế hoạch dòng SP (nếu đã lên KH)
    // — nếu lọt, %HT của chi tiết không bao giờ đạt vì sổ chặn công đoạn đó.
    const stagesByLine = await jobStagesByLine(lsxId)
    for (const l of input) {
      const allowed = stagesByLine.get(l.production_order_line_id)
      if (!allowed) continue
      if (l.final_stage && !allowed.includes(l.final_stage)) {
        throw BadRequest(
          `${l.kind === 'assembly' ? 'Cụm' : 'Chi tiết'} "${l.name}": công đoạn cuối không thuộc kế hoạch của SP — đổi công đoạn cuối hoặc sửa kế hoạch trước`,
        )
      }
      if (l.first_stage && !allowed.includes(l.first_stage)) {
        throw BadRequest(
          `${l.kind === 'assembly' ? 'Cụm' : 'Chi tiết'} "${l.name}": công đoạn đầu không thuộc kế hoạch của SP — đổi công đoạn đầu hoặc sửa kế hoạch trước`,
        )
      }
    }
    await componentsRepo.replaceAll(lsxId, input)
  },

  // `saveAsBom` (lưu ngược bảng định hình thành BOM kỹ thuật) ĐÃ BỎ ở 0096.
  //
  // Nó ghi đè TRỌN BỘ định mức của sản phẩm bằng vài dòng "vật tư + số lượng"
  // gộp từ bảng định hình. Khi còn hai bảng định mức thì vô hại vì nó ghi vào
  // bảng cũ (technical_bom_lines). Gộp về một bảng rồi thì một cú bấm từ màn
  // Sản xuất sẽ quét sạch quy cách, tiết diện, chiều dài cắt, khối lượng và
  // diện tích sơn mà Kỹ thuật đã dựng — không có đường lùi. Định mức là hồ sơ
  // của Kỹ thuật, chỉ sửa từ tab Định mức, theo từng dòng.

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
      // 0096: đọc ĐỊNH MỨC (technical_product_parts) — bảng duy nhất còn lại.
      // Giàu hơn BOM cũ: có sẵn tên chi tiết thật và quy cách phôi, nên điền
      // thẳng vào cột spec_* thay vì để thống kê gõ lại. KHÔNG có material_id
      // vì định mức không gắn danh mục kho — người nhập tự chọn vật tư nếu cần.
      const out: ComponentInput[] = []
      for (const line of orderLines) {
        // Dòng lệnh chưa gắn SP (mã "Thông báo sau") thì không có định mức để lấy.
        if (!line.product_id) continue
        const [parts, clusters] = await Promise.all([
          productProfileRepo.parts(line.product_id),
          productProfileRepo.clusters(line.product_id),
        ])
        // 0097: CỤM là bản ghi thật (cột `Parts/ Bộ phận` của biểu mẫu BOM mới).
        // Trước đây chỗ này phải MƯỢN `set_item_label` — nhãn món trong bộ — làm
        // cụm, vì định mức chưa có cấp cụm nào khác để lấy.
        const clusterName = new Map(clusters.map((c) => [c.id, c.name]))
        for (const p of parts) {
          out.push({
            production_order_line_id: line.id,
            cluster: p.cluster_id ? (clusterName.get(p.cluster_id) ?? null) : null,
            name: p.part_name,
            material_id: null,
            material_type: p.material_kind ?? null,
            spec_thickness_mm: p.dim_a_mm ?? null,
            spec_width_mm: p.dim_b_mm ?? null,
            spec_length_mm: p.cut_length_mm ?? null,
            wall_thickness_mm: p.wall_thickness_mm ?? null,
            unit: p.unit ?? null,
            qty_per_unit: Number(p.qty),
            dm_kg: null,
            pcs_per_bar: null,
            note: p.material_code ?? null,
          })
        }
      }
      return out
    }

    // 'previous': lấy bảng của LSX MỚI NHẤT có chứa SP tương ứng, remap sang
    // dòng đơn hiện tại theo product_id.
    const productIds = [
      ...new Set(orderLines.map((l) => l.product_id).filter((x): x is string => !!x)),
    ]
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
        production_order_line_id: targetLineId,
        kind: row.kind,
        cluster: row.cluster,
        name: row.name,
        material_id: row.material_id,
        material_type: row.material_type,
        spec_thickness_mm: row.spec_thickness_mm,
        spec_width_mm: row.spec_width_mm,
        spec_length_mm: row.spec_length_mm,
        wall_thickness_mm: row.wall_thickness_mm,
        unit: row.unit,
        qty_per_unit: row.qty_per_unit,
        dm_kg: row.dm_kg,
        pcs_per_bar: row.pcs_per_bar,
        qty_per_assembly: row.qty_per_assembly,
        first_stage: row.first_stage,
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
  const orderLines = await lsxLinesRepo.listLines(lsxId)
  const qtyByLine = new Map(orderLines.map((l) => [l.id, l.qty]))

  const agg = aggregateMaterialNeeds(
    rows.map((r) => ({
      material_id: r.material_id,
      calc: calcComponent(
        { qty_per_unit: r.qty_per_unit, dm_kg: r.dm_kg, pcs_per_bar: r.pcs_per_bar },
        qtyByLine.get(r.production_order_line_id) ?? 0,
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

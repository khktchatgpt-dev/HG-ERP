import { z } from 'zod'
import { routesRepo, type RouteRow } from './routes.repo'
import { productionRepo } from './production.repo'
import { componentsRepo } from './components.repo'
import { outputsRepo } from './outputs.repo'
import { canEditComponents } from './perms'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * Lộ trình giai đoạn sản xuất (0063) — phần "định hình quá trình" của QL Kế
 * hoạch: mỗi LOẠI SP đi qua các giai đoạn khác nhau. Lộ trình mặc định nằm
 * trên SP (technical_products.stage_route), mỗi lệnh giữ SNAPSHOT riêng per
 * dòng SP — sửa mặc định sau không đổi lệnh đang chạy (cùng triết lý 0038).
 *
 * Thứ tự giai đoạn = thứ tự danh mục production_stage (Phôi→Hàn→Sơn→…) —
 * lộ trình là TẬP CON của chuỗi chuẩn, không cần kéo thả sắp xếp.
 */

export const routeSaveSchema = z.object({
  routes: z
    .array(
      z.object({
        order_line_id: z.uuid(),
        stages: z.array(z.string().trim().min(1).max(50)).max(30),
        /** Lưu lộ trình này làm mặc định cho SP — lệnh sau tự kế thừa. */
        save_as_default: z.boolean().optional(),
      }),
    )
    .max(200),
})
export type RouteSaveInput = z.infer<typeof routeSaveSchema>

/** Giữ đúng thứ tự danh mục + loại code lạ/trùng. Pure — có test riêng. */
export function normalizeRoute(stages: string[], catalogOrder: string[]): string[] {
  const wanted = new Set(stages)
  return catalogOrder.filter((c) => wanted.has(c))
}

export type LineRoute = {
  order_line_id: string
  product_id: string
  product_code: string
  product_name: string
  /** Lộ trình đã chốt cho lệnh (null = chưa định hình dòng này). */
  stages: string[] | null
  /** Lộ trình mặc định của SP — nguồn điền sẵn khi chưa chốt. */
  default_stages: string[]
}

export const routesService = {
  /** Đọc: mọi NV đã đăng nhập (xưởng xem SP mình đi qua giai đoạn nào). */
  async list(_user: User, lsxId: string): Promise<{ lines: LineRoute[] }> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const orderLines = await ordersRepo.listLines(lsx.sales_order_id)
    const [saved, defaults] = await Promise.all([
      routesRepo.listByLsx(lsxId),
      routesRepo.productDefaults([...new Set(orderLines.map((l) => l.product_id))]),
    ])
    const savedByLine = new Map(saved.map((r) => [r.order_line_id, r.stages]))
    return {
      lines: orderLines.map((l) => ({
        order_line_id: l.id,
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.product_name,
        stages: savedByLine.get(l.id) ?? null,
        default_stages: defaults.get(l.product_id) ?? [],
      })),
    }
  },

  /** Ghi đè lộ trình của lệnh; tuỳ chọn lưu làm mặc định cho SP. */
  async save(user: User, lsxId: string, input: RouteSaveInput): Promise<void> {
    if (!(await canEditComponents(user))) {
      throw Forbidden('Chỉ Kế hoạch - Cung ứng / Ban quản lý định hình lộ trình')
    }
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed' || lsx.status === 'cancelled') {
      throw BadRequest('LSX đã kết thúc — lộ trình chỉ còn để tra cứu')
    }

    const orderLines = await ordersRepo.listLines(lsx.sales_order_id)
    const lineById = new Map(orderLines.map((l) => [l.id, l]))
    const catalog = (await productionRepo.listStages()).map((s) => s.code)
    const catalogSet = new Set(catalog)

    const rows: RouteRow[] = []
    for (const r of input.routes) {
      const line = lineById.get(r.order_line_id)
      if (!line) throw BadRequest('Có lộ trình gắn vào dòng SP không thuộc lệnh này')
      for (const s of r.stages) {
        if (!catalogSet.has(s))
          throw BadRequest(`Giai đoạn "${s}" không có trong danh mục`)
      }
      const stages = normalizeRoute(r.stages, catalog)
      if (!stages.length) {
        throw BadRequest(`SP ${line.product_code}: lộ trình phải có ít nhất 1 giai đoạn`)
      }
      rows.push({ order_line_id: r.order_line_id, stages })
    }

    // Validate chéo với dữ liệu đã có — lộ trình mới không được mâu thuẫn:
    //  (1) công đoạn cuối của chi tiết (0041) phải nằm trong lộ trình, nếu
    //      không %HT của nó không bao giờ đạt (sổ chặn nhập giai đoạn đó);
    //  (2) giai đoạn ĐÃ CÓ SẢN LƯỢNG không được rơi ra ngoài — khoá giai đoạn
    //      đang làm dở thì lịch sử thành mồ côi.
    const [comps, entries] = await Promise.all([
      componentsRepo.listByLsx(lsxId),
      outputsRepo.listByLsx(lsxId),
    ])
    const lineByComp = new Map(comps.map((c) => [c.id, c.order_line_id]))
    for (const row of rows) {
      const set = new Set(row.stages)
      const badFinal = comps.filter(
        (c) =>
          c.order_line_id === row.order_line_id &&
          c.final_stage &&
          !set.has(c.final_stage),
      )
      if (badFinal.length) {
        throw BadRequest(
          `Lộ trình bỏ mất công đoạn cuối của chi tiết: ${badFinal
            .map((c) => c.name)
            .join(', ')} — đổi công đoạn cuối trong bảng chi tiết trước`,
        )
      }
      const usedOutside = [
        ...new Set(
          entries
            .filter(
              (e) =>
                lineByComp.get(e.component_id) === row.order_line_id && !set.has(e.stage),
            )
            .map((e) => e.stage),
        ),
      ]
      if (usedOutside.length) {
        throw BadRequest(
          `Đã có sản lượng ở giai đoạn "${usedOutside.join(', ')}" — lộ trình mới không được bỏ giai đoạn đã làm (xoá sổ sản lượng trước nếu thật sự cần)`,
        )
      }
    }

    await routesRepo.replaceAll(lsxId, rows)

    // Lưu mặc định cho SP — để lệnh sau tự kế thừa, đỡ nhập lại (user chốt
    // "theo SP + sửa per lệnh").
    for (const r of input.routes) {
      if (!r.save_as_default) continue
      const line = lineById.get(r.order_line_id)!
      await routesRepo.saveProductDefault(
        line.product_id,
        normalizeRoute(r.stages, catalog),
      )
    }
  },

  /**
   * Giai đoạn hợp lệ để NHẬP SẢN LƯỢNG cho từng dòng SP của lệnh — dùng ở
   * outputs.service. null cho dòng chưa định hình (lệnh cũ vẫn nhập tự do).
   */
  async allowedStagesByLine(lsxId: string): Promise<Map<string, Set<string>>> {
    const saved = await routesRepo.listByLsx(lsxId)
    return new Map(
      saved
        .filter((r) => r.stages.length > 0)
        .map((r) => [r.order_line_id, new Set(r.stages)]),
    )
  },
}

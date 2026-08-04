import {
  lsxLinesRepo,
  type LsxGroup,
  type LsxGroupInput,
  type LsxLine,
  type LsxLineInput,
} from './lsx-lines.repo'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { resolveLsxTemplate, type LsxTemplate } from '@/modules/dept/sales/lsx-template'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { lsxAudienceIds } from './notify-targets'
import { emit } from '@/events/bus'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

/**
 * SOẠN DÒNG LỆNH SẢN XUẤT (0114) — thay cho "lệnh dùng chung dòng đơn" (BR-02).
 *
 * Vì sao Sales phải soạn chứ không lấy thẳng dòng đơn: file LSX thật chia hàng
 * theo ĐỢT XUẤT (cùng một mã SP nằm 5 dòng, mỗi dòng một số lượng + một ngày
 * xuất) và nhóm theo PO / bộ sưu tập. Phát lệnh xong hệ nạp sẵn dòng từ đơn,
 * Sales tách/sửa lại cho đúng thực tế rồi lưu.
 *
 * Lệnh ĐÃ DUYỆT mà sửa dòng = phát BẢN CHỈNH SỬA: revision +1, dòng đổi được
 * đánh dấu để phiếu in tô vàng — thứ file Excel không làm được (bản REVISED của
 * LAURA đổi 69 dòng mà xưởng không biết dòng nào).
 */

export type LsxSheet = {
  template: LsxTemplate
  groups: (LsxGroup & { lines: LsxLine[] })[]
  totals: { qty: number; cbm: number; lines: number }
}

/** Ánh xạ tech_spec cũ (machine/cushion/…) sang khoá spec mới của mẫu chuẩn. */
const SPEC_FROM_PRODUCT: Record<string, string> = {
  machine: 'may', // "machine" là tên cũ đặt sai — dữ liệu vốn là MÂY/dây đan
  cushion: 'nem',
  paint: 'son',
  glass: 'kinh',
  wood: 'go',
}

function groupWithLines(
  groups: LsxGroup[],
  lines: LsxLine[],
): (LsxGroup & { lines: LsxLine[] })[] {
  return groups.map((g) => ({
    ...g,
    lines: lines.filter((l) => l.group_id === g.id),
  }))
}

function sumTotals(lines: LsxLine[]): LsxSheet['totals'] {
  return {
    qty: lines.reduce((s, l) => s + l.qty, 0),
    cbm: lines.reduce((s, l) => s + (l.cbm ?? 0) * l.qty, 0),
    lines: lines.length,
  }
}

/** Mẫu cột của khách sở hữu lệnh. */
async function templateOfLsx(customerId: string): Promise<LsxTemplate> {
  const customer = await customersRepo.findById(customerId)
  return resolveLsxTemplate(customer?.lsx_template)
}

/** So dòng cũ ↔ mới, trả id các dòng đổi nội dung (bỏ qua sort_order). */
function changedLineIds(before: LsxLine[], after: LsxLine[]): string[] {
  const key = (l: LsxLine) =>
    JSON.stringify([
      l.product_code,
      l.customer_item_code,
      l.name_foreign,
      l.name_vi,
      l.name_customs,
      l.barcode,
      l.unit,
      l.qty,
      l.packing,
      l.cbm,
      l.ship_date,
      l.ship_label,
      l.specs,
      l.checks,
      l.extras,
      l.note,
      l.important_note,
    ])
  const old = new Map(before.map((l) => [l.id, key(l)]))
  return after.filter((l) => !old.has(l.id) || old.get(l.id) !== key(l)).map((l) => l.id)
}

export const lsxLinesService = {
  /** Đọc phiếu (nhóm + dòng + mẫu cột) — mọi NV đã đăng nhập xem được. */
  async sheet(_user: User, lsxId: string): Promise<LsxSheet> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const [groups, lines, template] = await Promise.all([
      lsxLinesRepo.listGroups(lsxId),
      lsxLinesRepo.listLines(lsxId),
      templateOfLsx(lsx.customer_id),
    ])
    return { template, groups: groupWithLines(groups, lines), totals: sumTotals(lines) }
  },

  /**
   * Dựng nhóm + dòng TỪ ĐƠN mà không ghi DB — dùng cho bản XEM TRƯỚC phiếu in
   * lúc Sales chưa phát lệnh, và làm nguồn cho seedFromOrders.
   */
  async draftFromOrders(
    orderIds: string[],
  ): Promise<(LsxGroupInput & { lines: LsxLineInput[] })[]> {
    if (!orderIds.length) return []
    const orders = (
      await Promise.all(orderIds.map((id) => ordersRepo.findById(id)))
    ).filter((o): o is NonNullable<typeof o> => !!o)
    const orderLines = await ordersRepo.listLinesByOrders(orders.map((o) => o.id))
    const products = await productsRepo.listByIds([
      ...new Set(orderLines.map((l) => l.product_id)),
    ])
    const byProduct = new Map(products.map((p) => [p.id, p]))

    return orders.map((o) => ({
      sales_order_id: o.id,
      title: `Đơn ${o.code}`,
      buyer_name: null,
      po_no: o.customer_po_no,
      ship_date: o.due_date,
      ship_label: null,
      note: null,
      sort_order: 0,
      lines: orderLines
        .filter((l) => l.order_id === o.id)
        .map((l) => {
          const p = byProduct.get(l.product_id)
          const spec = (p?.tech_spec ?? {}) as Record<string, string>
          const specs: Record<string, string> = {}
          for (const [from, to] of Object.entries(SPEC_FROM_PRODUCT)) {
            if (spec[from]) specs[to] = spec[from]
          }
          const pack = (p?.packing ?? {}) as {
            qty_per_carton?: number
            pack_unit_label?: string
          }
          return {
            product_id: l.product_id,
            sales_order_line_id: l.id,
            product_code: l.product_code,
            customer_item_code: p?.customer_item_code ?? l.customer_item_code ?? null,
            name_foreign: p?.name_foreign ?? null,
            name_vi: l.product_name,
            name_customs: null,
            barcode: p?.barcode ?? null,
            unit: l.product_unit,
            qty: l.qty,
            packing: pack.qty_per_carton
              ? `${pack.qty_per_carton} ${l.product_unit}/${pack.pack_unit_label ?? 'thùng'}`
              : null,
            cbm: null,
            ship_date: o.due_date,
            ship_label: null,
            specs,
            checks: {},
            extras: {},
            note: l.note,
            important_note: null,
            image_file_id: l.image_file_id,
            sort_order: 0,
          }
        }),
    }))
  },

  /**
   * NẠP SẴN dòng lệnh từ các đơn của lệnh — gọi ngay sau khi phát lệnh, hoặc
   * khi Sales gộp thêm đơn. Mỗi đơn thành một nhóm, mỗi dòng đơn thành một dòng
   * lệnh; Sales tách đợt xuất sau. KHÔNG đụng nhóm/dòng đã có.
   */
  async seedFromOrders(lsxId: string): Promise<void> {
    const [existingGroups, existingLines, orders] = await Promise.all([
      lsxLinesRepo.listGroups(lsxId),
      lsxLinesRepo.listLines(lsxId),
      ordersRepo.listByProductionOrder(lsxId),
    ])
    const seeded = new Set(existingGroups.map((g) => g.sales_order_id).filter(Boolean))
    const fresh = orders.filter((o) => !seeded.has(o.id))
    if (!fresh.length) return

    const drafts = await lsxLinesService.draftFromOrders(fresh.map((o) => o.id))
    await lsxLinesRepo.replaceAll(lsxId, [
      ...groupWithLines(existingGroups, existingLines),
      ...drafts,
    ])
  },

  /**
   * LƯU nhóm + dòng do Sales soạn. Chặn xoá dòng đã vào sản xuất; lệnh đã duyệt
   * thì mỗi lần lưu là một bản chỉnh sửa (revision +1, đánh dấu dòng đổi).
   */
  async save(
    user: User,
    lsxId: string,
    input: {
      groups: (LsxGroupInput & { lines: LsxLineInput[] })[]
      revision_note?: string | null
    },
  ): Promise<LsxSheet> {
    await assertAction(user, 'production.lsx.issue')
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status === 'completed' || lsx.status === 'cancelled') {
      throw BadRequest('Lệnh đã kết thúc — không sửa dòng được')
    }

    const before = await lsxLinesRepo.listLines(lsxId)
    const keptIds = new Set(
      input.groups.flatMap((g) => g.lines.map((l) => l.id).filter(Boolean) as string[]),
    )
    const dropped = before.filter((l) => !keptIds.has(l.id))
    if (dropped.length) {
      const jobs = await jobsRepo.listByLsx(lsxId)
      const droppedIds = new Set(dropped.map((l) => l.id))
      const running = jobs.find(
        (j) => droppedIds.has(j.production_order_line_id) && j.status !== 'todo',
      )
      if (running) {
        const line = dropped.find((l) => l.id === running.production_order_line_id)
        throw BadRequest(
          `Dòng "${line?.product_code ?? ''}" đã vào sản xuất — không xoá khỏi lệnh được`,
        )
      }
    }
    if (!input.groups.some((g) => g.lines.length)) {
      throw BadRequest('Lệnh phải có ít nhất một dòng sản phẩm')
    }

    await lsxLinesRepo.replaceAll(lsxId, input.groups)
    const after = await lsxLinesRepo.listLines(lsxId)

    // Bản chỉnh sửa: chỉ tính khi lệnh ĐÃ QUA DUYỆT — trước đó Sales còn đang soạn.
    const published = lsx.status === 'approved' || lsx.status === 'in_progress'
    const changed = changedLineIds(before, after)
    if (published && changed.length) {
      const revision = lsx.revision + 1
      await productionRepo.patch(lsxId, {
        revision,
        revised_at: new Date().toISOString(),
        revised_by: user.id,
        revision_note: input.revision_note ?? null,
      })
      await lsxLinesRepo.markChanged(changed, revision)
      await emit({
        name: 'lsx.revised',
        production_order_id: lsxId,
        code: lsx.code,
        revision,
        changed_lines: changed.length,
        note: input.revision_note ?? null,
        revised_by: user.id,
        notify_ids: await lsxAudienceIds(),
      })
    }
    return lsxLinesService.sheet(user, lsxId)
  },
}

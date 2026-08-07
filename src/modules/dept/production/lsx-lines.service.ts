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
import {
  colKey,
  LSX_FORM,
  resolveLsxTemplate,
  specColumnsOf,
  type LsxTemplate,
} from '@/modules/dept/sales/lsx-template'
import {
  productsRepo,
  type Product,
  type ProductPacking,
  type ProductTechSpec,
} from '@/modules/dept/technical/technical.repo'
import { productsService } from '@/modules/dept/technical/technical.service'
import { valueState } from './lsx-sheet-cells'
import {
  GAP_TAB,
  packingText,
  parsePacking,
  SPEC_FROM_PRODUCT,
  type ProfileGap,
  type ProfileGapKey,
  type ProfileMap,
  type ProfileSnapshot,
} from './lsx-line-fill'
import { lsxAudienceIds } from './notify-targets'
import { emit } from '@/events/bus'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { canMutateOwned } from '@/lib/record-ownership'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
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

/** Nhãn hiển thị của khoá spec (may → "Mây") — lấy từ form chuẩn, khỏi lệch. */
const SPEC_LABEL: Record<string, string> = Object.fromEntries(
  specColumnsOf(LSX_FORM).map((c) => [colKey(c), c.label]),
)

/**
 * Giá trị dòng lệnh DÙNG ĐƯỢC để bổ sung hồ sơ: có chữ và không phải placeholder
 * kiểu "xác nhận sau"/"Thông báo sau" — placeholder mà ghi vào hồ sơ SP là chôn
 * rác vào nguồn chuẩn.
 */
const usable = (v: string | null | undefined): string => {
  const t = (v ?? '').trim()
  return t && valueState(t, false) !== 'pending' ? t : ''
}

const hasCartonDims = (p: Product): boolean =>
  p.packing?.carton_l_cm != null &&
  p.packing?.carton_w_cm != null &&
  p.packing?.carton_h_cm != null

/**
 * CBM/thùng cho cột soát đóng cont: đo được 3 chiều thì TÍNH, chưa đo thì lấy
 * số hồ sơ khai trực tiếp (cùng thứ tự ưu tiên với `cartonCbm`).
 */
function productCbm(p: Product): number | null {
  const k = p.packing ?? {}
  return hasCartonDims(p)
    ? (k.carton_l_cm! * k.carton_w_cm! * k.carton_h_cm!) / 1_000_000
    : (k.cbm ?? null)
}

/**
 * ẢNH CHỤP HỒ SƠ SP ở đúng dạng dòng lệnh — nguồn cho CẢ HAI đường: nạp dòng
 * (`draftFromOrders`) và đối chiếu "ô này lấy từ hồ sơ hay Sales tự nhập"
 * (client). Chung một hàm nên hai bên không thể trôi lệch.
 */
export function profileSnapshot(p: Product, unit?: string | null): ProfileSnapshot {
  const specs: Record<string, string> = {}
  for (const [prodKey, specKey] of Object.entries(SPEC_FROM_PRODUCT)) {
    const v = (p.tech_spec?.[prodKey as keyof ProductTechSpec] ?? '').trim()
    if (v) specs[specKey] = v
  }
  return {
    specs,
    name_foreign: p.name_foreign ?? null,
    barcode: p.barcode ?? null,
    customer_item_code: p.customer_item_code ?? null,
    packing: packingText(p.packing?.qty_per_carton, unit, p.packing?.pack_unit_label),
    cbm: productCbm(p),
    gaps: productGaps(p),
  }
}

/** Trường hồ sơ SP đang TRỐNG (theo bộ trường LSX cần) — kèm tab để dẫn đi sửa. */
function productGaps(p: Product): ProfileGap[] {
  const gaps: ProfileGap[] = []
  const add = (key: ProfileGapKey, label: string) =>
    gaps.push({ key, label, tab: GAP_TAB[key] })

  if (!p.name_foreign?.trim()) add('name_foreign', 'Tên nước ngoài')
  if (!p.barcode?.trim()) add('barcode', 'Barcode')
  for (const [prodKey, specKey] of Object.entries(SPEC_FROM_PRODUCT)) {
    if (!(p.tech_spec?.[prodKey as keyof ProductTechSpec] ?? '').trim())
      add(specKey as ProfileGapKey, SPEC_LABEL[specKey] ?? specKey)
  }
  if (!p.packing?.qty_per_carton) add('packing', 'Đóng gói')
  if (p.packing?.cbm == null && !hasCartonDims(p)) add('cbm', 'CBM')
  return gaps
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
          // Dùng CHÍNH ảnh chụp hồ sơ mà màn soạn dòng đối chiếu — nạp và so
          // phải cùng một khuôn, lệch nhau là mọi ô hiện "khác hồ sơ" sai.
          const snap = p ? profileSnapshot(p, l.product_unit) : null
          return {
            product_id: l.product_id,
            sales_order_line_id: l.id,
            product_code: l.product_code,
            customer_item_code: snap?.customer_item_code ?? l.customer_item_code ?? null,
            name_foreign: snap?.name_foreign ?? null,
            name_vi: l.product_name,
            name_customs: null,
            barcode: snap?.barcode ?? null,
            unit: l.product_unit,
            qty: l.qty,
            packing: snap?.packing ?? null,
            cbm: snap?.cbm ?? null,
            ship_date: o.due_date,
            ship_label: null,
            specs: snap?.specs ?? {},
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
    // Soạn dòng CŨNG LÀ sửa lệnh — của ai người đó sửa (chốt 07/08/2026).
    if (!canMutateOwned(user, lsx.created_by)) {
      throw Forbidden(
        'Lệnh này do người khác lập — chỉ người lập hoặc quản lý mới sửa được',
      )
    }
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

  /**
   * Map productId → ẢNH CHỤP hồ sơ SP (kèm danh sách trường đang trống). Màn
   * soạn dòng cần cả snapshot chứ không chỉ gap: nguồn của từng ô ("lấy từ hồ
   * sơ" / "khác hồ sơ" / "hồ sơ trống") suy ra bằng cách so dòng với snapshot
   * này — nên trả cả SP KHÔNG có gap.
   *
   * `unitByProduct`: ĐVT của dòng, để dựng chuỗi đóng gói ("4 cái/thùng") đúng
   * như lúc nạp dòng — thiếu nó thì ô đóng gói luôn bị coi là "khác hồ sơ".
   */
  async lineProfiles(
    productIds: string[],
    unitByProduct: Record<string, string> = {},
  ): Promise<ProfileMap> {
    const ids = [...new Set(productIds.filter(Boolean))]
    if (!ids.length) return {}
    const products = await productsRepo.listByIds(ids)
    const out: ProfileMap = {}
    for (const p of products) out[p.id] = profileSnapshot(p, unitByProduct[p.id])
    return out
  },

  /**
   * BỔ SUNG hồ sơ SP từ một dòng lệnh (0114) — CHỈ điền trường hồ sơ đang
   * TRỐNG, không ghi đè giá trị đã khai: hồ sơ SP là nguồn chuẩn của LSX, sửa
   * ad-hoc trên một lệnh không được lật nguồn. Placeholder ("xác nhận sau"…)
   * bị bỏ qua. Quyền đi theo `technical.product.fill_specs` (Sales đã có từ
   * form báo giá) — assert nằm trong productsService.fillSpecs.
   */
  async fillProductFromLine(
    user: User,
    lsxId: string,
    lineId: string,
  ): Promise<{ filled: string[] }> {
    const lines = await lsxLinesRepo.listLines(lsxId)
    const line = lines.find((l) => l.id === lineId)
    if (!line) throw NotFound('Dòng lệnh không tồn tại')
    if (!line.product_id) throw BadRequest('Dòng chưa gắn hồ sơ SP')
    const p = await productsRepo.findById(line.product_id)
    if (!p) throw NotFound('Hồ sơ SP không tồn tại')

    const filled: string[] = []
    const input: Parameters<typeof productsService.fillSpecs>[2] = {}

    if (!p.name_foreign?.trim() && usable(line.name_foreign)) {
      input.name_foreign = usable(line.name_foreign)
      filled.push('Tên nước ngoài')
    }
    if (!p.barcode?.trim() && usable(line.barcode)) {
      input.barcode = usable(line.barcode)
      filled.push('Barcode')
    }

    const tech: ProductTechSpec = {}
    for (const [prodKey, specKey] of Object.entries(SPEC_FROM_PRODUCT)) {
      const cur = (p.tech_spec?.[prodKey as keyof ProductTechSpec] ?? '').trim()
      const val = usable(line.specs[specKey])
      if (!cur && val) {
        tech[prodKey as keyof ProductTechSpec] = val
        filled.push(SPEC_LABEL[specKey] ?? specKey)
      }
    }
    if (Object.keys(tech).length) input.tech_spec = tech

    const packing: ProductPacking = {}
    // "4 cái/ thùng" (định dạng seedFromOrders sinh ra) → qty + nhãn kiện.
    if (!p.packing?.qty_per_carton && usable(line.packing)) {
      const parsed = parsePacking(usable(line.packing))
      if (parsed) {
        packing.qty_per_carton = parsed.qty
        packing.pack_unit_label = parsed.label
        filled.push('Đóng gói')
      }
    }
    if (p.packing?.cbm == null && !hasCartonDims(p) && line.cbm != null) {
      packing.cbm = line.cbm
      filled.push('CBM')
    }
    if (Object.keys(packing).length) input.packing = packing

    if (!filled.length) return { filled }
    await productsService.fillSpecs(user, line.product_id, input)
    return { filled }
  },
}

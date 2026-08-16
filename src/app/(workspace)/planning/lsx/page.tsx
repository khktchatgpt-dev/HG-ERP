import { authService } from '@/modules/core/auth/auth.service'
import {
  productionRepo,
  listOrderLineProducts,
} from '@/modules/dept/production/production.repo'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { assessPoLate } from '@/lib/late-risk'
import { LsxSupplyScreen, type LsxSupplyRow } from './LsxSupplyScreen'

export const dynamic = 'force-dynamic'

/**
 * VẬT TƯ THEO LỆNH — màn của phòng Cung ứng, không phải bản sao màn xưởng.
 *
 * Trước đây route này dùng lại `RunningLsxList` của khu Sản xuất (tiến độ công
 * đoạn, tổ nào chạy) — người mua không quyết gì bằng những con số đó. Câu họ
 * cần trả lời là: LỆNH NÀY CỦA KHÁCH NÀO, làm những sản phẩm gì, bao giờ vật tư
 * phải về, và đã lập đơn mua nào rồi.
 *
 * CỐ Ý KHÔNG có phần "còn thiếu bao nhiêu" theo định mức: BOM chưa triển khai
 * thật (chủ dự án xác nhận 15/08/2026), tính ra sẽ là số rỗng hoặc số sai —
 * tệ hơn không có. Khi BOM có dữ liệu thì gắn thêm, dữ liệu và API đã sẵn
 * (`/api/dept/supply/needs`).
 *
 * BỐN TRUY VẤN cho cả trang, không N+1:
 *   1. LSX đang chạy (kèm khách, hạn vật tư, ngày giao).
 *   2. Dòng SP của mọi đơn thuộc các lệnh đó — một lượt, gom theo lệnh.
 *   3. Đơn mua (một lượt) → tự đếm và gom theo lệnh.
 *   4. LSX phụ của đơn (0125) — đơn mua chung tính cho CẢ các lệnh nó phục vụ.
 */
export default async function PlanningLsxPage() {
  const user = await authService.requirePageUser()
  const today = new Date().toISOString().slice(0, 10)

  const [lsxs, { rows: pos }, supplyStaff] = await Promise.all([
    productionRepo.listActive(),
    posService.list(user, { page: 1, page_size: 1000 }),
    isSupplyStaff(user),
  ])

  const [productLines, extraLsx] = await Promise.all([
    listOrderLineProducts(lsxs.flatMap((l) => l.order_ids)),
    posRepo.extraLsxByPoIds(pos.map((p) => p.id)),
  ])

  // Sản phẩm về theo LỆNH: một lệnh gộp nhiều đơn (0113) nên cộng dồn cùng mã.
  const lsxIdByOrderId = new Map<string, string>()
  for (const l of lsxs) for (const oid of l.order_ids) lsxIdByOrderId.set(oid, l.id)
  const productsByLsx = new Map<string, { code: string; name: string; qty: number }[]>()
  for (const pl of productLines) {
    const lsxId = lsxIdByOrderId.get(pl.order_id)
    if (!lsxId) continue
    const list = productsByLsx.get(lsxId) ?? []
    const hit = list.find((x) => x.code === pl.code)
    if (hit) hit.qty += pl.qty
    else list.push({ code: pl.code, name: pl.name, qty: pl.qty })
    productsByLsx.set(lsxId, list)
  }

  /*
   * Đơn mua gom theo LỆNH. Không lấy `pos_*` của v_order_tracking: view trả mỗi
   * ĐƠN HÀNG một dòng nên lệnh gộp nhiều đơn bị cộng trùng, và view chỉ nhìn
   * cột `production_order_id` nên bỏ sót đơn mua chung nhiều lệnh (0125).
   */
  type PoBrief = LsxSupplyRow['pos'][number]
  const posByLsx = new Map<string, PoBrief[]>()
  const attach = (lsxId: string, p: (typeof pos)[number], shared: boolean) => {
    const list = posByLsx.get(lsxId) ?? []
    list.push({
      id: p.id,
      code: p.code,
      supplier_name: p.supplier_name,
      status: p.status,
      expected_at: p.expected_at,
      currency: p.currency,
      shared,
      late: assessPoLate(p, today) === 'overdue',
    })
    posByLsx.set(lsxId, list)
  }
  for (const p of pos) {
    if (p.production_order_id) attach(p.production_order_id, p, false)
    for (const ex of extraLsx.get(p.id) ?? []) {
      if (ex.id !== p.production_order_id) attach(ex.id, p, true)
    }
  }

  const rows: LsxSupplyRow[] = lsxs.map((l) => {
    const list = posByLsx.get(l.id) ?? []
    const live = list.filter((p) => p.status !== 'cancelled')
    return {
      id: l.id,
      code: l.code,
      customer_name: l.customer_name,
      order_codes: l.order_codes,
      ship_date: l.ship_date,
      materials_due_at: l.materials_due_at,
      materials_received_at: l.materials_received_at,
      priority: l.priority,
      products: productsByLsx.get(l.id) ?? [],
      pos: list,
      posTotal: live.length,
      posUnsent: live.filter(
        (p) => p.status === 'draft' || p.status === 'pending_approval',
      ).length,
      posOpen: live.filter(
        (p) =>
          p.status !== 'draft' &&
          p.status !== 'pending_approval' &&
          p.status !== 'received',
      ).length,
      posLate: live.filter((p) => p.late).length,
    }
  })

  return (
    <LsxSupplyScreen
      rows={rows}
      today={today}
      canEdit={user.role === 'admin' || supplyStaff}
    />
  )
}

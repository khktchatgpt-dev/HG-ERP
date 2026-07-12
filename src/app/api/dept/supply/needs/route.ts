import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockInfoMany } from '@/modules/dept/warehouse/stock.repo'
import { smartLsxNeeds, reservedByOtherLsx } from '@/modules/dept/warehouse/stock.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { suggestForMaterial } from '@/lib/po-suggestion'

const querySchema = z.object({
  production_order_id: z.string().uuid(),
  // PO đang sửa (edit) — không tự đếm chính nó vào "đã đặt".
  exclude_po_id: z.string().uuid().optional(),
})

/**
 * Nhu cầu vật tư của 1 LSX cho form tạo PO (FR-SUP-01) + ĐỀ XUẤT MUA theo tồn
 * (plan-don-dat-hang-chuan-erp §P1, Cách 2). Ưu tiên bảng chi tiết nhập tay
 * (kg/số cây), fallback BOM×SL; − đã xuất. Mỗi vật tư kèm:
 *  - on_hand: tồn thực; reserved_others: nhu cầu còn lại LSX khác đã cam kết
 *    (approved|in_progress) → available = tồn − giữ chỗ.
 *  - ordered/pending: đã đặt (PO đã duyệt) / chờ duyệt (PO chờ GĐ) của LSX này.
 *  - suggest = max(cần − available − ordered, 0) — người mua tự quyết, không tự trừ.
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { production_order_id, exclude_po_id } = parseQuery(new URL(req.url), querySchema)

  const needs = await smartLsxNeeds(production_order_id)
  const matIds = needs.map((n) => n.material_id)

  const [stock, reserved, orderedPending] = await Promise.all([
    stockInfoMany(matIds),
    reservedByOtherLsx(production_order_id, matIds),
    supplyRepo.orderedPendingByLsx(production_order_id, exclude_po_id),
  ])
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))

  return NextResponse.json({
    needs: needs.map((n) => {
      const op = orderedPending.get(n.material_id)
      const s = suggestForMaterial({
        material_id: n.material_id,
        needed: n.qty_remaining,
        on_hand: onHand.get(n.material_id) ?? 0,
        reserved_others: reserved.get(n.material_id) ?? 0,
        ordered: op?.ordered ?? 0,
        pending: op?.pending ?? 0,
      })
      return {
        ...n,
        on_hand: s.on_hand,
        reserved_others: s.reserved_others,
        available: s.available,
        ordered: s.ordered,
        pending: s.pending,
        suggest: s.suggest,
        enough: s.enough,
        has_pending: s.has_pending,
      }
    }),
  })
})

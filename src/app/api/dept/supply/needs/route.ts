import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxNeeds, stockInfoMany } from '@/modules/dept/warehouse/stock.repo'

const querySchema = z.object({ production_order_id: z.string().uuid() })

/**
 * Nhu cầu vật tư của 1 LSX cho form tạo PO (FR-SUP-01): cần theo BOM×SL − đã
 * xuất, KÈM tồn kho hiện có — hiển thị để người mua tự quyết lượng đặt
 * (đặc tả 4.4: Cung ứng "đọc tồn để tính mua", hệ thống không tự trừ).
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { production_order_id } = parseQuery(new URL(req.url), querySchema)

  const needs = await lsxNeeds(production_order_id)
  const stock = await stockInfoMany(needs.map((n) => n.material_id))
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))

  return NextResponse.json({
    needs: needs.map((n) => ({ ...n, on_hand: onHand.get(n.material_id) ?? 0 })),
  })
})

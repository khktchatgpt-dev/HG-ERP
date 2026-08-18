import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockInfoMany, type LsxNeed } from '@/modules/dept/warehouse/stock.repo'
import {
  smartLsxNeeds,
  reservedByOtherLsx,
  lsxAllocationByCode,
} from '@/modules/dept/warehouse/stock.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { suggestForMaterial } from '@/lib/po-suggestion'
import { mergeAllocations, type MaterialAllocation } from '@/lib/po-allocation'

const uuid = z.string().uuid()

const querySchema = z.object({
  production_order_id: uuid,
  /** LSX PHỤ gộp thêm vào đơn (0125) — uuid cách nhau dấu phẩy. */
  extra_lsx_ids: z.string().max(500).optional(),
  // PO đang sửa (edit) — không tự đếm chính nó vào "đã đặt".
  exclude_po_id: uuid.optional(),
})

/**
 * Nhu cầu vật tư cho form tạo PO (FR-SUP-01) + ĐỀ XUẤT MUA theo tồn
 * (plan-don-dat-hang-chuan-erp §P1, Cách 2). Ưu tiên bảng chi tiết nhập tay,
 * fallback BOM×SL; − đã xuất.
 *
 * 0125 — MỘT ĐƠN GỘP NHIỀU LSX (đơn thật ghi "LSX 01+2+3/26-27"): nhận thêm
 * `extra_lsx_ids`, nhu cầu là TỔNG của cả bộ lệnh và tính ở SERVER chứ không để
 * client cộng từng lệnh: mỗi lệnh coi lệnh kia là "đã giữ chỗ" nên cộng suggest
 * từng lệnh sẽ trừ tồn hai lần — bộ 2 lệnh cần 160, tồn 100 mà cộng kiểu đó ra
 * 120 thay vì 60.
 *
 * Mỗi vật tư kèm:
 *  - on_hand / reserved_others / available (loại CẢ BỘ lệnh khỏi giữ chỗ)
 *  - ordered / pending: Σ theo mọi lệnh trong bộ
 *  - suggest = max(cần − available − ordered, 0) — người mua tự quyết
 *  - breakdown: phân bổ theo SP ("300 Bàn 65 gỗ, đm 4c/sp") cho ghi chú dòng
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { production_order_id, extra_lsx_ids, exclude_po_id } = parseQuery(
    new URL(req.url),
    querySchema,
  )
  const extras = (extra_lsx_ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== production_order_id && uuid.safeParse(s).success)
  const lsxIds = [production_order_id, ...new Set(extras)]

  // Nhu cầu từng lệnh rồi GỘP theo vật tư — cần/đã xuất/còn lại đều cộng dồn.
  const needLists = await Promise.all(lsxIds.map((id) => smartLsxNeeds(id)))
  const merged = new Map<string, LsxNeed>()
  for (const n of needLists.flat()) {
    const cur = merged.get(n.material_id)
    if (!cur) {
      merged.set(n.material_id, { ...n })
      continue
    }
    cur.qty_needed += n.qty_needed
    cur.qty_issued += n.qty_issued
    cur.qty_remaining += n.qty_remaining
    cur.kg_needed =
      cur.kg_needed == null && n.kg_needed == null
        ? null
        : (cur.kg_needed ?? 0) + (n.kg_needed ?? 0)
    cur.bars_needed =
      cur.bars_needed == null && n.bars_needed == null
        ? null
        : (cur.bars_needed ?? 0) + (n.bars_needed ?? 0)
    cur.incomplete = Boolean(cur.incomplete || n.incomplete)
  }
  const needs = [...merged.values()]
  const matIds = needs.map((n) => n.material_id)

  /*
   * "Đã đặt" tính MỘT LẦN cho cả bộ lệnh (orderedPendingByLsxSet) chứ không gọi
   * từng lệnh rồi cộng: đơn gộp A+B mà cộng theo lệnh là đếm hai lần, và đơn
   * mua chung của lệnh NGOÀI bộ (mua hộ lệnh trong bộ) trước đây bị bỏ sót —
   * cả hai đều làm số "đã đặt" sai và đề xuất mua sai theo.
   */
  const [stock, reserved, orderedPending, allocLists, maxStocks] = await Promise.all([
    stockInfoMany(matIds),
    reservedByOtherLsx(lsxIds, matIds),
    supplyRepo.orderedPendingByLsxSet(lsxIds, exclude_po_id),
    Promise.all(lsxIds.map((id) => lsxAllocationByCode(id))),
    materialsRepo.maxStockMany(matIds), // trần tồn — cảnh báo mua vượt (P3.1)
  ])
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))

  // Phân bổ theo SP, gộp cả bộ lệnh (cùng SP + cùng đm thì cộng SL).
  const alloc = new Map<string, MaterialAllocation[]>()
  for (const list of allocLists) {
    for (const [code, items] of list) {
      alloc.set(code, mergeAllocations(alloc.get(code) ?? [], items))
    }
  }

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
        max_stock: maxStocks.get(n.material_id) ?? null,
        breakdown: alloc.get(n.material_code) ?? [],
      }
    }),
  })
})

import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { materialGroupsRepo } from '@/modules/dept/supply/supply.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { SuppliersManager } from './SuppliersManager'
import { SuppliersScreenV4 } from './SuppliersScreenV4'

/**
 * BẢN SONG SONG `?v4=1` — kit v4 chạy cạnh bản cũ trên CÙNG dữ liệu đã nạp,
 * không thêm truy vấn nào. Bản cũ không bị đụng; gỡ về chỉ là bỏ tham số URL.
 */
export default async function PlanningSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await authService.requirePageUser()
  const v4 = (await searchParams).v4 === '1'
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))

  const [{ rows: suppliers }, { rows: pos }, { rows: materials }] = await Promise.all([
    suppliersService.list(user, { page: 1, page_size: 500 }),
    posRepo.list({ page: 1, page_size: 500 }),
    materialsService.list(user, { page: 1, page_size: 1000, active_only: true }),
  ])

  // Tổng chi theo NCC + nhãn nhóm hàng theo lô (cho chips ở danh sách).
  const [totals, groupsBySupplier] = await Promise.all([
    posRepo.totalsByPoIds(pos.map((p) => p.id)),
    materialGroupsRepo.labelsBySuppliers(suppliers.map((s) => s.id)),
  ])

  // Lịch sử mua gọn: đếm PO + PO gần nhất + tổng chi theo NCC (FR-SUP-06).
  // open = chưa về đủ/chưa huỷ — cảnh báo khi Ngừng giao dịch NCC còn PO dở dang.
  const poStats = new Map<
    string,
    { count: number; open: number; last_code: string; last_at: string; spend: number }
  >()
  for (const p of pos) {
    const open = p.status !== 'received' && p.status !== 'cancelled' ? 1 : 0
    const spend = p.status !== 'cancelled' ? (totals[p.id] ?? 0) : 0
    const cur = poStats.get(p.supplier_id)
    if (!cur) {
      poStats.set(p.supplier_id, {
        count: 1,
        open,
        last_code: p.code,
        last_at: p.created_at,
        spend,
      })
    } else {
      cur.count++
      cur.open += open
      cur.spend += spend
    }
  }

  const rows = suppliers.map((s) => ({
    ...s,
    po_count: poStats.get(s.id)?.count ?? 0,
    open_po_count: poStats.get(s.id)?.open ?? 0,
    last_po: poStats.get(s.id)?.last_code ?? null,
    last_po_at: poStats.get(s.id)?.last_at ?? null,
    total_spend: poStats.get(s.id)?.spend ?? 0,
    groups: groupsBySupplier.get(s.id) ?? [],
  }))

  if (v4) return <SuppliersScreenV4 suppliers={rows} canEdit={!!canEdit} />

  return (
    <SuppliersManager
      suppliers={rows}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
      }))}
      canEdit={!!canEdit}
    />
  )
}

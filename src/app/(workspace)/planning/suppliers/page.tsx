import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { materialGroupsRepo } from '@/modules/dept/supply/supply.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { SuppliersManager } from './SuppliersManager'

/**
 * BẢN SONG SONG `?v4=1` — kit v4 chạy cạnh bản cũ trên CÙNG dữ liệu đã nạp,
 * không thêm truy vấn nào. Bản cũ không bị đụng; gỡ về chỉ là bỏ tham số URL.
 */
export default async function PlanningSuppliersPage() {
  const user = await authService.requirePageUser()
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
  /*
    TỔNG CHI TÁCH THEO LOẠI TIỀN (09/09/2026).

    Trước đây cộng thẳng `cur.spend += spend` bất kể `p.currency`. Đo trong
    DB: 44 đơn VND + 24 đơn USD. Cộng chung rồi dán đuôi "₫" ra một con số
    KHÔNG TỒN TẠI — nguy hiểm hơn không hiện gì, vì nó nhìn vẫn như số thật
    và người ta đem đi báo cáo.
  */
  const poStats = new Map<
    string,
    {
      count: number
      open: number
      last_code: string
      last_at: string
      spend: Record<string, number>
    }
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
        spend: spend ? { [p.currency]: spend } : {},
      })
    } else {
      cur.count++
      cur.open += open
      if (spend) cur.spend[p.currency] = (cur.spend[p.currency] ?? 0) + spend
    }
  }

  const rows = suppliers.map((s) => ({
    ...s,
    po_count: poStats.get(s.id)?.count ?? 0,
    open_po_count: poStats.get(s.id)?.open ?? 0,
    last_po: poStats.get(s.id)?.last_code ?? null,
    last_po_at: poStats.get(s.id)?.last_at ?? null,
    total_spend: poStats.get(s.id)?.spend ?? {},
    groups: groupsBySupplier.get(s.id) ?? [],
  }))


  /*
    Màn v3 vẫn nhận `total_spend` là MỘT số. Không sửa nó ở lượt này (bản cũ
    giữ nguyên là luật của nhánh kit v4), nên dồn về loại tiền LỚN NHẤT thay
    vì cộng bừa các loại — hiển thị thiếu còn hơn hiển thị một con số không
    tồn tại.
  */
  const rowsV3 = rows.map((r) => ({
    ...r,
    total_spend: Math.max(0, ...Object.values(r.total_spend)),
  }))

  return (
    <SuppliersManager
      suppliers={rowsV3}
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

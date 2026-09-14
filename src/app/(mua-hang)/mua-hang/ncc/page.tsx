import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { NccScreen } from './NccScreen'

export const metadata = { title: 'Mua hàng · Nhà cung cấp' }

/**
 * DANH SÁCH NHÀ CUNG CẤP — Khuôn C, dựng bằng kit (Đợt 3, 14/09/2026).
 *
 * Thay trang tạm trỏ ngược về `/planning/suppliers`. Câu hỏi trang này trả
 * lời, đúng như cây menu khai: "Mua của ai, họ làm ăn ra sao?" — nên bảng
 * không dừng ở danh bạ (tên, mã, điện thoại) mà mang theo LỊCH SỬ MUA: đã đặt
 * bao nhiêu đơn, còn bao nhiêu đơn dở dang, lần gần nhất là bao giờ, đã chi
 * bao nhiêu.
 *
 * KHÔNG VIẾT SERVICE MỚI (luật của module này, xem `(mua-hang)/layout.tsx`):
 * hai nguồn dưới đây là đúng thứ `/planning/suppliers` đang gọi. Khác bản cũ
 * hai chỗ, cả hai đều do ĐO mà ra:
 *
 *  1. Bản cũ dồn `total_spend` về MỘT số; ở đây giữ map theo loại tiền.
 *  2. Bản cũ nạp thêm `materialGroupsRepo.labelsBySuppliers` để hiện cột
 *     "nhóm hàng". Đo 14/09/2026: **1/164 NCC** có nhãn đó — một cột rỗng
 *     99,4% cộng một truy vấn thừa. Cột "Mặt hàng" ở bản này đọc
 *     `suppliers.type` (128/164 = 78%), và đó mới đúng là thứ người mua cần:
 *     "Gia công đan mây", "Bao bì", "Sắt các loại"…
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))

  /*
    TRẦN NẠP — và NÓI RA khi chạm.

    Cả hai nguồn nạp một lượt để lọc ở client (164 NCC thì gọn). Nhưng im lặng
    cắt đuôi ở dòng 500 là cách chắc chắn để mọi con số trên màn sai mà không ai
    biết: đúng bẫy đã dính ở /planning/stock (trần 1000 dòng PostgREST giấu mất
    những mã CÓ tồn). Chạm trần thì báo, đừng đoán.
  */
  const CAP = 500
  const [{ rows: suppliers }, { rows: pos }] = await Promise.all([
    suppliersService.list(user, { page: 1, page_size: CAP }),
    posRepo.list({ page: 1, page_size: CAP }),
  ])
  const totals = await posRepo.totalsByPoIds(pos.map((p) => p.id))

  /*
    TỔNG CHI TÁCH THEO LOẠI TIỀN — không cộng chung, không quy đổi.

    Trong DB đang có cả đơn VND lẫn đơn USD (đo 09/09/2026: 44 + 24). Cộng
    thẳng rồi dán đuôi "₫" ra một con số KHÔNG TỒN TẠI, mà nó nhìn vẫn như số
    thật nên người ta đem đi báo cáo. Quy đổi cũng không được: tỉ giá nào, của
    ngày nào — đơn ký tháng 7 và đơn ký tháng 9 không cùng một tỉ giá.

    Đơn ĐÃ HUỶ không tính tiền, nhưng vẫn đếm vào số đơn đã từng đặt.
  */
  const stats = new Map<
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
    const cur = stats.get(p.supplier_id)
    if (!cur) {
      stats.set(p.supplier_id, {
        count: 1,
        open,
        last_code: p.code,
        last_at: p.created_at,
        spend: spend ? { [p.currency]: spend } : {},
      })
      continue
    }
    cur.count++
    cur.open += open
    if (spend) cur.spend[p.currency] = (cur.spend[p.currency] ?? 0) + spend
    // `posRepo.list` trả mới nhất trước, nhưng so ngày lại một lần nữa để mốc
    // "gần nhất" không phụ thuộc thứ tự của repo.
    if (p.created_at > cur.last_at) {
      cur.last_at = p.created_at
      cur.last_code = p.code
    }
  }

  const rows = suppliers.map((s) => {
    const st = stats.get(s.id)
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      short_name: s.short_name,
      tax_no: s.tax_no,
      type: s.type,
      status: s.status,
      is_active: s.is_active,
      can_order: s.can_order,
      po_count: st?.count ?? 0,
      open_po_count: st?.open ?? 0,
      last_po: st?.last_code ?? null,
      last_po_at: st?.last_at ?? null,
      spend: st?.spend ?? {},
    }
  })

  return (
    <NccScreen
      rows={rows}
      canEdit={!!canEdit}
      chamTran={
        suppliers.length >= CAP ? 'ncc' : pos.length >= CAP ? 'don' : null
      }
    />
  )
}

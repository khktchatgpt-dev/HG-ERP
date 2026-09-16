import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
// Hằng nằm ở module KHÔNG 'use client' — để trong `VatTuScreen` thì Next biến
// mọi export của file đó thành client-reference và server đọc ra `undefined`
// → `range(0, NaN)` → danh sách rỗng mà không báo lỗi (bẫy đã ghi trong
// `warehouse/materials/constants.ts`, dùng lại luôn hằng đó cho khỏi lệch).
import { PAGE_SIZE } from '@/components/warehouse/materials-constants'
import { VatTuScreen } from './VatTuScreen'

export const metadata = { title: 'Mua hàng · Vật tư' }

/**
 * DANH MỤC VẬT TƯ — Khuôn C, dựng bằng kit (Đợt 3, 14/09/2026).
 *
 * TRANG NÀY LÀ MỘT Ô TÌM, KHÔNG PHẢI MỘT BẢNG ĐỂ LƯỚT. Danh mục có **13.226
 * mã** — lướt hết là 265 trang, không ai làm thế. Người mua tới đây với một mã
 * hoặc một cái tên trong đầu; việc của màn là đưa họ tới đúng dòng đó nhanh
 * nhất, rồi trả lời "nó là gì, lần trước mua bao nhiêu".
 *
 * LỌC VÀ PHÂN TRANG Ở SERVER, KHÔNG Ở CLIENT. Trang NCC (164 dòng) lọc ở
 * client được vì cả tập nằm gọn trong một lần nạp; 13.226 dòng thì không —
 * gửi hết xuống trình duyệt là vài MB cho một màn hiện 50 dòng. Bộ lọc nằm
 * trong URL nên gửi link cho đồng nghiệp là họ thấy đúng thứ mình đang thấy.
 *
 * BA CỘT CỐ Ý KHÔNG CÓ, vì đo ra gần như rỗng (14/09/2026):
 *   · `default_supplier_id` — 166/13.226 (**1%**);
 *   · lịch sử mua thật (dòng đơn có mã VT) — **114** mã từng được mua;
 *   · `vat_rate` — **0**.
 * Nghĩa là câu "mua của ai" mà cây menu hứa, dữ liệu HIỆN CHƯA trả lời được
 * cho 99% danh mục: hệ thống mới chạy 69 đơn. Bày một cột rỗng 99% để giữ lời
 * hứa đó là tự nói dối. Khi số đơn lên, dựng lại cột này là việc một buổi.
 *
 * `last_purchase_price` giữ lại dù chỉ 955/13.226 (7%): đó là con số người mua
 * đi tìm, và ô trống ở đây có nghĩa thật — "chưa từng mua qua hệ thống" —
 * chứ không phải thiếu dữ liệu do lỗi nhập.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nhom?: string; ra?: string; trang?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const canEdit = await canAction(user, 'warehouse.material.update_purchasing')

  const q = sp.q?.trim() || undefined
  const group = sp.nhom?.trim() || undefined
  const review = sp.ra === '1'
  const page = Math.max(1, Number(sp.trang) || 1)

  const [{ rows }, counts, tax] = await Promise.all([
    materialsService.list(user, {
      q,
      group_name: group,
      needs_review: review ? true : undefined,
      page,
      page_size: PAGE_SIZE,
      active_only: false,
    }),
    // Đếm ở DB theo ĐÚNG bộ lọc đang áp, không cộng từ trang đang xem: 50 dòng
    // trên màn không nói được gì về 13.226 dòng phía sau.
    materialsService.counts(user, { q, group_name: group, needs_review: review ? true : undefined }),
    materialTaxonomy(),
  ])

  return (
    <VatTuScreen
      rows={rows.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        group_name: m.group_name,
        sub_group: m.sub_group,
        spec: m.spec,
        last_purchase_price: m.last_purchase_price,
        price_unit: m.price_unit,
        needs_review: m.needs_review,
      }))}
      counts={counts}
      groups={tax.groups.map((g) => g.name)}
      page={page}
      filters={{ q: sp.q ?? '', nhom: sp.nhom ?? '', ra: review }}
      canEdit={canEdit}
    />
  )
}

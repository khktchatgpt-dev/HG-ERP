import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
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
  searchParams: Promise<{
    q?: string
    nhom?: string
    ra?: string
    kn?: string
    ng?: string
    trang?: string
  }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()

  const q = sp.q?.trim() || undefined
  const group = sp.nhom?.trim() || undefined
  const review = sp.ra === '1'
  // Chưa có nhóm con — rổ việc chia nhóm (29/09/2026).
  const noSub = sp.kn === '1'
  // Chip 'Ngừng dùng' (05/10/2026): mặc định danh sách CHỈ mã đang dùng, mã
  // ngừng dùng xem riêng ở chip này — cùng nếp ô chọn vật tư khi soạn đơn.
  const ngung = sp.ng === '1'
  const page = Math.max(1, Number(sp.trang) || 1)

  const [{ rows }, counts, tax, canEdit, canRetire, { rows: sups }] = await Promise.all([
    materialsService.list(user, {
      q,
      group_name: group,
      needs_review: review ? true : undefined,
      no_sub: noSub || undefined,
      page,
      page_size: PAGE_SIZE,
      active_only: !ngung,
      inactive_only: ngung,
    }),
    // Đếm ở DB theo ĐÚNG bộ lọc đang áp, không cộng từ trang đang xem: 50 dòng
    // trên màn không nói được gì về 13.226 dòng phía sau.
    materialsService.counts(user, {
      q,
      group_name: group,
      needs_review: review ? true : undefined,
      no_sub: noSub || undefined,
      active_only: !ngung,
      inactive_only: ngung,
    }),
    materialTaxonomy(),
    // Đúng quyền service kiểm khi lưu — nút không hứa điều service từ chối.
    canAction(user, 'warehouse.material.update_purchasing'),
    canAction(user, 'warehouse.material.retire'),
    suppliersService.list(user, { page: 1, page_size: 500 }),
  ])

  // Ngày · người · lý do ngừng — chỉ cần khi đang xem tập ngừng dùng.
  const ngungBy = ngung ? await materialsService.lastRetire(user, rows.map((m) => m.id)) : null

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
        ngung: ngungBy?.get(m.id) ?? null,
      }))}
      counts={counts}
      groups={tax.groups.map((g) => g.name)}
      canEdit={canEdit}
      canRetire={canRetire}
      tax={tax}
      suppliers={sups
        .filter((x) => !x.is_carrier)
        .map((x) => ({
          value: x.id,
          label: x.code ? `${x.code} · ${x.short_name ?? x.name}` : x.name,
        }))}
      page={page}
      filters={{ q: sp.q ?? '', nhom: sp.nhom ?? '', ra: review, kn: noSub, ng: ngung }}
    />
  )
}

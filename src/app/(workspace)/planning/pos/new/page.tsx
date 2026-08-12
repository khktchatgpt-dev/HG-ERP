import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { settingsService } from '@/modules/core/settings/settings.service'
import { PoCreateForm } from './PoCreateForm'

/**
 * Trang soạn đơn đặt hàng.
 *
 * Chỉ nạp NCC + LSX. Vật tư TÌM Ở SERVER qua `/api/dept/supply/po-materials` khi
 * gõ — bản cũ nạp sẵn 1.000 vật tư + toàn bộ tồn kho + 500 PO ngay ở render chỉ
 * để phục vụ một ô lọc, tốn egress Supabase mỗi lần mở trang.
 */
export default async function NewPoPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>
}) {
  const user = await authService.requirePageUser()
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  if (!canEdit) redirect('/planning/pos')
  const { supplier: defaultSupplierId } = await searchParams

  // `company` cho nút "Xem trước phiếu in" — dựng đúng tờ phiếu sẽ gửi NCC ngay
  // lúc còn đang soạn. Settings có cache trong process nên gần như không tốn gì.
  const [{ rows: suppliers }, { rows: lsxAll }, company] = await Promise.all([
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.list({ page: 1, page_size: 200 }),
    settingsService.getAll(),
  ])

  return (
    <PoCreateForm
      defaultSupplierId={defaultSupplierId}
      company={company}
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        rating: s.rating,
        lead_time_days: s.lead_time_days,
        payment_terms: s.payment_terms,
        // Tiền tệ mặc định của NCC — chọn NCC là form tự chuyển (gỗ báo USD).
        currency: s.currency,
        // Địa chỉ / MST / SĐT chỉ dùng cho khối "Kính gửi" của phiếu xem trước.
        address: s.address,
        tax_no: s.tax_no,
        phone: s.phone,
      }))}
      // Chỉ LSX đã qua duyệt GĐ mới đặt vật tư được (service cũng chặn — BR-05).
      lsxs={lsxAll
        .filter((l) => l.status === 'approved' || l.status === 'in_progress')
        .map((l) => ({
          id: l.id,
          code: l.code,
          order_codes: l.order_codes,
          customer_name: l.customer_name,
        }))}
    />
  )
}

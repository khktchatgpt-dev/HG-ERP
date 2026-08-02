import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import {
  productionRepo,
  listLsxProducts,
} from '@/modules/dept/production/production.repo'
import { posService } from '@/modules/dept/supply/pos.service'
import { poMaterialsRepo } from '@/modules/dept/supply/po-materials.repo'
import { poTemplateMeta } from '@/lib/po-template'
import { PoCreateForm } from '../../new/PoCreateForm'
import { lineFromPo } from '../../new/po-line'

/**
 * SỬA / NHÂN BẢN đơn đặt hàng — dùng CHUNG form soạn đơn.
 *
 * Trước đây `PosManager` có form sửa riêng theo mô hình cũ (một bảng cột cứng,
 * không biết mẫu đơn). Sửa một đơn nhôm bằng form đó sẽ hạ mẫu về 'simple', xoá
 * kg/m + dài cây, và thành tiền tụt từ (tổng kg × giá/kg) xuống (số cây × giá/kg).
 * Một form duy nhất thì không có đường nào để hai bên lệch nhau.
 *
 * `?duplicate=1` = mở nội dung đơn cũ nhưng lưu thành đơn MỚI (đơn thép/phụ kiện
 * lặp lại hằng tháng, chỉ đổi SL và giá).
 */
export default async function EditPoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ duplicate?: string }>
}) {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  if (!canEdit) redirect('/planning/pos')

  const { id } = await params
  const { duplicate } = await searchParams
  const mode = duplicate ? 'duplicate' : 'edit'

  const detail = await posService.detail(user, id).catch(() => null)
  if (!detail) notFound()
  const { po, lines } = detail

  // BR: chỉ đơn chờ duyệt mới sửa được (service cũng chặn) — vào thẳng URL khi
  // đơn đã duyệt thì đẩy về danh sách thay vì để bấm Lưu rồi mới báo lỗi.
  if (mode === 'edit' && po.status !== 'pending_approval') redirect('/planning/pos')

  const [{ rows: suppliers }, { rows: lsxAll }, mats] = await Promise.all([
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.list({ page: 1, page_size: 200 }),
    poMaterialsRepo.byIds(lines.map((l) => l.material_id)),
  ])
  const onHand = new Map(mats.map((m) => [m.id, m.on_hand]))
  const meta = poTemplateMeta(po.template)

  // Mã SP của lệnh gắn với đơn — ô "Mã SP" từng dòng chọn từ đây. Nạp ở server
  // để mở form sửa là có sẵn, không phải chọn lại LSX mới ra danh sách.
  const lsxOfPo = po.production_order_id
    ? await productionRepo.findById(po.production_order_id)
    : null
  const lsxProducts = lsxOfPo?.sales_order_id
    ? await listLsxProducts(lsxOfPo.sales_order_id)
    : []

  return (
    <PoCreateForm
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        rating: s.rating,
        lead_time_days: s.lead_time_days,
        payment_terms: s.payment_terms,
      }))}
      lsxs={lsxAll
        .filter((l) => l.status === 'approved' || l.status === 'in_progress')
        .map((l) => ({
          id: l.id,
          code: l.code,
          order_code: l.order_code,
          customer_name: l.customer_name,
        }))}
      initial={{
        mode,
        po: {
          id: po.id,
          code: po.code,
          template: po.template ?? 'simple',
          production_order_id: po.production_order_id,
          supplier_id: po.supplier_id,
          currency: po.currency,
          vat_rate: po.vat_rate,
          price_includes_vat: po.price_includes_vat,
          discount_amount: po.discount_amount,
          contract_no: po.contract_no,
          // `expected_at` là `date` — cắt phần giờ cho <input type="date">.
          expected_at: po.expected_at ? po.expected_at.slice(0, 10) : null,
          note: po.note,
          signer_role: po.signer_role,
          // Đơn tạo trước 0106 chưa có 5 điều khoản tách dòng → lấy mặc định của
          // mẫu để phiếu in không rỗng, người dùng sửa lại nếu cần.
          terms: {
            quality: po.terms_quality ?? meta.terms.quality,
            delivery_place: po.terms_delivery_place ?? meta.terms.delivery_place,
            payment: po.terms_payment ?? meta.terms.payment,
            invoice: po.terms_invoice ?? meta.terms.invoice,
            lead_time: po.terms_lead_time ?? meta.terms.lead_time,
          },
        },
        lines: lines.map((l) => lineFromPo(l, onHand.get(l.material_id) ?? 0)),
      }}
      initialProducts={lsxProducts}
    />
  )
}

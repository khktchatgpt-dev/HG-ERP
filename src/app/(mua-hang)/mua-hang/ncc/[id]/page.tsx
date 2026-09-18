import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { loadPriceBook, posRepo } from '@/modules/dept/supply/pos.repo'
import { HoSoNccScreen } from './HoSoNccScreen'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await suppliersRepo.findById(id).catch(() => null)
  return { title: s ? `Mua hàng · ${s.short_name ?? s.name}` : 'Mua hàng · Nhà cung cấp' }
}

/**
 * HỒ SƠ NHÀ CUNG CẤP — KHUÔN E (Đợt 3, 15/09/2026).
 *
 * Tới hôm nay, bấm một NCC ở `/mua-hang/ncc` là rời khu mới sang
 * `/planning/suppliers/[id]`. Đây là chỗ CUỐI CÙNG trong khu Mua hàng còn đá
 * người dùng ra ngoài trên đường đi hằng ngày.
 *
 * KHUÔN E, KHÔNG PHẢI KHUÔN D. Hồ sơ danh mục KHÔNG có vòng đời duyệt — nhét
 * nó vào khuôn chứng từ là phải bịa ra một vòng đời, rồi người dùng đi tìm nút
 * "gửi duyệt" trên thứ không ai duyệt bao giờ. Chỗ của ba trục trạng thái ở
 * đây là DẢI HIỆU SUẤT, và mỗi ô bắt buộc kèm mẫu số.
 *
 * MỌI SỐ TRÊN DẢI SUY TỪ ĐƠN THẬT, không lấy trường chấm tay: đo 15/09/2026
 * thì `quality_score`, `service_score`, `price_score`, `lead_time_days` đều
 * 1/164 NCC, `complaint_count` 0/164. Hiện 0 điểm cho 163 NCC còn lại là VU
 * cho họ điểm kém — nên ô đó để `null` kèm câu nói rõ chưa ai chấm.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const [ncc, supplyStaff, { rows: pos }, giaAll] = await Promise.all([
    suppliersRepo.findById(id),
    isSupplyStaff(user),
    posRepo.list({ supplier_id: id, page: 1, page_size: 500 }),
    loadPriceBook(),
  ])
  if (!ncc) notFound()

  const poIds = pos.map((p) => p.id)
  const totals = await posRepo.totalsByPoIds(poIds)

  return (
    <HoSoNccScreen
      canEdit={user.role === 'admin' || supplyStaff}
      ncc={{
        id: ncc.id,
        code: ncc.code,
        name: ncc.name,
        short_name: ncc.short_name,
        type: ncc.type,
        status: ncc.status,
        is_active: ncc.is_active,
        can_order: ncc.can_order,
        lock_reason: ncc.lock_reason,
        tax_no: ncc.tax_no,
        phone: ncc.phone,
        email: ncc.email,
        address: ncc.address,
        legal_rep: ncc.legal_rep,
        payment_terms: ncc.payment_terms,
        // Bốn trường phiếu sửa cần — hai ô liên hệ (nối 17/09) và hai ô MỒI
        // xuống đơn mới (số ngày nợ, lead time).
        payment_net_days: ncc.payment_net_days,
        lead_time_days: ncc.lead_time_days,
        contact_name: ncc.contact_name,
        contact_phone: ncc.contact_phone,
        note: ncc.note,
      }}
      pos={pos.map((p) => ({
        id: p.id,
        code: p.code,
        status: p.status,
        currency: p.currency,
        created_at: p.created_at,
        expected_at: p.expected_at,
        lsx_code: p.lsx_code,
        total: totals[p.id] ?? 0,
      }))}
      gia={giaAll
        .filter((g) => g.supplier_id === id)
        .map((g) => ({ code: g.code, name: g.name, price: g.price, unit: g.unit, currency: g.currency, price_unit: g.price_unit, at: g.at, times: g.times }))} // prettier-ignore
    />
  )
}

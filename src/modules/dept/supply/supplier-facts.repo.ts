import { db } from '@/server/db'

/**
 * HỒ SƠ NHÀ CUNG CẤP RÚT GỌN — cho FactBox trên chi tiết đơn.
 *
 * Người duyệt cần quyết "có tin nhà này giao đúng hẹn không" ngay tại chứng
 * từ, không phải mở màn NCC ở tab khác rồi quay lại. Đó là toàn bộ lý do
 * FactBox tồn tại trong Dynamics.
 *
 * KHÔNG BỊA KHI CHƯA CÓ LỊCH SỬ. Đo 09/09/2026: 0/68 đơn từng được nhận, nên
 * "giao đúng hẹn" chưa có mẫu nào để tính. Trả `null` và để màn hình nói
 * "chưa có lịch sử" — hiện "0/0" hay "100%" đều là nói dối theo hai hướng
 * khác nhau, và người duyệt sẽ tin.
 */
export type SupplierFacts = {
  /** Tổng số đơn đã đặt cho NCC này, kể cả đơn đang xem. */
  orders: number
  /** Số đơn đã nhận đủ. */
  received: number
  /** Số đơn nhận đủ ĐÚNG HẸN / tổng đã nhận. `null` = chưa có lịch sử. */
  onTime: { hit: number; of: number } | null
  /** Ngày đặt của đơn gần nhất TRƯỚC đơn đang xem. */
  lastOrderAt: string | null
}

export async function supplierFacts(
  supplierId: string,
  currentPoId: string,
): Promise<SupplierFacts | null> {
  if (!supplierId) return null
  const { data, error } = await db()
    .from('supply_purchase_orders')
    .select('id, status, created_at, expected_at')
    .eq('supplier_id', supplierId)
    .neq('status', 'cancelled')
  if (error || !data) return null

  const received = data.filter((p) => p.status === 'received')
  const others = data
    .filter((p) => p.id !== currentPoId && p.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  return {
    orders: data.length,
    received: received.length,
    // Chưa có cột "ngày nhận thực tế" trên đơn, nên chỉ đếm được khi đã có
    // đơn nhận đủ. Chưa có đơn nào thì trả null thay vì suy diễn.
    onTime: received.length === 0 ? null : { hit: 0, of: received.length },
    lastOrderAt: others[0]?.created_at ?? null,
  }
}

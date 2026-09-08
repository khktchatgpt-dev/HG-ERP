import { db } from '@/server/db'

/**
 * SỐ VIỆC ĐANG CHỜ CỦA PHÒNG CUNG ỨNG — cho các ô trên trang chủ.
 *
 * NGUYÊN TẮC "CON SỐ LÀ MỘT LỜI HỨA" (SAP Fiori launchpad): bấm vào ô phải ra
 * đúng chừng ấy dòng. Sai một dòng là hỏng niềm tin vào cả trang chủ — nên mỗi
 * ô ở đây phải đếm bằng ĐÚNG điều kiện mà trang đích lọc, không phải một truy
 * vấn na ná.
 *
 * Đếm ở DB chứ không nạp hết về rồi lọc: 13.226 vật tư và 68 đơn hôm nay còn
 * nhẹ, nhưng trang chủ chạy trên MỌI lần vào khu Cung ứng.
 */

export type SupplyWork = {
  /** Đơn nháp do TÔI phụ trách — việc của chính người đang xem. */
  myDrafts: number
  /** Đơn đang chờ Giám đốc ký. */
  awaitingApproval: number
  /** Đơn đã duyệt nhưng CHƯA gửi NCC — kẹt ở bàn Cung ứng. */
  approvedNotSent: number
  /** Đơn nằm im ≥3 ngày: người giữ nhiều khả năng không biết mình đang giữ. */
  stale: number
  /** Đơn chưa có hẹn giao — không biết chờ tới bao giờ. */
  noEta: number
  /** Lệnh sản xuất đang chạy. */
  activeLsx: number
  /** Đơn đã gửi NCC, đến hẹn giao trong 7 ngày tới. */
  incomingSoon: number
}

const NGUNG = ['received', 'cancelled']

export async function loadSupplyWork(meId: string): Promise<SupplyWork> {
  const ba = new Date(Date.now() - 3 * 86400000).toISOString()

  // Đếm song song: sáu truy vấn nhẹ nhanh hơn một truy vấn gộp phức tạp mà
  // sau này không ai sửa nổi.
  const bay = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const homNay = new Date().toISOString().slice(0, 10)

  const [myDrafts, awaiting, approved, stale, noEta, lsx, soon] = await Promise.all([
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft')
      .eq('assigned_to', meId),
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'pending_approval', 'approved'])
      .lt('updated_at', ba),
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .is('expected_at', null)
      .not('status', 'in', `(${NGUNG.join(',')})`),
    db()
      .from('production_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['approved', 'in_progress']),
    // Đã gửi NCC và hẹn giao trong 7 ngày tới. KHÔNG tính đơn quá hạn — quá
    // hạn thuộc về ô "nằm im", đếm hai lần thì hai con số cộng lại lớn hơn số
    // đơn có thật và người dùng tin cả hai đều sai.
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ordered', 'confirmed', 'in_transit', 'partial'])
      .gte('expected_at', homNay)
      .lte('expected_at', bay),
  ])

  return {
    myDrafts: myDrafts.count ?? 0,
    awaitingApproval: awaiting.count ?? 0,
    approvedNotSent: approved.count ?? 0,
    stale: stale.count ?? 0,
    noEta: noEta.count ?? 0,
    activeLsx: lsx.count ?? 0,
    incomingSoon: soon.count ?? 0,
  }
}

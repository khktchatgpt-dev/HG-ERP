import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import {
  dungDotXuat,
  gomTheoLenh,
  khoaSp,
  kiemKeHoach,
  type DotXuat,
  type LenhXuat,
} from '@/lib/ke-hoach-xuat'
import { shipPlanRepo } from './ship-plan.repo'
import type { ShipPlanSaveInput } from './ship-plan.schema'

/** Lệnh còn lên kế hoạch xuất được — đã xong / huỷ / nháp thì thôi. */
const SUA_DUOC = ['pending_approval', 'approved', 'in_progress']

export const shipPlanService = {
  /**
   * KẾ HOẠCH XUẤT HÀNG — mọi đợt xuất của lệnh còn sống (đợt Sale chia nếu có,
   * không thì nhóm lệnh). Cùng mức lộ với danh sách đơn bán: layout khu Bán
   * hàng gác ai vào được; chỉ ĐỌC.
   */
  async board(user: User): Promise<DotXuat[]> {
    void user // giữ chữ ký service (user đầu tiên) để sau gác quyền không phải đổi chỗ gọi
    return dungDotXuat(await shipPlanRepo.load())
  },

  /**
   * Kế hoạch xuất THEO LỆNH (06/10/2026): mỗi lệnh = các đợt (PO khách + ngày
   * xuất) × SP. Trả cả `dots` (cùng một lần đọc DB) cho khung "Tổng theo tháng".
   */
  async plan(user: User): Promise<{ lenhs: LenhXuat[]; dots: DotXuat[] }> {
    void user
    const raw = await shipPlanRepo.load()
    const lenhs = gomTheoLenh(raw)
    return { lenhs, dots: lenhs.flatMap((l) => l.dots) }
  },

  /**
   * SALE CHIA ĐỢT cho một lệnh (0222) — thay cả bộ kế hoạch. KHÔNG đụng dòng
   * lệnh, nên KHÔNG tạo bản chỉnh sửa lệnh (chủ dự án chốt 06/10: màn chia đợt
   * riêng cho Sale). Quyền: như sửa đơn bán (`sales.order.manage`).
   * Kiểm bằng CHÍNH hàm màn hình dùng (`kiemKeHoach`): vượt SL lệnh / SP lạ /
   * đợt rỗng thì chặn; xếp thiếu thì cho (chia dần từng PO).
   */
  async save(user: User, lsxId: string, input: ShipPlanSaveInput): Promise<void> {
    await assertAction(user, 'sales.order.manage')
    const found = await shipPlanRepo.lsxForPlan(lsxId)
    if (!found) throw NotFound('Lệnh sản xuất không tồn tại')
    if (!SUA_DUOC.includes(found.lsx.status))
      throw BadRequest(
        `Lệnh ${found.lsx.code} không còn lên kế hoạch xuất được (đã xong / huỷ / nháp)`,
      )
    const sps = new Map<
      string,
      { key: string; code: string; qty: number; product_id: string | null }
    >()
    for (const l of found.lines) {
      const k = khoaSp(l)
      const sp = sps.get(k) ?? { key: k, code: k, qty: 0, product_id: l.product_id }
      sp.qty += l.qty
      sps.set(k, sp)
    }
    const { loi } = kiemKeHoach(input.lots, [...sps.values()])
    if (loi.length) throw BadRequest(loi.slice(0, 5).join(' · '))
    const productIds = Object.fromEntries(
      [...sps.values()].map((s) => [s.key, s.product_id]),
    )
    await shipPlanRepo.replaceLots(
      lsxId,
      input.lots.map((l) => ({ ...l, product_ids: productIds })),
      user.id,
    )
  },
}

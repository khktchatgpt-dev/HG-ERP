import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { todayVn } from '@/lib/date-vn'
import { XuatScreen } from './XuatScreen'

const TO_THEO_CONG_DOAN = [
  'phôi',
  'hàn',
  'nguội',
  'sơn sắt',
  'sơn nhôm',
  'may',
  'cắt vải',
  'cơ điện',
]
const thuTuTo = (n: string) => {
  const k = n.toLowerCase().replace(/^tổ\s+/, '')
  const i = TO_THEO_CONG_DOAN.indexOf(k)
  return i < 0 ? 99 : i
}

export const metadata = { title: 'Kho · Xuất kho' }
export const dynamic = 'force-dynamic'

/**
 * XUẤT KHO THEO THỰC TẾ LẤY — `/warehouse/xuat` (Bước 2 Kho,
 * `docs/kho-buoc-2-xuat-kho.md`). Chủ dự án chốt 16/09/2026: không so định
 * mức; thủ kho ghi mã, số lượng, lệnh hoặc tổ nhận.
 *
 * Trang nạp ba danh mục nhỏ cho dải chip: lệnh đang chạy (đã duyệt / đang
 * SX — đúng tập service cho xuất), tên tổ để gợi ý ô người nhận, và quyền
 * ghi sổ. Vật tư KHÔNG nạp trước (13.229 mã) — tìm từng mã qua API lúc thêm
 * dòng, tồn dùng được tra cùng lúc.
 */
export default async function WarehouseIssuePage() {
  const user = await authService.requirePageUser()
  const [lsx, deps, canEdit] = await Promise.all([
    productionRepo.listActive(),
    departmentsRepo.list(),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  // Tổ nhận vật tư: các phòng tên "Tổ …" + hai tổ đặt tên khác (Cắt Vải, Xưởng).
  const to = deps
    .map((d) => d.name)
    // `\b` của JS chỉ hiểu ranh giới ASCII — "Tổ Hàn" không khớp /^tổ\b/. Đo
    // 16/09: dải Tổ lấy chỉ còn "Cắt Vải" và "Xưởng Sản Xuất". Dùng \s.
    .filter((n) => /^tổ\s+/i.test(n) || /^cắt vải$/i.test(n))
    // Xếp theo CÔNG ĐOẠN (phôi → hàn → nguội → sơn → may → cắt vải → cơ điện),
    // không theo chữ cái — thủ kho nhớ dây chuyền, không nhớ bảng chữ.
    .sort((a, b) => thuTuTo(a) - thuTuTo(b))

  return (
    <XuatScreen
      lsx={lsx.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
        order_codes: l.order_codes,
        status: l.status,
      }))}
      to={to}
      phong={deps.map((d) => d.name).sort((a, b) => a.localeCompare(b, 'vi'))}
      today={todayVn()}
      nguoiLap={user.name ?? user.email}
      canEdit={canEdit}
    />
  )
}

import { authService } from '@/modules/core/auth/auth.service'
import { buildLsxSupplyRows } from '@/modules/dept/supply/lsx-supply.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { LsxSupplyScreen } from './LsxSupplyScreen'

export const dynamic = 'force-dynamic'

/**
 * VẬT TƯ THEO LỆNH — màn của phòng Cung ứng, không phải bản sao màn xưởng.
 *
 * Trước đây route này dùng lại `RunningLsxList` của khu Sản xuất (tiến độ công
 * đoạn, tổ nào chạy) — người mua không quyết gì bằng những con số đó. Câu họ
 * cần trả lời là: LỆNH NÀY CỦA KHÁCH NÀO, làm những sản phẩm gì, bao giờ vật tư
 * phải về, và đã lập đơn mua nào rồi.
 *
 * CỐ Ý KHÔNG có phần "còn thiếu bao nhiêu" theo định mức: BOM chưa triển khai
 * thật (chủ dự án xác nhận 15/08/2026), tính ra sẽ là số rỗng hoặc số sai —
 * tệ hơn không có. Khi BOM có dữ liệu thì gắn thêm, dữ liệu và API đã sẵn
 * (`/api/dept/supply/needs`).
 *
 * Phần GOM DỮ LIỆU nằm ở `lsx-supply.service` để dùng chung với file xuất
 * Excel (`/api/dept/supply/lsx-report`) — một nguồn số cho cả hai.
 */
export default async function PlanningLsxPage() {
  const user = await authService.requirePageUser()
  const today = new Date().toISOString().slice(0, 10)

  const [rows, supplyStaff] = await Promise.all([
    buildLsxSupplyRows(user, today),
    isSupplyStaff(user),
  ])

  return (
    <LsxSupplyScreen
      rows={rows}
      today={today}
      canEdit={user.role === 'admin' || supplyStaff}
    />
  )
}

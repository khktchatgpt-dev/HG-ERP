import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'

/**
 * Ai phải biết khi một lệnh sản xuất động đậy: Kế hoạch + Cung ứng + Kỹ thuật +
 * cả nhà xưởng. Tách khỏi lsx.service để lsx-lines.service dùng chung mà không
 * tạo vòng import (lsx.service gọi ngược lsx-lines.service lúc phát lệnh).
 *
 * Tách vai 07/2026: phòng gộp cũ + 2 phòng tách đều nhận.
 */
const SUPPLY_DEPTS = new Set([
  'Kế Hoạch Sản Xuất-cung ứng',
  'Kế Hoạch Sản Xuất',
  'Cung Ứng - Mua Hàng',
])
const TECH_DEPT = 'Kỹ Thuật'

export async function lsxAudienceIds(): Promise<string[]> {
  const [depts, users] = await Promise.all([departmentsRepo.list(), usersRepo.list()])
  const target = new Set(
    depts
      .filter(
        (d) =>
          SUPPLY_DEPTS.has(d.name) ||
          d.name === TECH_DEPT ||
          d.workspace_id === 'production',
      )
      .map((d) => d.id),
  )
  return users
    .filter((u) => u.department_id && target.has(u.department_id))
    .map((u) => u.id)
}

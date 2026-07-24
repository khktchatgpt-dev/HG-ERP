import type { User } from '@/modules/core/users/users.repo'
import { hasPermission, hasRoleTag } from '@/modules/core/rbac/rbac.service'

/**
 * Guard mềm dùng chung của khu Sản xuất (đọc thẳng RBAC registry) — tách file
 * riêng để service/access.ts dùng chéo mà không vòng import.
 */

/** Thuộc bộ phận Sản xuất (tổ xưởng / thống kê / quản đốc). */
export async function isProductionStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'production.member')
}

/** Nhân sự Kế hoạch sản xuất — vai lên lộ trình + giao tổ + hạn. */
export async function isPlannerStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'planner.member')
}

/**
 * Quyền ĐỊNH HÌNH bảng chi tiết (thống kê xưởng tạo/sửa từ BOM Kỹ thuật —
 * user chốt 07/2026): permission production.components.edit
 * (seed gán director + planner + production_staff từ 0085).
 */
export async function canEditComponents(user: User): Promise<boolean> {
  return hasPermission(user, 'production.components.edit')
}

/** Quyền lên KẾ HOẠCH SX (lộ trình + giao tổ + hạn + ưu tiên) — 0085. */
export async function canManagePlan(user: User): Promise<boolean> {
  return hasPermission(user, 'production.plan.manage')
}

// ── Nhãn VỊ TRÍ trong xưởng (0087) — tách UI, KHÔNG phải quyền ──────────────

/** Thống kê xưởng — UI rơi vào Sổ số liệu, menu Sổ + Định hình. */
export async function isProductionStat(user: User): Promise<boolean> {
  return hasRoleTag(user, 'production_stat')
}

/** Tổ trưởng — UI rơi vào Việc của tổ, menu tối giản. */
export async function isProductionLeader(user: User): Promise<boolean> {
  return hasRoleTag(user, 'production_leader')
}

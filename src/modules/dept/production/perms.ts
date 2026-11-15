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

/**
 * Được ghi ngược bảng chi tiết của lệnh lên ĐỊNH MỨC hồ sơ SP ("Khởi tạo hồ sơ SP")
 * — Kỹ thuật / Kế hoạch / GĐ (bản vẽ 15/11/2026 SNZSog1E…, Q5). Thống kê có quyền
 * sửa bảng chi tiết nhưng KHÔNG ghi định mức: bảng thống kê khai nhanh (tên + số /
 * SP) chỉ thuộc lệnh; Cung ứng mua vật tư theo định mức hồ sơ.
 */
export async function canSeedProfile(user: User): Promise<boolean> {
  const [kt, kh] = await Promise.all([
    hasPermission(user, 'technical.edit'),
    hasPermission(user, 'production.plan.manage'),
  ])
  return kt || kh
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

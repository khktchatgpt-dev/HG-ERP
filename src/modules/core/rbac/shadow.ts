import type { User } from '@/modules/core/users/users.repo'
import { hasPermission } from './rbac.service'

/**
 * Shadow mode (Phase 1 chuyển RBAC): guard vẫn TRẢ VỀ kết quả CŨ (legacy) —
 * hành vi hệ thống không đổi 1 ly — nhưng đồng thời tính kết quả RBAC và
 * `console.warn` khi hai bên LỆCH. Sau một thời gian log sạch (0 lệch) là bằng
 * chứng backfill đúng → Phase tiếp theo bỏ nhánh legacy, trả thẳng RBAC.
 *
 * An toàn khi migration 0073 CHƯA apply: `hasPermission` lỗi (thiếu bảng) được
 * nuốt + log, guard vẫn trả legacy như thường.
 */
export async function shadowGuard(
  user: User,
  guard: string,
  legacy: boolean,
  permKey: string,
): Promise<boolean> {
  try {
    const next = await hasPermission(user, permKey)
    if (next !== legacy) {
      console.warn(
        `[rbac-shadow] ${guard}(${user.id}) legacy=${legacy} rbac=${next} key=${permKey}`,
      )
    }
  } catch (e) {
    console.warn(`[rbac-shadow] ${guard}(${user.id}) rbac error:`, e)
  }
  return legacy
}

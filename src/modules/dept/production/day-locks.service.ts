import { dayLocksRepo, type DayLock } from './day-locks.repo'
import { isProductionStaff } from './production.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

/**
 * CHỐT SỔ MỀM theo tổ + ngày (0068): thống kê chốt cuối ngày → sổ của
 * (tổ, ngày) khoá ghi/xoá ở outputs.service; muốn sửa phải nhờ quản đốc
 * (admin/manager) mở khoá. Không notify — nếu sau cần thêm event
 * `production.day.locked` (event bus).
 */
export const dayLocksService = {
  /**
   * Chốt sổ: bộ phận SX + admin (khớp canRecordOutput). NV xưởng bị ÉP tổ
   * mình (bỏ qua team gửi lên); admin/manager chốt hộ tổ chỉ định.
   */
  async lock(
    user: User,
    input: { entry_date: string; team_department_id?: string | null },
  ): Promise<DayLock> {
    const isMgr = user.role === 'admin' || user.role === 'manager'
    if (!isMgr && !(await isProductionStaff(user))) {
      throw Forbidden('Chỉ bộ phận Sản xuất hoặc Ban quản lý chốt sổ')
    }
    const teamId = isMgr
      ? (input.team_department_id ?? user.department_id)
      : user.department_id
    if (!teamId) {
      throw BadRequest(
        isMgr ? 'Chọn tổ cần chốt sổ' : 'Tài khoản chưa gán tổ — nhờ IT gán phòng ban',
      )
    }
    const dept = await departmentsRepo.findById(teamId)
    if (!dept || dept.workspace_id !== 'production') {
      throw BadRequest('Chỉ chốt sổ cho tổ thuộc xưởng sản xuất')
    }
    const { lock, duplicate } = await dayLocksRepo.insert({
      team_department_id: teamId,
      entry_date: input.entry_date,
      locked_by: user.id,
    })
    if (duplicate || !lock) {
      throw Conflict(`${dept.name} đã chốt sổ ngày ${input.entry_date}`)
    }
    return lock
  },

  /** Mở khoá: CHỈ admin/manager — có vết (badge sổ hiện ai chốt, mở là xoá dòng). */
  async unlock(user: User, teamId: string, date: string): Promise<void> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw Forbidden('Chỉ Giám đốc/Ban quản lý mở khoá sổ đã chốt')
    }
    const existing = await dayLocksRepo.find(teamId, date)
    if (!existing) throw NotFound('Tổ chưa chốt sổ ngày này')
    await dayLocksRepo.deleteByTeamDate(teamId, date)
  },

  /** Trạng thái chốt của 1 ngày — mọi NV đã đăng nhập đọc. */
  async listByDate(_user: User, date: string): Promise<DayLock[]> {
    return dayLocksRepo.listByDate(date)
  },
}

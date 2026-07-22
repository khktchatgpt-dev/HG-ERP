import { leaveRepo, type LeaveRequest, type LeaveStatus, type LeaveType } from './hr.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { shadowGuard } from '@/modules/core/rbac/shadow'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

const HR_DEPT_NAME = 'Hành Chính Nhân Sự'

async function isHRStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const legacy = dept?.name === HR_DEPT_NAME
  // Phase 1 RBAC: shadow-so với hr.member, vẫn trả legacy.
  return shadowGuard(user, 'isHRStaff', legacy, 'hr.member')
}

function canDecide(user: User): boolean {
  // Approver = manager (bất kỳ phòng nào) hoặc admin.
  return user.role === 'manager' || user.role === 'admin'
}

export const leaveService = {
  /** NV bất kỳ tạo đơn cho chính mình. */
  async create(
    user: User,
    input: {
      leave_type: LeaveType
      from_date: string
      to_date: string
      days_count: number
      reason?: string
    },
  ): Promise<LeaveRequest> {
    if (new Date(input.to_date) < new Date(input.from_date)) {
      throw BadRequest('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu')
    }
    return leaveRepo.insert({
      user_id: user.id,
      leave_type: input.leave_type,
      from_date: input.from_date,
      to_date: input.to_date,
      days_count: input.days_count,
      reason: input.reason ?? null,
    })
  },

  async list(
    user: User,
    opts: {
      scope: 'mine' | 'pending' | 'all'
      status?: LeaveStatus
      page: number
      page_size: number
    },
  ) {
    if (opts.scope === 'mine') {
      return leaveRepo.list({
        user_id: user.id,
        status: opts.status,
        page: opts.page,
        page_size: opts.page_size,
      })
    }
    if (opts.scope === 'pending') {
      if (!canDecide(user) && !(await isHRStaff(user))) throw Forbidden()
      return leaveRepo.list({
        status: 'pending',
        page: opts.page,
        page_size: opts.page_size,
      })
    }
    // 'all'
    if (!(await isHRStaff(user))) throw Forbidden('Chỉ HR/Admin xem được tất cả đơn')
    return leaveRepo.list({
      status: opts.status,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async decide(
    user: User,
    id: string,
    action: 'approve' | 'reject',
    note?: string,
  ): Promise<LeaveRequest> {
    if (!canDecide(user)) throw Forbidden('Chỉ quản lý mới duyệt được đơn')
    const before = await leaveRepo.findById(id)
    if (!before) throw NotFound('Đơn không tồn tại')
    if (before.status !== 'pending') {
      throw BadRequest(`Đơn đã ${before.status}, không thể thay đổi`)
    }
    return leaveRepo.patch(id, {
      status: action === 'approve' ? 'approved' : 'rejected',
      approver_id: user.id,
      approver_note: note ?? null,
      approved_at: new Date().toISOString(),
    })
  },

  async cancel(user: User, id: string): Promise<LeaveRequest> {
    const before = await leaveRepo.findById(id)
    if (!before) throw NotFound('Đơn không tồn tại')
    if (before.user_id !== user.id && user.role !== 'admin') {
      throw Forbidden('Bạn chỉ huỷ được đơn của mình')
    }
    if (before.status !== 'pending') {
      throw BadRequest('Chỉ đơn chờ duyệt mới huỷ được')
    }
    return leaveRepo.patch(id, { status: 'cancelled' })
  },
}

export { isHRStaff }

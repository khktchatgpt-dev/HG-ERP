import { leaveRepo, type LeaveRequest, type LeaveStatus, type LeaveType } from './hr.repo'
import type { User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isHRStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'hr.member')
}

// Approver = manager-tier. Permission hr.leave.decide (seed gán manager/admin).
async function canDecide(user: User): Promise<boolean> {
  return hasPermission(user, 'hr.leave.decide')
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
      if (!(await canDecide(user)) && !(await isHRStaff(user))) throw Forbidden()
      return leaveRepo.list({
        status: 'pending',
        page: opts.page,
        page_size: opts.page_size,
      })
    }
    // 'all'
    await assertAction(user, 'hr.leave.list_all')
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
    await assertAction(user, 'hr.leave.decide')
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

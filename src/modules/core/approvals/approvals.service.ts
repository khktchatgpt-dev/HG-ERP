import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import {
  approvalEventsRepo,
  type ApprovalAction,
  type ApprovalEntityType,
  type ApprovalEvent,
} from './approvals.repo'

/**
 * Đọc lịch sử phê duyệt — chỉ Ban Giám đốc (admin/manager) xem để quản lý.
 * Ghi log không qua service (do event handler, đã có actor từ event).
 */
export const approvalHistoryService = {
  async list(
    user: User,
    filter: {
      entity_type?: ApprovalEntityType
      action?: ApprovalAction
      limit?: number
    } = {},
  ): Promise<ApprovalEvent[]> {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw Forbidden('Chỉ Ban Giám đốc xem được lịch sử phê duyệt')
    }
    return approvalEventsRepo.listRecent(filter)
  },
}

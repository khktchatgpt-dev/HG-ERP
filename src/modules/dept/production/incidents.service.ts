import '@/events/register' // Đăng ký handler event ở lần import đầu tiên (như tasks.service).
import { incidentsRepo, type Incident } from './incidents.repo'
import { productionRepo } from './production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'
import { emit } from '@/events/bus'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import type { IncidentCreateInput } from './incidents.schema'

/** ID quản đốc (GĐ/Ban QL) nhận báo sự cố — trừ chính người thao tác. */
async function coordinatorIds(excludeId: string): Promise<string[]> {
  const users = await usersRepo.list()
  return users
    .filter((u) => (u.role === 'admin' || u.role === 'manager') && u.id !== excludeId)
    .map((u) => u.id)
}

/**
 * Sổ sự cố xưởng (tách vai 07/2026): tổ báo ngay trên thẻ việc, quản đốc thấy
 * danh sách đang mở ở màn Tiến độ và đóng khi xử lý xong. Append + resolve —
 * không sửa/xoá nội dung (giữ vết).
 */
export const incidentsService = {
  /** Đọc: mọi NV đã đăng nhập (cùng chính sách đọc mở của workspace SX). */
  async list(
    _user: User,
    opts: { status?: 'open' | 'resolved' } = {},
  ): Promise<Incident[]> {
    return incidentsRepo.list(opts)
  },

  /** Tổ báo sự cố — quyền mềm: mọi nhân sự xưởng (admin luôn được). */
  async report(user: User, input: IncidentCreateInput): Promise<Incident> {
    if (!(await hasPermission(user, 'production.incident.report'))) {
      throw Forbidden('Chỉ bộ phận sản xuất báo sự cố')
    }
    if (input.production_order_id) {
      const lsx = await productionRepo.findById(input.production_order_id)
      if (!lsx) throw BadRequest('LSX không tồn tại')
    }
    const incident = await incidentsRepo.insert({
      production_order_id: input.production_order_id ?? null,
      stage: input.stage ?? null,
      department_id: user.department_id,
      reported_by: user.id,
      message: input.message,
    })
    const dept = user.department_id
      ? await departmentsRepo.findById(user.department_id)
      : null
    await emit({
      name: 'production.incident.reported',
      incident_id: incident.id,
      production_order_id: incident.production_order_id,
      lsx_code: incident.lsx_code,
      stage: incident.stage,
      department_name: dept?.name ?? null,
      message: incident.message,
      reported_by: user.id,
      notify_ids: await coordinatorIds(user.id),
    })
    return incident
  },

  /** Quản đốc đóng sự cố: chỉ GĐ/Ban quản lý (admin/manager). */
  async resolve(user: User, id: string): Promise<Incident> {
    if (!(await hasPermission(user, 'production.incident.close'))) {
      throw Forbidden('Chỉ Giám đốc/Ban quản lý đóng sự cố')
    }
    const found = await incidentsRepo.findById(id)
    if (!found) throw NotFound('Sự cố không tồn tại')
    if (found.status === 'resolved') return found
    const incident = await incidentsRepo.resolve(id, user.id)
    await emit({
      name: 'production.incident.resolved',
      incident_id: incident.id,
      lsx_code: incident.lsx_code,
      message: incident.message,
      resolved_by: user.id,
      notify_ids: incident.reported_by ? [incident.reported_by] : [],
    })
    return incident
  },
}

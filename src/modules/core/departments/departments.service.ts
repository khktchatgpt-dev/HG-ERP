import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { safeSyncUserRoles } from '@/modules/core/rbac/rbac.sync'
import { BadRequest, Forbidden } from '@/server/http'

export const departmentsService = {
  async list() {
    return departmentsRepo.list()
  },

  async create(user: User, input: { name: string; description?: string }) {
    if (user.role !== 'admin') throw Forbidden('Only admin can create departments')
    return departmentsRepo.insert(input)
  },

  async update(
    user: User,
    id: string,
    patch: {
      name?: string
      description?: string | null
      head_user_id?: string | null
      stage_code?: string | null
    },
  ) {
    if (user.role !== 'admin') throw Forbidden('Only admin can edit departments')

    if (patch.head_user_id) {
      const head = await usersRepo.findById(patch.head_user_id)
      if (!head || !head.is_active) {
        throw BadRequest('Người dùng được chọn không tồn tại hoặc đã khoá')
      }
      if (head.department_id !== id) {
        throw BadRequest('Trưởng BP phải thuộc về phòng ban này')
      }
    }

    // Tổ ↔ công đoạn (0064): code phải có trong danh mục production_stage.
    if (patch.stage_code && !(await departmentsRepo.stageCodeExists(patch.stage_code))) {
      throw BadRequest('Công đoạn không có trong danh mục production_stage')
    }

    const before = await departmentsRepo.findById(id)
    const updated = await departmentsRepo.update(id, patch)

    // Đồng bộ role RBAC dẫn-xuất khi đổi trưởng phòng (role 'head') hoặc đổi
    // TÊN phòng (ảnh hưởng planner/supply trong workspace 'planning').
    const affected = new Set<string>()
    if (patch.head_user_id !== undefined && patch.head_user_id !== before?.head_user_id) {
      if (before?.head_user_id) affected.add(before.head_user_id)
      if (patch.head_user_id) affected.add(patch.head_user_id)
    }
    if (patch.name !== undefined && before && patch.name !== before.name) {
      for (const u of await usersRepo.list({ department_id: id })) affected.add(u.id)
    }
    for (const uid of affected) await safeSyncUserRoles(uid)

    return updated
  },

  async remove(user: User, id: string) {
    if (user.role !== 'admin') throw Forbidden('Only admin can delete departments')
    await departmentsRepo.delete(id)
  },
}

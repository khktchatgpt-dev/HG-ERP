import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
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

    return departmentsRepo.update(id, patch)
  },

  async remove(user: User, id: string) {
    if (user.role !== 'admin') throw Forbidden('Only admin can delete departments')
    await departmentsRepo.delete(id)
  },
}

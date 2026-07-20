import { defectCodesRepo, type DefectCode } from './defect-codes.repo'
import { productionRepo } from './production.repo'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, Conflict, Forbidden } from '@/server/http'

function assertAdmin(user: User): void {
  if (user.role !== 'admin') throw Forbidden('Chỉ admin quản lý danh mục lỗi')
}

async function assertStageValid(stageCode: string | null | undefined): Promise<void> {
  if (!stageCode) return
  const stages = await productionRepo.listStages()
  if (!stages.some((s) => s.code === stageCode)) {
    throw BadRequest('Công đoạn không có trong danh mục production_stage')
  }
}

/**
 * Danh mục nguyên nhân lỗi SX (0067): đọc mọi NV (dropdown sổ), ghi chỉ admin.
 * Code BẤT BIẾN sau tạo (sổ tham chiếu bằng code) — sai thì ẩn (is_active)
 * rồi tạo code mới, không sửa/xoá.
 */
export const defectCodesService = {
  async listActive(): Promise<DefectCode[]> {
    return defectCodesRepo.listActive()
  },

  async listAll(user: User): Promise<DefectCode[]> {
    assertAdmin(user)
    return defectCodesRepo.listAll()
  },

  async create(
    user: User,
    input: {
      code: string
      label: string
      stage_code?: string | null
      sort_order: number
    },
  ): Promise<DefectCode> {
    assertAdmin(user)
    await assertStageValid(input.stage_code)
    const { item, duplicate } = await defectCodesRepo.insert({
      code: input.code,
      label: input.label,
      stage_code: input.stage_code ?? null,
      sort_order: input.sort_order,
    })
    if (duplicate || !item) throw Conflict(`Code "${input.code}" đã tồn tại`)
    return item
  },

  async update(
    user: User,
    id: string,
    patch: Partial<{
      label: string
      stage_code: string | null
      sort_order: number
      is_active: boolean
    }>,
  ): Promise<DefectCode> {
    assertAdmin(user)
    if (patch.stage_code !== undefined) await assertStageValid(patch.stage_code)
    return defectCodesRepo.update(id, patch)
  },
}

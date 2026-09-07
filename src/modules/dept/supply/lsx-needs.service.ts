import { Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isSupplyStaff } from './suppliers.service'
import { lsxNeedsRepo, type LsxNeedManual } from './lsx-needs.repo'
import type { LsxNeedsDeleteInput, LsxNeedsUpsertInput } from './lsx-needs.schema'

/**
 * BẢNG KÊ NHẬP TAY (0184) — nghiệp vụ + quyền. Ai nhập: nhân viên Cung ứng và
 * admin, cùng quyền với soạn đơn (user chốt 05/09/2026). Đọc: mọi người đã đăng
 * nhập — bảng kê là thứ Sản xuất và Giám đốc cũng cần nhìn.
 */
async function assertCanEdit(user: User): Promise<void> {
  if (user.role === 'admin') return
  if (await isSupplyStaff(user)) return
  throw Forbidden('Chỉ phòng Cung ứng mới sửa được bảng kê vật tư')
}

async function assertLsx(id: string): Promise<void> {
  const lsx = await productionRepo.findById(id)
  if (!lsx) throw NotFound('Không tìm thấy lệnh sản xuất')
}

export const lsxNeedsService = {
  async list(productionOrderId: string): Promise<LsxNeedManual[]> {
    return lsxNeedsRepo.listByLsx(productionOrderId)
  },

  /** Ghi đè từng mã: dòng có sẵn thì thay số, chưa có thì thêm. */
  async upsert(user: User, input: LsxNeedsUpsertInput): Promise<LsxNeedManual[]> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    // Cùng một mã lặp trong payload (dán Excel hay có) → lấy dòng cuối, không
    // để upsert ném lỗi "ON CONFLICT cannot affect row a second time".
    const byMat = new Map<string, { material_id: string; qty_needed: number; note: string | null }>()
    for (const r of input.rows) {
      byMat.set(r.material_id, {
        material_id: r.material_id,
        qty_needed: r.qty_needed,
        note: r.note?.trim() ? r.note.trim() : null,
      })
    }
    await lsxNeedsRepo.upsertMany(input.production_order_id, [...byMat.values()], user.id)
    return lsxNeedsRepo.listByLsx(input.production_order_id)
  },

  /** Bỏ dòng tay → mã đó quay về nguồn tự động (hoặc biến mất nếu không có). */
  async remove(user: User, input: LsxNeedsDeleteInput): Promise<LsxNeedManual[]> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    await lsxNeedsRepo.deleteMany(input.production_order_id, input.material_ids)
    return lsxNeedsRepo.listByLsx(input.production_order_id)
  },
}

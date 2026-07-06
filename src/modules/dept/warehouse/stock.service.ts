import { stockRepo, movementsRepo } from './stock.repo'
import { materialsRepo } from './warehouse.repo'
import { isWarehouseUser } from './warehouse.service'
import { type User } from '@/modules/core/users/users.repo'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/** Chỉ Kho + admin/manager được ghi phiếu nhập/xuất. */
function canEdit(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

type ReceiveInput = {
  material_id: string
  qty: number // số ĐẠT vào kho
  qty_rejected?: number
  qc_status?: 'pass' | 'partial' | 'fail'
  ref_type: 'po' | 'external'
  ref_no?: string | null
  shelf_location?: string | null
  note?: string | null
}

type IssueInput = {
  material_id: string
  qty: number
  ref_type: 'lsx' | 'daily'
  ref_no?: string | null
  shelf_location?: string | null
  note?: string | null
}

export const stockService = {
  async listStock(
    user: User,
    opts: { q?: string; group_name?: string; low_only?: boolean },
  ) {
    if (!(await isWarehouseUser(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    return stockRepo.list({
      q: opts.q,
      group_name: opts.group_name,
      low_only: opts.low_only ?? false,
    })
  },

  /** Nhập kho (FR-WMS-02/04). qty = số ĐẠT; qty_rejected (QC không đạt) không vào tồn (BR-10). */
  async receive(user: User, input: ReceiveInput): Promise<{ id: string }> {
    if (!(await isWarehouseUser(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ quản lý Kho / admin nhập kho được')
    }
    const mat = await materialsRepo.findById(input.material_id)
    if (!mat) throw NotFound('Vật tư không tồn tại')
    if (!mat.is_active) throw BadRequest('Vật tư đã ngừng sử dụng, không nhập được')

    return movementsRepo.insert({
      material_id: input.material_id,
      direction: 'in',
      qty: input.qty,
      qty_rejected: input.qty_rejected ?? 0,
      qc_status: input.qc_status ?? null,
      ref_type: input.ref_type,
      ref_no: input.ref_no ?? null,
      shelf_location: input.shelf_location ?? mat.shelf_location,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  /** Xuất kho (FR-WMS-05/06). Không cho xuất quá tồn hiện có. */
  async issue(user: User, input: IssueInput): Promise<{ id: string }> {
    if (!(await isWarehouseUser(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ quản lý Kho / admin xuất kho được')
    }
    const mat = await materialsRepo.findById(input.material_id)
    if (!mat) throw NotFound('Vật tư không tồn tại')

    const onHand = await stockRepo.onHand(input.material_id)
    if (input.qty > onHand) {
      throw BadRequest(
        `Không đủ tồn để xuất: cần ${input.qty}, còn ${onHand} ${mat.unit}`,
      )
    }

    return movementsRepo.insert({
      material_id: input.material_id,
      direction: 'out',
      qty: input.qty,
      ref_type: input.ref_type,
      ref_no: input.ref_no ?? null,
      shelf_location: input.shelf_location ?? mat.shelf_location,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  async listMovements(
    user: User,
    opts: {
      material_id?: string
      direction?: 'in' | 'out'
      page: number
      page_size: number
    },
  ) {
    if (!(await isWarehouseUser(user))) throw Forbidden()
    return movementsRepo.list({
      material_id: opts.material_id,
      direction: opts.direction,
      page: opts.page,
      page_size: opts.page_size,
    })
  },
}

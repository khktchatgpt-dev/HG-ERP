import { BadRequest, Conflict, Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import {
  docsRepo,
  insertMovements,
  stockByBin,
  warehousesRepo,
  type StockStatus,
} from './stock.repo'
import { blockedLots, type BlockedLot } from './blocked.repo'

/**
 * HÀNG MẮC (Đợt 3 §2.3) — và ĐƯỜNG GHI ĐẦU TIÊN cho C2/C3.
 *
 * Trước file này, hai mã chuyển trạng thái của bộ 0197 không có nơi nào ghi
 * vào: bảng khai chúng, lib khai luật của chúng, nhưng không hành động nào
 * sinh ra dòng mang mã đó. Sổ §2.3 nói đúng — màn này là chỗ chúng ra đời.
 *
 * ĐỔI TRẠNG THÁI = MỘT CẶP DÒNG SỔ (0194): out khỏi trạng thái cũ + in vào
 * trạng thái mới, CÙNG kệ, nối bằng `transfer_group`. Không cột nào bị UPDATE
 * tại chỗ — sổ chỉ cộng thêm, không sửa lùi.
 */

/** Tuổi tính bằng ngày — cột làm nên lý do tồn tại của màn này. */
export function tuoiNgay(blockedAt: string | null, now = new Date()): number | null {
  if (!blockedAt) return null
  const ms = now.getTime() - new Date(blockedAt).getTime()
  return Math.floor(ms / 86_400_000)
}

/**
 * Mức gấp theo tuổi (sổ §2.3): quá 3 ngày `warn`, quá 7 ngày `stop`.
 *
 * Hàng mắc không ai nhắc thì nằm hết tháng — đó là toàn bộ lý do có cột tuổi,
 * nên nó phải đổi màu chứ không chỉ hiện số.
 */
export function mucGap(tuoi: number | null): 'neutral' | 'warn' | 'stop' {
  if (tuoi == null) return 'neutral'
  if (tuoi > 7) return 'stop'
  if (tuoi > 3) return 'warn'
  return 'neutral'
}

async function assertWrite(user: User): Promise<void> {
  await assertAction(user, 'warehouse.stock.write')
}

/** Lượng đang có ở đúng Ô (mã × kệ × trạng thái) — không tin client. */
async function qtyAt(
  materialId: string,
  binId: string | null,
  status: StockStatus,
): Promise<number> {
  const rows = await stockByBin({ material_ids: [materialId] })
  const hit = rows.find(
    (r) => (r.bin_id ?? null) === (binId ?? null) && r.stock_status === status,
  )
  return hit?.qty ?? 0
}

export const blockedService = {
  async list(user: User): Promise<BlockedLot[]> {
    await assertAction(user, 'warehouse.stock.read')
    return blockedLots()
  },

  /**
   * ĐỔI TRẠNG THÁI của một lượng — C2 (mở khoá) hoặc C3 (khoá lại).
   *
   * Lý do BẮT BUỘC cho cả hai chiều, không chỉ chiều khoá. Mở khoá là nói
   * "tôi đã kiểm lại và hàng này dùng được" — câu đó phải có người ký tên,
   * nếu không thì trạng thái khoá chỉ là một nút ai bấm cũng được.
   */
  async changeStatus(
    user: User,
    input: {
      material_id: string
      bin_id: string | null
      qty: number
      from: StockStatus
      to: StockStatus
      reason: string
    },
  ): Promise<{ id: string; code: string }> {
    await assertWrite(user)
    if (input.from === input.to) {
      throw BadRequest('Trạng thái đi và đến trùng nhau — không có gì để chuyển')
    }
    if (input.qty <= 0) throw BadRequest('Lượng chuyển phải lớn hơn 0')
    if (!input.reason.trim()) {
      throw BadRequest('Đổi trạng thái phải kèm lý do — nó đi theo lô suốt đời nó')
    }

    const have = await qtyAt(input.material_id, input.bin_id, input.from)
    if (input.qty > have + 1e-6) {
      throw Conflict(
        `Ô đó chỉ có ${have} ở trạng thái "${input.from}" — không chuyển được ${input.qty}`,
        'STATUS_SHORT',
      )
    }

    /*
     * MÃ LÝ DO suy từ CHIỀU chuyển, không nhận từ client: chỉ có hai chiều
     * có nghĩa nghiệp vụ, và để client chọn mã là mở đường cho một dòng
     * "mở khoá" mang mã "khoá hàng".
     */
    const reasonCode = input.to === 'blocked' ? 'C3' : 'C2'

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('DCK'),
      warehousesRepo.mainId(),
    ])
    const doc = await docsRepo.insert({
      code,
      kind: 'transfer',
      reason: `${input.to === 'blocked' ? 'Khoá hàng' : 'Mở khoá'}: ${input.reason.trim()}`,
      created_by: user.id,
    })

    const group = crypto.randomUUID()
    const common = {
      material_id: input.material_id,
      qty: input.qty,
      ref_type: 'transfer' as const,
      reason_code: reasonCode,
      transfer_group: group,
      note: input.reason.trim(),
      created_by: user.id,
      doc_id: doc.id,
      warehouse_id: warehouseId,
      bin_id: input.bin_id,
    }
    await insertMovements([
      { ...common, direction: 'out' as const, stock_status: input.from },
      { ...common, direction: 'in' as const, stock_status: input.to },
    ])
    return { id: doc.id, code: doc.code }
  },

  /**
   * XUẤT HUỶ hàng mắc — X4.
   *
   * QUYỀN THAY CHO VÒNG DUYỆT, và đây là một NỢ chứ không phải thiết kế:
   * `canDuyet('X4')` là true trong bộ mã, nhưng đường duyệt cho phiếu xuất
   * chưa có (chỉ kiểm kê mới có, từ 0157). Tạm siết bằng vai — chỉ admin và
   * quản lý huỷ được — để việc mất tài sản không nằm trong tay một cú bấm
   * của bất kỳ ai có quyền ghi kho. Nối vào vòng duyệt thật là việc còn lại,
   * ghi ở sổ §2.1 bước 2b.
   */
  async scrap(
    user: User,
    input: { material_id: string; bin_id: string | null; qty: number; reason: string },
  ): Promise<{ id: string; code: string }> {
    await assertWrite(user)
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw Forbidden(
        'Chỉ quản lý kho hoặc quản trị viên xuất huỷ được — huỷ là mất tài sản, không lùi lại được',
      )
    }
    if (input.qty <= 0) throw BadRequest('Lượng huỷ phải lớn hơn 0')
    if (!input.reason.trim()) throw BadRequest('Xuất huỷ bắt buộc ghi rõ nguyên nhân')

    const have = await qtyAt(input.material_id, input.bin_id, 'blocked')
    if (input.qty > have + 1e-6) {
      throw Conflict(`Ô đó chỉ còn ${have} đang khoá — không huỷ được ${input.qty}`)
    }

    const [code, warehouseId] = await Promise.all([
      docsRepo.nextCode('PXK'),
      warehousesRepo.mainId(),
    ])
    const doc = await docsRepo.insert({
      code,
      kind: 'issue',
      reason: `Xuất huỷ hàng mắc: ${input.reason.trim()}`,
      created_by: user.id,
    })
    await insertMovements([
      {
        material_id: input.material_id,
        direction: 'out' as const,
        qty: input.qty,
        ref_type: 'adjust',
        reason_code: 'X4',
        // Huỷ lượng ĐANG KHOÁ, nên dòng ra phải mang đúng trạng thái đó —
        // ghi 'ok' là rút từ một rổ không có hàng và làm rổ khoá âm vĩnh viễn.
        stock_status: 'blocked' as const,
        bin_id: input.bin_id,
        note: input.reason.trim(),
        created_by: user.id,
        doc_id: doc.id,
        warehouse_id: warehouseId,
      },
    ])
    return { id: doc.id, code: doc.code }
  },
}

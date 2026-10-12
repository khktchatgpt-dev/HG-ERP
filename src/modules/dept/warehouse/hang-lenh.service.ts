import type { User } from '@/modules/core/users/users.repo'
import { Forbidden } from '@/server/http'
import { tinhHangLenh, type HangLenhRow } from '@/lib/kho-hang-lenh'
import { hangLenhRepo } from './hang-lenh.repo'
import { issuedByLsx } from './stock.repo'
import { canViewWarehouse } from './warehouse.service'

/**
 * HÀNG CỦA LỆNH — "Lấy hàng của lệnh" trên phiếu xuất Kho (Kho đợt 2 · Bước 4).
 * Ghép bốn nguồn rồi giao cho luật thuần `tinhHangLenh` (một chỗ luật, có test).
 * Đã xuất dùng ĐÚNG `issuedByLsx` (ròng: xuất − hoàn kho − đảo) như bảng kê lệnh.
 */
export const hangLenhService = {
  async get(user: User, lsxId: string): Promise<HangLenhRow[]> {
    if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    const dong = await hangLenhRepo.dongCuaLenh(lsxId)
    if (dong.length === 0) return []
    const mats = [...new Set(dong.map((d) => d.material_id))]
    const [nhanTheoDong, daXuat, { ton, vatTu }] = await Promise.all([
      hangLenhRepo.nhanTheoDong(dong.map((d) => d.line_id)),
      issuedByLsx(lsxId),
      hangLenhRepo.tonVaTen(mats),
    ])
    return tinhHangLenh({ dong, nhanTheoDong, daXuat, ton, vatTu })
  },
}

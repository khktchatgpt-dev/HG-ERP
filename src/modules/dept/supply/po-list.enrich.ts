import { posRepo } from './pos.repo'
import { supplyRepo } from './supply.repo'

/**
 * BƠM THÊM SỐ cho danh sách Đơn mua — MỘT chỗ cho cả màn lẫn file Excel.
 *
 * Trước 27/09/2026 trang và route xuất Excel mỗi bên tự nạp, và route quên
 * lệnh GỘP (`extra_lsx`): lọc theo một lệnh phụ thì màn có đơn mua chung mà
 * file không có. Route lọc lại bằng chính `poMatches` của màn, nên mọi trường
 * `poMatches` đọc (lệnh gộp, tên vật tư cho ô tìm) phải có mặt ở cả hai bên —
 * hai bên gọi hàm này là hết lệch.
 */
export async function enrichPoList<T extends { id: string }>(pos: T[]) {
  const ids = pos.map((p) => p.id)
  const [totals, lineDone, extraLsx, materials] = await Promise.all([
    posRepo.totalsByPoIds(ids),
    supplyRepo.lineDoneByPoIds(ids),
    posRepo.extraLsxByPoIds(ids),
    posRepo.materialNamesByPoIds(ids),
  ])
  return pos.map((p) => ({
    ...p,
    total: totals[p.id] ?? 0,
    lines_done: lineDone.get(p.id)?.done ?? 0,
    lines_total: lineDone.get(p.id)?.total ?? 0,
    extra_lsx: extraLsx.get(p.id) ?? [],
    material_names: materials.get(p.id) ?? [],
  }))
}

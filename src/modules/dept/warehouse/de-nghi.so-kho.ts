import { soDuyet, trangThaiTheoSo } from '@/lib/de-nghi-nhap'
import { deNghiRepo } from './de-nghi.repo'

/**
 * TÍNH LẠI trạng thái phiếu đề nghị từ SỔ KHO (0238 · Đ4): sau mỗi lần nhập và
 * sau mỗi lần đảo phiếu nhập. Một hàm, hai nơi gọi (`deNghiService.nhapKho`,
 * `stockService.reverseDoc`) — tách file riêng để stock.service không phải
 * import de-nghi.service (vòng import).
 *
 * Chỉ đụng phiếu đã duyệt trở đi (approved / ordering / done). Phiếu đã "Chốt
 * xong" giữ Xong dù đảo bớt phiếu nhập — lý do chốt vẫn đúng.
 */
export async function capNhatTheoSoKho(requestIds: string[]): Promise<void> {
  for (const id of requestIds) {
    const p = await deNghiRepo.findById(id)
    if (!p || !['approved', 'ordering', 'done'].includes(p.status)) continue
    const so = await deNghiRepo.soKho(p.lines.map((l) => l.id))
    const moi = trangThaiTheoSo(
      p.lines.map((l) => ({ can: soDuyet(l), daNhap: so.get(l.id)?.daNhap ?? 0 })),
      !!p.closed_at,
    )
    if (moi !== p.status)
      await deNghiRepo.update(id, { status: moi }, ['approved', 'ordering', 'done'])
  }
}

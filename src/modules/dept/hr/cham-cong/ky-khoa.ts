import { Conflict } from '@/server/http'
import { kyCongRepo } from './ky-cong.repo'

/**
 * KHOÁ GHI THEO KỲ CÔNG (B3) — tách khỏi ky-cong.service để phiếu điều chỉnh và tick làm
 * trưa gọi được mà không kéo vòng import (kỳ công → bảng công → điều chỉnh).
 */

/** Chặn ghi phiếu / tick trưa cho ngày thuộc kỳ không còn mở. */
export async function kiemKhoaKy(ngays: string[]): Promise<void> {
  const khoa = await kyCongRepo.kyKhoaChua(ngays)
  if (khoa.length) {
    const t = khoa[0].thang
    throw Conflict(
      `Kỳ ${t.slice(5)}/${t.slice(0, 4)} đã chốt — xin mở lại kỳ, hoặc ghi khoản này vào bảng lương kỳ sau`,
    )
  }
}

/** Q4: phiếu điều chỉnh được duyệt cho người của một tổ đã xác nhận → tổ về "chưa xác nhận". */
export async function boXacNhanViPhieu(
  phieu: { ngay: string; boPhan: string | null; moTa: string }[],
  userId: string,
): Promise<void> {
  if (!phieu.length) return
  const teams = await kyCongRepo.toTheoTen()
  for (const p of phieu) {
    if (!p.boPhan) continue
    const id = teams.get(p.boPhan)
    const ky = id ? await kyCongRepo.kyMoChua(p.ngay) : null
    if (!ky || !id) continue
    if (await kyCongRepo.xoaXacNhan(ky.id, id))
      await kyCongRepo.ghiSuKien({
        kyId: ky.id,
        viec: 'team_unconfirm',
        teamId: id,
        userId,
        ghiChu: `Phiếu điều chỉnh được duyệt: ${p.moTa}`,
      })
  }
}

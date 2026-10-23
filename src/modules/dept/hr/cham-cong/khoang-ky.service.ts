import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict } from '@/server/http'
import {
  khoangKy,
  kiemKhoang,
  thangCua,
  type KhoangDat,
  type KhoangKy,
  type KiemKhoang,
} from '@/lib/cham-cong/khoang-ky'
import { kyCongRepo } from './ky-cong.repo'

/**
 * KHOẢNG KỲ CÔNG — Nhân sự đặt từ–đến từng kỳ (bản vẽ duyệt 21/10/2026). Mọi chỗ cần "kỳ
 * tháng X chạy từ ngày nào tới ngày nào" / "ngày D thuộc kỳ nào" đọc qua đây, không dùng
 * hằng 26 → 25 nữa. Quyền đặt = quyền sửa nhân viên chấm công (Q3); kỳ đã chốt thì khoá.
 */
export const khoangKyService = {
  /** Mọi kỳ đã đặt — truyền xuống màn phía trình duyệt khi màn cần tự tra (vài chục dòng). */
  ds(): Promise<KhoangDat[]> {
    return kyCongRepo.dsKhoang()
  },

  async cua(thang: string): Promise<KhoangKy> {
    return khoangKy(thang, await kyCongRepo.dsKhoang())
  },

  /** Kỳ đang chứa ngày `iso` (mặc định của các màn = kỳ chứa hôm nay). */
  async thangCua(iso: string): Promise<string> {
    return thangCua(iso, await kyCongRepo.dsKhoang())
  },

  /** Kỳ trên URL nếu hợp lệ, không thì kỳ đang chứa hôm nay — mặc định chung của mọi màn theo kỳ. */
  async chon(thang: string | undefined, homNay: string): Promise<string> {
    // BẪY đã dính: heredoc từng nuốt dấu \ của \d → regex không bao giờ khớp, URL ?thang= bị bỏ qua (23/10/2026).
    return thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(thang) ? thang : this.thangCua(homNay)
  },

  async dat(
    user: User,
    thang: string,
    v: { tu: string; den: string; lyDo?: string | null },
  ): Promise<KiemKhoang> {
    await assertAction(user, 'hr.attendance.employee_edit')
    const ky = await kyCongRepo.ky(thang)
    if (ky && ky.trangThai !== 'open')
      throw Conflict(
        `Kỳ ${thang.slice(5)}/${thang.slice(0, 4)} đã chốt — khoảng kỳ khoá theo bản chốt. Xin mở lại kỳ trước khi đổi.`,
      )
    const ds = await kyCongRepo.dsKhoang()
    const k = kiemKhoang(thang, v.tu, v.den, ds)
    if (k.loi.length) throw BadRequest(k.loi[0])
    const lyDo = v.lyDo?.trim() || null
    if (k.khacGoiY && !lyDo)
      throw BadRequest('Khoảng kỳ khác gợi ý nối tiếp kỳ trước — ghi lý do')
    const cu = khoangKy(thang, ds)
    const moi = await kyCongRepo.datKhoang(thang, v.tu, v.den)
    await kyCongRepo.ghiSuKien({
      kyId: moi.id,
      viec: 'set_range',
      userId: user.id,
      ghiChu: lyDo,
      data: { tu_cu: cu.tu, den_cu: cu.den, da_dat_cu: cu.daDat, tu: v.tu, den: v.den },
    })
    return k
  },
}

/**
 * HỒ SƠ MỘT NHÂN VIÊN — /hr/nhan-vien/[mã] (Hồ sơ nhân viên B2a, bản vẽ lượt 2 duyệt
 * 19/10/2026, Q1–Q6 theo đề xuất). Khuôn E: không vòng duyệt; đầu trang là dải số.
 * Dùng lại danh sách của Chấm công (`nhanVien`) để danh sách và hồ sơ đếm bằng CÙNG một
 * nguồn; vết vào / ra lấy từ biến động (0248).
 */
import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { kyCuaThang, thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import { soSanhMa } from '@/lib/nhan-su/ho-so'
import { chamCongService, type NhanVienData, type NvDong } from './cham-cong.service'
import { bienDongRepo, type BienDongDong } from './bien-dong.repo'

export type HoSoNvTrang = {
  n: NvDong
  bienDong: BienDongDong[]
  cas: NhanVienData['cas']
  boPhan: string[]
  chucDanh: string[]
  /** Mã người đang làm, xếp như danh sách mặc định — để ‹ › khi không có tập lọc. */
  dsMa: string[]
  homNay: string
  /** Kỳ công đang chạy: số ngày có quẹt / số ngày đã lấy dữ liệu (tới hôm nay). */
  ky: { thang: string; tu: string; den: string; coQuet: number | null; daLay: number }
  quyen: { sua: boolean }
}

export const hoSoNvService = {
  async trang(user: User, ma: string): Promise<HoSoNvTrang> {
    await assertAction(user, 'hr.attendance.view')
    const homNay = todayVn()
    const nv = await chamCongService.nhanVien(user, homNay)
    const n = nv.ds.find((x) => x.code === ma)
    if (!n) throw NotFound(`Không có nhân viên mã ${ma}`)
    const thang = thangCuaNgay(homNay)
    const k = kyCuaThang(thang)
    const den = k.den < homNay ? k.den : homNay
    const [bienDong, sua, mot] = await Promise.all([
      bienDongRepo.cuaNguoi(n.id),
      canAction(user, 'hr.attendance.employee_edit'),
      n.khongChamCong || den < k.tu
        ? null
        : chamCongService.motNguoi(user, ma, { tu: k.tu, den }),
    ])
    const ngayDaLay = mot?.ngay.filter((d) => d.daLay) ?? []
    return {
      n,
      bienDong,
      cas: nv.cas,
      boPhan: nv.boPhan,
      chucDanh: [
        ...new Set(nv.ds.map((x) => x.chucDanh).filter((t): t is string => !!t)),
      ].sort((a, b) => a.localeCompare(b, 'vi')),
      dsMa: nv.ds
        .filter((x) => x.active)
        .map((x) => x.code)
        .sort(soSanhMa),
      homNay,
      ky: {
        thang,
        tu: k.tu,
        den: k.den,
        coQuet: mot ? ngayDaLay.filter((d) => d.luot.length > 0).length : null,
        daLay: ngayDaLay.length,
      },
      quyen: { sua },
    }
  },
}

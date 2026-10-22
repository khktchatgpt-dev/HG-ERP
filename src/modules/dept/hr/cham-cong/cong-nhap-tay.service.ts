import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict } from '@/server/http'
import { kiemNhap, ngayLamViec, soNgayKy } from '@/lib/cham-cong/cong-nhap-tay'
import { khoangTrongKy } from '@/lib/nhan-su/bien-dong'
import { chamCongRepo, type EmployeeRow } from './cham-cong.repo'
import { congNhapTayRepo, type NhapTayDong } from './cong-nhap-tay.repo'
import { khoangKyService } from './khoang-ky.service'
import { kyCongRepo } from './ky-cong.repo'

/**
 * CÔNG NHẬP TAY — khối A (bản vẽ duyệt 22/10/2026, PYQ1Dw2W…): Nhân sự nhập số công + giờ tăng
 * ca cho người không chấm công mỗi kỳ; còn người trống thì chưa chốt kỳ được. Quyền nhập =
 * quyền sửa nhân viên chấm công (như đặt khoảng kỳ); kỳ đã chốt thì khoá. Mỗi lần nhập / sửa /
 * xoá ghi một sự kiện 'manual_set' vào dòng thời gian kỳ.
 */

export type DongKhongCham = {
  ma: string
  ten: string
  to: string | null
  /** Gợi ý cho ô trống: ngày trừ Chủ nhật trong phần kỳ người này còn làm. */
  ngayLamViec: number
  /** null = chưa nhập (chặn chốt). */
  cong: number | null
  tcGio: number | null
  ghiChu: string | null
  nguoiSua: string | null
  lucSua: string | null
}

/** Người không chấm công có làm trong kỳ + công đã nhập — dùng chung trang, điều kiện chốt, bản chốt. */
export function dsKhongCham(
  emps: EmployeeRow[],
  nhap: NhapTayDong[],
  tu: string,
  den: string,
): (DongKhongCham & { employeeId: string })[] {
  const theo = new Map(nhap.map((x) => [x.employeeId, x]))
  return emps
    .filter(
      (e) =>
        e.attendance_exempt &&
        khoangTrongKy({ hireDate: e.hire_date, leaveDate: e.leave_date }, tu, den),
    )
    .map((e) => {
      const x = theo.get(e.id)
      return {
        employeeId: e.id,
        ma: e.code,
        ten: e.full_name,
        to: e.team,
        ngayLamViec: ngayLamViec(tu, den, {
          ngayVao: e.hire_date,
          ngayNghi: e.leave_date,
        }),
        cong: x ? x.cong : null,
        tcGio: x ? Math.round((x.tcPhut / 60) * 100) / 100 : null,
        ghiChu: x?.ghiChu ?? null,
        nguoiSua: x?.nguoiSua ?? null,
        lucSua: x?.lucSua ?? null,
      }
    })
    .sort(
      (a, b) =>
        (a.to ?? '').localeCompare(b.to ?? '', 'vi') ||
        a.ma.localeCompare(b.ma, 'vi', { numeric: true }),
    )
}

export const congNhapTayService = {
  async ghi(
    user: User,
    thang: string,
    v: { ma: string; cong: number | null; tcGio: number | null; ghiChu?: string | null },
  ): Promise<void> {
    await assertAction(user, 'hr.attendance.employee_edit')
    const ky = await kyCongRepo.ky(thang)
    if (ky && ky.trangThai !== 'open')
      throw Conflict(
        `Kỳ ${thang.slice(5)}/${thang.slice(0, 4)} đã chốt — công nhập tay khoá theo bản chốt. Xin mở lại kỳ trước khi sửa.`,
      )
    const k = await khoangKyService.cua(thang)
    const [emps, nhap] = await Promise.all([
      chamCongRepo.employees(),
      congNhapTayRepo.ds(thang),
    ])
    const dong = dsKhongCham(emps, nhap, k.tu, k.den).find((x) => x.ma === v.ma)
    if (!dong)
      throw BadRequest(
        `${v.ma} không phải người không chấm công có làm trong kỳ này — đánh dấu ở hồ sơ nhân viên trước`,
      )
    const kiem = kiemNhap(
      { cong: v.cong, tcGio: v.tcGio },
      { soNgayKy: soNgayKy(k.tu, k.den), ngayLamViec: dong.ngayLamViec },
    )
    if (kiem.loi) throw BadRequest(`${v.ma}: ${kiem.loi}`)
    const ghiChu = v.ghiChu?.trim() || null
    if (v.cong == null) await congNhapTayRepo.xoa(thang, dong.employeeId)
    else
      await congNhapTayRepo.ghi({
        thang,
        employeeId: dong.employeeId,
        cong: v.cong,
        tcPhut: Math.round((v.tcGio ?? 0) * 60),
        ghiChu,
        userId: user.id,
      })
    const kyDong = ky ?? (await kyCongRepo.damBao(thang, k.tu, k.den))
    await kyCongRepo.ghiSuKien({
      kyId: kyDong.id,
      viec: 'manual_set',
      userId: user.id,
      ghiChu,
      data: {
        ma: dong.ma,
        ten: dong.ten,
        cong: v.cong,
        tc_gio: v.cong == null ? null : (v.tcGio ?? 0),
        cong_cu: dong.cong,
        tc_gio_cu: dong.tcGio,
      },
    })
  },
}

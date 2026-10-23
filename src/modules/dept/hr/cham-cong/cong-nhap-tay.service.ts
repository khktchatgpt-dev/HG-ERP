import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict } from '@/server/http'
import {
  kiemThem,
  lyDoCua,
  ngayLamViec,
  soNgayKy,
  TEN_LY_DO_THEM,
  type LyDoThem,
} from '@/lib/cham-cong/cong-nhap-tay'
import { khoangTrongKy } from '@/lib/nhan-su/bien-dong'
import { chamCongRepo, type EmployeeRow } from './cham-cong.repo'
import {
  congNhapTayRepo,
  type CongThemDong,
  type NhapTayDong,
} from './cong-nhap-tay.repo'
import { khoangKyService } from './khoang-ky.service'
import { kyCongRepo } from './ky-cong.repo'

/**
 * CÔNG NHẬP TAY (hr_time_manual, 0262).
 *   · Khối A — người không chấm công: từ 23/10/2026 là việc của KẾ TOÁN, không phải Nhân sự
 *     (chủ dự án: "trường hợp đặc biệt bên kế toán xử lý; thường lương tháng"). Ô trống =
 *     lương tháng đủ; người quản lý lương nhập công / giờ TC ở màn Bảng lương
 *     (`bangLuongService.nhapCong`). Không chặn chốt kỳ. `dsKhongCham` ở đây là hàm gom dùng chung.
 *   · Khối B — công cộng thêm ngoài máy cho người CÓ chấm công: Nhân sự nhập ở Kỳ công.
 * Quyền khối B = quyền sửa nhân viên chấm công; kỳ đã chốt thì khoá. Mỗi lần nhập / sửa /
 * xoá ghi một sự kiện 'manual_set' vào dòng thời gian kỳ.
 */

export type DongKhongCham = {
  ma: string
  ten: string
  to: string | null
  /** Gợi ý cho ô trống: ngày trừ Chủ nhật trong phần kỳ người này còn làm. */
  ngayLamViec: number
  /** null = chưa nhập → bảng lương trả đủ lương tháng (phần kỳ còn làm). */
  cong: number | null
  tcGio: number | null
  ghiChu: string | null
  nguoiSua: string | null
  lucSua: string | null
}

/** Người không chấm công có làm trong kỳ + công Kế toán đã nhập — màn Bảng lương + bảng lương tính. */
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

/** Dòng khối B bày trên màn — mã / tên / tổ lấy theo nhân viên. */
export type DongCongThem = {
  id: string
  ma: string
  ten: string
  to: string | null
  lyDo: LyDoThem
  cong: number
  ghiChu: string | null
  nguoiSua: string | null
  lucSua: string
}

export function dsCongThem(emps: EmployeeRow[], rows: CongThemDong[]): DongCongThem[] {
  const theo = new Map(emps.map((e) => [e.id, e]))
  return rows.map((r) => {
    const e = theo.get(r.employeeId)
    return {
      id: r.id,
      ma: e?.code ?? '?',
      ten: e?.full_name ?? '(không rõ)',
      to: e?.team ?? null,
      lyDo: lyDoCua(r.lyDo),
      cong: r.cong,
      ghiChu: r.ghiChu,
      nguoiSua: r.nguoiSua,
      lucSua: r.lucSua,
    }
  })
}

/** Người được cộng thêm: có chấm công (không chấm công do Kế toán xử lý ở bảng lương) và làm trong kỳ. */
const duocThem = (e: EmployeeRow, tu: string, den: string) =>
  !e.attendance_exempt &&
  !!khoangTrongKy({ hireDate: e.hire_date, leaveDate: e.leave_date }, tu, den)

async function moKy(thang: string) {
  const ky = await kyCongRepo.ky(thang)
  if (ky && ky.trangThai !== 'open')
    throw Conflict(
      `Kỳ ${thang.slice(5)}/${thang.slice(0, 4)} đã chốt — công nhập tay khoá theo bản chốt. Xin mở lại kỳ trước khi sửa.`,
    )
  const k = await khoangKyService.cua(thang)
  return { ky, k, emps: await chamCongRepo.employees() }
}

export const congNhapTayService = {
  /** Khối B: thêm một / nhiều dòng (dán Excel), sửa hay xoá một dòng. Thêm nhiều = tất cả hoặc không. */
  async congThem(
    user: User,
    thang: string,
    v:
      | {
          kieu: 'them'
          dong: {
            ma: string
            cong: number | null
            lyDo: LyDoThem
            ghiChu?: string | null
          }[]
        }
      | {
          kieu: 'sua'
          id: string
          ma: string
          cong: number | null
          lyDo: LyDoThem
          ghiChu?: string | null
        }
      | { kieu: 'xoa'; id: string },
  ): Promise<{ so: number }> {
    await assertAction(user, 'hr.attendance.employee_edit')
    const { ky, k, emps } = await moKy(thang)
    const ngayKy = soNgayKy(k.tu, k.den)
    const theoMa = new Map(emps.map((e) => [e.code, e]))
    const nguoi = (ma: string) => {
      const e = theoMa.get(ma)
      if (!e)
        throw BadRequest(`Mã ${ma} không có trong danh sách nhân viên — chọn đúng người`)
      if (e.attendance_exempt)
        throw BadRequest(
          `${ma} ${e.full_name} là người không chấm công — Kế toán xử lý trên bảng lương, không cộng ở đây`,
        )
      if (!duocThem(e, k.tu, k.den))
        throw BadRequest(
          `${ma} ${e.full_name} không làm trong kỳ này (theo ngày vào / ngày nghỉ)`,
        )
      return e
    }
    const cu = dsCongThem(emps, await congNhapTayRepo.dsThem(thang))
    let data: Record<string, unknown>
    let so = 1
    if (v.kieu === 'them') {
      if (!v.dong.length) throw BadRequest('Không có dòng nào để thêm')
      const ds = v.dong.map((x, i) => {
        const e = nguoi(x.ma)
        const loi = kiemThem(x.cong, ngayKy)
        if (loi) throw BadRequest(`Dòng ${i + 1} (${x.ma}): ${loi}`)
        return {
          employeeId: e.id,
          cong: x.cong!,
          lyDo: x.lyDo,
          ghiChu: x.ghiChu?.trim() || null,
        }
      })
      await congNhapTayRepo.themNhieu(thang, ds, user.id)
      so = ds.length
      data = {
        khoi: 'B',
        them: so,
        ly_do: TEN_LY_DO_THEM[v.dong[0].lyDo],
        cong: Math.round(ds.reduce((t, x) => t + x.cong, 0) * 100) / 100,
        ...(so === 1
          ? { ma: v.dong[0].ma, ten: theoMa.get(v.dong[0].ma)?.full_name }
          : {}),
      }
    } else if (v.kieu === 'sua') {
      const truoc = cu.find((x) => x.id === v.id)
      if (!truoc) throw BadRequest('Dòng này không còn — tải lại trang')
      const e = nguoi(v.ma)
      const loi = kiemThem(v.cong, ngayKy)
      if (loi) throw BadRequest(`${v.ma}: ${loi}`)
      await congNhapTayRepo.suaThem(
        v.id,
        thang,
        {
          employeeId: e.id,
          cong: v.cong!,
          lyDo: v.lyDo,
          ghiChu: v.ghiChu?.trim() || null,
        },
        user.id,
      )
      data = {
        khoi: 'B',
        ma: v.ma,
        ten: e.full_name,
        ly_do: TEN_LY_DO_THEM[v.lyDo],
        cong_cu: truoc.cong,
        cong: v.cong,
      }
    } else {
      const truoc = cu.find((x) => x.id === v.id)
      if (!truoc) return { so: 0 }
      await congNhapTayRepo.xoaThem(v.id, thang)
      data = {
        khoi: 'B',
        ma: truoc.ma,
        ten: truoc.ten,
        ly_do: TEN_LY_DO_THEM[truoc.lyDo],
        cong_cu: truoc.cong,
        cong: null,
      }
    }
    const kyDong = ky ?? (await kyCongRepo.damBao(thang, k.tu, k.den))
    await kyCongRepo.ghiSuKien({
      kyId: kyDong.id,
      viec: 'manual_set',
      userId: user.id,
      data,
    })
    return { so }
  },
}

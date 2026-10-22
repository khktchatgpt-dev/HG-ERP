/**
 * BIẾN ĐỘNG NHÂN SỰ — Hồ sơ nhân viên B1 (bản vẽ duyệt 19/10/2026, Q1–Q7 theo đề xuất).
 * Chép SAP personnel action / Odoo departure: Tuyển vào · Cho nghỉ việc · Đi làm lại ·
 * Chuyển tổ / chức danh, mỗi việc có ngày hiệu lực + lý do + vết. Ô "đang làm" không còn
 * gõ tay: nó suy ra từ ngày làm cuối (repo lật `active` khi qua ngày, 0248).
 *
 * Ngày rơi vào kỳ công đã chốt thì chặn (`kiemKhoaKy`): kỳ đó đã tính người này theo dữ
 * liệu cũ, sửa ngày là lệch bản chốt.
 */
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { boSo0 } from '@/lib/cham-cong/ghep-ten'
import {
  maKccTiep,
  ngaySau,
  ngayVn,
  TEN_LY_DO_NGHI,
  type LyDoNghi,
} from '@/lib/nhan-su/bien-dong'
import { chamCongRepo, type EmployeeRow } from './cham-cong.repo'
import { bienDongRepo, type BienDongDong } from './bien-dong.repo'
import { kyCongRepo } from './ky-cong.repo'

const SUA = 'hr.attendance.employee_edit'

/**
 * Ngày biến động rơi vào kỳ công đã chốt → chặn, câu chặn nói cách gỡ: kỳ đó đã tính người
 * này theo dữ liệu cũ, đổi ngày là lệch bản chốt.
 */
async function kiemKhoaKy(ngays: string[]): Promise<void> {
  const khoa = await kyCongRepo.kyKhoaChua(ngays)
  if (!khoa.length) return
  const k = khoa[0]
  throw Conflict(
    `Kỳ ${k.thang.slice(5)}/${k.thang.slice(0, 4)} (${ngayVn(k.tu)} – ${ngayVn(k.den)}) đã chốt — chọn ngày từ ${ngayVn(ngaySau(k.den))}, hoặc nhờ Kế toán trưởng mở lại kỳ`,
  )
}

async function nguoi(id: string): Promise<EmployeeRow> {
  const e = (await chamCongRepo.employees()).find((x) => x.id === id)
  if (!e) throw NotFound('Không tìm thấy nhân viên')
  return e
}

export type TuyenVao = {
  /** Không chấm công → mã tự cấp KCC-NNN (Q3); ngược lại `code` là số trên máy. */
  khong_cham: boolean
  code?: string
  full_name: string
  hire_date: string
  team: string | null
  shift_id: string
  job_title?: string | null
  device_user_id?: string
}

export const bienDongService = {
  async lichSu(user: User, id: string): Promise<BienDongDong[]> {
    await assertAction(user, 'hr.attendance.view')
    return bienDongRepo.cuaNguoi(id)
  },

  async tuyenVao(user: User, v: TuyenVao): Promise<{ id: string; code: string }> {
    await assertAction(user, SUA)
    await kiemKhoaKy([v.hire_date])
    const emps = await chamCongRepo.employees()
    let code: string
    if (v.khong_cham) code = maKccTiep(emps.map((e) => e.code))
    else {
      if (!v.code)
        throw BadRequest('Nhập mã trên máy chấm công, hoặc chọn "Không chấm công"')
      code = v.code
      const trung = emps.find((e) => boSo0(e.code) === code)
      if (trung) throw Conflict(`Mã ${code} đã là của ${trung.full_name}`)
    }
    const e = await chamCongRepo.addEmployee({
      code,
      full_name: v.full_name,
      team: v.team,
      shift_id: v.shift_id,
      note: null,
      attendance_exempt: v.khong_cham,
      hire_date: v.hire_date,
      job_title: v.job_title ?? null,
    })
    if (v.device_user_id)
      await chamCongRepo.updateDeviceUser(v.device_user_id, {
        employee_id: e.id,
        needs_review: false,
      })
    await bienDongRepo.ghi({
      employeeId: e.id,
      loai: 'hire',
      ngay: v.hire_date,
      sau: { team: v.team, job_title: v.job_title ?? null, code },
      userId: user.id,
    })
    return { id: e.id, code }
  },

  /**
   * Ghi / sửa ngày vào của đoạn làm việc hiện tại (Q1: Nhân sự nhập dần cho người cũ).
   * Có biến động Tuyển vào / Đi làm lại thì dời ngày của nó, chưa có thì tạo.
   */
  async datNgayVao(user: User, id: string, ngay: string | null): Promise<void> {
    await assertAction(user, SUA)
    const e = await nguoi(id)
    if (e.hire_date === ngay) return
    if (ngay && e.leave_date && ngay > e.leave_date)
      throw BadRequest(`Ngày vào sau ngày làm cuối ${ngayVn(e.leave_date)}`)
    await kiemKhoaKy([e.hire_date, ngay].filter((d): d is string => !!d))
    await chamCongRepo.updateEmployee(id, { hire_date: ngay })
    const bd = await bienDongRepo.moiNhat(id, ['hire', 'rehire'])
    if (bd && ngay) await bienDongRepo.doiNgay(bd.id, ngay)
    else if (bd) await bienDongRepo.huy(bd.id, user.id)
    else if (ngay)
      await bienDongRepo.ghi({
        employeeId: id,
        loai: 'hire',
        ngay,
        ghiChu: 'Ghi ngày vào cho người đã có trong danh sách',
        userId: user.id,
      })
  },

  /** Cho nghỉ: còn trong kỳ công / lương tới hết ngày làm cuối. */
  async choNghi(
    user: User,
    id: string,
    v: { leave_date: string; reason: LyDoNghi; note?: string | null },
  ): Promise<{ daKhoa: boolean }> {
    await assertAction(user, SUA)
    const e = await nguoi(id)
    if (!e.active)
      throw Conflict(`${e.full_name} đã nghỉ việc — dùng "Đi làm lại" nếu quay lại`)
    if (e.leave_date)
      throw Conflict(
        `${e.full_name} đã có ngày làm cuối ${ngayVn(e.leave_date)} — huỷ cho nghỉ trước khi ghi lại`,
      )
    if (e.hire_date && v.leave_date < e.hire_date)
      throw BadRequest(`Ngày làm cuối trước ngày vào ${ngayVn(e.hire_date)}`)
    await kiemKhoaKy([v.leave_date])
    const daQua = v.leave_date < todayVn()
    await chamCongRepo.updateEmployee(id, {
      leave_date: v.leave_date,
      leave_reason: v.reason,
      ...(daQua && { active: false }),
    })
    await bienDongRepo.ghi({
      employeeId: id,
      loai: 'leave',
      ngay: v.leave_date,
      lyDo: v.reason,
      ghiChu: v.note ?? null,
      truoc: { team: e.team, job_title: e.job_title },
      sau: { reason: TEN_LY_DO_NGHI[v.reason] },
      userId: user.id,
    })
    return { daKhoa: daQua }
  },

  /** Huỷ cho nghỉ (ghi nhầm) — chỉ khi kỳ chứa ngày làm cuối chưa chốt. */
  async huyNghi(user: User, id: string): Promise<void> {
    await assertAction(user, SUA)
    const e = await nguoi(id)
    if (!e.leave_date) throw BadRequest(`${e.full_name} không có ngày làm cuối để huỷ`)
    await kiemKhoaKy([e.leave_date])
    await chamCongRepo.updateEmployee(id, {
      leave_date: null,
      leave_reason: null,
      active: true,
    })
    const bd = await bienDongRepo.moiNhat(id, ['leave'])
    if (bd) await bienDongRepo.huy(bd.id, user.id)
  },

  /** Đi làm lại: đoạn làm việc mới, giữ mã cũ. Tài khoản ERP (nếu bị khoá) Admin mở lại. */
  async diLamLai(
    user: User,
    id: string,
    v: { hire_date: string; note?: string | null },
  ): Promise<void> {
    await assertAction(user, SUA)
    const e = await nguoi(id)
    if (e.active) throw Conflict(`${e.full_name} đang làm — không cần đi làm lại`)
    if (e.leave_date && v.hire_date <= e.leave_date)
      throw BadRequest(`Ngày vào lại phải sau ngày làm cuối ${ngayVn(e.leave_date)}`)
    await kiemKhoaKy([v.hire_date])
    await chamCongRepo.updateEmployee(id, {
      hire_date: v.hire_date,
      leave_date: null,
      leave_reason: null,
      active: true,
    })
    await bienDongRepo.ghi({
      employeeId: id,
      loai: 'rehire',
      ngay: v.hire_date,
      ghiChu: v.note ?? null,
      truoc: { hire_date: e.hire_date, leave_date: e.leave_date, reason: e.leave_reason },
      userId: user.id,
    })
  },

  /**
   * Chuyển tổ / đổi chức danh có ngày hiệu lực. Ghi vết + đổi ngay trên hồ sơ; bảng công
   * hiện vẫn xếp người theo tổ HIỆN TẠI cho cả kỳ (chia theo ngày hiệu lực: làm sau).
   */
  async chuyen(
    user: User,
    id: string,
    v: {
      effective_date: string
      team: string | null
      job_title: string | null
      note?: string | null
    },
  ): Promise<void> {
    await assertAction(user, SUA)
    const e = await nguoi(id)
    if (!e.active) throw Conflict(`${e.full_name} đã nghỉ việc`)
    if (v.team === e.team && v.job_title === e.job_title)
      throw BadRequest('Tổ và chức danh không đổi')
    await chamCongRepo.updateEmployee(id, { team: v.team, job_title: v.job_title })
    await bienDongRepo.ghi({
      employeeId: id,
      loai: 'transfer',
      ngay: v.effective_date,
      ghiChu: v.note ?? null,
      truoc: { team: e.team, job_title: e.job_title },
      sau: { team: v.team, job_title: v.job_title },
      userId: user.id,
    })
  },
}

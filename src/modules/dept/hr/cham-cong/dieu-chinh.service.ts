import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { chamCongRepo } from './cham-cong.repo'
import { dieuChinhRepo, type DieuChinhDong } from './dieu-chinh.repo'
import type { DieuChinhGui } from './cham-cong.schema'
import { boXacNhanViPhieu, kiemKhoaKy } from './ky-khoa'

/**
 * ĐIỀU CHỈNH CHẤM CÔNG (bản vẽ DieuChinh.dc.html, câu 22–25 duyệt 17/10/2026).
 * Nhân sự gửi → người có `hr.attendance.adjust_decide` duyệt / từ chối; người gửi
 * rút được khi còn chờ. Không xoá — mọi bản giữ lại làm lịch sử.
 * KHÔNG tự duyệt phiếu của mình (18/10/2026): người gửi và người duyệt phải khác nhau.
 */

/** `toi` = tài khoản đang xem: phiếu có `guiId === toi` thì không được tự duyệt. */
export type QuyenDieuChinh = { gui: boolean; duyet: boolean; toi: string }

export async function quyenDieuChinh(user: User): Promise<QuyenDieuChinh> {
  const [gui, duyet] = await Promise.all([
    canAction(user, 'hr.attendance.adjust'),
    canAction(user, 'hr.attendance.adjust_decide'),
  ])
  return { gui, duyet, toi: user.id }
}

export type TrangDieuChinh = {
  /** Mọi bản chờ duyệt, mọi kỳ. */
  choDuyet: DieuChinhDong[]
  /** Bản trong kỳ đang xem (mọi tình trạng). */
  trongKy: DieuChinhDong[]
  /** Mã → họ tên, tổ (để bày). */
  nguoi: Record<string, { ten: string; to: string | null }>
  quyen: QuyenDieuChinh
}

export const dieuChinhService = {
  async gui(user: User, v: DieuChinhGui): Promise<string> {
    await assertAction(user, 'hr.attendance.adjust')
    if (v.ngay > todayVn()) throw BadRequest('Không điều chỉnh ngày chưa tới')
    await kiemKhoaKy([v.ngay])
    const e = (await chamCongRepo.employees()).find((x) => x.code === v.ma)
    if (!e) throw NotFound(`Không có nhân viên mã ${v.ma}`)
    return dieuChinhRepo.them({
      employee_id: e.id,
      work_date: v.ngay,
      kind: v.loai,
      punch_time: v.loai === 'leave' ? null : v.gio,
      punch_dir: v.loai === 'add_punch' ? v.chieu : null,
      leave_type: v.loai === 'leave' ? v.nghi : null,
      reason: v.lyDo,
      evidence: v.canCu || null,
      created_by: user.id,
    })
  },

  /** Duyệt / từ chối (người có quyền duyệt) hoặc rút (người gửi). Chỉ bản còn chờ. */
  async quyet(
    user: User,
    ids: string[],
    viec: 'duyet' | 'tu_choi' | 'rut',
    ghiChu?: string,
  ): Promise<number> {
    const q = await quyenDieuChinh(user)
    const ds = await dieuChinhRepo.theoIds(ids)
    if (ds.length !== ids.length) throw NotFound('Có điều chỉnh không còn tồn tại')
    if (ds.some((d) => d.status !== 'pending'))
      throw BadRequest('Chỉ xử lý được điều chỉnh đang chờ duyệt — tải lại trang')
    await kiemKhoaKy([...new Set(ds.map((d) => d.work_date))])
    if (viec === 'rut') {
      if (!q.duyet && ds.some((d) => d.created_by !== user.id))
        throw Forbidden('Chỉ người gửi được rút điều chỉnh của mình')
      return dieuChinhRepo.doiTinhTrang(ids, { status: 'cancelled' })
    }
    if (!q.duyet) throw Forbidden('Bạn chưa có quyền duyệt điều chỉnh chấm công')
    const cuaMinh = ds.filter((d) => d.created_by === user.id).length
    if (cuaMinh)
      throw Forbidden(
        `${cuaMinh} điều chỉnh do chính bạn gửi — người khác có quyền duyệt phải xử lý`,
      )
    const so = await dieuChinhRepo.doiTinhTrang(ids, {
      status: viec === 'duyet' ? 'approved' : 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decide_note: ghiChu || null,
    })
    if (viec === 'duyet')
      await boXacNhanViPhieu(
        ds.map((d) => ({
          ngay: d.work_date,
          boPhan: d.nv?.team ?? null,
          moTa: `${d.nv?.code ?? ''} ${d.nv?.full_name ?? ''} ngày ${d.work_date.slice(8, 10)}/${d.work_date.slice(5, 7)}`.trim(),
        })),
        user.id,
      )
    return so
  },

  /** Trang "Điều chỉnh công": chờ duyệt (mọi kỳ) + lịch sử kỳ đang xem. */
  async trang(user: User, tu: string, den: string): Promise<TrangDieuChinh> {
    await assertAction(user, 'hr.attendance.view')
    const [choDuyet, trongKy, emps, quyen] = await Promise.all([
      dieuChinhRepo.choDuyet(),
      dieuChinhRepo.trongKhoang(tu, den),
      chamCongRepo.employees(),
      quyenDieuChinh(user),
    ])
    const nguoi: TrangDieuChinh['nguoi'] = {}
    for (const e of emps) nguoi[e.code] = { ten: e.full_name, to: e.team }
    return { choDuyet, trongKy, nguoi, quyen }
  },
}

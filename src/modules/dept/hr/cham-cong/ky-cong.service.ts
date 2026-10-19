import type { User } from '@/modules/core/users/users.repo'
import { khoangTrongKy } from '@/lib/nhan-su/bien-dong'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import {
  banChotTu,
  CHUA_CO_TO,
  dieuKienChot,
  dieuKienXacNhanTo,
  KY_DAU_ERP,
  tongTheoTo,
  type DieuKien,
  type DongChot,
  type TongTo,
  type TrangThaiKy,
} from '@/lib/cham-cong/ky-cong'
import { chamCongRepo } from './cham-cong.repo'
import { gioCongService, type GioCong } from './gio-cong.service'
import { kyCongRepo, type KyDong, type SuKien, type XacNhanDong } from './ky-cong.repo'
import { bangLuongRepo, type TrangThaiLuong } from '../luong/bang-luong.repo'
import { bangLuongService } from '../luong/bang-luong.service'

/**
 * KỲ CÔNG (B3, bản vẽ duyệt 18/10/2026, Q1–Q7 theo đề xuất) — chứng từ:
 *   Đang mở → (mọi tổ xác nhận) → Đã chốt → Chờ mở lại → (Giám đốc duyệt) → Đang mở.
 * Nhân sự xác nhận tổ thay tổ trưởng sau khi thu phiếu giấy có chữ ký (Q2); ngày thiếu
 * lượt được "tính 0 giờ" nếu đồng ý lúc xác nhận (Q1). Chốt lưu BẢN CHỐT
 * (hr_time_results) và khoá mọi ghi cho ngày trong kỳ.
 */

export type ToKy = TongTo & {
  teamId: string | null
  cachTinh: 'khung' | 'ngay'
  /** Xác nhận còn hiệu lực: có dòng VÀ số ngày đồng ý tính 0 giờ còn đủ phủ số thiếu hiện tại. */
  xacNhan: XacNhanDong | null
  dieuKien: DieuKien[]
}

export type KyCongTrang = {
  thang: string
  tu: string
  den: string
  homNay: string
  ngayLay: string | null
  ngoaiErp: boolean
  trangThai: TrangThaiKy
  ky: KyDong | null
  ban: number | null
  to: ToKy[]
  chuaCoTo: number
  choDuyet: number
  khongCham: { ma: string; ten: string; to: string | null }[]
  dieuKien: DieuKien[]
  nguoi: {
    ma: string
    ten: string
    to: string
    phut: number
    cong: number
    thieu: number
  }[]
  khung: { ma: string; ten: string }[]
  suKien: SuKien[]
  phutMotCong: number
  /** Trạng thái bảng lương của kỳ (B5) — dải vòng đời đi tiếp "Đã tính lương" / "Đã trả". */
  bangLuong: TrangThaiLuong | null
  quyen: { xacNhan: boolean; chot: boolean; xinMo: boolean; duyetMo: boolean }
}

const HET_ERP = (t: string) =>
  `Kỳ ${t.slice(5)}/${t.slice(0, 4)} đã trả lương ngoài ERP — kỳ công trong ERP bắt đầu từ kỳ ${KY_DAU_ERP.slice(5)}/${KY_DAU_ERP.slice(0, 4)}`

async function quyen(user: User) {
  const [xacNhan, chot, duyetMo] = await Promise.all([
    canAction(user, 'hr.attendance.adjust'),
    canAction(user, 'hr.period.close'),
    canAction(user, 'hr.period.reopen_decide'),
  ])
  return { xacNhan, chot, xinMo: xacNhan, duyetMo }
}

/** Gom dữ liệu của một kỳ — dùng chung cho trang và cho mọi chuyển tiếp (kiểm lại ở server). */
async function dung(user: User, thang: string) {
  const homNay = todayVn()
  const g: GioCong = await gioCongService.bang(user, thang, homNay)
  const [teams, emps, xn] = await Promise.all([
    kyCongRepo.toTheoTen(),
    chamCongRepo.employees(),
    g.ky ? kyCongRepo.xacNhan(g.ky.id) : Promise.resolve([] as XacNhanDong[]),
  ])
  const tong = tongTheoTo(g.nguoi)
  const bc = { homNay, den: g.den, ngayLay: g.ngayLay }
  const xnTheo = new Map(xn.map((x) => [x.teamId, x]))
  const cachTinh = new Map(g.boPhan.map((b) => [b.ten, b.cachTinh]))
  const to: ToKy[] = tong
    .filter((t) => t.ten !== CHUA_CO_TO)
    .map((t) => {
      const teamId = teams.get(t.ten) ?? null
      const x = teamId ? (xnTheo.get(teamId) ?? null) : null
      return {
        ...t,
        teamId,
        cachTinh: cachTinh.get(t.ten) ?? 'khung',
        xacNhan: x && x.ngay0 >= t.thieu ? x : null,
        dieuKien: dieuKienXacNhanTo(bc, t),
      }
    })
  const chuaCoTo = tong.find((t) => t.ten === CHUA_CO_TO)?.so ?? 0
  const choDuyet = g.dieuChinh.filter((d) => d.tinhTrang === 'pending').length
  return { g, homNay, bc, to, chuaCoTo, choDuyet, emps, teams }
}

/** Có làm ngày nào trong kỳ [tu, den] — theo ngày vào / ngày làm cuối, không theo cờ active. */
const lamTrongKy = (
  e: { hire_date: string | null; leave_date: string | null },
  tu: string,
  den: string,
) => !!khoangTrongKy({ hireDate: e.hire_date, leaveDate: e.leave_date }, tu, den)

function kiemErp(thang: string) {
  if (thang < KY_DAU_ERP) throw Conflict(HET_ERP(thang))
}

export const kyCongService = {
  async trang(user: User, thang: string): Promise<KyCongTrang> {
    await assertAction(user, 'hr.attendance.view')
    const [d, q] = await Promise.all([dung(user, thang), quyen(user)])
    const { g, to } = d
    const ky = g.ky
    return {
      thang,
      tu: g.tu,
      den: g.den,
      homNay: d.homNay,
      ngayLay: g.ngayLay,
      ngoaiErp: thang < KY_DAU_ERP,
      trangThai: ky?.trangThai ?? 'open',
      ky,
      ban: g.ban,
      to,
      chuaCoTo: d.chuaCoTo,
      choDuyet: d.choDuyet,
      khongCham: d.emps
        .filter((e) => e.attendance_exempt && lamTrongKy(e, d.g.tu, d.g.den))
        .map((e) => ({ ma: e.code, ten: e.full_name, to: e.team })),
      dieuKien: dieuKienChot(d.bc, {
        choDuyet: d.choDuyet,
        chuaCoTo: d.chuaCoTo,
        to: to.map((t) => ({ ten: t.ten, daXacNhan: !!t.xacNhan })),
      }),
      nguoi: g.nguoi.map((n) => ({
        ma: n.ma,
        ten: n.ten,
        to: n.boPhan ?? CHUA_CO_TO,
        phut: n.tong.tong,
        cong: n.tong.cong,
        thieu: n.tong.thieu,
      })),
      khung: g.khung,
      suKien: ky ? await kyCongRepo.suKien(ky.id) : [],
      phutMotCong: g.phutMotCong,
      bangLuong: (await bangLuongRepo.bang(thang))?.trangThai ?? null,
      quyen: q,
    }
  },

  async xacNhanTo(
    user: User,
    thang: string,
    ten: string,
    dongY0: boolean,
  ): Promise<void> {
    await assertAction(user, 'hr.attendance.adjust')
    kiemErp(thang)
    const d = await dung(user, thang)
    if (d.g.ky && d.g.ky.trangThai !== 'open')
      throw Conflict(`Kỳ đã chốt — không xác nhận thêm tổ được`)
    const t = d.to.find((x) => x.ten === ten)
    if (!t || !t.teamId) throw BadRequest(`Không có tổ "${ten}" trong kỳ này`)
    const vuong = t.dieuKien.find((x) => !x.ok)
    if (vuong) throw BadRequest(`${vuong.ten}: ${vuong.chiTiet}`)
    if (t.thieu > 0 && !dongY0)
      throw BadRequest(
        `${t.ten} còn ${t.thieu} ngày thiếu lượt — bổ sung giờ, hoặc tích "đồng ý tính 0 giờ"`,
      )
    const ky = await kyCongRepo.damBao(thang, d.g.tu, d.g.den)
    await kyCongRepo.ghiXacNhan(ky.id, t.teamId, t.thieu, user.id)
    await kyCongRepo.ghiSuKien({
      kyId: ky.id,
      viec: 'team_confirm',
      teamId: t.teamId,
      userId: user.id,
      data: { nguoi: t.so, cong: t.cong, ngay0: t.thieu },
    })
  },

  async boXacNhanTo(user: User, thang: string, ten: string): Promise<void> {
    await assertAction(user, 'hr.attendance.adjust')
    const ky = await kyCongRepo.ky(thang)
    if (!ky) return
    if (ky.trangThai !== 'open') throw Conflict('Kỳ đã chốt — xin mở lại trước')
    const id = (await kyCongRepo.toTheoTen()).get(ten)
    if (!id) throw BadRequest(`Không có tổ "${ten}"`)
    if (await kyCongRepo.xoaXacNhan(ky.id, id))
      await kyCongRepo.ghiSuKien({
        kyId: ky.id,
        viec: 'team_unconfirm',
        teamId: id,
        userId: user.id,
        ghiChu: 'Bỏ xác nhận tay',
      })
  },

  async chot(user: User, thang: string): Promise<{ cong: number; nguoi: number }> {
    await assertAction(user, 'hr.period.close')
    kiemErp(thang)
    const d = await dung(user, thang)
    if (d.g.ky && d.g.ky.trangThai !== 'open') throw Conflict('Kỳ này đã chốt')
    const dk = dieuKienChot(d.bc, {
      choDuyet: d.choDuyet,
      chuaCoTo: d.chuaCoTo,
      to: d.to.map((t) => ({ ten: t.ten, daXacNhan: !!t.xacNhan })),
    })
    const vuong = dk.find((x) => !x.ok)
    if (vuong) throw BadRequest(`Chưa chốt được — ${vuong.ten}: ${vuong.chiTiet}`)

    const idTheoMa = new Map(d.emps.map((e) => [e.code, e.id]))
    const dong: (DongChot & { employeeId: string })[] = [
      ...banChotTu(d.g.nguoi),
      ...d.emps
        // Người nghỉ / vào giữa kỳ vẫn có dòng; số công tính theo phần kỳ họ còn làm (0248).
        .filter((e) => e.attendance_exempt && lamTrongKy(e, d.g.tu, d.g.den))
        .map((e): DongChot => ({
          ma: e.code,
          ten: e.full_name,
          to: e.team,
          ngay: null,
          k: {},
          truaCong: 0,
          tong: 0,
          nghi: null,
          khong: false,
          miem: true,
        })),
    ]
      .filter((x) => idTheoMa.has(x.ma))
      .map((x) => ({ ...x, employeeId: idTheoMa.get(x.ma)! }))

    const ky = await kyCongRepo.damBao(thang, d.g.tu, d.g.den)
    const lan = ky.lanChot + 1
    // Ghi bản chốt TRƯỚC rồi mới đổi trạng thái có điều kiện: đổi hỏng (người khác vừa chốt)
    // thì bản chốt mồ côi mang số lần chốt không ai đọc — vô hại, không bao giờ có kỳ "đã
    // chốt" mà thiếu bản chốt.
    await kyCongRepo.ghiBanChot(ky.id, lan, dong)
    const ok = await kyCongRepo.doi(ky.id, 'open', {
      status: 'closed',
      close_count: lan,
      calc_version_id: d.g.banId,
      closed_by: user.id,
      closed_at: new Date().toISOString(),
      reopen_reason: null,
      reopen_by: null,
      reopen_at: null,
    })
    if (!ok) throw Conflict('Kỳ vừa được người khác chốt — tải lại trang')
    const cong = Math.round(d.g.nguoi.reduce((s, n) => s + n.tong.cong, 0) * 100) / 100
    await kyCongRepo.ghiSuKien({
      kyId: ky.id,
      viec: 'close',
      userId: user.id,
      data: {
        lan,
        cong,
        nguoi: d.g.nguoi.length,
        khongCham: dong.filter((x) => x.miem).length,
      },
    })
    return { cong, nguoi: d.g.nguoi.length }
  },

  async xinMoLai(user: User, thang: string, lyDo: string): Promise<void> {
    await assertAction(user, 'hr.attendance.adjust')
    const ky = await kyCongRepo.ky(thang)
    if (!ky || ky.trangThai !== 'closed') throw Conflict('Chỉ xin mở lại được kỳ đã chốt')
    await bangLuongService.kiemMoLaiKyCong(thang)
    const ok = await kyCongRepo.doi(ky.id, 'closed', {
      status: 'reopen_requested',
      reopen_reason: lyDo,
      reopen_by: user.id,
      reopen_at: new Date().toISOString(),
    })
    if (!ok) throw Conflict('Trạng thái kỳ vừa đổi — tải lại trang')
    await kyCongRepo.ghiSuKien({
      kyId: ky.id,
      viec: 'reopen_request',
      userId: user.id,
      ghiChu: lyDo,
    })
  },

  async rutXin(user: User, thang: string): Promise<void> {
    const ky = await kyCongRepo.ky(thang)
    if (!ky || ky.trangThai !== 'reopen_requested')
      throw Conflict('Không có yêu cầu mở lại')
    const q = await quyen(user)
    if (ky.xinBoiId !== user.id && !q.duyetMo)
      throw Forbidden('Chỉ người xin mới rút được yêu cầu mở lại')
    await kyCongRepo.doi(ky.id, 'reopen_requested', { status: 'closed' })
    await kyCongRepo.ghiSuKien({ kyId: ky.id, viec: 'reopen_withdraw', userId: user.id })
  },

  async quyetMoLai(
    user: User,
    thang: string,
    dongY: boolean,
    ghiChu?: string,
  ): Promise<void> {
    await assertAction(user, 'hr.period.reopen_decide')
    const ky = await kyCongRepo.ky(thang)
    if (!ky || ky.trangThai !== 'reopen_requested')
      throw Conflict('Không có yêu cầu mở lại')
    if (ky.xinBoiId === user.id)
      throw Forbidden('Bạn là người xin mở lại — người khác có quyền duyệt phải xử lý')
    // Mở lại: bản chốt lần này giữ nguyên trong hr_time_results (close_no), lần chốt sau +1.
    const ok = await kyCongRepo.doi(ky.id, 'reopen_requested', {
      status: dongY ? 'open' : 'closed',
    })
    if (!ok) throw Conflict('Trạng thái kỳ vừa đổi — tải lại trang')
    await kyCongRepo.ghiSuKien({
      kyId: ky.id,
      viec: dongY ? 'reopen_approve' : 'reopen_reject',
      userId: user.id,
      ghiChu: ghiChu || null,
    })
  },
}

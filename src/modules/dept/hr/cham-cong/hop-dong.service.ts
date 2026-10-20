/**
 * HỢP ĐỒNG LAO ĐỘNG + GIẤY TỜ trên hồ sơ nhân viên (B3, bản vẽ lượt 2 duyệt 19/10/2026; Q2
 * lượt 1: không lập mẫu in, chỉ lưu bản đã ký). Cùng ranh giới quyền với thông tin cá nhân
 * (hr.employee.private) vì giấy tờ có CCCD. Riêng Ô LƯƠNG ghi trên HĐ theo quyền lương mật
 * (hr.payroll.profile, 20/10/2026): Nhân sự vẫn làm HĐ nhưng không thấy, không ghi đè mức lương.
 *
 * Không xoá HĐ: ghi nhầm thì huỷ kèm lý do. Hai HĐ chưa huỷ không được chồng thời gian.
 * Luật lao động (thử việc ≤ 60 ngày, xác định thời hạn ≤ 36 tháng) chỉ cảnh báo — trả về
 * cho màn bày, không chặn.
 */
import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { canhBaoHd, chongNhau, TEN_LOAI_HD, type LoaiHd } from '@/lib/nhan-su/hop-dong'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { filesRepo } from '@/modules/core/files/files.repo'
import { hopDongRepo } from './hop-dong.repo'
import { bienDongRepo } from './bien-dong.repo'

const QUYEN = 'hr.employee.private'
/** Quyền lương mật — chỉ người có quyền này thấy / ghi ô lương trên HĐ. */
export const QUYEN_LUONG_HD = 'hr.payroll.profile'

export type HdNhap = {
  so: string | null
  loai: LoaiHd
  tuNgay: string
  denNgay: string | null
  chucDanh: string | null
  luong: number | null
  ghiChu: string | null
  fileId: string | null
}

function kiemNgay(v: HdNhap) {
  if (v.loai === 'indefinite') v.denNgay = null
  else if (!v.denNgay) throw BadRequest(`${TEN_LOAI_HD[v.loai]} cần ngày kết thúc`)
  if (v.denNgay && v.denNgay < v.tuNgay)
    throw BadRequest('Ngày kết thúc trước ngày bắt đầu')
}

async function kiemChong(employeeId: string, v: HdNhap, boQua?: string) {
  const ds = await hopDongRepo.cuaNguoi(employeeId)
  const trung = ds.find(
    (h) =>
      !h.huy &&
      h.id !== boQua &&
      chongNhau(h, { tuNgay: v.tuNgay, denNgay: v.denNgay, huy: false }),
  )
  if (trung)
    throw Conflict(
      `Trùng thời gian với HĐ ${trung.so ?? TEN_LOAI_HD[trung.loai].toLowerCase()} (${ngayVn(trung.tuNgay)} – ${trung.denNgay ? ngayVn(trung.denNgay) : 'không thời hạn'}) — sửa ngày, hoặc huỷ HĐ kia nếu ghi nhầm`,
    )
}

/** File scan phải là giấy tờ của chính người này (không mượn file của người khác). */
async function kiemFile(employeeId: string, fileId: string | null) {
  if (!fileId) return
  const f = await filesRepo.getById(fileId)
  if (!f || f.deleted_at || f.hr_employee_id !== employeeId)
    throw BadRequest('File scan không thuộc hồ sơ người này — tải lên lại')
}

async function ghiVet(user: User, employeeId: string, ghiChu: string) {
  await bienDongRepo.ghi({
    employeeId,
    loai: 'edit',
    ngay: todayVn(),
    ghiChu,
    userId: user.id,
  })
}

export const hopDongService = {
  async them(user: User, employeeId: string, v: HdNhap): Promise<{ canhBao: string[] }> {
    await assertAction(user, QUYEN)
    kiemNgay(v)
    await kiemChong(employeeId, v)
    await kiemFile(employeeId, v.fileId)
    const luong = (await canAction(user, QUYEN_LUONG_HD)) ? v.luong : null
    await hopDongRepo.them({ ...v, luong, employeeId, userId: user.id })
    await ghiVet(
      user,
      employeeId,
      `Hợp đồng: thêm ${TEN_LOAI_HD[v.loai].toLowerCase()}${v.so ? ` số ${v.so}` : ''} từ ${ngayVn(v.tuNgay)}`,
    )
    return { canhBao: canhBaoHd(v) }
  },

  async sua(user: User, id: string, v: HdNhap): Promise<{ canhBao: string[] }> {
    await assertAction(user, QUYEN)
    const cu = await hopDongRepo.mot(id)
    if (!cu) throw NotFound('Không tìm thấy hợp đồng')
    if (cu.huy) throw Conflict('Hợp đồng đã huỷ — thêm hợp đồng mới thay vì sửa')
    kiemNgay(v)
    await kiemChong(cu.employeeId, v, id)
    await kiemFile(cu.employeeId, v.fileId)
    await hopDongRepo.sua(id, {
      contract_no: v.so,
      kind: v.loai,
      start_date: v.tuNgay,
      end_date: v.denNgay,
      job_title: v.chucDanh,
      // Không có quyền lương: giữ nguyên mức lương đang ghi (form của họ không có ô này).
      salary: (await canAction(user, QUYEN_LUONG_HD)) ? v.luong : cu.luong,
      note: v.ghiChu,
      file_id: v.fileId,
    })
    await ghiVet(
      user,
      cu.employeeId,
      `Hợp đồng: sửa ${cu.so ? `số ${cu.so}` : TEN_LOAI_HD[cu.loai].toLowerCase()}`,
    )
    return { canhBao: canhBaoHd(v) }
  },

  async huy(user: User, id: string, lyDo: string): Promise<void> {
    await assertAction(user, QUYEN)
    const cu = await hopDongRepo.mot(id)
    if (!cu) throw NotFound('Không tìm thấy hợp đồng')
    if (cu.huy) return
    await hopDongRepo.huy(id, lyDo, user.id)
    await ghiVet(
      user,
      cu.employeeId,
      `Hợp đồng: huỷ ${cu.so ? `số ${cu.so}` : TEN_LOAI_HD[cu.loai].toLowerCase()} · ${lyDo}`,
    )
  },

  /** Giấy tờ của một người (file đã chốt, chưa xoá). */
  async giayTo(user: User, employeeId: string) {
    await assertAction(user, QUYEN)
    const rows = await filesRepo.listByParent('hr_employee_id', employeeId)
    return rows.map((f) => ({
      id: f.id,
      ten: f.filename,
      loai: f.doc_type,
      dungLuong: f.size_bytes,
      luc: f.created_at,
      mime: f.mime_type,
    }))
  },
}

export type GiayTo = Awaited<ReturnType<typeof hopDongService.giayTo>>[number]

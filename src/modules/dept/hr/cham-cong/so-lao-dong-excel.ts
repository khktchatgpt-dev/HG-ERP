import ExcelJS from 'exceljs'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { todayVn } from '@/lib/date-vn'
import { ngayVn, TEN_LY_DO_NGHI, type LyDoNghi } from '@/lib/nhan-su/bien-dong'
import { TEN_GIOI_TINH, type GioiTinh } from '@/lib/nhan-su/ca-nhan'
import { soSanhMa } from '@/lib/nhan-su/ho-so'
import { hdHienHanh, TEN_LOAI_HD } from '@/lib/nhan-su/hop-dong'
import { chamCongRepo } from './cham-cong.repo'
import { caNhanRepo } from './ca-nhan.repo'
import { hopDongRepo } from './hop-dong.repo'

const NEN_DAU = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F5F8' },
} as const
const d = (iso: string | null | undefined) => (iso ? ngayVn(iso) : '')

/**
 * SỔ QUẢN LÝ LAO ĐỘNG (B4, theo nội dung NĐ 145/2020 Điều 3) — đồng thời là MẪU NHẬP: tiêu đề
 * cột khớp đúng bộ nhận cột của "Nhập từ Excel", nên điền thêm rồi dán lại là được. Ngày ghi
 * dạng chữ dd/mm/yyyy, CCCD / MST là chữ (giữ số 0 đầu).
 *
 * Có quyền hr.employee.private → đủ cột cá nhân + hợp đồng; không có → chỉ cột công việc.
 */
export async function buildSoLaoDong(
  user: User,
): Promise<{ buf: Buffer; rieng: boolean }> {
  await assertAction(user, 'hr.attendance.view')
  const rieng = await canAction(user, 'hr.employee.private')
  const homNay = todayVn()
  const [emps, ds, hds] = await Promise.all([
    chamCongRepo.employees(),
    rieng ? caNhanRepo.tatCa() : Promise.resolve(new Map()),
    rieng ? hopDongRepo.tatCaChuaHuy() : Promise.resolve([]),
  ])
  const hdCua = new Map<string, typeof hds>()
  for (const h of hds) hdCua.set(h.employeeId, [...(hdCua.get(h.employeeId) ?? []), h])

  const cot: {
    ten: string
    rong: number
    chu?: boolean
    gia: (e: (typeof emps)[number]) => string
  }[] = [
    { ten: 'Mã NV', rong: 10, chu: true, gia: (e) => e.code },
    { ten: 'Họ tên', rong: 26, gia: (e) => e.full_name },
    { ten: 'Tổ', rong: 22, gia: (e) => e.team ?? '' },
    { ten: 'Chức danh', rong: 22, gia: (e) => e.job_title ?? '' },
    { ten: 'Ngày vào làm', rong: 13, chu: true, gia: (e) => d(e.hire_date) },
  ]
  if (rieng) {
    const r = (e: (typeof emps)[number]) => ds.get(e.id)
    cot.push(
      {
        ten: 'Giới tính',
        rong: 9,
        gia: (e) => (r(e)?.gender ? TEN_GIOI_TINH[r(e)!.gender as GioiTinh] : ''),
      },
      { ten: 'Ngày sinh', rong: 12, chu: true, gia: (e) => d(r(e)?.birth_date) },
      { ten: 'Quốc tịch', rong: 11, gia: (e) => r(e)?.nationality ?? '' },
      { ten: 'Số CCCD', rong: 15, chu: true, gia: (e) => r(e)?.national_id ?? '' },
      { ten: 'Ngày cấp', rong: 12, chu: true, gia: (e) => d(r(e)?.id_issue_date) },
      { ten: 'Nơi cấp', rong: 22, gia: (e) => r(e)?.id_issue_place ?? '' },
      { ten: 'Quê quán', rong: 18, gia: (e) => r(e)?.hometown ?? '' },
      { ten: 'Thường trú', rong: 30, gia: (e) => r(e)?.permanent_address ?? '' },
      { ten: 'Chỗ ở hiện tại', rong: 30, gia: (e) => r(e)?.current_address ?? '' },
      { ten: 'Điện thoại', rong: 13, chu: true, gia: (e) => r(e)?.phone ?? '' },
      { ten: 'Trình độ', rong: 18, gia: (e) => r(e)?.education ?? '' },
      { ten: 'Mã số thuế', rong: 15, chu: true, gia: (e) => r(e)?.tax_code ?? '' },
      {
        ten: 'Loại hợp đồng',
        rong: 22,
        gia: (e) => {
          const h = hdHienHanh(hdCua.get(e.id) ?? [], homNay)
          return h ? TEN_LOAI_HD[h.loai] : ''
        },
      },
      {
        ten: 'Số hợp đồng',
        rong: 16,
        chu: true,
        gia: (e) => hdHienHanh(hdCua.get(e.id) ?? [], homNay)?.so ?? '',
      },
      {
        ten: 'HĐ hiệu lực từ',
        rong: 13,
        chu: true,
        gia: (e) => d(hdHienHanh(hdCua.get(e.id) ?? [], homNay)?.tuNgay),
      },
      {
        ten: 'HĐ hiệu lực đến',
        rong: 14,
        chu: true,
        gia: (e) => {
          const h = hdHienHanh(hdCua.get(e.id) ?? [], homNay)
          return h ? (h.denNgay ? d(h.denNgay) : 'không thời hạn') : ''
        },
      },
      { ten: 'Liên hệ khẩn cấp', rong: 22, gia: (e) => r(e)?.emergency_name ?? '' },
      { ten: 'Quan hệ', rong: 9, gia: (e) => r(e)?.emergency_relation ?? '' },
      {
        ten: 'SĐT khẩn cấp',
        rong: 13,
        chu: true,
        gia: (e) => r(e)?.emergency_phone ?? '',
      },
    )
  }
  cot.push(
    {
      ten: 'Tình trạng',
      rong: 11,
      gia: (e) => (e.active ? (e.leave_date ? 'sắp nghỉ' : 'đang làm') : 'đã nghỉ'),
    },
    { ten: 'Ngày làm việc cuối', rong: 14, chu: true, gia: (e) => d(e.leave_date) },
    {
      ten: 'Lý do nghỉ',
      rong: 18,
      gia: (e) =>
        e.leave_reason
          ? (TEN_LY_DO_NGHI[e.leave_reason as LyDoNghi] ?? e.leave_reason)
          : '',
    },
  )

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sổ quản lý lao động')
  ws.addRow([rieng ? 'SỔ QUẢN LÝ LAO ĐỘNG' : 'DANH SÁCH NHÂN VIÊN']).font = {
    bold: true,
    size: 13,
  }
  ws.addRow([
    `Lập ngày ${ngayVn(homNay)} · ${emps.length} người (${emps.filter((e) => e.active).length} đang làm) · ` +
      (rieng
        ? 'Chứa CCCD, địa chỉ — tài liệu nội bộ Phòng Nhân sự, không gửi ra ngoài.'
        : 'Bản không có thông tin cá nhân (người lập không có quyền xem).'),
  ])
  ws.addRow([
    'Điền thêm vào các cột rồi dán lại ở Hồ sơ nhân viên › Nhập từ Excel; cột không nhận ra (STT, Loại HĐ…) được bỏ qua.',
  ])
  const head = ws.addRow(['STT', ...cot.map((c) => c.ten)])
  head.font = { bold: true }
  head.eachCell((c) => (c.fill = NEN_DAU))
  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 3 }]
  ws.getColumn(1).width = 5
  cot.forEach((c, i) => {
    const col = ws.getColumn(i + 2)
    col.width = c.rong
    if (c.chu) col.numFmt = '@'
  })
  ;[...emps]
    .sort((a, b) => Number(b.active) - Number(a.active) || soSanhMa(a.code, b.code))
    .forEach((e, i) => ws.addRow([i + 1, ...cot.map((c) => c.gia(e))]))
  return { buf: Buffer.from(await wb.xlsx.writeBuffer()), rieng }
}

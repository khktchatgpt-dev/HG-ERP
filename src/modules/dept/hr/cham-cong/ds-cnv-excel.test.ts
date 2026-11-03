import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { EmployeeRow } from './cham-cong.repo'
import { nhomDangLam, veDsCnv, type DuLieuDsCnv } from './ds-cnv-excel'

const nv = (p: Partial<EmployeeRow>): EmployeeRow => ({
  id: p.code ?? 'x',
  code: 'x',
  full_name: 'Người thử',
  shift_id: 'ca',
  active: true,
  team: 'Kho',
  note: null,
  attendance_exempt: false,
  hire_date: '2023-05-08',
  leave_date: null,
  leave_reason: null,
  job_title: 'NV Kho',
  ...p,
})
const ds = [
  nv({ code: '31', team: 'Tổ Phôi' }),
  nv({ code: '5', team: 'Tổ Phôi', note: 'Hồ sơ TẠM · ca mặc định Xưởng, cần xem lại' }),
  nv({ code: '7', team: null }),
  nv({ code: '2', team: 'Kho' }),
  nv({ code: '9', active: false, leave_date: '2026-10-30', leave_reason: 'resign' }),
]
const rieng = new Map(
  ['31', '2', '9'].map((id) => [
    id,
    {
      birth_date: '1994-09-21',
      gender: 'male',
      nationality: null,
      hometown: null,
      education: null,
      national_id: id === '2' ? null : '052301004417',
      id_issue_date: null,
      id_issue_place: null,
      permanent_address: null,
      current_address: 'Khu phố 2',
      phone: '0905123456',
      emergency_name: null,
      emergency_relation: null,
      emergency_phone: null,
      social_insurance_no: null,
      tax_code: null,
    },
  ]),
)
const x: DuLieuDsCnv = {
  congTy: { ten: 'Công ty TNHH SX-TM Hoàng Gia', diaChi: 'Lô C3 CCN Cát Nhơn' },
  homNay: '2026-11-03',
  nv: ds,
  rieng,
}

async function doc(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const chu = (ws: ExcelJS.Worksheet) =>
    ws
      .getSheetValues()
      .map((r) => (Array.isArray(r) ? r.slice(1).map((v) => v ?? '') : []))
  return wb.worksheets.map((ws) => ({ ten: ws.name, dong: chu(ws) }))
}

describe('nhóm đang làm theo bộ phận', () => {
  it('theo tên bộ phận, "(Chưa có bộ phận)" cuối, trong nhóm theo mã; người nghỉ không vào', () => {
    const g = nhomDangLam(ds)
    expect(g.map((n) => n.ten)).toEqual(['Kho', 'Tổ Phôi', '(Chưa có bộ phận)'])
    expect(g[1].ds.map((n) => n.code)).toEqual(['5', '31'])
  })
})

describe('file DS CNV', () => {
  it('hai sheet; tiêu đề; nhóm đánh số + số người; tổng; không có Số tài khoản / Email', async () => {
    const { buf, soCccd } = await veDsCnv(x)
    const [s1, s2] = await doc(buf)
    expect(s1.ten).toBe('DS CNV 2026')
    expect(s2.ten).toBe('Đã nghỉ việc')
    expect(s1.dong[1][0]).toBe('CÔNG TY TNHH SX-TM HOÀNG GIA')
    expect(s1.dong[3][0]).toBe('DANH SÁCH CÔNG NHÂN VIÊN NĂM 2026')
    const dau = s1.dong[5]
    expect(dau).toEqual([
      'STT',
      'MSNV',
      'Họ và tên',
      'Chức vụ',
      'Giới tính',
      'Ngày tháng năm sinh',
      'Nơi ở hiện tại',
      'Ngày vào làm',
      'Số CCCD',
      'Số điện thoại',
      'Ghi chú',
    ])
    const nhom = s1.dong.filter((r) => /^\d\d\. /.test(String(r[0])))
    expect(nhom.map((r) => [r[0], r[r.length - 1]])).toEqual([
      ['01. KHO', 'Số người: 1'],
      ['02. TỔ PHÔI', 'Số người: 2'],
      ['03. (CHƯA CÓ BỘ PHẬN)', 'Số người: 1'],
    ])
    const tong = s1.dong.find((r) => r?.[0] === 'TỔNG SỐ CÔNG NHÂN VIÊN')!
    expect(tong[tong.length - 1]).toBe('4')
    // 31 và 9 có CCCD (2 không có, 5 và 7 không có dòng riêng tư)
    expect(soCccd).toBe(2)
    // ghi chú bỏ đuôi "ca mặc định"
    expect(s1.dong.find((r) => r?.[1] === '5')![10]).toBe('Hồ sơ TẠM')
    const nghi = s2.dong.find((r) => r?.[1] === '9')!
    expect(nghi).toContain('30/10/2026')
  })
  it('không có quyền thông tin riêng → không cột cá nhân, không đếm CCCD', async () => {
    const { buf, soCccd } = await veDsCnv({ ...x, rieng: null })
    const [s1] = await doc(buf)
    expect(s1.dong[5]).toEqual([
      'STT',
      'MSNV',
      'Họ và tên',
      'Chức vụ',
      'Ngày vào làm',
      'Ghi chú',
    ])
    expect(soCccd).toBe(0)
  })
})

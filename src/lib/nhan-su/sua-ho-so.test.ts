import { describe, expect, it } from 'vitest'
import type { CaNhan } from './ca-nhan'
import { formTu, goiHoSo, kiemHoSo, type GocCv } from './sua-ho-so'

const n: GocCv = {
  hoTen: 'Nguyễn Văn Phúc',
  tenTuMay: false,
  boPhan: 'Tổ Sơn Sắt',
  chucDanh: 'Công nhân',
  ngayVao: '2023-05-08',
  shiftId: 'ca-ngay',
  khongChamCong: false,
  ghiChu: null,
}
const c: CaNhan = {
  ngaySinh: '1994-09-21',
  gioiTinh: 'male',
  quocTich: 'Việt Nam',
  queQuan: null,
  trinhDo: null,
  cccdChe: '•••• 2208',
  mstChe: null,
  ngayCap: null,
  noiCap: null,
  thuongTru: null,
  choO: 'Khu phố 2',
  dienThoai: '0976214558',
  khanCapTen: null,
  khanCapQuanHe: null,
  khanCapSdt: null,
  maBhxh: null,
}
const H = '2026-11-02'
const P = { cv: true, rieng: true }

describe('form dựng từ dữ liệu đã lưu', () => {
  it('ngày dd/mm/yyyy, SĐT có cách; ô che (CCCD, MST) trống', () => {
    const f = formTu(n, c)
    expect(f.ngayVao).toBe('08/05/2023')
    expect(f.ngaySinh).toBe('21/09/1994')
    expect(f.dienThoai).toBe('0976 214 558')
    expect(f.cccd).toBe('')
    expect(f.mst).toBe('')
  })
  it('không có quyền riêng (caNhan null) → ô cá nhân trống, không lỗi', () => {
    expect(formTu(n, null).dienThoai).toBe('')
  })
})

describe('chỉ gửi ô đã đổi', () => {
  const goc = formTu(n, c)
  it('không đổi gì → gói rỗng; gõ lại cùng giá trị cách khác → vẫn không đổi', () => {
    expect(goiHoSo(goc, goc, P)).toEqual({ goi: {}, so: 0 })
    const f = {
      ...goc,
      dienThoai: '0976.214.558',
      ngaySinh: '21-9-1994',
      choO: ' Khu  phố 2 ',
    }
    expect(goiHoSo(f, goc, P).so).toBe(0)
  })
  it('đổi ở hai khối → một gói, chuẩn hoá; xoá ô → null', () => {
    const f = {
      ...goc,
      chucVu: 'Tổ trưởng',
      ngayVao: '01/06/2023',
      dienThoai: '0905 123 456',
      choO: '',
      cccd: '052 301 004 417',
    }
    expect(goiHoSo(f, goc, P)).toEqual({
      goi: {
        cong_viec: { job_title: 'Tổ trưởng', hire_date: '2023-06-01' },
        ca_nhan: {
          national_id: '052301004417',
          current_address: null,
          phone: '0905123456',
        },
      },
      so: 5,
    })
  })
  it('khối không được sửa thì không gửi dù form khác', () => {
    const f = { ...goc, chucVu: 'Tổ trưởng', dienThoai: '0905123456' }
    expect(goiHoSo(f, goc, { cv: false, rieng: true }).goi).toEqual({
      ca_nhan: { phone: '0905123456' },
    })
    expect(goiHoSo(f, goc, { cv: true, rieng: false }).goi).toEqual({
      cong_viec: { job_title: 'Tổ trưởng' },
    })
  })
})

describe('kiểm ô', () => {
  const goc = formTu(n, c)
  it('ô sai theo thứ tự trang; ô trống không lỗi (trừ họ tên)', () => {
    const f = { ...goc, ten: 'A', ngaySinh: '31/02/1990', cccd: '123', khanCapSdt: '12' }
    expect(kiemHoSo(f, { ...P, homNay: H }).map((x) => x.o)).toEqual([
      'ten',
      'ngaySinh',
      'cccd',
      'khanCapSdt',
    ])
    expect(
      kiemHoSo({ ...goc, ngaySinh: '', dienThoai: '' }, { ...P, homNay: H }),
    ).toEqual([])
  })
  it('ngày sinh / ngày cấp sau hôm nay → sai; ngày vào tương lai được (chưa vào)', () => {
    const f = { ...goc, ngaySinh: '01/01/2030', ngayVao: '15/11/2026' }
    expect(kiemHoSo(f, { ...P, homNay: H }).map((x) => x.o)).toEqual(['ngaySinh'])
  })
  it('MST 10 hoặc 13 số', () => {
    expect(kiemHoSo({ ...goc, mst: '01234' }, { ...P, homNay: H })[0].o).toBe('mst')
    expect(kiemHoSo({ ...goc, mst: '0123456789' }, { ...P, homNay: H })).toEqual([])
  })
})

describe('Mã số BHXH trên hồ sơ (B5)', () => {
  const goc = formTu(n, { ...c, maBhxh: '5212345678' })
  it('bày đủ trong form; gõ lại có cách → không đổi; xoá → null; sai → báo', () => {
    expect(goc.maBhxh).toBe('5212345678')
    expect(goiHoSo({ ...goc, maBhxh: '5212 345 678' }, goc, P).so).toBe(0)
    expect(goiHoSo({ ...goc, maBhxh: '' }, goc, P).goi).toEqual({
      ca_nhan: { social_insurance_no: null },
    })
    expect(kiemHoSo({ ...goc, maBhxh: '52123' }, { ...P, homNay: H })[0].o).toBe('maBhxh')
  })
})

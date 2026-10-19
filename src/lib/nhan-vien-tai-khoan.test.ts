import { describe, expect, it } from 'vitest'
import {
  demLoc,
  ghepDong,
  goiYGan,
  hienMacDinh,
  khopTim,
  tenDungChung,
  type NvGoc,
  type TkGoc,
} from './nhan-vien-tai-khoan'

const nv = (id: string, ten: string, p: Partial<NvGoc> = {}): NvGoc => ({
  id,
  ma: id,
  ten,
  to: null,
  toId: null,
  dangLam: true,
  khongCham: false,
  ...p,
})
const tk = (id: string, ten: string, p: Partial<TkGoc> = {}): TkGoc => ({
  id,
  email: `${id}@hg.com`,
  ten,
  role: 'employee',
  phongId: null,
  title: null,
  dangMo: true,
  xoaLuc: null,
  nvId: null,
  dungChung: false,
  nguoiCam: null,
  dangNhap: null,
  doiMk: false,
  ...p,
})

const NV = [
  nv('101', 'Đặng Thị Thanh Nga'),
  nv('KCC-007', 'Trần Duy Ninh'),
  nv('102', 'Nguyễn Văn An'),
  nv('103', 'Nguyễn Văn An'),
  nv('104', 'Lê Văn Cũ', { dangLam: false }),
]
const TK = [
  tk('nga', 'Dang Thi Thanh Nga'),
  tk('an', 'Nguyễn Văn An'),
  tk('thao', 'Vũ Phương Thảo'),
  tk('son', 'Thống kê Tổ Sơn Sắt', { dungChung: true, nguoiCam: 'Hoa' }),
  tk('cu', 'Lê Văn Cũ', { nvId: '104', dangMo: false }),
  tk('xoa', 'Người Đã Xoá', { xoaLuc: '2026-09-01' }),
]

describe('ghép nhân viên ↔ tài khoản', () => {
  const dong = ghepDong(NV, TK)
  it('mỗi nhân viên một dòng, rồi tài khoản chưa gắn, rồi dùng chung', () => {
    expect(dong.map((d) => d.kieu)).toEqual([
      'nv',
      'nv',
      'nv',
      'nv',
      'nv',
      'chua_gan',
      'chua_gan',
      'chua_gan',
      'chua_gan',
      'dung_chung',
    ])
    expect(dong.find((d) => d.kieu === 'nv' && d.nv.id === '104')?.tk?.id).toBe('cu')
  })
  it('mặc định ẩn người đã nghỉ và tài khoản rời đã xoá; chip đếm đúng hàm lọc', () => {
    expect(dong.filter(hienMacDinh)).toHaveLength(8)
    expect(demLoc(dong, false)).toEqual({
      tat_ca: 8,
      co_tk: 0,
      chua_co: 4,
      chua_gan: 3,
      dung_chung: 1,
      nghi_con_tk: 0,
    })
    expect(demLoc(dong, true).chua_gan).toBe(4)
  })
  it('người nghỉ mà tài khoản còn mở luôn hiện', () => {
    const d = ghepDong([nv('9', 'A', { dangLam: false })], [tk('a', 'A', { nvId: '9' })])
    expect(demLoc(d, false).nghi_con_tk).toBe(1)
  })
  it('tìm không dấu theo mã, tên, email, người cầm', () => {
    expect(dong.filter((d) => khopTim(d, 'ninh')).length).toBe(1)
    expect(dong.filter((d) => khopTim(d, 'hoa')).length).toBe(1)
  })
})

describe('gợi ý gắn theo họ tên', () => {
  it('khớp đúng một người thì gợi ý; trùng tên hai người thì không', () => {
    const g = goiYGan(NV, TK)
    expect(g.map((x) => [x.tk.id, x.nv.id])).toEqual([['nga', '101']])
  })
  it('bỏ qua tên kiểu tài khoản dùng chung', () => {
    expect(tenDungChung('Thống kê Tổ Phôi')).toBe(true)
    expect(tenDungChung('Quản trị viên')).toBe(true)
    expect(tenDungChung('Thống Nhất')).toBe(false)
  })
})

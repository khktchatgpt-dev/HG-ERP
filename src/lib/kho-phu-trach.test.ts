import { describe, expect, it } from 'vitest'
import {
  cheDoMacDinh,
  khopGiu,
  nguoiCuaDon,
  nguoiGiu,
  thayDoi,
  thuKhoCua,
  type NguoiKho,
} from './kho-phu-trach'

const NGUOI: NguoiKho[] = [
  { id: 'ha', name: 'Hà Nguyễn Nữ', thu_kho: false },
  { id: 'hao', name: 'Lê Khắc Hào', thu_kho: true },
]
const PC = { 'Bao bì': 'ha', 'Mút - xốp': 'ha', 'Sắt thép': 'hao' }

describe('người giữ', () => {
  it('nhóm chưa gán / mã không nhóm thuộc thủ kho', () => {
    expect(thuKhoCua(NGUOI)).toBe('hao')
    expect(nguoiGiu('Bao bì', PC, 'hao')).toBe('ha')
    expect(nguoiGiu('Gỗ', PC, 'hao')).toBe('hao')
    expect(nguoiGiu(null, PC, 'hao')).toBe('hao')
    expect(nguoiGiu('Gỗ', PC, null)).toBeNull()
  })
  it('đơn hai nhóm hai người thuộc cả hai, không lặp', () => {
    expect(nguoiCuaDon(['Bao bì', 'Mút - xốp'], PC, 'hao')).toEqual(['ha'])
    expect(nguoiCuaDon(['Bao bì', 'Gỗ', 'Mút - xốp'], PC, 'hao')).toEqual(['ha', 'hao'])
    expect(nguoiCuaDon([], PC, 'hao')).toEqual(['hao'])
  })
})

describe('lọc "Của tôi"', () => {
  it('mặc định: nhân viên có đơn → của tôi; thủ kho / ngoài Kho / không đơn → tất cả', () => {
    expect(cheDoMacDinh('ha', NGUOI, [['ha'], ['hao']])).toBe('toi')
    expect(cheDoMacDinh('ha', NGUOI, [['hao']])).toBe('tat_ca')
    expect(cheDoMacDinh('hao', NGUOI, [['hao']])).toBe('tat_ca')
    expect(cheDoMacDinh('nga', NGUOI, [['ha']])).toBe('tat_ca')
  })
  it('khớp theo tôi / một người / tất cả', () => {
    expect(khopGiu(['ha', 'hao'], 'toi', 'ha')).toBe(true)
    expect(khopGiu(['hao'], 'toi', 'ha')).toBe(false)
    expect(khopGiu(['hao'], 'hao', 'ha')).toBe(true)
    expect(khopGiu([], 'tat_ca', 'ha')).toBe(true)
  })
})

describe('thay đổi để lưu', () => {
  it('chỉ nhóm đổi, bỏ gán là null', () => {
    expect(
      thayDoi(PC, {
        ...PC,
        'Bao bì': 'hao',
        Gỗ: 'ha',
        'Sắt thép': undefined as unknown as string,
      }),
    ).toEqual([
      // prettier-ignore
      { group_name: 'Bao bì', user_id: 'hao' },
      { group_name: 'Gỗ', user_id: 'ha' },
      { group_name: 'Sắt thép', user_id: null },
    ])
    expect(thayDoi(PC, { ...PC })).toEqual([])
  })
})

describe('nhóm của tôi (Tồn kho, Hôm nay)', () => {
  it('nhân viên: nhóm được gán; thủ kho: mọi nhóm không gán cho người khác; ngoài Kho: null', async () => {
    const { nhomCuaToi, macDinhCuaToi } = await import('./kho-phu-trach')
    expect(nhomCuaToi('ha', NGUOI, PC)).toEqual({ in: ['Bao bì', 'Mút - xốp'] })
    expect(nhomCuaToi('hao', NGUOI, PC)).toEqual({ notIn: ['Bao bì', 'Mút - xốp'] })
    expect(nhomCuaToi('nga', NGUOI, PC)).toBeNull()
    expect(macDinhCuaToi('ha', NGUOI, PC)).toBe(true)
    expect(macDinhCuaToi('ha', NGUOI, {})).toBe(false)
    expect(macDinhCuaToi('hao', NGUOI, PC)).toBe(false)
  })
})

describe('gợi ý người đếm (mở đợt kiểm kê theo nhóm)', () => {
  it('một người giữ hết → gợi ý; nhiều người → không gợi ý; chưa chọn → không', async () => {
    const { goiYNguoiDem } = await import('./kho-phu-trach')
    const giu = { 'Bao bì': 'ha', 'Mút - xốp': 'ha', 'Sắt thép': 'hao', 'Lạ': null }
    expect(goiYNguoiDem(['Bao bì', 'Mút - xốp'], giu)).toEqual({ id: 'ha', nguoi: ['ha'] })
    expect(goiYNguoiDem(['Bao bì', 'Sắt thép'], giu)).toEqual({ id: null, nguoi: ['ha', 'hao'] })
    expect(goiYNguoiDem([], giu)).toEqual({ id: null, nguoi: [] })
    expect(goiYNguoiDem(['Lạ'], giu)).toEqual({ id: null, nguoi: [] })
  })
})

describe('nhãn gọn nhóm vật tư', () => {
  it('lấy phần trước " - " đầu tiên', async () => {
    const { nhomGon } = await import('./kho-phu-trach')
    expect(nhomGon('Vải - da - chỉ - phụ liệu may')).toBe('Vải')
    expect(nhomGon('Nhôm định hình - tấm')).toBe('Nhôm định hình')
    expect(nhomGon('Inox')).toBe('Inox')
  })
})

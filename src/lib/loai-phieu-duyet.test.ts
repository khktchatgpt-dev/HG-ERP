import { describe, expect, it } from 'vitest'
import {
  LOAI_PHIEU,
  LOAI_THEO_THU_TU,
  PHONG_TRINH,
  demTheoPhong,
  gomTheoLoai,
  kyNhanhDuoc,
  vungGap,
  xepGap,
  type LoaiPhieu,
} from './loai-phieu-duyet'

/** Danh mục loại phiếu duyệt (Hộp ký H1, Q23–Q28). */
const p = (
  kind: LoaiPhieu,
  x: Partial<{ waiting_days: number; late_sign: unknown; po: { eta_late_days: number } | null; big: boolean; code: string }> = {}, // prettier-ignore
) => ({ kind, waiting_days: 0, late_sign: null, po: null, big: false, code: kind, ...x })

describe('LOAI_PHIEU', () => {
  it('mọi loại thuộc một phòng có trong danh sách phòng; thứ tự khối theo phòng (Q25)', () => {
    for (const l of LOAI_THEO_THU_TU) expect(PHONG_TRINH).toContain(LOAI_PHIEU[l].phong)
    expect(LOAI_THEO_THU_TU).toEqual(['po', 'dnm', 'lsx', 'quote', 'luong'])
  })
})

describe('vungGap / xepGap — khối "Cần ký trước" (Q24)', () => {
  it('ký bù > quá hẹn > chờ ≥ 3 ngày; giá trị lớn KHÔNG tự vào', () => {
    expect(vungGap(p('po', { late_sign: { at: 'x' } }))?.ma).toBe('ky_bu')
    expect(vungGap(p('po', { po: { eta_late_days: 4 } }))).toEqual({ ma: 'qua_hen', cau: 'hẹn giao đã qua 4 ngày' }) // prettier-ignore
    expect(vungGap(p('dnm', { waiting_days: 3 }))?.ma).toBe('cho_lau')
    expect(vungGap(p('dnm', { waiting_days: 2 }))).toBeNull()
    expect(vungGap(p('po', { big: true }))).toBeNull()
  })

  it('xếp: ký bù trước, rồi quá hẹn, rồi chờ lâu (chờ lâu hơn trước); phiếu không gấp bị loại', () => {
    const ds = [
      p('dnm', { code: 'a', waiting_days: 3 }),
      p('po', { code: 'b', po: { eta_late_days: 1 }, waiting_days: 1 }),
      p('dnm', { code: 'c', waiting_days: 6 }),
      p('po', { code: 'd', late_sign: {}, waiting_days: 0 }),
      p('lsx', { code: 'e', waiting_days: 1 }),
    ]
    expect(xepGap(ds).map((x) => x.code)).toEqual(['d', 'b', 'c', 'a'])
  })
})

describe('gomTheoLoai / demTheoPhong', () => {
  const ds = [p('lsx'), p('po'), p('dnm'), p('po')]
  it('khối theo thứ tự đã khai, khối rỗng ẩn', () => {
    expect(gomTheoLoai(ds).map((g) => [g.loai, g.items.length])).toEqual([['po', 2], ['dnm', 1], ['lsx', 1]]) // prettier-ignore
  })
  it('đếm theo phòng, phòng 0 phiếu vẫn có chip', () => {
    expect(demTheoPhong(ds).map((x) => [x.phong, x.n])).toEqual([['mua_hang', 2], ['kho', 1], ['san_xuat', 1], ['ban_hang', 0], ['ke_toan', 0]]) // prettier-ignore
  })
})

it('kyNhanhDuoc — lệnh SX luôn mở ra đọc; đơn mua lớn / ký bù chặn (Q26)', () => {
  expect(kyNhanhDuoc(p('po'))).toBe(true)
  expect(kyNhanhDuoc(p('po', { big: true }))).toBe(false)
  expect(kyNhanhDuoc(p('po', { late_sign: {} }))).toBe(false)
  expect(kyNhanhDuoc(p('dnm'))).toBe(true)
  expect(kyNhanhDuoc(p('lsx'))).toBe(false)
})

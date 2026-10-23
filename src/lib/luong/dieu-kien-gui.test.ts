import { describe, expect, it } from 'vitest'
import { dieuKienGui, nguoiThieuPhieu } from './dieu-kien-gui'

const ky = { tu: '2026-09-26', den: '2026-10-25' }
const nv = (
  id: string,
  team: string | null,
  o: { hire?: string | null; leave?: string | null } = {},
) => ({
  id,
  code: id,
  full_name: `NV ${id}`,
  team,
  hire_date: o.hire ?? null,
  leave_date: o.leave ?? null,
})
const khoi = new Map<string, string | null>([
  ['Tổ Phôi', 'ttsx'],
  ['Khoán Bốc Xếp', null],
])

describe('nguoiThieuPhieu — người làm trong kỳ mà bảng lương không có phiếu (23/10/2026)', () => {
  it('lộ người có hồ sơ nhưng không có phiếu; bỏ qua tổ khoán ngoài; người chưa có tổ vẫn lộ', () => {
    const emps = [
      nv('1', 'Tổ Phôi'),
      nv('2', 'Tổ Phôi'),
      nv('3', 'Khoán Bốc Xếp'),
      nv('4', null),
    ]
    const r = nguoiThieuPhieu(emps, khoi, [{ employeeId: '1' }], ky)
    expect(r.map((x) => x.ma)).toEqual(['2', '4'])
  })
  it('không tính người vào sau kỳ / nghỉ trước kỳ; chưa tính (0 phiếu) thì không so', () => {
    const emps = [
      nv('5', 'Tổ Phôi', { hire: '2026-10-26' }),
      nv('6', 'Tổ Phôi', { leave: '2026-09-25' }),
      nv('7', 'Tổ Phôi', { hire: '2026-10-20' }),
    ]
    expect(
      nguoiThieuPhieu(emps, khoi, [{ employeeId: 'x' }], ky).map((x) => x.ma),
    ).toEqual(['7'])
    expect(nguoiThieuPhieu(emps, khoi, [], ky)).toEqual([])
  })
})

describe('dieuKienGui', () => {
  it('điều kiện "ai làm trong kỳ cũng có phiếu" nêu tên tối đa 3 người', () => {
    const thieu = ['12', '253', '6090', '7002'].map((ma) => ({
      ma,
      ten: `NV ${ma}`,
      to: null,
    }))
    const d = dieuKienGui([{ employeeId: 'a', van: [] }], false, thieu)
    const x = d.find((k) => k.ma === 'du_nguoi')!
    expect(x.ok).toBe(false)
    expect(x.chiTiet).toBe('4 người không có phiếu: 12 NV 12, 253 NV 253, 6090 NV 6090…')
    expect(dieuKienGui([{ employeeId: 'a', van: [] }], false).every((k) => k.ok)).toBe(
      true,
    )
  })
  it('các điều kiện cũ giữ nguyên: thiếu hồ sơ, STK, hệ số, thực lĩnh âm, cần tính lại', () => {
    const d = dieuKienGui(
      [
        { employeeId: 'a', van: ['Chưa có hồ sơ lương', 'Thiếu STK'] },
        { employeeId: 'b', van: ['Thiếu hệ số K2 ngày thường', 'Thực lĩnh âm'] },
      ],
      true,
    )
    expect(d.filter((k) => !k.ok).map((k) => k.ma)).toEqual([
      'tinh_lai',
      'ho_so',
      'stk',
      'he_so',
      'am',
    ])
    expect(d.find((k) => k.ma === 'he_so')!.chiTiet).toBe('K2 ngày thường')
  })
})

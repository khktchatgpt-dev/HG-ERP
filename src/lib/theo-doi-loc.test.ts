import { describe, expect, it } from 'vitest'
import {
  MOI,
  NGOAI_LENH,
  chiaTrang,
  demTheo,
  khoangDong,
  khopLenh,
  tenNccGon,
  type Nhom,
} from './theo-doi-loc'

const nhom = (key: string, n: number): Nhom<string> => ({
  key,
  ten: key,
  rows: Array.from({ length: n }, (_, i) => `${key}${i + 1}`),
})

describe('chiaTrang — vừa vùng bảng, không trang nào phải cuộn', () => {
  it('mỗi trang ≤ cap mục, tiêu đề nhóm tính là một dòng', () => {
    const t = chiaTrang([nhom('A', 5), nhom('B', 3)], 4)
    for (const p of t) expect(p.length).toBeLessThanOrEqual(4)
    const dong = t.flat().filter((m) => m.kind === 'dong')
    expect(dong).toHaveLength(8)
  })

  it('trang mở đầu giữa nhóm thì lặp tiêu đề nhóm (tiếp)', () => {
    const t = chiaTrang([nhom('A', 5)], 4)
    expect(t[0][0]).toMatchObject({ kind: 'nhom', key: 'A', tiep: false, n: 5 })
    expect(t[1][0]).toMatchObject({ kind: 'nhom', key: 'A', tiep: true })
  })

  it('không để tiêu đề nhóm trơ ở cuối trang', () => {
    // A lấp 3/4 chỗ; B không còn chỗ cho tiêu đề + 1 dòng → B sang trang 2.
    const t = chiaTrang([nhom('A', 2), nhom('B', 2)], 4)
    expect(t[0].map((m) => (m.kind === 'nhom' ? m.key : 'd'))).toEqual(['A', 'd', 'd'])
    expect(t[1][0]).toMatchObject({ kind: 'nhom', key: 'B', tiep: false })
  })

  it('cap quá nhỏ vẫn tiến được (tối thiểu tiêu đề + 1 dòng)', () => {
    const t = chiaTrang([nhom('A', 3)], 0)
    expect(t.flat().filter((m) => m.kind === 'dong')).toHaveLength(3)
  })

  it('khoangDong đếm dòng đơn, bỏ tiêu đề nhóm', () => {
    const t = chiaTrang([nhom('A', 5), nhom('B', 3)], 4)
    expect(khoangDong(t, 0)).toEqual({ tu: 1, den: 3 })
    expect(khoangDong(t, 1)).toEqual({ tu: 4, den: 5 })
  })

  it('rỗng → không trang nào', () => {
    expect(chiaTrang([], 10)).toEqual([])
  })
})

describe('lọc', () => {
  it('khopLenh: mọi lệnh · ngoài lệnh · đúng mã', () => {
    expect(khopLenh(null, MOI)).toBe(true)
    expect(khopLenh(null, NGOAI_LENH)).toBe(true)
    expect(khopLenh('06/26-27 - MX', NGOAI_LENH)).toBe(false)
    expect(khopLenh('06/26-27 - MX', '06/26-27 - MX')).toBe(true)
  })

  it('demTheo: nhiều trước, bỏ null', () => {
    expect(demTheo(['a', 'b', 'a', null], (x) => x)).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })

  it('tenNccGon bỏ tiền tố pháp nhân', () => {
    expect(tenNccGon('CÔNG TY TNHH SX & TM TƯỜNG NGUYÊN')).toBe('SX & TM TƯỜNG NGUYÊN')
    expect(tenNccGon('Công Ty TNHH Nhôm Đoàn Gia')).toBe('Nhôm Đoàn Gia')
    expect(tenNccGon('CTY TNHH HLH')).toBe('HLH')
    expect(tenNccGon('KIMPACK PACKAGING JOINT STOCK COMPANY')).toBe(
      'KIMPACK PACKAGING JOINT STOCK COMPANY',
    )
  })
})

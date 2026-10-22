import { describe, expect, it } from 'vitest'
import { CHUA_BO_PHAN, tinhCoMat } from './co-mat'

// 01/10/2026 là thứ Năm; 04/10 là chủ nhật.
const theoNgay: { ngay: string; theoMay: Record<string, number> }[] = [
  { ngay: '2026-10-01', theoMay: { '.201': 5 } },
  { ngay: '2026-10-02', theoMay: { '.201': 3 } },
  { ngay: '2026-10-03', theoMay: {} }, // chưa lấy về
  { ngay: '2026-10-04', theoMay: { '.201': 1 } }, // CN
  { ngay: '2026-10-05', theoMay: { '.201': 1 } }, // sau hôm nay
]
const nhanSu = [
  { ma: '1', ten: 'A', boPhan: 'Tổ Phôi' },
  { ma: '2', ten: 'B', boPhan: 'Tổ Phôi' },
  { ma: '3', ten: 'C', boPhan: null },
]
const dong = [
  { ngay: '2026-10-01', ma: '1', daGhep: true },
  { ngay: '2026-10-01', ma: '2', daGhep: true },
  { ngay: '2026-10-01', ma: '3', daGhep: true },
  { ngay: '2026-10-02', ma: '1', daGhep: true },
  { ngay: '2026-10-02', ma: '9', daGhep: false }, // mã chưa ghép: không đếm
  { ngay: '2026-10-04', ma: '1', daGhep: true },
]

describe('tinhCoMat', () => {
  const m = tinhCoMat({ theoNgay, dong, nhanSu, homNay: '2026-10-04' })

  it('không bày ngày sau hôm nay', () => {
    expect(m.ngays).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  })

  it('đếm người có lượt theo tổ; ngày chưa lấy về là null, không phải 0', () => {
    const phoi = m.tos.find((t) => t.to === 'Tổ Phôi')!
    expect(phoi.ngay).toEqual([2, 1, null, 1])
  })

  it('nhóm chưa có bộ phận xếp cuối', () => {
    expect(m.tos.at(-1)!.to).toBe(CHUA_BO_PHAN)
  })

  it('trung bình bỏ chủ nhật và ngày chưa có dữ liệu', () => {
    const phoi = m.tos.find((t) => t.to === 'Tổ Phôi')!
    // (2 + 1) / 2 ngày / 2 người
    expect(phoi.tb).toBeCloseTo(0.75)
  })

  it('dòng tổng cộng mọi tổ, mã chưa ghép không tính', () => {
    expect(m.tong).toEqual([3, 1, null, 1])
    expect(m.tongNguoi).toBe(3)
    expect(m.tbTong).toBeCloseTo((3 + 1) / 2 / 3)
  })
})

describe('người vào / nghỉ giữa kỳ — mẫu số theo từng ngày (22/10/2026)', () => {
  it('người nghỉ 02/10 chỉ vào mẫu số tới 02/10; người vào 03/10 chỉ từ 03/10', () => {
    const m = tinhCoMat({
      theoNgay: ['2026-10-01', '2026-10-02', '2026-10-03'].map((ngay) => ({
        ngay,
        theoMay: { '.201': 5 },
      })),
      dong: [
        { ngay: '2026-10-01', ma: 'A', daGhep: true },
        { ngay: '2026-10-02', ma: 'B', daGhep: true },
        { ngay: '2026-10-03', ma: 'C', daGhep: true },
      ],
      nhanSu: [
        { ma: 'A', ten: 'A', boPhan: 'Tổ X' },
        { ma: 'B', ten: 'B', boPhan: 'Tổ X', ngayCuoi: '2026-10-02' },
        { ma: 'C', ten: 'C', boPhan: 'Tổ X', ngayVao: '2026-10-03' },
      ],
      homNay: '2026-10-03',
    })
    expect(m.tongNguoi).toBe(3)
    expect(m.tos[0].mau).toEqual([2, 2, 2])
    expect(m.tos[0].ngay).toEqual([1, 1, 1])
    expect(m.tongMau).toEqual([2, 2, 2])
  })
})

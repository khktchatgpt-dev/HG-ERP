import { describe, expect, it } from 'vitest'
import {
  doiThang,
  gomSoCongDoan,
  ngayTrongThang,
  tongTheoMa,
  type ScdGhi,
  type ScdNguon,
} from './so-cong-doan'

const nguon = (p: Partial<ScdNguon>): ScdNguon => ({
  lsx_id: 'L12',
  lsx_code: '12/26-27 - OVAL',
  ma: '992852',
  ten_sp: 'Giường Oval 185cm',
  row_id: 'r1',
  cum: 'Cụm tay',
  ten: 'Vòng giữa',
  thu_tu: 0,
  can: 100,
  da_lam: 40,
  ...p,
})
const ghi = (p: Partial<ScdGhi>): ScdGhi => ({
  lsx_id: 'L12',
  lsx_code: '12/26-27 - OVAL',
  component_id: 'r1',
  ten: 'Vòng giữa',
  cum: 'Cụm tay',
  thu_tu: 0,
  ngay: '2026-09-08',
  qty: 10,
  team_id: 'to-han',
  ...p,
})

describe('gomSoCongDoan', () => {
  it('một chi tiết lặp ở hai đợt gộp MỘT hàng: cộng cần, đã làm và số từng ngày', () => {
    const out = gomSoCongDoan(
      [nguon({}), nguon({ row_id: 'r2', can: 50, da_lam: 50 })],
      [ghi({}), ghi({ component_id: 'r2', qty: 5 }), ghi({ ngay: '2026-09-09', qty: 7 })],
      { ca: false },
    )
    expect(out).toHaveLength(1)
    const d = out[0].ma[0].dong
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ can: 150, da_lam: 90, thang: 22 })
    expect(d[0].ngay).toEqual({ '2026-09-08': 15, '2026-09-09': 7 })
  })

  it('mặc định chỉ hàng CÓ ghi; "cả chi tiết" giữ hàng chưa có số', () => {
    const n = [nguon({}), nguon({ row_id: 'r9', ten: 'Chân sau', thu_tu: 1 })]
    expect(
      gomSoCongDoan(n, [ghi({})], { ca: false })[0].ma[0].dong.map((x) => x.ten),
    ).toEqual(['Vòng giữa'])
    expect(
      gomSoCongDoan(n, [ghi({})], { ca: true })[0].ma[0].dong.map((x) => x.ten),
    ).toEqual(['Vòng giữa', 'Chân sau'])
  })

  it('ô ngày nhớ tổ: một tổ thì giữ tổ, hai tổ cùng ngày thì null (mở Sổ theo ngày mọi tổ)', () => {
    const out = gomSoCongDoan(
      [nguon({})],
      [
        ghi({}),
        ghi({ team_id: 'to-han' }),
        ghi({ ngay: '2026-09-09', team_id: 'to-han' }),
        ghi({ ngay: '2026-09-09', team_id: 'to-han-2' }),
      ],
      { ca: false },
    )
    expect(out[0].ma[0].dong[0].to).toEqual({
      '2026-09-08': 'to-han',
      '2026-09-09': null,
    })
  })

  it('đếm "xong x/y" theo mã: đã làm ≥ cần', () => {
    const out = gomSoCongDoan(
      [nguon({}), nguon({ row_id: 'r2', ten: 'Chống ngoài', can: 30, da_lam: 30 })],
      [],
      { ca: true },
    )
    expect(out[0].ma[0].xong).toBe(1)
  })

  it('dòng sổ của chi tiết không còn trên Hồ sơ lệnh vẫn bày, không có cần / đã làm', () => {
    const out = gomSoCongDoan([], [ghi({ component_id: 'mat' })], { ca: false })
    expect(out[0].ma[0].code).toBeNull()
    expect(out[0].ma[0].dong[0]).toMatchObject({ can: null, da_lam: null, thang: 10 })
  })

  it('xếp lệnh theo số, mã theo mã, chi tiết theo thứ tự Bảng chi tiết', () => {
    const out = gomSoCongDoan(
      [
        nguon({ lsx_id: 'L2', lsx_code: '2/26-27 - A', row_id: 'a' }),
        nguon({
          lsx_id: 'L10',
          lsx_code: '10/26-27 - B',
          row_id: 'b',
          ten: 'Z',
          thu_tu: 5,
        }),
        nguon({
          lsx_id: 'L10',
          lsx_code: '10/26-27 - B',
          row_id: 'c',
          ten: 'Y',
          thu_tu: 1,
        }),
      ],
      [],
      { ca: true },
    )
    expect(out.map((l) => l.lsx_code)).toEqual(['2/26-27 - A', '10/26-27 - B'])
    expect(out[1].ma[0].dong.map((x) => x.ten)).toEqual(['Y', 'Z'])
  })
})

describe('ngày trong tháng', () => {
  it('đúng số ngày, cả tháng 2 năm nhuận', () => {
    expect(ngayTrongThang('2026-09')).toHaveLength(30)
    expect(ngayTrongThang('2028-02')).toHaveLength(29)
    expect(ngayTrongThang('2026-11')[0]).toBe('2026-11-01')
  })
  it('đổi tháng qua năm', () => {
    expect(doiThang('2026-01', -1)).toBe('2025-12')
    expect(doiThang('2026-12', 1)).toBe('2027-01')
  })
})

describe('tongTheoMa', () => {
  it('cộng Cần / Đã làm / Σ tháng theo mã; hàng không còn trên Hồ sơ lệnh đếm riêng', () => {
    const lenh = gomSoCongDoan(
      [
        nguon({ row_id: 'a', ten: 'Chân', can: 100, da_lam: 40 }),
        nguon({ row_id: 'b', ten: 'Giằng', can: 50, da_lam: 50 }),
      ],
      [
        ghi({ component_id: 'a', ten: 'Chân', ngay: '2026-09-08', qty: 30 }),
        ghi({ component_id: 'b', ten: 'Giằng', ngay: '2026-09-09', qty: 20 }),
        ghi({ component_id: 'zz', ten: 'Mồ côi', ngay: '2026-09-09', qty: 5 }),
      ],
      { ca: false },
    )
    const t = tongTheoMa(lenh)
    const m = t.find((x) => x.code === '992852')!
    expect(m).toMatchObject({ so_ct: 2, can: 150, da_lam: 90, con: 60, thang: 50, xong: 1, khong_so: 0 })
    const co = t.find((x) => x.code === null)!
    expect(co).toMatchObject({ so_ct: 1, can: 0, thang: 5, khong_so: 1 })
  })
})

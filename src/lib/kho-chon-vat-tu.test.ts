import { describe, expect, it } from 'vitest'
import {
  goiYTon,
  latTich,
  locChonNhieu,
  nhomCoTon,
  taoDemTim,
  type VatTuTon,
} from './kho-chon-vat-tu'

const vt = (
  id: string,
  code: string,
  name: string,
  extra: Partial<VatTuTon> = {},
): VatTuTon => ({
  id,
  code,
  name,
  unit: 'Kg',
  qty_ok: 10,
  ke: null,
  nhom: null,
  ...extra,
})

const DS: VatTuTon[] = [
  vt('a', 'SAT0352', 'Thép hộp 20x40 dày 8 dem', { nhom: 'Sắt', ke: 'A1' }),
  vt('b', 'CN0716', 'VC thép hộp từ TPHCM', { nhom: 'Chi phí' }),
  vt('c', 'SAT0344', 'Thép hộp', { nhom: 'Sắt' }),
  vt('d', 'VIT0012', 'Vít đầu dù 4x15', { nhom: 'Ngũ kim', ke: 'B2' }),
  vt('e', 'SON0101', 'Sơn lót xám', { nhom: 'Sơn' }),
]

describe('goiYTon', () => {
  it('chữ rỗng → không bung danh sách', () => {
    expect(goiYTon(DS, '')).toEqual([])
    expect(goiYTon(DS, '   ')).toEqual([])
  })

  it('tìm không dấu, mọi từ phải có, không cần liền nhau', () => {
    expect(goiYTon(DS, 'thep hop').map((x) => x.code)).toEqual([
      'CN0716',
      'SAT0344',
      'SAT0352',
    ])
    expect(goiYTon(DS, '4x15 vit').map((x) => x.code)).toEqual(['VIT0012'])
  })

  it('khớp cả search_text của DB (quy cách, nhóm con) — cùng kết quả với server', () => {
    // Đo DB 27/10: "Sắt hộp 15x35x8dem" chỉ có chữ "thép hộp" ở nhóm con.
    const sat = vt('s', 'ST-0070', 'Sắt hộp 15x35x8dem', {
      tim: 'st-0070 sat hop 15x35x8dem  15*35*8 thep hop vuong - chu nhat',
    })
    expect(goiYTon([sat], 'thep hop').map((x) => x.code)).toEqual(['ST-0070'])
  })

  it('tìm được theo kệ', () => {
    expect(goiYTon(DS, 'b2').map((x) => x.code)).toEqual(['VIT0012'])
  })

  it('mã của lệnh đang chọn lên đầu', () => {
    const r = goiYTon(DS, 'thep hop', new Set(['a']))
    expect(r[0].code).toBe('SAT0352')
  })

  it('mã bắt đầu bằng chữ gõ đứng trước mã chỉ chứa nó', () => {
    const ds = [vt('x', 'ASAT1', 'Bản mã sat'), vt('y', 'SAT9', 'Thép')]
    expect(goiYTon(ds, 'sat').map((x) => x.code)).toEqual(['SAT9', 'ASAT1'])
  })

  it('cắt theo max', () => {
    expect(goiYTon(DS, 'h', new Set(), 2)).toHaveLength(2)
  })
})

describe('locChonNhieu', () => {
  const f = { q: '', nhom: '', chiCuaLenh: false, cuaLenh: new Set<string>() }

  it('không lọc gì → cả tập, xếp theo mã', () => {
    expect(locChonNhieu(DS, f).map((x) => x.id)).toEqual(['b', 'c', 'a', 'e', 'd'])
  })

  it('lọc theo nhóm và chữ', () => {
    expect(locChonNhieu(DS, { ...f, nhom: 'Sắt', q: '20x40' }).map((x) => x.id)).toEqual([
      'a',
    ])
  })

  it('chỉ mã của lệnh', () => {
    const cuaLenh = new Set(['d', 'e'])
    expect(
      locChonNhieu(DS, { ...f, chiCuaLenh: true, cuaLenh }).map((x) => x.id),
    ).toEqual(['e', 'd'])
  })
})

describe('latTich', () => {
  it('tích rồi bỏ; giữ thứ tự tích (= thứ tự dòng vào phiếu)', () => {
    let t = latTich(new Map(), DS[3])
    t = latTich(t, DS[0])
    t = latTich(t, DS[4])
    expect([...t.keys()]).toEqual(['d', 'a', 'e'])
    t = latTich(t, DS[0])
    expect([...t.keys()]).toEqual(['d', 'e'])
  })

  it('không sửa Map cũ', () => {
    const goc = new Map<string, VatTuTon>()
    latTich(goc, DS[0])
    expect(goc.size).toBe(0)
  })
})

describe('nhomCoTon', () => {
  it('đếm theo nhóm, bỏ mã không nhóm', () => {
    expect(nhomCoTon([...DS, vt('z', 'X1', 'Không nhóm')])).toEqual([
      { nhom: 'Chi phí', so: 1 },
      { nhom: 'Ngũ kim', so: 1 },
      { nhom: 'Sắt', so: 2 },
      { nhom: 'Sơn', so: 1 },
    ])
  })
})

describe('taoDemTim', () => {
  it('cùng chữ sau khi bỏ dấu, gộp khoảng trắng → trúng đệm', () => {
    const d = taoDemTim<number>()
    d.dat('Thép  hộp', 1)
    expect(d.lay('thep hop')).toBe(1)
    expect(d.lay('thep')).toBeUndefined()
  })

  it('giữ tối đa `tran` câu gần nhất', () => {
    const d = taoDemTim<number>(2)
    d.dat('a', 1)
    d.dat('b', 2)
    d.dat('c', 3)
    expect(d.lay('a')).toBeUndefined()
    expect(d.lay('c')).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import {
  boSungTuMoc,
  doiQuyCach,
  docDongLenh,
  ganNguoi,
  gopNhatKyLenh,
  slLucMoc,
  type BanGhiLenh,
  type DoiDongLenh,
} from './nhat-ky-lenh'

const dau = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changed_at: string,
): BanGhiLenh => ({ line_id: null, action: 'update', before, after, changed_at })

const DAU0 = {
  ship_date: '2027-01-10',
  materials_due_at: null,
  priority: 1,
  status: 'approved',
}
const CH = { product_id: 'sp-ch', product_code: 'CH0172HG-AL', qty: 400, unit: 'cái', specs: { son: 'Sơn đen', nem: '' }, ship_date: '2027-01-10' } // prettier-ignore

const dong = (
  line_id: string,
  action: BanGhiLenh['action'],
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  changed_at: string,
): BanGhiLenh => ({ line_id, action, before, after, changed_at })

describe('gộp nhật ký lệnh — đầu lệnh', () => {
  it('mỗi trường đổi một dòng, cũ lúc mốc → mới bây giờ, giờ của lần chạm cuối', () => {
    const { doi } = gopNhatKyLenh([
      dau(DAU0, { ...DAU0, ship_date: '2026-12-31' }, '2026-11-03T01:00:00Z'),
      dau({ ...DAU0, ship_date: '2026-12-31' }, { ...DAU0, ship_date: '2026-12-20', priority: 2 }, '2026-11-03T02:00:00Z'), // prettier-ignore
    ])
    expect(doi).toEqual([
      { key: 'dau:ship_date', phan: 'dau', truong: 'ship_date', truoc: '2027-01-10', sau: '2026-12-20', luc: '2026-11-03T02:00:00Z' }, // prettier-ignore
      { key: 'dau:priority', phan: 'dau', truong: 'priority', truoc: 1, sau: 2, luc: '2026-11-03T02:00:00Z' }, // prettier-ignore
    ])
  })

  it('dời rồi dời lại như cũ → không hiện', () => {
    const { doi } = gopNhatKyLenh([
      dau(DAU0, { ...DAU0, ship_date: '2026-12-31' }, '2026-11-03T01:00:00Z'),
      dau({ ...DAU0, ship_date: '2026-12-31' }, DAU0, '2026-11-03T02:00:00Z'),
    ])
    expect(doi).toEqual([])
  })

  it('huỷ lệnh là một dòng riêng', () => {
    const { doi } = gopNhatKyLenh([dau(DAU0, { ...DAU0, status: 'cancelled' }, '2026-11-03T01:00:00Z')]) // prettier-ignore
    expect(doi).toMatchObject([
      { key: 'dau:status', truoc: 'approved', sau: 'cancelled' },
    ])
  })
})

describe('gộp nhật ký lệnh — dòng lệnh', () => {
  it('đổi SL + quy cách trên một dòng → một dòng sửa, nói đủ trường', () => {
    const { doi } = gopNhatKyLenh([
      dong('l1', 'update', CH, { ...CH, qty: 420 }, '2026-11-03T01:00:00Z'),
      dong('l1', 'update', { ...CH, qty: 420 }, { ...CH, qty: 450, specs: { son: 'Sơn nâu' } }, '2026-11-03T02:00:00Z'), // prettier-ignore
    ])
    expect(doi).toHaveLength(1)
    const d = doi[0] as DoiDongLenh
    expect(d).toMatchObject({ loai: 'sua', truong: ['qty', 'specs'], napLai: false })
    expect([d.truoc?.qty, d.sau?.qty]).toEqual([400, 450])
  })

  it('quy cách rỗng coi như không khai — "" → thiếu khoá không phải đổi', () => {
    const { doi } = gopNhatKyLenh([
      dong(
        'l1',
        'update',
        CH,
        { ...CH, specs: { son: 'Sơn đen' } },
        '2026-11-03T01:00:00Z',
      ),
    ])
    expect(doi).toEqual([])
  })

  it('thêm SP / bỏ SP', () => {
    const { doi } = gopNhatKyLenh([
      dong('moi', 'insert', null, { ...CH, product_id: 'sp-tb', product_code: 'TB0183HG-AL', qty: 60 }, '2026-11-03T01:00:00Z'), // prettier-ignore
      dong('cu', 'delete', { ...CH, product_id: 'sp-x', product_code: 'BN0230HG-AL', qty: 69 }, null, '2026-11-03T01:00:00Z'), // prettier-ignore
    ])
    expect(doi.map((d) => [d.key, d.phan === 'dong' && d.loai]).sort()).toEqual([['cu', 'bo'], ['moi', 'them']]) // prettier-ignore
  })

  it('script xoá hết rồi nạp lại: giống hệt triệt tiêu, cùng SP khác SL thành một dòng sửa', () => {
    const t1 = '2026-11-03T01:00:00Z'
    const t2 = '2026-11-03T01:00:00.010Z'
    const TB = { ...CH, product_id: 'sp-tb', product_code: 'TB0183HG-AL', qty: 60 }
    const { doi, napLaiGiong } = gopNhatKyLenh([
      dong('a', 'delete', CH, null, t1),
      dong('b', 'delete', TB, null, t1),
      dong('a2', 'insert', null, { ...CH, qty: 450 }, t2),
      dong('b2', 'insert', null, { ...TB }, t2),
    ])
    expect(napLaiGiong).toBe(1)
    expect(doi).toHaveLength(1)
    expect(doi[0]).toMatchObject({
      key: 'a>a2',
      loai: 'sua',
      truong: ['qty'],
      napLai: true,
    })
  })
})

describe('bổ sung từ mốc soát', () => {
  it('thay đổi mốc thấy mà nhật ký không có → thêm, không lặp cái nhật ký đã nói', () => {
    const { doi } = gopNhatKyLenh([dong('l1', 'update', CH, { ...CH, qty: 450 }, '2026-11-03T01:00:00Z')]) // prettier-ignore
    const out = boSungTuMoc(doi, [
      { k: 'sp_sl', nhan: 'CH0172HG-AL', truoc: 400, nay: 450 },
      { k: 'ship_date', nhan: 'Ngày xuất', truoc: '2027-01-10', nay: '2026-12-20' },
      { k: 'sp_them', nhan: 'TB0183HG-AL', truoc: null, nay: 60 },
    ])
    expect(out.map((d) => d.key)).toEqual(['l1', 'moc:ship_date', 'moc:TB0183HG-AL'])
    expect(out[2]).toMatchObject({ loai: 'them', truoc: null, luc: null })
  })
})

describe('SL sản phẩm lúc mốc', () => {
  it('trừ phần đổi ròng: sửa SL, thêm SP (lúc mốc 0), bỏ SP (sống lại)', () => {
    const { doi } = gopNhatKyLenh([
      dong('l1', 'update', CH, { ...CH, qty: 450 }, '2026-11-03T01:00:00Z'),
      dong(
        'l2',
        'insert',
        null,
        { ...CH, product_id: 'sp-tb', qty: 60 },
        '2026-11-03T01:00:00Z',
      ),
      dong(
        'l3',
        'delete',
        { ...CH, product_id: 'sp-bn', qty: 69 },
        null,
        '2026-11-03T01:00:00Z',
      ),
    ])
    const sl = slLucMoc(new Map([['sp-ch', 450], ['sp-tb', 60]]), doi) // prettier-ignore
    expect(Object.fromEntries(sl)).toEqual({ 'sp-ch': 400, 'sp-tb': 0, 'sp-bn': 69 })
  })
})

describe('ai sửa', () => {
  const sk = [
    { luc: '2026-11-03T01:00:30Z', boi: 'ke-hoach' },
    { luc: '2026-11-03T05:00:00Z', boi: 'sale' },
  ]
  it('sự kiện app gần nhất trong 2 phút; không có → null (script)', () => {
    expect(ganNguoi('2026-11-03T01:00:00Z', sk)).toBe('ke-hoach')
    expect(ganNguoi('2026-11-03T03:00:00Z', sk)).toBeNull()
    expect(ganNguoi(null, sk)).toBeNull()
  })
})

describe('đọc ảnh chụp + quy cách', () => {
  it('specs rỗng bỏ đi; nhãn tiếng Việt theo SPEC_FIELDS', () => {
    expect(docDongLenh({ qty: '450.00', specs: { son: 'Sơn đen', nem: ' ' } })).toMatchObject({ qty: 450, specs: { son: 'Sơn đen' } }) // prettier-ignore
    expect(doiQuyCach({ son: 'Sơn đen' }, { son: 'Sơn nâu', kinh: 'Kính 8mm' })).toEqual([
      { key: 'son', nhan: 'Sơn', truoc: 'Sơn đen', sau: 'Sơn nâu' },
      { key: 'kinh', nhan: 'Kính', truoc: null, sau: 'Kính 8mm' },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import {
  anhHuongMua,
  docAnh,
  gopNhatKy,
  gopVaoVatTu,
  type AnhDong,
  type BanGhiNhatKy,
} from './nhat-ky-dinh-muc'
import { khoaChuaMa } from './bom-chua-ma'

const anh = (o: Partial<AnhDong>): AnhDong => ({
  material_code: null,
  part_name: null,
  qty: null,
  unit: null,
  dim_a_mm: null,
  dim_b_mm: null,
  wall_thickness_mm: null,
  cut_length_mm: null,
  material_note: null,
  weight_kg: null,
  waste_pct: null,
  group_code: 'NGU_KIM',
  ...o,
})

const VIT = anh({ material_code: 'CN1527', part_name: 'Vít dù 4x12, 7M', qty: 64, unit: 'cái' }) // prettier-ignore

let n = 0
const ghi = (
  part_id: string,
  action: BanGhiNhatKy['action'],
  before: AnhDong | null,
  after: AnhDong | null,
  changed_at: string,
  extra: Partial<BanGhiNhatKy> = {},
): BanGhiNhatKy => ({
  product_id: 'sp1',
  part_id,
  action,
  before,
  after,
  changed_by: `u${++n}`,
  changed_at,
  ...extra,
})

describe('gộp nhật ký thành thay đổi ròng', () => {
  it('sửa một lần → một dòng sửa, nói trường nào đổi', () => {
    const { dong } = gopNhatKy([
      ghi('p1', 'update', VIT, { ...VIT, qty: 68 }, '2026-11-04T02:11:00Z'),
    ])
    expect(dong).toHaveLength(1)
    expect(dong[0]).toMatchObject({
      key: 'p1',
      loai: 'sua',
      truong: ['qty'],
      napLai: false,
    })
    expect(dong[0].truoc?.qty).toBe(64)
    expect(dong[0].sau?.qty).toBe(68)
  })

  it('sửa ba lần chỉ còn số đầu → số cuối; người + giờ là của lần cuối', () => {
    const { dong } = gopNhatKy([
      ghi('p1', 'update', { ...VIT, qty: 65 }, { ...VIT, qty: 66 }, '2026-11-04T03:00:00Z', { changed_by: 'cuoi' }), // prettier-ignore
      ghi('p1', 'update', VIT, { ...VIT, qty: 65 }, '2026-11-04T02:00:00Z'),
    ])
    expect(dong).toHaveLength(1)
    expect([dong[0].truoc?.qty, dong[0].sau?.qty]).toEqual([64, 66])
    expect(dong[0]).toMatchObject({ luc: '2026-11-04T03:00:00Z', boi: 'cuoi' })
  })

  it('sửa rồi sửa lại như cũ → không hiện', () => {
    const { dong } = gopNhatKy([
      ghi('p1', 'update', VIT, { ...VIT, qty: 68 }, '2026-11-04T02:00:00Z'),
      ghi('p1', 'update', { ...VIT, qty: 68 }, VIT, '2026-11-04T03:00:00Z'),
    ])
    expect(dong).toEqual([])
  })

  it('thêm rồi xoá trong khoảng → không hiện; thêm mới / xoá hẳn → Thêm / Bỏ', () => {
    const { dong } = gopNhatKy([
      ghi('tam', 'insert', null, VIT, '2026-11-04T02:00:00Z'),
      ghi('tam', 'delete', VIT, null, '2026-11-04T02:05:00Z'),
      ghi('moi', 'insert', null, anh({ material_code: 'NK-0087', part_name: 'Vít 6x40', qty: 2 }), '2026-11-04T02:00:00Z'), // prettier-ignore
      ghi('cu', 'delete', anh({ part_name: 'Gối 220×470', qty: 1, group_code: 'CUSHION' }), null, '2026-11-04T02:00:00Z'), // prettier-ignore
    ])
    expect(dong.map((d) => [d.key, d.loai]).sort()).toEqual([['cu', 'bo'], ['moi', 'them']]) // prettier-ignore
  })

  it('cùng giờ (một giao dịch): thêm trước, sửa sau', () => {
    const t = '2026-11-04T02:00:00Z'
    const { dong } = gopNhatKy([
      ghi('p1', 'update', VIT, { ...VIT, qty: 70 }, t),
      ghi('p1', 'insert', null, VIT, t),
    ])
    expect(dong).toHaveLength(1)
    expect(dong[0]).toMatchObject({ loai: 'them', truoc: null })
    expect(dong[0].sau?.qty).toBe(70)
  })

  it('xoá hết rồi nạp lại giống hệt → không hiện gì, chỉ đếm', () => {
    const t1 = '2026-11-04T02:00:00Z'
    const t2 = '2026-11-04T02:00:01Z'
    const DEN = anh({ material_code: 'nk-0015 ', part_name: 'LĐN 6x20x15', qty: 2 })
    const { dong, napLaiGiong } = gopNhatKy([
      ghi('a', 'delete', VIT, null, t1),
      ghi('b', 'delete', DEN, null, t1),
      ghi('a2', 'insert', null, { ...VIT }, t2),
      // Mã viết khác hoa / khoảng trắng vẫn là một mã.
      ghi('b2', 'insert', null, { ...DEN, material_code: 'NK-0015' }, t2),
      ghi('c2', 'insert', null, anh({ material_code: 'NK-0087', part_name: 'Vít 6x40', qty: 2 }), t2), // prettier-ignore
    ])
    expect(napLaiGiong).toBe(2)
    expect(dong.map((d) => [d.key, d.loai])).toEqual([['c2', 'them']])
  })

  it('nạp lại cùng chi tiết mà khác SL → một dòng sửa (không phải Bỏ + Thêm)', () => {
    const { dong } = gopNhatKy([
      ghi('a', 'delete', VIT, null, '2026-11-04T02:00:00Z'),
      ghi('a2', 'insert', null, { ...VIT, qty: 68 }, '2026-11-04T02:00:01Z', { changed_by: 'thuc' }), // prettier-ignore
    ])
    expect(dong).toHaveLength(1)
    expect(dong[0]).toMatchObject({ key: 'a>a2', loai: 'sua', truong: ['qty'], napLai: true, boi: 'thuc' }) // prettier-ignore
  })

  it('nạp lại khác chi tiết (đổi tên / mã) → Bỏ + Thêm, không ghép bừa', () => {
    const { dong } = gopNhatKy([
      ghi('a', 'delete', VIT, null, '2026-11-04T02:00:00Z'),
      ghi(
        'a2',
        'insert',
        null,
        { ...VIT, material_code: 'CN1528' },
        '2026-11-04T02:00:01Z',
      ),
    ])
    expect(dong.map((d) => d.loai).sort()).toEqual(['bo', 'them'])
  })

  it('không ghép chéo giữa hai SP', () => {
    const { dong, napLaiGiong } = gopNhatKy([
      ghi('a', 'delete', VIT, null, '2026-11-04T02:00:00Z'),
      ghi('b', 'insert', null, VIT, '2026-11-04T02:00:01Z', { product_id: 'sp2' }),
    ])
    expect(napLaiGiong).toBe(0)
    expect(dong).toHaveLength(2)
  })
})

describe('ảnh hưởng số mua', () => {
  const sua = (truoc: AnhDong | null, sau: AnhDong | null) =>
    gopNhatKy([
      ghi('p', truoc && sau ? 'update' : truoc ? 'delete' : 'insert', truoc, sau, '2026-11-04T02:00:00Z'), // prettier-ignore
    ]).dong[0]

  it('đổi SL/SP: chênh × SL sản phẩm trong lệnh', () => {
    expect(anhHuongMua(sua(VIT, { ...VIT, qty: 68 }), 400)).toEqual([
      { code: 'CN1527', unit: 'cái', perTruoc: 64, perSau: 68, slSp: 400, delta: 1600 },
    ])
  })

  it('đổi mã: mã mới cộng, mã cũ trừ', () => {
    const r = anhHuongMua(sua(VIT, { ...VIT, material_code: 'NK-0015' }), 10)
    expect(r.map((x) => [x.code, x.delta])).toEqual([
      ['NK-0015', 640],
      ['CN1527', -640],
    ])
  })

  it('thêm / bỏ dòng; chỉ đổi quy cách thì không có mục', () => {
    expect(anhHuongMua(sua(null, VIT), 2)[0].delta).toBe(128)
    expect(anhHuongMua(sua(VIT, null), 2)[0].delta).toBe(-128)
    expect(anhHuongMua(sua(VIT, { ...VIT, cut_length_mm: 847 }), 400)).toEqual([])
  })

  it('dòng không ghi SL → chưa rõ (null), không coi như 0', () => {
    const r = anhHuongMua(sua({ ...VIT, qty: null }, VIT), 400)
    expect(r).toEqual([expect.objectContaining({ delta: null })])
  })
})

describe('nút ▸: dòng định mức nào góp vào vật tư nào', () => {
  const d = gopNhatKy([
    ghi('p', 'update', VIT, { ...VIT, material_code: 'nk-0015' }, '2026-11-04T02:00:00Z'),
  ]).dong[0]

  it('vật tư có mã: khớp mã trước hoặc sau', () => {
    expect(gopVaoVatTu(d, { key: 'id-a', code: 'CN1527' })).toBe(true)
    expect(gopVaoVatTu(d, { key: 'id-b', code: 'NK-0015' })).toBe(true)
    expect(gopVaoVatTu(d, { key: 'id-c', code: 'NK-0016' })).toBe(false)
  })

  it('vật tư chưa mã: khớp đúng khoá gom của bảng kê', () => {
    const goi = anh({ part_name: 'Gối  220 x 470', qty: 1, group_code: 'cushion', dim_a_mm: 220, dim_b_mm: 470 }) // prettier-ignore
    const dg = gopNhatKy([ghi('g', 'update', goi, { ...goi, qty: 2 }, '2026-11-04T02:00:00Z')]).dong[0] // prettier-ignore
    const khoa = khoaChuaMa({ kind: 'CUSHION', part_name: 'Gối 220x470', dims: [220, 470, null], material_code: null }) // prettier-ignore
    expect(gopVaoVatTu(dg, { key: `~${khoa}`, code: null })).toBe(true)
    expect(gopVaoVatTu(dg, { key: '~CUSHION|gối|220×470|', code: null })).toBe(false)
  })
})

describe('đọc ảnh chụp jsonb', () => {
  it('số dạng chuỗi → số, chữ rỗng → null', () => {
    expect(docAnh({ qty: '64.5', material_code: ' ', part_name: 'Vít', dim_a_mm: null })).toMatchObject({ qty: 64.5, material_code: null, part_name: 'Vít', dim_a_mm: null }) // prettier-ignore
    expect(docAnh(null)).toBeNull()
  })
})

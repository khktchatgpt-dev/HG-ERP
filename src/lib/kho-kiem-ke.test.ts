import { describe, expect, it } from 'vitest'
import { danhSachDem, kiemCuoiTheoNhom, lyDoKhongTuDuyet, mocPhatSinh } from './kho-kiem-ke'

const nhom = new Map([
  ['a1', 'Nhôm'],
  ['a2', 'Nhôm'],
  ['a3', 'Nhôm'],
  ['b1', 'Bao bì'],
  ['b2', 'Bao bì'],
])

describe('danhSachDem — Q1: có tồn ∪ có phiếu gần đây', () => {
  it('gộp hai nguồn, không đếm trùng, co_ton chỉ đếm mã còn tồn', () => {
    const ds = danhSachDem(nhom, new Set(['a1', 'b1']), new Set(['a1', 'a2', 'b2']))
    const nh = ds.find((x) => x.group_name === 'Nhôm')!
    expect(nh.co_ton).toBe(1)
    expect(nh.ids.sort()).toEqual(['a1', 'a2'])
    expect(ds.find((x) => x.group_name === 'Bao bì')).toMatchObject({ co_ton: 1 })
  })

  it('mã không phát sinh, không tồn thì không vào (a3)', () => {
    const ds = danhSachDem(nhom, new Set(['a1']), new Set())
    expect(ds[0].ids).toEqual(['a1'])
  })

  it('mã ngừng dùng (không có trong nhomCua) bị bỏ', () => {
    expect(danhSachDem(nhom, new Set(['zz']), new Set(['zz']))).toEqual([])
  })

  it('giới hạn theo nhóm đã chọn', () => {
    const ds = danhSachDem(nhom, new Set(['a1', 'b1']), new Set(), ['Bao bì'])
    expect(ds.map((x) => x.group_name)).toEqual(['Bao bì'])
  })

  it('xếp nhóm nhiều mã có tồn lên trước', () => {
    const ds = danhSachDem(nhom, new Set(['b1', 'b2', 'a1']), new Set())
    expect(ds.map((x) => x.group_name)).toEqual(['Bao bì', 'Nhôm'])
  })
})

describe('kiemCuoiTheoNhom', () => {
  it('chỉ đợt theo nhóm đã duyệt, lấy mốc mới nhất', () => {
    const m = kiemCuoiTheoNhom([
      {
        scope_kind: 'group',
        scope_ref: { groups: ['Nhôm'] },
        approved_at: '2026-09-30T10:00:00Z',
      },
      { scope_kind: 'group', scope_ref: { groups: ['Nhôm', 'Bao bì'] }, approved_at: '2026-10-31T10:00:00Z' }, // prettier-ignore
      { scope_kind: 'group', scope_ref: { groups: ['Sơn'] }, approved_at: null },
      {
        scope_kind: 'bin',
        scope_ref: { bin_ids: ['x'] },
        approved_at: '2026-11-01T00:00:00Z',
      },
    ])
    expect(m.get('Nhôm')).toBe('2026-10-31T10:00:00Z')
    expect(m.get('Bao bì')).toBe('2026-10-31T10:00:00Z')
    expect(m.has('Sơn')).toBe(false)
  })
})

describe('mocPhatSinh', () => {
  it('lùi 180 ngày', () => {
    expect(mocPhatSinh(new Date('2026-10-19T00:00:00Z'))).toBe('2026-04-22T00:00:00.000Z')
  })
})

describe('lyDoKhongTuDuyet — Q2', () => {
  it('người được phân đếm bị chặn', () => {
    expect(lyDoKhongTuDuyet('nu', { assigned_to: 'nu' }, [])).toMatch(/phân đếm/)
  })
  it('ai đã ghi một số đếm cũng bị chặn', () => {
    expect(lyDoKhongTuDuyet('hao', { assigned_to: 'nu' }, ['nu', 'hao'])).toMatch(/ghi số đếm/)
  })
  it('người khác thì duyệt được', () => {
    expect(lyDoKhongTuDuyet('hao', { assigned_to: 'nu' }, ['nu', null])).toBeNull()
  })
})

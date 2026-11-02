import { describe, expect, it } from 'vitest'
import {
  chupMoc,
  dauThayDoi,
  demNhom,
  sapXepDoi,
  soThayDoi,
  soVoiAnhChup,
  soVoiMoc,
  viecCua,
  type DongDoi,
  type MocSoat,
  type NguonMoc,
} from './lenh-doi'

const nguon = (over: Partial<NguonMoc> = {}): NguonMoc => ({
  rows: [
    { material_id: 'm-nk0222', material_code: 'NK-0222', material_name: 'tán rút m6x15 xi đen', unit: 'Con', qty_needed: 14255, source: 'bom' }, // prettier-ignore
    { material_id: 'm-nk0213', material_code: 'NK-0213', material_name: 'gót chân 20x30x5 đen', unit: 'Cái', qty_needed: 4225, source: 'bom_draft' }, // prettier-ignore
    // Mã chỉ có trên đơn (ngoài định mức) — không phải nhu cầu.
    { material_id: 'm-ngoai', material_code: 'NK-0999', material_name: 'ngoài định mức', unit: 'Con', qty_needed: 0, source: 'none' }, // prettier-ignore
  ],
  chuaMa: [{ key: 'NGU_KIM|vit 4x15', name: 'Vít 4x15', unit: 'Con', qty_total: 1200 }],
  ship_date: '2026-12-24',
  materials_due_at: null,
  products: [
    { id: 'p1', code: 'BN0230HG-AL', qty: 12 },
    { id: 'p2', code: 'CH0289HG-AL', qty: 62 },
  ],
  ...over,
})

describe('chupMoc', () => {
  it('giữ số Cần đã quy đổi, bỏ mã ngoài định mức, khoá vật tư chưa mã bằng ~', () => {
    const m = chupMoc(nguon())
    expect(Object.keys(m.needs).sort()).toEqual([
      'm-nk0213',
      'm-nk0222',
      '~NGU_KIM|vit 4x15',
    ])
    expect(m.needs['m-nk0222']).toEqual({ qty: 14255, unit: 'Con', name: 'tán rút m6x15 xi đen', code: 'NK-0222' }) // prettier-ignore
    expect(m.products.p2).toEqual({ code: 'CH0289HG-AL', qty: 62 })
  })

  it('SP có ở hai dòng lệnh thì cộng SL', () => {
    const m = chupMoc(
      nguon({
        products: [
          { id: 'p1', code: 'BN0230HG-AL', qty: 12 },
          { id: 'p1', code: 'BN0230HG-AL', qty: 8 },
        ],
      }),
    )
    expect(m.products.p1.qty).toBe(20)
  })
})

describe('soVoiMoc', () => {
  const moc = chupMoc(nguon())

  it('không đổi gì thì rỗng', () => {
    expect(soVoiMoc(moc, chupMoc(nguon()))).toEqual({ so: [], thongTin: [] })
  })

  it('bắt mã mới, đổi SL, bỏ mã và dòng chưa mã', () => {
    const nay = chupMoc(
      nguon({
        rows: [
          { material_id: 'm-nk0222', material_code: 'NK-0222', material_name: 'tán rút', unit: 'Con', qty_needed: 15000, source: 'bom' }, // prettier-ignore
          { material_id: 'm-moi', material_code: 'BUL0102', material_name: 'Bulon 8x45x15 xt', unit: 'Con', qty_needed: 780, source: 'bom' }, // prettier-ignore
        ],
        chuaMa: [
          { key: 'NGU_KIM|vit 4x15', name: 'Vít 4x15', unit: 'Con', qty_total: 1500 },
        ],
      }),
    )
    const { so } = soVoiMoc(moc, nay)
    const by = new Map(so.map((s) => [s.key, s]))
    expect(by.get('m-nk0222')).toMatchObject({ loai: 'doi_sl', truoc: 14255, nay: 15000, material_id: 'm-nk0222' }) // prettier-ignore
    expect(by.get('m-moi')).toMatchObject({ loai: 'moi', truoc: 0, nay: 780 })
    expect(by.get('m-nk0213')).toMatchObject({ loai: 'bo', truoc: 4225, nay: 0 })
    expect(by.get('~NGU_KIM|vit 4x15')).toMatchObject({ loai: 'doi_sl', truoc: 1200, nay: 1500, material_id: null }) // prettier-ignore
  })

  it('sai số dấu phẩy động không phải thay đổi', () => {
    const nay = structuredClone(moc) as MocSoat
    nay.needs['m-nk0222'].qty = 14255.00000001
    expect(soVoiMoc(moc, nay).so).toEqual([])
  })

  it('dòng định mức không ghi số (null) vẫn so được', () => {
    const a = chupMoc(
      nguon({ chuaMa: [{ key: 'k', name: 'Nệm', unit: null, qty_total: null }] }),
    )
    const b = chupMoc(
      nguon({ chuaMa: [{ key: 'k', name: 'Nệm', unit: null, qty_total: 4 }] }),
    )
    expect(soVoiMoc(a, b).so).toMatchObject([{ key: '~k', truoc: null, nay: 4 }])
    expect(soVoiMoc(a, a).so).toEqual([])
  })

  it('ngày xuất, mốc vật tư và SL từng SP đổi thì vào phần thông tin', () => {
    const nay = chupMoc(
      nguon({
        ship_date: '2026-12-20',
        materials_due_at: '2026-11-20',
        products: [
          { id: 'p1', code: 'BN0230HG-AL', qty: 15 },
          { id: 'p3', code: 'TB0298HG-AL', qty: 40 },
        ],
      }),
    )
    const { thongTin } = soVoiMoc(moc, nay)
    expect(thongTin).toEqual([
      { k: 'ship_date', nhan: 'Ngày xuất', truoc: '2026-12-24', nay: '2026-12-20' },
      { k: 'materials_due_at', nhan: 'Mốc vật tư', truoc: null, nay: '2026-11-20' },
      { k: 'sp_sl', nhan: 'BN0230HG-AL', truoc: 12, nay: 15 },
      { k: 'sp_bo', nhan: 'CH0289HG-AL', truoc: 62, nay: null },
      { k: 'sp_them', nhan: 'TB0298HG-AL', truoc: null, nay: 40 },
    ])
  })
})

describe('soVoiAnhChup — chưa soát lần nào', () => {
  const ma = new Map([
    ['NK-0222', { material_id: 'm-nk0222', name: 'tán rút', unit: 'Con' }],
    ['NK-0213', { material_id: 'm-nk0213', name: 'gót chân', unit: 'Cái' }],
    ['NH-0127', { material_id: 'm-nhom', name: 'Nhôm hộp', unit: 'Cây' }],
    ['NK-0031', { material_id: 'm-bo', name: 'ngũ kim bỏ', unit: 'Cái' }],
  ])
  const nay = chupMoc(
    nguon({
      rows: [
        { material_id: 'm-nk0222', material_code: 'NK-0222', material_name: 'tán rút', unit: 'Con', qty_needed: 14255, source: 'bom' }, // prettier-ignore
        { material_id: 'm-nhom', material_code: 'NH-0127', material_name: 'Nhôm hộp', unit: 'Cây', qty_needed: 30, source: 'bom' }, // prettier-ignore
      ],
      chuaMa: [],
    }),
  )

  it('GIGA: lúc chụp không có mã nào → mọi mã nay đều mới, trước = 0', () => {
    const so = soVoiAnhChup({
      chup: new Map(),
      song: new Map([['NK-0222', 14255]]),
      nay,
      ma,
    })
    expect(so).toEqual([
      { key: 'm-nk0222', material_id: 'm-nk0222', code: 'NK-0222', name: 'tán rút', unit: 'Con', loai: 'moi', truoc: 0, nay: 14255 }, // prettier-ignore
    ])
  })

  it('đổi số gốc → số trước ước theo tỉ lệ (cùng phép quy đổi), có cờ uoc', () => {
    // Nhôm: định mức gốc 180 m lúc chụp, nay 216 m; bảng kê quy ra 30 cây.
    const so = soVoiAnhChup({
      chup: new Map([['nh-0127 ', 180]]),
      song: new Map([['NH-0127', 216]]),
      nay,
      ma,
    })
    expect(so).toMatchObject([
      { key: 'm-nhom', loai: 'doi_sl', truoc: 25, nay: 30, uoc: true },
    ])
  })

  it('bỏ khỏi định mức → trước là số gốc lúc chụp', () => {
    const so = soVoiAnhChup({
      chup: new Map([['NK-0031', 600]]),
      song: new Map(),
      nay,
      ma,
    })
    expect(so).toMatchObject([{ key: 'm-bo', loai: 'bo', truoc: 600, nay: 0, uoc: true }])
  })

  it('mã bỏ mà bảng kê không còn dòng nào → khoá theo mã', () => {
    const so2 = soVoiAnhChup({ chup: new Map([['XX-1', 5]]), song: new Map(), nay, ma })
    expect(so2).toMatchObject([
      { key: '#XX-1', material_id: null, name: 'XX-1', loai: 'bo' },
    ])
  })

  it('không đổi số gốc thì không có dòng; mã có định mức mà không lên bảng kê bị bỏ qua', () => {
    expect(soVoiAnhChup({ chup: new Map([['NK-0222', 14255]]), song: new Map([['NK-0222', 14255]]), nay, ma })).toEqual([]) // prettier-ignore
    // NK-0213 có trong định mức sống nhưng bảng kê chưa quy đổi được (Cần = 0).
    expect(soVoiAnhChup({ chup: new Map(), song: new Map([['NK-0213', 10]]), nay, ma })).toEqual([]) // prettier-ignore
  })
})

describe('viecCua — số GIGA 01 ngày 02/11', () => {
  const ma = { key: 'm', truoc: 0, nay: 0 }
  it('chưa có đơn → Đặt đúng số còn phải đặt', () => {
    expect(viecCua(ma, { can: 14255, conPhaiDat: 14255, daCoDon: 0 })).toEqual({ viec: { k: 'dat', qty: 14255 }, nhom: 'dat_them' }) // prettier-ignore
  })
  it('đơn đặt thiếu → Đặt phần thiếu (NK-0213: 4.225 − 3.830)', () => {
    expect(viecCua(ma, { can: 4225, conPhaiDat: 395, daCoDon: 3830 }).viec).toEqual({ k: 'dat', qty: 395 }) // prettier-ignore
  })
  it('dư trong hao hụt → Đủ (NK-0217: 15.060 / 13.865 = dư 8,6%)', () => {
    const v = viecCua(ma, { can: 13865, conPhaiDat: 0, daCoDon: 15060 })
    expect(v.nhom).toBe('du')
    expect(v.viec).toMatchObject({ k: 'du', tuTon: false })
    expect((v.viec as { pct: number }).pct).toBeCloseTo(0.0862, 3)
  })
  it('dư quá 10% → nhóm thừa', () => {
    expect(viecCua(ma, { can: 4200, conPhaiDat: 0, daCoDon: 4800 })).toMatchObject({ viec: { k: 'du_vuot', qty: 600 }, nhom: 'thua' }) // prettier-ignore
  })
  it('bỏ khỏi định mức mà đơn đã đặt → Thừa cả số trên đơn', () => {
    expect(viecCua(ma, { can: 0, conPhaiDat: 0, daCoDon: 600 })).toEqual({ viec: { k: 'thua', qty: 600 }, nhom: 'thua' }) // prettier-ignore
  })
  it('bỏ khỏi định mức, chưa đặt → không cần nữa', () => {
    expect(viecCua(ma, undefined)).toEqual({ viec: { k: 'khong_can' }, nhom: 'du' })
    expect(viecCua(ma, { can: 0, conPhaiDat: 0, daCoDon: 0 }).viec).toEqual({
      k: 'khong_can',
    })
  })
  it('đủ nhờ tồn kho', () => {
    expect(viecCua(ma, { can: 100, conPhaiDat: 0, daCoDon: 40 }).viec).toEqual({ k: 'du', pct: 0, tuTon: true }) // prettier-ignore
  })
  it('vật tư chưa có mã kho → chỉ nói tăng / giảm', () => {
    expect(viecCua({ key: '~k', truoc: 120, nay: 135 }, undefined)).toEqual({ viec: { k: 'chua_ma', tang: 15 }, nhom: 'chua_ma' }) // prettier-ignore
    expect(viecCua({ key: '~k', truoc: null, nay: 4 }, undefined).viec).toEqual({ k: 'chua_ma', tang: null }) // prettier-ignore
  })
})

const dong = (over: Partial<DongDoi>): DongDoi => ({
  key: 'k',
  material_id: 'k',
  code: 'A',
  name: 'A',
  unit: 'Con',
  loai: 'moi',
  truoc: 0,
  nay: 0,
  viec: { k: 'khong_can' },
  nhom: 'du',
  daCoDon: 0,
  pos: [],
  sps: [],
  suaLuc: null,
  suaBoi: null,
  ...over,
})

describe('sắp xếp, đếm, dấu', () => {
  const rows = [
    dong({ key: 'a', code: 'NK-0217', nay: 13865, viec: { k: 'du', pct: 0.086, tuTon: false }, nhom: 'du' }), // prettier-ignore
    dong({
      key: 'b',
      code: 'NK-0221',
      nay: 310,
      viec: { k: 'dat', qty: 310 },
      nhom: 'dat_them',
    }),
    dong({ key: 'c', code: 'NK-0222', nay: 14255, viec: { k: 'dat', qty: 14255 }, nhom: 'dat_them' }), // prettier-ignore
    dong({
      key: 'd',
      code: 'NK-0031',
      nay: 0,
      viec: { k: 'thua', qty: 600 },
      nhom: 'thua',
    }),
  ]

  it('việc phải đặt lên đầu, số lớn trước', () => {
    expect(sapXepDoi(rows).map((r) => r.key)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('đếm theo nhóm', () => {
    expect(demNhom(rows)).toEqual({ dat_them: 2, thua: 1, chua_ma: 0, du: 1 })
  })

  it('dấu đổi khi số đổi, không đổi theo thứ tự', () => {
    const t = { dong: rows, thongTin: [], suaSauMoc: null }
    const dau = dauThayDoi(t)
    expect(dauThayDoi({ ...t, dong: [...rows].reverse() })).toBe(dau)
    expect(dauThayDoi({ ...t, dong: [rows[0], { ...rows[1], nay: 311 }] })).not.toBe(dau)
    expect(soThayDoi(t)).toBe(4)
  })
})

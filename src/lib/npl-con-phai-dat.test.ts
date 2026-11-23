import { describe, expect, it } from 'vitest'
import {
  buildConPhaiDat,
  conPhaiDat,
  lenhKhongSo,
  tinhCan,
  type CanMat,
  type CanPart,
} from './npl-con-phai-dat'
import type { NplLenh, NplRow } from './npl-theo-lenh'

const L1: NplLenh = { id: 'l1', code: '01/26-27 - GIGA', ship_date: '2026-12-24' }
const L2: NplLenh = { id: 'l2', code: '13/26-27 - MX', ship_date: '2027-01-10' }
const lenhById = new Map([L1, L2].map((l) => [l.id, l]))

const mat = (id: string, code: string, name: string, unit = 'Con'): CanMat => ({
  id,
  code,
  name,
  unit,
  group_name: 'Bu lông - vít - đinh - liên kết',
  default_bar_length_m: null,
})
const part = (p: Partial<CanPart> & { product_id: string }): CanPart => ({
  material_code: null,
  part_name: null,
  group_code: 'NGU_KIM',
  qty: 1,
  unit: 'Con',
  ...p,
})
const row = (
  p: Partial<NplRow> & { lsx_id: string; material_id: string | null },
): NplRow => ({
  key: `${p.lsx_id}|${p.po_id ?? 'po1'}|${p.material_id}`,
  lsx_code: lenhById.get(p.lsx_id)?.code ?? '',
  po_id: 'po1',
  po_code: 'PO-2026-0001',
  status: 'received',
  tab: 'du',
  ma: 'X',
  ten: 'X',
  dvt: 'Con',
  nhom: null,
  supplier: 'NCC',
  assignee: null,
  assignee_id: null,
  hen: null,
  tre: null,
  dat: 0,
  ve: 0,
  thieu: 0,
  chia: null,
  gop: null,
  ...p,
})

describe('tinhCan', () => {
  const mats = [mat('m1', 'NK-0207', 'Bulon 6x20x13, xi đen'), mat('m2', 'NK-0213', 'gót chân 20x30x5 đen', 'Cái')] // prettier-ignore

  it('cần = định mức/SP × SL SP của lệnh, cộng mọi chi tiết và mọi dòng lệnh', () => {
    const kq = tinhCan({
      dongLenh: [
        { lsx_id: 'l1', product_id: 'p1', qty: 100 },
        { lsx_id: 'l1', product_id: 'p1', qty: 50 }, // SP ở hai dòng lệnh
        { lsx_id: 'l1', product_id: 'p2', qty: 10 },
      ],
      sps: [
        { id: 'p1', code: 'CH0289HG-AL' },
        { id: 'p2', code: 'BN0231HG-AL' },
      ],
      parts: [
        part({
          product_id: 'p1',
          material_code: 'NK-0207',
          part_name: 'Tay vịn',
          qty: 4,
        }),
        part({ product_id: 'p1', material_code: 'nk-0207 ', part_name: 'Chân', qty: 2 }),
        part({
          product_id: 'p2',
          material_code: 'NK-0207',
          part_name: 'Tay vịn',
          qty: 8,
        }),
      ],
      mats,
    })
    expect(kq.cans).toHaveLength(1)
    const c = kq.cans[0]
    expect(c.can).toBe(6 * 150 + 8 * 10)
    expect(c.sp.find((s) => s.sp_code === 'CH0289HG-AL')).toMatchObject({ per: 6, sl: 150, can: 900, vi_tri: ['Tay vịn', 'Chân'] }) // prettier-ignore
  })

  it('bỏ khung / gỗ — không đặt theo định mức', () => {
    const kq = tinhCan({
      dongLenh: [{ lsx_id: 'l1', product_id: 'p1', qty: 10 }],
      sps: [{ id: 'p1', code: 'SP1' }],
      parts: [
        part({ product_id: 'p1', material_code: 'NK-0207', group_code: 'FRAME' }),
        part({ product_id: 'p1', material_code: 'NK-0207', group_code: 'WOOD' }),
      ],
      mats,
    })
    expect(kq.cans).toEqual([])
  })

  it('đếm tên chưa gắn mã theo lệnh × tên, mã không có trong danh mục cũng là chưa mã', () => {
    const kq = tinhCan({
      dongLenh: [
        { lsx_id: 'l1', product_id: 'p1', qty: 10 },
        { lsx_id: 'l1', product_id: 'p2', qty: 10 },
        { lsx_id: 'l2', product_id: 'p2', qty: 5 },
      ],
      sps: [],
      parts: [
        part({ product_id: 'p1', part_name: 'Thùng âm dương', group_code: 'PACKAGING' }),
        part({ product_id: 'p2', part_name: 'thùng  âm dương', group_code: 'PACKAGING' }),
        part({ product_id: 'p1', material_code: 'KHONG-CO', part_name: 'Vít 4x30' }),
      ],
      mats,
    })
    // "Thùng âm dương" ở l1 (hai SP, một tên) + ở l2 = 2; "Vít 4x30" ở l1 = 1.
    expect(kq.chuaMa).toEqual({ PACKAGING: 2, NGU_KIM: 1 })
  })

  it('dòng không quy đổi được đơn vị: đếm riêng, không vào số cần', () => {
    const kq = tinhCan({
      dongLenh: [{ lsx_id: 'l1', product_id: 'p1', qty: 10 }],
      sps: [],
      parts: [
        part({ product_id: 'p1', material_code: 'NK-0207', unit: 'kg', qty: null }),
      ],
      mats,
    })
    expect(kq.cans).toEqual([])
    expect(kq.chanQuyDoi).toBe(1)
  })
})

describe('buildConPhaiDat', () => {
  const can = (
    material_id: string,
    ma: string,
    ten: string,
    n: number,
    lsx_id = 'l1',
  ) => ({
    lsx_id,
    material_id,
    ma,
    ten,
    dvt: 'Cái',
    nhom: null,
    can: n,
    sp: [],
  })

  it('đặt thiếu / đủ / chưa có đơn theo đơn của CHÍNH lệnh (gồm nháp)', () => {
    const out = buildConPhaiDat(
      [
        can('m1', 'NK-0213', 'gót chân 20x30x5 đen', 4225),
        can('m2', 'NK-0207', 'Bulon 6x20x13', 13100),
        can('m3', 'NK-0222', 'tán rút m6x15', 14255),
      ],
      [
        row({ lsx_id: 'l1', material_id: 'm1', dat: 3830 }),
        row({ lsx_id: 'l1', material_id: 'm2', dat: 10000, status: 'draft' }),
        row({ lsx_id: 'l1', material_id: 'm2', dat: 3780, po_id: 'po2' }),
        row({ lsx_id: 'l2', material_id: 'm3', dat: 99999 }), // đơn lệnh khác — không tính
      ],
      lenhById,
    )
    const by = Object.fromEntries(out.map((c) => [c.ma, c]))
    expect(by['NK-0213']).toMatchObject({ tt: 'dat_thieu', dat: 3830, con: 395 })
    expect(by['NK-0207']).toMatchObject({ tt: 'du', dat: 13780, con: 0 })
    expect(by['NK-0207'].don).toHaveLength(2)
    expect(by['NK-0222']).toMatchObject({ tt: 'chua_co_don', dat: 0, con: 14255 })
  })

  it('mã khác tên gần giống trên đơn của lệnh: "gần tên", không tự trừ', () => {
    const out = buildConPhaiDat(
      [can('m1', 'NK-0221', 'cờ lê 2 đầu m10-13 xi đen', 310)],
      [
        row({
          lsx_id: 'l1',
          material_id: 'x9',
          ma: 'DCC0028',
          ten: 'Cờ lê 2 đầu 10-13',
          dat: 325,
        }),
      ],
      lenhById,
    )
    expect(out[0]).toMatchObject({ tt: 'gan_ten', dat: 0, con: 310 })
    expect(out[0].gan[0].ma).toBe('DCC0028')
  })

  it('dòng đơn mà định mức của lệnh cũng cần riêng thì không phải "gần tên"', () => {
    const out = buildConPhaiDat(
      [
        can('m1', 'NK-0119', 'LĐN 6x16x10 đen', 400),
        can('m2', 'NK-0120', 'LĐN 6x16x10 trắng', 400),
      ],
      [row({ lsx_id: 'l1', material_id: 'm2', ten: 'LĐN 6x16x10 trắng', dat: 400 })],
      lenhById,
    )
    expect(out.find((c) => c.ma === 'NK-0119')).toMatchObject({ tt: 'chua_co_don' })
  })

  it('conPhaiDat bỏ dòng đủ, đặt thiếu và gần tên lên trước', () => {
    const out = buildConPhaiDat(
      [
        can('a', 'A', 'Vít 4x15', 100),
        can('b', 'B', 'gót chân 20x30x5', 50),
        can('c', 'C', 'Bulon 6x20x13', 10),
      ],
      [
        row({ lsx_id: 'l1', material_id: 'b', dat: 40 }),
        row({ lsx_id: 'l1', material_id: 'c', dat: 10 }),
      ],
      lenhById,
    )
    expect(conPhaiDat(out).map((c) => c.ma)).toEqual(['B', 'A'])
  })
})

describe('lenhKhongSo', () => {
  it('nói vì sao không so được, xếp lệnh xuất trước lên đầu', () => {
    const out = lenhKhongSo(
      [L2, L1, { id: 'l3', code: '11/26-27 - MX', ship_date: null }],
      [],
      new Map([
        ['l1', { sp: 8, coDinhMuc: 0 }],
        ['l2', { sp: 22, coDinhMuc: 6 }],
      ]),
    )
    expect(out.map((x) => [x.code, x.ly_do])).toEqual([
      ['01/26-27 - GIGA', 'Chưa có định mức (0/8 SP)'],
      ['13/26-27 - MX', 'Định mức chưa gắn mã ngũ kim, bao bì (6/22 SP có định mức)'],
      ['11/26-27 - MX', 'Lệnh chưa có sản phẩm'],
    ])
  })
})

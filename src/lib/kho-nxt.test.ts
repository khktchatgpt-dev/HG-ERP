import { describe, expect, it } from 'vitest'
import {
  chieuDong,
  docKy,
  doiChieuSo,
  dungNxt,
  giaVnd,
  kyThang,
  type DongSo,
} from './kho-nxt'

let seq = 0
const d = (o: Partial<DongSo>): DongSo => ({
  id: `m${++seq}`,
  material_id: 'A',
  direction: 'in',
  qty: 0,
  unit_cost: null,
  currency: null,
  fx_rate: null,
  reason_code: null,
  ref_type: null,
  po_line_id: null,
  production_order_id: null,
  ngay: '2026-10-05',
  doc_id: null,
  doc_code: null,
  doc_kind: null,
  la_dao: false,
  dien_giai: null,
  ...o,
})

const mua = (
  qty: number,
  gia: number | null,
  ngay = '2026-10-05',
  o: Partial<DongSo> = {},
) => d({ qty, unit_cost: gia, reason_code: 'N1', ngay, doc_kind: 'receipt', ...o })
const cap = (qty: number, ngay = '2026-10-10', o: Partial<DongSo> = {}) =>
  d({ qty, direction: 'out', reason_code: 'X1', ngay, doc_kind: 'issue', ...o })

describe('chieuDong — cột và dấu', () => {
  it('mã trên dòng quyết định cột', () => {
    expect(chieuDong(mua(10, 5))).toMatchObject({ cot: 'mua', sl: 10, suy: false })
    expect(chieuDong(cap(4))).toMatchObject({ cot: 'choLenh', sl: 4 })
    expect(chieuDong(d({ qty: 3, direction: 'out', reason_code: 'X4' }))).toMatchObject({ cot: 'xuatKhac', sl: 3 }) // prettier-ignore
  })

  it('Q3: dòng đảo cùng mã ngược chiều → số ÂM ở cột gốc', () => {
    expect(chieuDong(d({ qty: 380, direction: 'out', reason_code: 'N1', la_dao: true }))).toMatchObject({ cot: 'mua', sl: -380 }) // prettier-ignore
    expect(chieuDong(d({ qty: 100, direction: 'in', reason_code: 'X1', la_dao: true }))).toMatchObject({ cot: 'choLenh', sl: -100 }) // prettier-ignore
  })

  it('dòng đảo KHÔNG mã: suy theo CHIỀU dòng (phiếu đảo mang loại ngược phiếu gốc)', () => {
    // PXK-2026-0012 (phiếu XUẤT) đảo PNK-2026-0038 nạp nền 11/09 — dòng 'out', po_line.
    const daoNhap = d({ qty: 380, direction: 'out', la_dao: true, doc_kind: 'issue', po_line_id: 'pl', ref_type: 'adjust' }) // prettier-ignore
    expect(chieuDong(daoNhap)).toMatchObject({
      cot: 'mua',
      sl: -380,
      ma: 'N1',
      suy: true,
    })
    const daoXuat = d({ qty: 7, direction: 'in', la_dao: true, doc_kind: 'receipt', production_order_id: 'l', ref_type: 'adjust' }) // prettier-ignore
    expect(chieuDong(daoXuat)).toMatchObject({ cot: 'choLenh', sl: -7, ma: 'X1' })
  })

  it('kiểm kê không mã → N4 / X5', () => {
    expect(chieuDong(d({ qty: 2, doc_kind: 'stocktake', ref_type: 'adjust' }))).toMatchObject({ cot: 'kkThua', sl: 2 }) // prettier-ignore
    expect(chieuDong(d({ qty: 2, direction: 'out', doc_kind: 'stocktake', ref_type: 'adjust' }))).toMatchObject({ cot: 'kkThieu', sl: 2 }) // prettier-ignore
  })

  it('không suy được → Nhập khác / Khác, không bịa mã', () => {
    expect(chieuDong(d({ qty: 1, ref_type: 'daily' }))).toMatchObject({
      cot: 'nhapKhac',
      ma: null,
    })
    expect(chieuDong(d({ qty: 1, direction: 'out', ref_type: 'adjust' }))).toMatchObject({ cot: 'xuatKhac', ma: null }) // prettier-ignore
  })

  it('chuyển kệ không đổi tồn theo mã', () => {
    expect(chieuDong(d({ qty: 9, reason_code: 'C1' }))).toMatchObject({
      cot: null,
      sl: 0,
    })
  })
})

describe('giaVnd', () => {
  it('USD quy theo tỷ giá đơn; thiếu tỷ giá → null', () => {
    expect(giaVnd(d({ unit_cost: 2, currency: 'USD', fx_rate: 25000 }))).toBe(50000)
    expect(giaVnd(d({ unit_cost: 2, currency: 'USD' }))).toBeNull()
    expect(giaVnd(d({ unit_cost: 9, currency: 'VND' }))).toBe(9)
  })
})

describe('dungNxt — số lượng', () => {
  it('tồn đầu từ trước kỳ, cột trong kỳ, dòng sau kỳ bỏ', () => {
    const [r] = dungNxt(
      [
        mua(100, 10, '2026-09-20'),
        cap(30, '2026-09-25'),
        mua(50, 10),
        cap(20),
        mua(9, 10, '2026-11-01'),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.ton_dau).toBe(70)
    expect(r.nhap.mua).toBe(50)
    expect(r.xuat.choLenh).toBe(20)
    expect(r.ton_cuoi).toBe(100)
  })

  it('BAO0689 thật: nhập 760, đảo 380, cấp 760, đảo 380, kiểm kê ±380 → tồn 0', () => {
    const [r] = dungNxt(
      [
        mua(760, 41500),
        cap(760),
        d({
          qty: 380,
          direction: 'out',
          reason_code: 'N1',
          la_dao: true,
          unit_cost: 41500,
        }),
        d({ qty: 380, direction: 'in', reason_code: 'X1', la_dao: true }),
        d({ qty: 380, doc_kind: 'stocktake', ref_type: 'adjust', ngay: '2026-10-15' }),
        d({
          qty: 380,
          direction: 'out',
          doc_kind: 'stocktake',
          ref_type: 'adjust',
          ngay: '2026-10-15',
        }),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.nhap).toMatchObject({ mua: 380, kkThua: 380 })
    expect(r.xuat).toMatchObject({ choLenh: 380, kkThieu: 380 })
    expect(r.ton_cuoi).toBe(0)
    expect(r.don_gia).toBe(41500)
    expect(r.gt_cuoi).toBeCloseTo(0)
  })
})

describe('dungNxt — Q1 bình quân gia quyền cả kỳ', () => {
  it('một đơn giá cho cả kỳ, xuất trước lần nhập sau vẫn theo bình quân kỳ', () => {
    const [r] = dungNxt([mua(100, 10, '2026-10-02'), cap(50, '2026-10-03'), mua(100, 20, '2026-10-20')], '2026-10-01', '2026-10-31') // prettier-ignore
    expect(r.don_gia).toBe(15)
    expect(r.gt_xuat).toBe(750)
    expect(r.gt_cuoi).toBe(150 * 15)
  })

  it('tồn đầu có giá trị nối từ tháng trước, vào mẫu số kỳ này', () => {
    // 09: nhập 100 × 10, xuất 40 → tồn 60, giá trị 600. 10: nhập 40 × 20.
    const [r] = dungNxt([mua(100, 10, '2026-09-02'), cap(40, '2026-09-10'), mua(40, 20)], '2026-10-01', '2026-10-31') // prettier-ignore
    expect(r.gt_dau).toBe(600)
    expect(r.don_gia).toBeCloseTo((600 + 800) / 100)
  })

  it('đẳng thức kế toán ở cột tiền: đầu + nhập − xuất = cuối', () => {
    const [r] = dungNxt(
      [
        mua(100, 10, '2026-08-02'),
        cap(30, '2026-09-10'),
        mua(10, 50, '2026-09-11'),
        mua(20, null),
        d({ qty: 5, reason_code: 'N3', production_order_id: 'l' }),
        cap(60),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect((r.gt_dau ?? 0) + (r.gt_nhap ?? 0) - (r.gt_xuat ?? 0)).toBeCloseTo(
      r.gt_cuoi ?? NaN,
    )
  })

  it('nhập không giá KHÔNG kéo bình quân xuống, và được đếm thiếu giá', () => {
    const [r] = dungNxt([mua(100, 10), mua(100, null)], '2026-10-01', '2026-10-31')
    expect(r.don_gia).toBe(10)
    expect(r.gt_cuoi).toBe(2000)
    expect([r.thieu_gia, r.lan_mua]).toEqual([1, 2])
  })

  it('chưa lần nào có giá → null, không phải 0', () => {
    const [r] = dungNxt([mua(180, null)], '2026-10-01', '2026-10-31')
    expect(r.don_gia).toBeNull()
    expect(r.gt_cuoi).toBeNull()
  })

  it('tồn cuối âm → không định giá', () => {
    const [r] = dungNxt([mua(5, 10, '2026-09-01'), cap(12)], '2026-10-01', '2026-10-31')
    expect(r.ton_cuoi).toBe(-7)
    expect(r.gt_cuoi).toBeNull()
  })

  it('kỳ không có giá mới dùng lại bình quân kỳ trước', () => {
    const [r] = dungNxt([mua(10, 30, '2026-09-01'), cap(10, '2026-09-02'), d({ qty: 4, reason_code: 'N3', production_order_id: 'l' })], '2026-10-01', '2026-10-31') // prettier-ignore
    expect(r.don_gia).toBe(30)
    expect(r.gt_cuoi).toBe(120)
  })

  it('NK-0093 thật: đảo phiếu nạp nền kỳ trước làm SL ròng âm → bình quân theo lần nhập dương, không dùng kỳ trước', () => {
    const [r] = dungNxt(
      [
        mua(2142.4, 160, '2026-09-11'),
        d({
          qty: 2142.4,
          direction: 'out',
          doc_kind: 'stocktake',
          ref_type: 'adjust',
          ngay: '2026-09-15',
        }),
        d({ qty: 2142.4, doc_kind: 'stocktake', ref_type: 'adjust', ngay: '2026-10-01' }),
        d({
          qty: 2142.4,
          direction: 'out',
          la_dao: true,
          doc_kind: 'issue',
          po_line_id: 'pl',
          ref_type: 'adjust',
          unit_cost: 160,
          ngay: '2026-10-01',
        }),
        mua(2142, 160, '2026-10-02'),
        cap(2142, '2026-10-02'),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.bq).toMatchObject({ kieu: 'duong', mau: 2142 })
    expect(r.don_gia).toBe(160)
    expect(r.ton_cuoi).toBe(0)
    expect(r.gt_cuoi).toBeCloseTo(0)
  })

  it('ròng dương nhưng tiền âm cũng không dùng bậc ròng (tránh đơn giá âm)', () => {
    const [r] = dungNxt(
      [
        mua(10, 100),
        d({
          qty: 9.6,
          direction: 'out',
          reason_code: 'N1',
          la_dao: true,
          unit_cost: 200,
        }),
      ],
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.bq?.kieu).toBe('duong')
    expect(r.don_gia).toBe(100)
  })

  it('dòng USD thiếu tỷ giá: không vào bình quân, đếm riêng', () => {
    const [r] = dungNxt([mua(10, 2, undefined, { currency: 'USD' }), mua(10, 100)], '2026-10-01', '2026-10-31') // prettier-ignore
    expect(r.don_gia).toBe(100)
    expect(r.thieu_ty_gia).toBe(1)
  })
})

describe('doiChieuSo', () => {
  it('khớp khi mọi dòng rơi vào một cột', () => {
    const dong = [
      mua(10, 1, '2026-09-01'),
      mua(5, 1),
      cap(3),
      d({ qty: 2, reason_code: 'C1' }),
    ]
    const rows = dungNxt(dong, '2026-10-01', '2026-10-31')
    expect(doiChieuSo(rows, dong, '2026-10-01', '2026-10-31')).toMatchObject({
      khop: true,
      so: 2,
    })
  })
})

describe('kỳ', () => {
  it('kyThang ra đủ ngày cuối tháng', () => {
    expect(kyThang('2026-02-10')).toEqual({ tu: '2026-02-01', den: '2026-02-28' })
    expect(kyThang('2026-10-19')).toEqual({ tu: '2026-10-01', den: '2026-10-31' })
  })
  it('docKy: ngày không có thật → mặc định', () => {
    expect(docKy('2026-13-45', '2026-02-30', '2026-10-19')).toEqual({
      tu: '2026-10-01',
      den: '2026-10-31',
    })
  })
  it('docKy: sai → tháng hiện tại; ngược → đảo', () => {
    expect(docKy('x', undefined, '2026-10-19')).toEqual({
      tu: '2026-10-01',
      den: '2026-10-31',
    })
    expect(docKy('2026-10-20', '2026-10-01', '2026-10-19')).toEqual({ tu: '2026-10-01', den: '2026-10-20' }) // prettier-ignore
  })
})

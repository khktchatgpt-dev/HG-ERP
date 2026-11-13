import { describe, expect, it } from 'vitest'
import type { DongSo } from './kho-nxt'
import { dsThangKiem, kiemKy, thangDaQua, type DotKiemKeMo } from './kho-kiem-ky'

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
const mua = (qty: number, gia: number | null, o: Partial<DongSo> = {}) =>
  d({ qty, unit_cost: gia, reason_code: 'N1', doc_kind: 'receipt', ...o })
const cap = (qty: number, o: Partial<DongSo> = {}) =>
  d({
    qty,
    direction: 'out',
    reason_code: 'X1',
    doc_kind: 'issue',
    ngay: '2026-10-10',
    ...o,
  })

const KHONG_LENH = new Map<string, string[]>()
const kiem = (
  dong: DongSo[],
  o: {
    thangDau?: string
    thang?: string
    lenh?: Map<string, string[]>
    dot?: DotKiemKeMo[]
  } = {},
) =>
  kiemKy({
    dong,
    thangDau: o.thangDau ?? '2026-10',
    thang: o.thang ?? '2026-10',
    lenhCuaDong: o.lenh ?? KHONG_LENH,
    dotKiemKe: o.dot ?? [],
  })

describe('dsThangKiem / thangDaQua', () => {
  it('liệt kê tháng gồm hai đầu, qua năm mới', () => {
    expect(dsThangKiem('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
    expect(dsThangKiem('2026-10', '2026-10')).toEqual(['2026-10'])
  })

  it('chỉ nhận đúng một tháng trọn đã qua hết', () => {
    expect(thangDaQua({ tu: '2026-10-01', den: '2026-10-31' }, '2026-11-13')).toBe(
      '2026-10',
    )
    expect(thangDaQua({ tu: '2026-11-01', den: '2026-11-30' }, '2026-11-13')).toBeNull() // còn chạy
    expect(thangDaQua({ tu: '2026-10-01', den: '2026-10-30' }, '2026-11-13')).toBeNull() // không trọn
    expect(thangDaQua({ tu: '2026-10-05', den: '2026-10-31' }, '2026-11-13')).toBeNull()
    expect(thangDaQua({ tu: '2026-11-01', den: '2026-11-30' }, '2026-12-01')).toBe(
      '2026-11',
    )
  })
})

describe('kiemKy — chặn', () => {
  it('tồn âm cuối tháng là chặn; đủ hàng thì không', () => {
    const am = kiem([mua(5, 100), cap(8)])
    expect(am.thangs[0].tonAm).toEqual(['A'])
    expect(am.soChan).toBe(1)
    expect(kiem([mua(10, 100), cap(8)]).soChan).toBe(0)
  })

  it('đợt kiểm kê chưa xong chỉ chặn khi mốc chốt sổ nằm trong kỳ', () => {
    const dot: DotKiemKeMo[] = [
      { id: '1', code: 'KK-2026-0009', status: 'counting', freeze_ngay: '2026-10-28' },
      { id: '2', code: 'KK-2026-0010', status: 'counting', freeze_ngay: '2026-11-02' },
      { id: '3', code: 'KK-2026-0011', status: 'open', freeze_ngay: null },
    ]
    const k = kiem([mua(1, 1)], { dot })
    expect(k.dotMo.map((t) => t.code)).toEqual(['KK-2026-0009'])
    expect(k.soChan).toBe(1)
  })
})

describe('kiemKy — lưu ý', () => {
  it('lệnh nhận hàng trong tháng mà không có dòng xuất nào cho lệnh', () => {
    const lenh = new Map([
      ['pl1', ['L1']],
      ['pl2', ['L2']],
      ['pl3', ['L3', 'L4']], // dòng đơn chia cho hai lệnh (0185)
    ])
    const k = kiem(
      [
        mua(10, 5, { po_line_id: 'pl1' }),
        mua(10, 5, { po_line_id: 'pl2', material_id: 'B' }),
        mua(10, 5, { po_line_id: 'pl3', material_id: 'C' }),
        cap(4, { production_order_id: 'L2', material_id: 'B' }),
        cap(1, { production_order_id: 'L4', material_id: 'C' }),
      ],
      { lenh },
    )
    expect(k.thangs[0].lenhNhan).toEqual(['L1', 'L2', 'L3', 'L4'])
    expect(k.thangs[0].lenhChuaXuat).toEqual(['L1', 'L3'])
    expect(k.tong.lenhChuaXuat).toBe(2)
  })

  it('phiếu đảo không tính là nhận hàng, cũng không tính là xuất cho lệnh', () => {
    const lenh = new Map([['pl1', ['L1']]])
    const k = kiem(
      [
        mua(10, 5, { po_line_id: 'pl1' }),
        // Đảo một phiếu xuất của L1: không làm L1 thành "đã xuất".
        d({
          qty: 2,
          direction: 'out',
          reason_code: 'X1',
          production_order_id: 'L1',
          la_dao: true,
        }),
        // Đảo phiếu nhập của dòng đơn khác: không thêm lệnh nhận hàng.
        d({
          qty: 3,
          direction: 'out',
          reason_code: 'N1',
          po_line_id: 'pl9',
          la_dao: true,
        }),
      ],
      { lenh: new Map([...lenh, ['pl9', ['L9']]]) },
    )
    expect(k.thangs[0].lenhNhan).toEqual(['L1'])
    expect(k.thangs[0].lenhChuaXuat).toEqual(['L1'])
  })

  it('mã phát sinh mà chưa lần nhập nào có giá', () => {
    const k = kiem([mua(10, null), mua(5, 200, { material_id: 'B' })])
    expect(k.thangs[0].maThieuGia).toEqual(['A'])
  })

  it('đếm KHÔNG trùng qua các tháng', () => {
    const k = kiem(
      [mua(10, null, { ngay: '2026-09-20' }), mua(4, null, { ngay: '2026-10-03' })],
      { thangDau: '2026-09' },
    )
    expect(k.thangs.map((t) => t.maThieuGia)).toEqual([['A'], ['A']])
    expect(k.tong.maThieuGia).toBe(1)
  })
})

describe('kiemKy — tóm tắt bản chốt', () => {
  it('Q6: chốt tháng M kiểm mọi tháng còn mở từ tháng đầu của sổ', () => {
    const k = kiem([mua(10, 100, { ngay: '2026-09-11' })], { thangDau: '2026-09' })
    expect(k.den).toBe('2026-10-31')
    expect(k.thangs.map((t) => t.thang)).toEqual(['2026-09', '2026-10'])
  })

  it('dòng xuất nhận giá theo cột; phiếu đảo không đếm; KK thừa không giá đếm riêng', () => {
    const k = kiem([
      mua(100, 50),
      cap(10),
      cap(5),
      d({
        qty: 3,
        direction: 'out',
        doc_kind: 'stocktake',
        ref_type: 'adjust',
        ngay: '2026-10-20',
      }),
      d({
        qty: 2,
        direction: 'in',
        doc_kind: 'stocktake',
        ref_type: 'adjust',
        ngay: '2026-10-21',
      }),
      d({ qty: 5, direction: 'in', reason_code: 'X1', la_dao: true, ngay: '2026-10-22' }),
    ])
    const t = k.thangs[0]
    expect(t.dongXuat).toBe(3)
    expect(t.dongXuatTheoCot).toEqual({ choLenh: 2, kkThieu: 1, xuatKhac: 0 })
    expect(t.dongKkThua).toBe(1)
  })

  it('giá trị xuất và tồn cuối lấy từ dungNxt (bình quân cả tháng), tồn cuối gồm mã không phát sinh', () => {
    const k = kiem(
      [
        mua(10, 100, { ngay: '2026-09-10' }),
        mua(10, 300, { material_id: 'B', ngay: '2026-09-10' }),
        mua(10, 200, { material_id: 'B', ngay: '2026-10-02' }),
        cap(4, { material_id: 'B' }),
      ],
      { thangDau: '2026-09' },
    )
    const [t9, t10] = k.thangs
    expect(t9.gtTonCuoi).toBe(1000 + 3000)
    // B: (3000 + 2000) / 20 = 250 → xuất 4 × 250; A không phát sinh tháng 10 vẫn vào tồn cuối.
    expect(t10.gtXuat).toBe(1000)
    expect(t10.gtTonCuoi).toBe(1000 + 16 * 250)
  })
})

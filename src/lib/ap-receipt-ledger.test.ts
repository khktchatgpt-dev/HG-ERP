import { describe, expect, it } from 'vitest'
import { buildLedger, ledgerDetail } from './ap-ledger'
import {
  itemLabel,
  looksLikeHgCode,
  prepayLabel,
  receiptEntries,
  splitVat,
  termsOf,
  unpricedBy,
  type ReceiptMove,
} from './ap-receipt-ledger'

const mv = (o: Partial<ReceiptMove> = {}): ReceiptMove => ({
  qty: 10,
  unit_cost: 1000,
  direction: 'in',
  doc_id: 'd1',
  doc_code: 'PNK-2026-0001',
  doc_date: '2026-10-09',
  supplier_doc_no: null,
  is_reversal: false,
  po_id: 'p1',
  po_code: 'PO-2026-0001',
  currency: 'VND',
  supplier_id: 's1',
  supplier_name: 'Hiệp Hưng',
  vat_rate: 8,
  price_includes_vat: false,
  terms_payment: 'Công nợ cuối tháng',
  supplier_net_days: null,
  ...o,
})

describe('splitVat', () => {
  it('giá chưa VAT → cộng VAT theo thuế suất đơn', () => {
    // Số thật PNK-2026-0114 (Hiệp Hưng, PO-2026-0089, 8 %).
    expect(splitVat(52_687_680, 8, false)).toEqual({ net: 52_687_680, vat: 4_215_014.4, gross: 56_902_694.4 }) // prettier-ignore
  })
  it('giá đã gồm VAT → giữ tổng, tách ngược VAT', () => {
    const r = splitVat(110_000, 10, true)
    expect(r.gross).toBe(110_000)
    expect(r.net).toBe(100_000)
    expect(r.vat).toBe(10_000)
  })
  it('thuế suất trống / 0 → không VAT', () => {
    expect(splitVat(5000, null, false)).toEqual({ net: 5000, vat: 0, gross: 5000 })
  })
})

describe('receiptEntries', () => {
  it('gộp các dòng cùng phiếu × đơn thành MỘT bút toán, gồm VAT', () => {
    const e = receiptEntries([mv(), mv({ qty: 5, unit_cost: 2000 })], null)
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ kind: 'invoice', amount: 21_600, net: 20_000, vat: 1600, label: 'Phiếu nhập' }) // prettier-ignore
  })

  it('một phiếu gom hai đơn → hai bút toán, mỗi bút toán mang mã đơn của nó', () => {
    const e = receiptEntries([mv(), mv({ po_id: 'p2', po_code: 'PO-2026-0002' })], null)
    expect(e.map((x) => x.po_code).sort()).toEqual(['PO-2026-0001', 'PO-2026-0002'])
  })

  it('dòng chưa có giá KHÔNG thành 0 đồng — bị bỏ ra, đếm riêng', () => {
    const moves = [mv({ unit_cost: null }), mv({ doc_id: 'd2', unit_cost: null, doc_date: '2026-11-02' })] // prettier-ignore
    expect(receiptEntries(moves, null)).toEqual([])
    expect(unpricedBy(moves, '2026-10-31').get('s1|VND')).toBe(1) // phiếu tháng 11 chưa tính
  })

  it('phiếu đảo ghi vào cột trả hàng theo NGÀY ĐẢO, tháng gốc giữ nguyên', () => {
    // Ca thật Tiêu Điểm Sáng: nhập 09/2026, đảo 10/2026.
    const entries = receiptEntries(
      [
        mv({ vat_rate: 0, qty: 1, unit_cost: 77_220_000, doc_date: '2026-09-20' }),
        mv({ vat_rate: 0, qty: 1, unit_cost: 77_220_000, doc_id: 'd2', doc_code: 'PNK-2026-0130', direction: 'out', is_reversal: true, doc_date: '2026-10-05' }), // prettier-ignore
      ],
      null,
    )
    const [sep] = buildLedger(entries, '2026-09-01', '2026-09-30')
    expect(sep).toMatchObject({ increase: 77_220_000, returned: 0, closing: 77_220_000 })
    const [oct] = buildLedger(entries, '2026-10-01', '2026-10-31')
    expect(oct).toMatchObject({ opening: 77_220_000, returned: 77_220_000, decrease: 0, closing: 0 }) // prettier-ignore
    expect(entries.find((x) => x.kind === 'return')?.label).toBe('Đảo phiếu nhập')
  })

  it('trả hàng NCC (không phải đảo) mang nhãn riêng', () => {
    const [e] = receiptEntries([mv({ direction: 'out' })], null)
    expect(e).toMatchObject({ kind: 'return', label: 'Trả hàng NCC', amount: 10_800 })
  })

  it('hạn thanh toán: "công nợ cuối tháng" → ngày cuối tháng của phiếu', () => {
    const [e] = receiptEntries([mv()], null)
    expect(e.due).toBe('2026-10-31')
  })

  it('hạn thanh toán: đơn trống điều khoản → rơi xuống mặc định công ty', () => {
    const [e] = receiptEntries([mv({ terms_payment: null })], { basis: 'net', days: 30 })
    expect(e.due).toBe('2026-11-08')
  })

  it('phiếu trả hàng không có hạn', () => {
    const [e] = receiptEntries([mv({ direction: 'out' })], { basis: 'net', days: 30 })
    expect(e.due).toBeNull()
  })

  it('sổ chi tiết: phiếu nhập đứng trước trả hàng và thanh toán trong cùng ngày', () => {
    const entries = [
      ...receiptEntries(
        [mv({ direction: 'out', doc_id: 'd0', doc_code: 'PNK-A' })],
        null,
      ),
      { ...receiptEntries([mv()], null)[0], doc_no: 'PNK-Z' },
      { supplier_id: 's1', supplier_name: 'Hiệp Hưng', currency: 'VND', date: '2026-10-09', kind: 'payment' as const, doc_no: 'A-UNC', amount: 100 }, // prettier-ignore
    ]
    const d = ledgerDetail(entries, 's1', 'VND', '2026-10-01', '2026-10-31')
    expect(d.lines.map((l) => l.kind)).toEqual(['invoice', 'return', 'payment'])
    expect(d.lines.map((l) => l.running)).toEqual([10_800, 0, -100])
  })
})

describe('receiptEntries — dòng hàng', () => {
  it('bút toán mang từng dòng hàng, VAT theo dòng, cộng lại đúng bằng bút toán', () => {
    // Số thật PNK-2026-0095 (Minh Thắng, PO-2026-0132, 8 %).
    const [e] = receiptEntries(
      [
        mv({ move_id: 'b', item_name: 'Long đền sắt 8x20x2', item_unit: 'Cái', qty: 810, unit_cost: 350, lsx_code: '01/26-27 - YOTRIO' }), // prettier-ignore
        mv({ move_id: 'a', item_name: 'Long đền chẻ lỗ 8x2', item_unit: 'Con', qty: 1500, unit_cost: 170, lsx_code: '01/26-27 - YOTRIO' }), // prettier-ignore
      ],
      null,
    )
    expect(e.lsx_code).toBe('01/26-27 - YOTRIO')
    expect(e.items).toEqual([
      { name: 'Long đền chẻ lỗ 8x2', unit: 'Con', qty: 1500, price: 170, net: 255_000, vat: 20_400, amount: 275_400 }, // prettier-ignore
      { name: 'Long đền sắt 8x20x2', unit: 'Cái', qty: 810, price: 350, net: 283_500, vat: 22_680, amount: 306_180 }, // prettier-ignore
    ])
    expect(e.amount).toBe(581_580)
    expect(e.items!.reduce((s, i) => s + i.amount, 0)).toBe(e.amount)
  })

  it('dòng chưa có giá không có mặt trong dòng hàng của bút toán', () => {
    const [e] = receiptEntries([mv({ move_id: 'a' }), mv({ move_id: 'b', unit_cost: null })], null) // prettier-ignore
    expect(e.items).toHaveLength(1)
  })
})

describe('itemLabel — tên dòng hàng không lặp quy cách', () => {
  it.each([
    ['Ắc gai 8x70 taro gai 6x20', '8x70 taro gai 6x20', 'Ắc gai 8x70 taro gai 6x20'],
    ['Vít 4x20 ren gỗ đen', '4×20', 'Vít 4x20 ren gỗ đen'],
    ['Pát góc đóng thùng', '75x75', 'Pát góc đóng thùng 75x75'],
    ['Eru 10, xi trắng', null, 'Eru 10, xi trắng'],
  ])('%s + %s → %s', (name, spec, want) => expect(itemLabel(name, spec)).toBe(want))
})

describe('looksLikeHgCode — ô số phiếu NCC đang ghi mã đơn HG', () => {
  it.each(['6/2026- HG/MT', '17/10/2026 HG-YD', 'ĐH 6 -2026/ HG-PQ', '03-2026 HG/KP'])(
    'mã đơn HG: %s',
    (s) => expect(looksLikeHgCode(s)).toBe(true),
  )
  it.each(['18457', '16016', 'PGH-00231', '', null])('số phiếu NCC thật: %s', (s) =>
    expect(looksLikeHgCode(s)).toBe(false),
  )
})

describe('prepayLabel — điều khoản đòi trả trước', () => {
  it.each([
    ['Cọc 30%, xác nhận đơn đặt hàng. SL còn lại', 'cọc 30%'],
    ['TTR — đặt cọc 20%, 80% còn lại khi nhận hàng', 'cọc 20%'],
    ['Thanh toán trước khi nhận hàng', 'trả trước'],
    ['Tạm ứng 50% sau khi đặt hàng, thanh toán phần còn lại khi giao đủ', 'tạm ứng 50%'],
  ])('%s → %s', (text, want) => expect(prepayLabel(text)).toBe(want))

  it.each(['Thanh toán công nợ cuối tháng', 'Công nợ 30 ngày', '', null])(
    'không trả trước: %s',
    (text) => expect(prepayLabel(text)).toBeNull(),
  )
})

describe('termsOf', () => {
  it('một câu (bỏ chấm cuối, khoảng trắng thừa) → bày câu đó', () => {
    expect(termsOf(['Công nợ cuối tháng.', 'Công nợ  cuối tháng', null])).toEqual({ text: 'Công nợ cuối tháng', distinct: 1 }) // prettier-ignore
  })
  it('nhiều câu khác nhau → chỉ đếm, không chọn bừa', () => {
    expect(termsOf(['Cọc 30%', 'Công nợ 30 ngày'])).toEqual({ text: null, distinct: 2 })
  })
  it('không đơn nào ghi → 0', () => {
    expect(termsOf([null, ''])).toEqual({ text: null, distinct: 0 })
  })
})

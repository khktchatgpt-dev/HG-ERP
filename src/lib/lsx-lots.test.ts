import { describe, it, expect } from 'vitest'
import {
  applyLotsToGroups,
  lotShipText,
  lsxShipDateFromLots,
  nextLot,
  type LotLite,
} from './lsx-lots'

const LOTS: LotLite[] = [
  {
    seq: 1,
    po_no: 'PO-A',
    po_ref: null,
    ship_date: '2026-11-20',
    lines: [{ product_key: 'CH0283HG-AL', qty: 60 }],
  },
  {
    seq: 2,
    po_no: 'PO-B',
    po_ref: 'Menards 55',
    ship_date: '2026-12-04',
    lines: [
      { product_key: 'CH0283HG-AL', qty: 40 },
      { product_key: 'TB0100', qty: 10 },
    ],
  },
  {
    seq: 3,
    po_no: null,
    po_ref: null,
    ship_date: null,
    lines: [{ product_key: 'TB0100', qty: 5 }],
  },
]

describe('lsxShipDateFromLots — hạn xuất đầu lệnh = lô sớm nhất (D1)', () => {
  it('lấy ngày sớm nhất, bỏ lô chưa có ngày', () => {
    expect(lsxShipDateFromLots(LOTS)).toBe('2026-11-20')
  })
  it('không lô nào có ngày → null (không ghi đè đầu lệnh)', () => {
    expect(lsxShipDateFromLots([{ ...LOTS[2] }])).toBeNull()
    expect(lsxShipDateFromLots([])).toBeNull()
  })
})

describe('lotShipText — đợt xuất của dòng theo lô', () => {
  it('SP ở hai lô → hai đợt theo thứ tự ngày, kèm PO', () => {
    expect(lotShipText('CH0283HG-AL', LOTS)).toBe(
      'w47.26 · 20/11/26 (PO-A) · w49.26 · 04/12/26 (Menards 55)',
    )
  })
  it('lô chưa chốt lịch → chữ "chưa chốt lịch", xếp cuối', () => {
    expect(lotShipText('TB0100', LOTS)).toBe(
      'w49.26 · 04/12/26 (Menards 55) · chưa chốt lịch',
    )
  })
  it('mã SP không nằm lô nào / mã rỗng → chuỗi rỗng', () => {
    expect(lotShipText('XX', LOTS)).toBe('')
    expect(lotShipText(null, LOTS)).toBe('')
  })
  it('khoá gọn khoảng trắng — "CH0283HG-AL " khớp "CH0283HG-AL"', () => {
    expect(lotShipText(' CH0283HG-AL ', LOTS)).not.toBe('')
  })
})

describe('applyLotsToGroups — ghi đè đợt xuất của dòng khi lệnh có lô', () => {
  const groups = [
    {
      id: 'g1',
      lines: [
        {
          id: 'l1',
          product_code: 'CH0283HG-AL',
          ship_date: '2026-09-13',
          ship_label: null,
        },
        { id: 'l2', product_code: 'KHAC', ship_date: '2026-09-13', ship_label: null },
      ],
    },
  ]
  it('dòng có lô → label theo lô, ship_date null; dòng không lô → giữ nguyên', () => {
    const out = applyLotsToGroups(groups, LOTS)
    expect(out[0].lines[0]).toMatchObject({
      ship_date: null,
      ship_label: expect.stringContaining('w47.26'),
    })
    expect(out[0].lines[1]).toMatchObject({ ship_date: '2026-09-13', ship_label: null })
  })
  it('lệnh chưa chia lô → trả nguyên bộ (dữ liệu cũ vẫn in được)', () => {
    expect(applyLotsToGroups(groups, [])[0].lines[0].ship_date).toBe('2026-09-13')
  })
})

describe('nextLot — lô kế tiếp chưa qua', () => {
  it('lấy lô sớm nhất có ngày ≥ hôm nay', () => {
    expect(nextLot(LOTS, '2026-11-25')?.seq).toBe(2)
    expect(nextLot(LOTS, '2026-10-01')?.seq).toBe(1)
  })
  it('mọi lô đã qua → lô muộn nhất; không lô có ngày → null', () => {
    expect(nextLot(LOTS, '2027-01-01')?.seq).toBe(2)
    expect(nextLot([LOTS[2]], '2026-10-01')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { planSplitByReceipts, validateSplitRest } from './po-shipments'

// PO-2026-0084 thật (07/10/2026): một đợt 100%, hai phiếu nhập chưa nối đợt.
const A = 'bul0087'
const B = 'bul0088'
const C = 'nk0034'
const dot1 = {
  lines: [
    { po_line_id: A, qty: 59405 },
    { po_line_id: B, qty: 13697 },
    { po_line_id: C, qty: 127447 },
  ],
}
const pnk79 = { doc_id: 'd79', doc_code: 'PNK-2026-0079', date: '2026-10-02', lines: [{ po_line_id: A, qty: 4270 }, { po_line_id: B, qty: 2200 }, { po_line_id: C, qty: 23400 }] } // prettier-ignore
const pnk96 = { doc_id: 'd96', doc_code: 'PNK-2026-0096', date: '2026-10-05', lines: [{ po_line_id: A, qty: 7800 }, { po_line_id: B, qty: 2800 }, { po_line_id: C, qty: 10000 }] } // prettier-ignore

describe('planSplitByReceipts', () => {
  it('PO-2026-0084: hai phiếu theo thứ tự ngày, phần còn chờ = đợt − đã về', () => {
    const p = planSplitByReceipts(dot1, [pnk96, pnk79])!
    expect(p.receipts.map((r) => r.doc_code)).toEqual(['PNK-2026-0079', 'PNK-2026-0096'])
    expect(p.rest).toEqual([
      { po_line_id: A, qty: 47335 },
      { po_line_id: B, qty: 8697 },
      { po_line_id: C, qty: 94047 },
    ])
  })

  it('không có phiếu nào có số → không có phương án', () => {
    expect(planSplitByReceipts(dot1, [])).toBeNull()
    expect(planSplitByReceipts(dot1, [{ ...pnk79, lines: [] }])).toBeNull()
  })

  it('về đủ (hoặc dư) dòng nào thì dòng đó không còn trong phần chờ', () => {
    const p = planSplitByReceipts({ lines: [{ po_line_id: A, qty: 100 }, { po_line_id: B, qty: 50 }] }, [
      { doc_id: 'x', doc_code: 'PNK-1', date: '2026-10-01', lines: [{ po_line_id: A, qty: 102 }, { po_line_id: B, qty: 20 }] },
    ])! // prettier-ignore
    expect(p.rest).toEqual([{ po_line_id: B, qty: 30 }])
  })
})

describe('validateSplitRest', () => {
  const plan = planSplitByReceipts(dot1, [pnk79, pnk96])!
  const today = '2026-10-07'

  it('một đợt hẹn đủ phần còn chờ → hợp lệ', () => {
    expect(validateSplitRest(plan, [{ expected_date: '2026-10-20', lines: plan.rest }], today)).toEqual([]) // prettier-ignore
  })

  it('chia hai đợt cộng đúng → hợp lệ; lệch → báo đúng dòng', () => {
    const ok = [
      { expected_date: '2026-10-20', lines: [{ po_line_id: A, qty: 20000 }, { po_line_id: B, qty: 8697 }, { po_line_id: C, qty: 50000 }] },
      { expected_date: '2026-11-05', lines: [{ po_line_id: A, qty: 27335 }, { po_line_id: C, qty: 44047 }] },
    ] // prettier-ignore
    expect(validateSplitRest(plan, ok, today)).toEqual([])
    const lech = [{ expected_date: '2026-10-20', lines: [{ po_line_id: A, qty: 47000 }, { po_line_id: B, qty: 8697 }, { po_line_id: C, qty: 94047 }] }] // prettier-ignore
    expect(validateSplitRest(plan, lech, today, new Map([[A, 'Bulon 8x25']]))).toEqual([
      '"Bulon 8x25": các đợt hẹn cộng 47.000, phần còn chờ là 47.335',
    ])
  })

  it('thiếu ngày, ngày đã qua, chưa xếp đợt nào', () => {
    expect(validateSplitRest(plan, [], today)).toContain(
      'Phần còn chờ chưa xếp vào đợt nào',
    )
    expect(validateSplitRest(plan, [{ expected_date: '', lines: plan.rest }], today)).toEqual(['Đợt hẹn 1: chưa chọn ngày']) // prettier-ignore
    expect(validateSplitRest(plan, [{ expected_date: '2026-10-01', lines: plan.rest }], today)).toEqual(['Đợt hẹn 1: ngày hẹn đã qua']) // prettier-ignore
  })

  it('đã về đủ hết → không cần đợt hẹn nào', () => {
    const full = planSplitByReceipts({ lines: [{ po_line_id: A, qty: 10 }] }, [{ doc_id: 'x', doc_code: 'PNK-1', date: '2026-10-01', lines: [{ po_line_id: A, qty: 10 }] }])! // prettier-ignore
    expect(validateSplitRest(full, [], today)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildLedger,
  ledgerDetail,
  ledgerTotals,
  monthRange,
  type LedgerEntry,
} from './ap-ledger'

const inv = (
  date: string,
  amount: number,
  o: Partial<LedgerEntry> = {},
): LedgerEntry => ({
  supplier_id: 's1',
  supplier_name: 'NCC A',
  currency: 'VND',
  kind: 'invoice',
  doc_no: `HD-${date}`,
  date,
  amount,
  ...o,
})
const pay = (date: string, amount: number, o: Partial<LedgerEntry> = {}): LedgerEntry =>
  inv(date, amount, { kind: 'payment', doc_no: `UNC-${date}`, ...o })

describe('buildLedger — dư đầu + phát sinh = dư cuối', () => {
  it('phương trình sổ luôn đúng', () => {
    const [r] = buildLedger(
      [
        inv('2026-07-10', 1000), // trước kỳ
        pay('2026-07-20', 400), // trước kỳ
        inv('2026-08-05', 500),
        pay('2026-08-25', 200),
      ],
      '2026-08-01',
      '2026-08-31',
    )
    expect(r.opening).toBe(600) // 1000 − 400
    expect(r.increase).toBe(500)
    expect(r.decrease).toBe(200)
    expect(r.closing).toBe(900) // 600 + 500 − 200
    expect(r.opening + r.increase - r.decrease).toBe(r.closing)
  })

  it('giao dịch SAU kỳ không lọt vào sổ của kỳ này', () => {
    const [r] = buildLedger(
      [inv('2026-08-05', 500), inv('2026-09-01', 9999)],
      '2026-08-01',
      '2026-08-31',
    )
    expect(r.increase).toBe(500)
    expect(r.closing).toBe(500)
  })

  /**
   * Sổ nào cho gõ tay số dư đầu kỳ thì sớm muộn số đó lệch khỏi tổng giao dịch,
   * và không ai biết bên nào sai. Dư đầu ở đây LUÔN cộng dồn từ giao dịch.
   */
  it('dư đầu kỳ cộng dồn MỌI giao dịch trước kỳ, không khai tay', () => {
    const [r] = buildLedger(
      [inv('2020-01-01', 100), inv('2025-06-06', 50), pay('2025-07-07', 30)],
      '2026-08-01',
      '2026-08-31',
    )
    expect(r.opening).toBe(120)
    expect(r.entry_count).toBe(0)
    // Không phát sinh trong kỳ nhưng CÓ dư đầu — vẫn là dòng thật của sổ.
    expect(r.closing).toBe(120)
  })

  it('tách theo NCC × TIỀN TỆ, không cộng USD vào VND', () => {
    const rows = buildLedger(
      [
        inv('2026-08-01', 1_000_000),
        inv('2026-08-02', 500, { currency: 'USD' }),
        inv('2026-08-03', 200, { supplier_id: 's2', supplier_name: 'NCC B' }),
      ],
      '2026-08-01',
      '2026-08-31',
    )
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.closing !== 1_000_500)).toBe(true)
  })

  it('bỏ dòng không dư đầu, không phát sinh, không dư cuối', () => {
    const rows = buildLedger([inv('2026-09-15', 100)], '2026-08-01', '2026-08-31')
    expect(rows).toEqual([])
  })

  it('xếp NCC nợ nhiều nhất lên đầu', () => {
    const rows = buildLedger(
      [
        inv('2026-08-01', 100),
        inv('2026-08-01', 900, { supplier_id: 's2', supplier_name: 'NCC B' }),
      ],
      '2026-08-01',
      '2026-08-31',
    )
    expect(rows[0].supplier_name).toBe('NCC B')
  })
})

describe('ledgerDetail — số dư luỹ kế từng dòng', () => {
  it('luỹ kế bắt đầu từ dư đầu kỳ và chạy đúng chiều', () => {
    const d = ledgerDetail(
      [inv('2026-07-01', 1000), inv('2026-08-05', 500), pay('2026-08-10', 300)],
      's1',
      'VND',
      '2026-08-01',
      '2026-08-31',
    )
    expect(d.opening).toBe(1000)
    expect(d.lines.map((l) => l.running)).toEqual([1500, 1200])
  })

  /** Trả tiền cho hoá đơn CÙNG NGÀY mà xếp ngược thì số dư âm giữa sổ. */
  it('cùng một ngày: hoá đơn trước, thanh toán sau', () => {
    const d = ledgerDetail(
      [pay('2026-08-05', 500), inv('2026-08-05', 500)],
      's1',
      'VND',
      '2026-08-01',
      '2026-08-31',
    )
    expect(d.lines.map((l) => l.kind)).toEqual(['invoice', 'payment'])
    expect(d.lines.map((l) => l.running)).toEqual([500, 0])
  })

  it('chỉ lấy đúng NCC và đúng tiền tệ được hỏi', () => {
    const d = ledgerDetail(
      [
        inv('2026-08-01', 100),
        inv('2026-08-02', 50, { currency: 'USD' }),
        inv('2026-08-03', 70, { supplier_id: 's2' }),
      ],
      's1',
      'VND',
      '2026-08-01',
      '2026-08-31',
    )
    expect(d.lines).toHaveLength(1)
    expect(d.lines[0].amount).toBe(100)
  })

  /**
   * Dư cuối của sổ chi tiết PHẢI khớp dư cuối của chính dòng đó trên sổ tổng
   * hợp. Thiếu chặn đuôi thì giao dịch kỳ SAU chạy vào đây và hai bảng nói hai
   * số — lệch kiểu đó không ai dò ra, vì hai bảng nằm hai chỗ.
   */
  it('khớp dư cuối với buildLedger, kể cả khi có giao dịch kỳ sau', () => {
    const entries = [
      inv('2026-07-01', 1000),
      inv('2026-08-05', 500),
      pay('2026-08-10', 300),
      inv('2026-09-02', 7777), // kỳ SAU
    ]
    const d = ledgerDetail(entries, 's1', 'VND', '2026-08-01', '2026-08-31')
    const [r] = buildLedger(entries, '2026-08-01', '2026-08-31')
    expect(d.lines).toHaveLength(2)
    expect(d.lines.at(-1)?.running).toBe(r.closing)
  })
})

describe('ledgerTotals', () => {
  it('cộng theo tiền tệ và giữ phương trình sổ', () => {
    const rows = buildLedger(
      [
        inv('2026-07-01', 1000),
        inv('2026-08-01', 500),
        pay('2026-08-02', 200),
        inv('2026-08-03', 300, { supplier_id: 's2', supplier_name: 'B' }),
      ],
      '2026-08-01',
      '2026-08-31',
    )
    const [t] = ledgerTotals(rows)
    expect(t.opening).toBe(1000)
    expect(t.increase).toBe(800)
    expect(t.decrease).toBe(200)
    expect(t.closing).toBe(1600)
    expect(t.opening + t.increase - t.decrease).toBe(t.closing)
    expect(t.supplier_count).toBe(2)
  })
})

describe('monthRange', () => {
  it('ra đúng ngày cuối tháng, kể cả tháng 2 năm nhuận', () => {
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
})

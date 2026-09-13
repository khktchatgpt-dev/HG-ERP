import { describe, expect, it } from 'vitest'
import {
  coverage,
  coveragePct,
  rowAction,
  showMoney,
  showNum,
  toLanes,
} from './kit-core'

describe('showNum', () => {
  it('số 0 hiện thành ô trống — 0 khác với "chưa có số"', () => {
    expect(showNum(0)).toBe('')
    expect(showNum(null)).toBe('')
    expect(showNum(undefined)).toBe('')
  })

  it('có nhóm nghìn kiểu Việt', () => {
    expect(showNum(1350)).toBe('1.350')
  })

  it('giữ phần lẻ khi thật sự lẻ, không đẻ ra "297,"', () => {
    // Bẫy đã dính ở file Excel: mã #,##0.## vẫn in dấu thập phân khi phần lẻ
    // bằng 0 — 297 hiện ra "297," trên Excel tiếng Việt.
    expect(showNum(297)).toBe('297')
    expect(showNum(3450.5)).toBe('3.450,5')
  })
})

describe('showMoney', () => {
  it('tiền lớn có nhóm nghìn, 0 thì trống', () => {
    expect(showMoney(5482000)).toBe('5.482.000')
    expect(showMoney(0)).toBe('')
  })

  it('VND KHÔNG có phần lẻ — xu là rác của phép nhân, không phải tiền', () => {
    // Đo trên màn NCC 08/09/2026: tổng chi cộng dồn từ nhiều dòng đơn giá lẻ
    // ra "6.570.693.696,79". Phần lẻ đó vô nghĩa với đồng Việt Nam và còn
    // đẩy cột rộng thêm.
    expect(showMoney(6570693696.79)).toBe('6.570.693.697')
    expect(showMoney(180550.61)).toBe('180.551')
  })

  it('ngoại tệ có xu thì mở phần lẻ bằng digits', () => {
    expect(showMoney(16830.9, { digits: 2 })).toBe('16.830,9')
  })
})

describe('coverage', () => {
  it('chưa có gì = 0, đủ = 1', () => {
    expect(coverage({ need: 440, covered: 0 })).toBe(0)
    expect(coverage({ need: 80, covered: 80 })).toBe(1)
  })

  it('không cần gì thì KHÔNG thiếu gì — need 0 trả về đủ', () => {
    // 0/0 là NaN; trả 0 thì dòng "không cần mua" hiện thanh rỗng như đang
    // thiếu, đúng thứ gây hiểu nhầm trên bảng.
    expect(coverage({ need: 0, covered: 0 })).toBe(1)
  })

  it('kẹp trong [0,1] — mua dư không cho ra 130%', () => {
    expect(coverage({ need: 100, covered: 130 })).toBe(1)
    expect(coverage({ need: 100, covered: -5 })).toBe(0)
  })

  it('phần trăm làm tròn, không phần lẻ', () => {
    expect(coveragePct(coverage({ need: 80, covered: 5 }))).toBe('6%')
    expect(coveragePct(1)).toBe('100%')
  })
})

describe('rowAction — nói VIỆC PHẢI LÀM, không nói tình hình', () => {
  const base = { suggest: 100, hasPrice: true, hasSupplier: true, blockedByBom: false }

  it('BOM chưa xác nhận thắng mọi thứ khác — không mua được thì bàn giá vô nghĩa', () => {
    const a = rowAction({ ...base, blockedByBom: true, hasSupplier: false })
    expect(a.label).toContain('BOM')
    expect(a.tone).toBe('warn')
  })

  it('hết việc thì nói Đủ', () => {
    expect(rowAction({ ...base, suggest: 0 }).label).toBe('Đủ')
  })

  it('chưa biết NCC là việc gấp nhất trong các mã còn phải mua', () => {
    const a = rowAction({ ...base, hasSupplier: false, hasPrice: false })
    expect(a.label).toBe('Chưa biết mua ở đâu')
    expect(a.tone).toBe('stop')
  })

  it('có NCC nhưng chưa giá thì đi hỏi giá', () => {
    expect(rowAction({ ...base, hasPrice: false }).label).toContain('hỏi giá')
  })

  it('đủ điều kiện thì nói thẳng là cắt đơn được', () => {
    expect(rowAction(base).label).toBe('Sẵn sàng cắt đơn')
  })
})

describe('toLanes', () => {
  const rows = [
    { code: 'A', suggest: 100, bom: false },
    { code: 'B', suggest: 0, bom: false },
    { code: 'C', suggest: 0, bom: true },
  ]

  it('chia đúng và không làm mất dòng nào', () => {
    const lanes = toLanes(rows, [
      { id: 'mua', label: 'Cần mua', test: (r) => r.suggest > 0 },
      { id: 'bom', label: 'Kỹ thuật đang mắc', tone: 'warn', test: (r) => r.bom },
      { id: 'du', label: 'Đã đủ', test: (r) => r.suggest === 0 && !r.bom },
    ])
    expect(lanes.map((l) => l.rows.length)).toEqual([1, 1, 1])
    expect(lanes[0].rows[0].code).toBe('A')
    expect(lanes[1].tone).toBe('warn')
  })

  it('hàng đợi rỗng vẫn giữ chỗ — số 0 là thông tin, không phải lý do giấu tab', () => {
    const lanes = toLanes(rows, [
      { id: 'x', label: 'Không có gì', test: () => false },
    ])
    expect(lanes).toHaveLength(1)
    expect(lanes[0].rows).toHaveLength(0)
  })
})

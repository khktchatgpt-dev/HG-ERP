import { describe, expect, it } from 'vitest'
import { buildFunnel, STAGE_META, type FunnelEntry } from './finance-funnel'

const e = (currency: string, stage: FunnelEntry['stage'], amount: number): FunnelEntry => ({ currency, stage, amount }) // prettier-ignore

describe('buildFunnel — năm mốc của một đồng tiền mua', () => {
  it('cộng đúng từng mốc và suy ra bốn khoảng chênh', () => {
    const [r] = buildFunnel([
      e('VND', 'committed', 1000),
      e('VND', 'confirmed', 800),
      e('VND', 'received', 500),
      e('VND', 'invoiced', 300),
      e('VND', 'paid', 100),
    ])
    expect(r.unconfirmed).toBe(200) // 1000 − 800
    expect(r.in_flight).toBe(300) // 800 − 500
    expect(r.awaiting_invoice).toBe(200) // 500 − 300
    expect(r.unpaid).toBe(200) // 300 − 100
  })

  /**
   * USD và VND KHÔNG quy đổi. Tỷ giá nào là quyết định kế toán, không phải thứ
   * một hàm gộp số tự chọn thay.
   */
  it('tách theo tiền tệ, không gộp và không quy đổi', () => {
    const rows = buildFunnel([
      e('VND', 'committed', 1_000_000),
      e('USD', 'committed', 500),
    ])
    expect(rows.map((r) => r.currency).sort()).toEqual(['USD', 'VND'])
    expect(rows.find((r) => r.currency === 'USD')!.committed).toBe(500)
    expect(rows.every((r) => r.committed !== 1_000_500)).toBe(true)
  })

  it('nhiều khoản cùng mốc thì cộng dồn', () => {
    const [r] = buildFunnel([
      e('VND', 'received', 100),
      e('VND', 'received', 250.5),
      e('VND', 'received', 0.5),
    ])
    expect(r.received).toBe(351)
  })

  /**
   * Hàng về nhiều hơn đặt, hay NCC xuất hoá đơn trước khi giao, đều có thật.
   * Nhưng "còn phải về −2 triệu" thì không đọc ra nghĩa gì — phần lệch ngược
   * chiều thuộc về màn đối chiếu, nơi nó được gọi đúng tên.
   */
  it('hiệu số không bao giờ âm', () => {
    const [r] = buildFunnel([
      e('VND', 'committed', 100),
      e('VND', 'confirmed', 100),
      e('VND', 'received', 100),
      // NCC đòi NHIỀU HƠN hàng đã về
      e('VND', 'invoiced', 180),
      e('VND', 'paid', 200),
    ])
    expect(r.awaiting_invoice).toBe(0)
    expect(r.unpaid).toBe(0)
    // Con số gốc vẫn giữ nguyên để màn bày được sự thật.
    expect(r.invoiced).toBe(180)
    expect(r.paid).toBe(200)
  })

  it('không có khoản nào thì trả mảng rỗng, không trả hàng 0', () => {
    expect(buildFunnel([])).toEqual([])
  })

  it('xếp tiền tệ có cam kết lớn nhất lên trước', () => {
    const rows = buildFunnel([
      e('USD', 'committed', 500),
      e('VND', 'committed', 1_000_000),
    ])
    expect(rows[0].currency).toBe('VND')
  })
})

describe('STAGE_META — phân vùng ước tính / ghi sổ', () => {
  it('hai mốc đầu là ƯỚC TÍNH, ba mốc sau mới ghi sổ được', () => {
    expect(STAGE_META.committed.kind).toBe('uoc_tinh')
    expect(STAGE_META.confirmed.kind).toBe('uoc_tinh')
    expect(STAGE_META.received.kind).toBe('ghi_so')
    expect(STAGE_META.invoiced.kind).toBe('ghi_so')
    expect(STAGE_META.paid.kind).toBe('ghi_so')
  })
})

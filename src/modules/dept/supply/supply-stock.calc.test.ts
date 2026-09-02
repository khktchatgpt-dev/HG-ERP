import { describe, expect, it } from 'vitest'
import { deriveBuyerFigures, sortForBuyer, type BuyerSortRow } from './supply-stock.calc'

const fig = (p: Partial<Parameters<typeof deriveBuyerFigures>[0]>) =>
  deriveBuyerFigures({
    on_hand: 0,
    reserved: 0,
    ordered: 0,
    min_stock: 0,
    reorder_point: null,
    ...p,
  })

describe('deriveBuyerFigures', () => {
  it('khả dụng trừ phần đã hứa cho LSX', () => {
    expect(fig({ on_hand: 100, reserved: 30 }).available).toBe(70)
  })

  it('âm khả dụng khi hứa cho LSX nhiều hơn tồn — không kẹp về 0', () => {
    // Kẹp về 0 là giấu mất đúng ca cần mua gấp nhất (ST-0013: tồn 0, giữ 17.632).
    expect(fig({ on_hand: 0, reserved: 17632 }).available).toBe(-17632)
  })

  it('vị thế cộng hàng đang trên đường', () => {
    expect(fig({ on_hand: 10, reserved: 4, ordered: 50 }).position).toBe(56)
  })

  it('ngưỡng lấy reorder_point trước, min_stock sau', () => {
    expect(fig({ min_stock: 20, reorder_point: 80 }).threshold).toBe(80)
    expect(fig({ min_stock: 20, reorder_point: null }).threshold).toBe(20)
    // reorder_point = 0 nghĩa là "chưa khai", không phải "ngưỡng bằng 0".
    expect(fig({ min_stock: 20, reorder_point: 0 }).threshold).toBe(20)
  })

  it('thiếu = ngưỡng − vị thế, hàng đang về được tính là đã có', () => {
    expect(fig({ on_hand: 10, min_stock: 100, ordered: 0 }).shortage).toBe(90)
    // Đã đặt đủ rồi thì KHÔNG còn thiếu — chỗ này sai là đặt trùng đơn cũ.
    expect(fig({ on_hand: 10, min_stock: 100, ordered: 90 }).shortage).toBe(0)
    expect(fig({ on_hand: 10, min_stock: 100, ordered: 200 }).shortage).toBe(0)
  })

  it('chưa khai ngưỡng thì không bịa ra nợ', () => {
    expect(fig({ on_hand: 0, min_stock: 0, reorder_point: null }).shortage).toBe(0)
  })
})

describe('sortForBuyer', () => {
  const row = (p: Partial<BuyerSortRow>): BuyerSortRow => ({
    code: 'X',
    eta: null,
    ordered: 0,
    pending: 0,
    ...p,
  })

  it('có ngày về lên trước, ngày gần nhất trên cùng', () => {
    const rows = [
      row({ code: 'C', eta: '2026-09-20' }),
      row({ code: 'A', eta: '2026-09-03' }),
      row({ code: 'B', eta: '2026-09-10' }),
    ]
    expect(rows.sort(sortForBuyer).map((r) => r.code)).toEqual(['A', 'B', 'C'])
  })

  it('đã đặt mà chưa hẹn ngày đứng trên mã không liên quan', () => {
    const rows = [
      row({ code: 'ZZ' }),
      row({ code: 'MM', ordered: 500 }),
      row({ code: 'AA', eta: '2026-09-30' }),
      row({ code: 'NN', pending: 20 }),
    ]
    expect(rows.sort(sortForBuyer).map((r) => r.code)).toEqual(['AA', 'MM', 'NN', 'ZZ'])
  })
})

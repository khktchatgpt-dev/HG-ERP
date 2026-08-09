import { describe, expect, it } from 'vitest'
import { assessPoFit, lineProgress } from './po-fit'

/*
 * Chuẩn so là CÔNG THỨC CỘT L của sổ "Tổng hợp ĐH" (file LSX 04):
 * IF(về > hạn, "Trễ SX", IF(về >= hạn-2, "Sát hạn", "Kịp")).
 */
describe('assessPoFit — đèn Kịp SX? đúng công thức sổ', () => {
  const dh = (expected_at: string | null, status = 'ordered') => ({
    status,
    expected_at,
  })

  it('về dự kiến sau hạn → Trễ SX', () => {
    expect(assessPoFit(dh('2026-09-10'), '2026-09-07')).toBe('late')
  })

  it('về trong 2 ngày sát hạn → Sát hạn (kể cả đúng ngày hạn)', () => {
    expect(assessPoFit(dh('2026-09-07'), '2026-09-07')).toBe('tight')
    expect(assessPoFit(dh('2026-09-05'), '2026-09-07')).toBe('tight')
  })

  it('về sớm hơn hạn quá 2 ngày → Kịp', () => {
    expect(assessPoFit(dh('2026-09-04'), '2026-09-07')).toBe('ok')
  })

  it('lệnh chưa đặt hạn / đơn chưa hẹn giao → không có cơ sở, không đèn', () => {
    expect(assessPoFit(dh('2026-09-04'), null)).toBeNull()
    expect(assessPoFit(dh(null), '2026-09-07')).toBeNull()
  })

  it('đơn đã về đủ / đã huỷ → thôi cảnh báo', () => {
    expect(assessPoFit(dh('2026-09-10', 'received'), '2026-09-07')).toBeNull()
    expect(assessPoFit(dh('2026-09-10', 'cancelled'), '2026-09-07')).toBeNull()
  })

  it('expected_at dạng timestamp vẫn so đúng theo ngày', () => {
    expect(assessPoFit(dh('2026-09-10T00:00:00+07:00'), '2026-09-07')).toBe('late')
  })
})

describe('lineProgress — đếm theo DÒNG, không cộng chéo đơn vị', () => {
  it('dòng xong = còn thiếu ≤ 0 (giao dư vẫn là xong)', () => {
    expect(
      lineProgress([{ qty_missing: 0 }, { qty_missing: -5 }, { qty_missing: 120 }]),
    ).toEqual({ done: 2, total: 3 })
  })

  it('đơn chưa có dòng nào ở view → 0/0', () => {
    expect(lineProgress([])).toEqual({ done: 0, total: 0 })
  })
})

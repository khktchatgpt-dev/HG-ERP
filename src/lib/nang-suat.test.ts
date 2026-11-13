import { describe, expect, it } from 'vitest'
import {
  gomNangSuat,
  nangSuat,
  parseKy,
  soDinhMuc,
  type NsDong,
  type NsPhieu,
} from './nang-suat'

const days = ['2026-11-10', '2026-11-11', '2026-11-12']
const P = (
  id: string,
  date: string,
  stage: string,
  hours: number | null,
  team = 't1',
): NsPhieu => ({
  id,
  entry_date: date,
  stage,
  team_id: team,
  labor_hours: hours,
})

describe('gomNangSuat', () => {
  const phieu = [
    P('a', '2026-11-10', 'phoi', 48),
    P('b', '2026-11-11', 'phoi', 32),
    P('c', '2026-11-11', 'han', 16, 't2'),
    P('cu', '2026-11-12', 'phoi', null), // phiếu không ghi giờ
    P('ngoai', '2026-11-01', 'phoi', 8), // ngoài kỳ
  ]
  const dong: NsDong[] = [
    { doc_id: 'a', qty: 100, kg: 40 },
    { doc_id: 'a', qty: 20, kg: null }, // thiếu ĐM kg
    { doc_id: 'b', qty: 60, kg: 24 },
    { doc_id: 'c', qty: 10, kg: 30 },
    { doc_id: 'cu', qty: 5, kg: 10 },
    { doc_id: 'ngoai', qty: 999, kg: 999 },
    { doc_id: null, qty: 7, kg: 7 }, // dòng không phiếu
  ]
  const { rows, total } = gomNangSuat(phieu, dong, days, (p) => p.stage)
  const phoi = rows.find((r) => r.key === 'phoi')!

  it('Σ kg ÷ Σ giờ, mỗi phiếu cộng giờ một lần — không trung bình các ngày', () => {
    // (40 + 24) ÷ (48 + 32) = 0,8 — trung bình hai ngày (0,83 và 0,75) sẽ ra 0,79.
    expect(phoi.kg_ns).toBe(64)
    expect(phoi.hours).toBe(80)
    expect(phoi.ns).toBe(0.8)
  })
  it('phiếu không giờ: vào kg + số lượng, không vào năng suất; đếm ra', () => {
    expect(phoi.kg).toBe(74)
    expect(phoi.qty).toBe(185)
    expect(phoi.no_hours).toBe(1)
  })
  it('dòng thiếu ĐM kg được đếm', () => {
    expect(phoi.missing_kg).toBe(1)
  })
  it('theo ngày', () => {
    expect(phoi.by_day.map((d) => d.ns)).toEqual([0.8, 0.8, null])
    expect(phoi.by_day[2].kg).toBe(10)
  })
  it('bỏ phiếu ngoài kỳ và dòng không phiếu; tổng toàn xưởng = Σ kg ÷ Σ giờ', () => {
    expect(total.kg_ns).toBe(94)
    expect(total.hours).toBe(96)
    expect(total.ns).toBe(1)
    expect(total.docs).toBe(4)
  })
})

describe('nangSuat · soDinhMuc · parseKy', () => {
  it('không giờ / không kg → null', () => {
    expect(nangSuat(10, 0)).toBeNull()
    expect(nangSuat(0, 8)).toBeNull()
  })
  it('% định mức; chưa đặt ĐM → null', () => {
    expect(soDinhMuc(8, 10)).toBe(0.8)
    expect(soDinhMuc(8, null)).toBeNull()
  })
  it('kỳ chỉ nhận 7 / 14 / 30, còn lại 14', () => {
    expect(parseKy('30')).toBe(30)
    expect(parseKy('99')).toBe(14)
    expect(parseKy(null)).toBe(14)
  })
})

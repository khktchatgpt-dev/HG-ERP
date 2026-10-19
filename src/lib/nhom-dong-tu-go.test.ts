import { describe, expect, it } from 'vitest'
import { NHOM_GO, NHOM_MAY, NHOM_NEM, NHOM_VAI, nhomChoDongTuGo } from './nhom-dong-tu-go'

describe('nhomChoDongTuGo', () => {
  it('dòng thật của PO-2026-0136: nệm thắng chữ "vải" trong ngoặc', () => {
    expect(nhomChoDongTuGo('Bộ nệm Riva nâu (không vải mái che + tai)')).toBe(NHOM_NEM)
    expect(nhomChoDongTuGo('Bộ vỏ nệm Riva xám (không vải mái che, tai)')).toBe(NHOM_NEM)
    expect(nhomChoDongTuGo('Vải mái che Riva cobo (có tai)')).toBe(NHOM_VAI)
  })
  it('ghế / bàn gỗ ở lại nhóm Gỗ', () => {
    expect(nhomChoDongTuGo('Ghế 5 bậc nhôm gỗ bạch đàn FSC')).toBe(NHOM_GO)
    expect(nhomChoDongTuGo('Mặt bàn Halson')).toBe(NHOM_GO)
  })
  it('khớp theo TỪ, không theo mẩu chữ: "dao" không phải "da"', () => {
    expect(nhomChoDongTuGo('Ghế đan mây tự nhiên')).toBe(NHOM_MAY)
    expect(nhomChoDongTuGo('Bàn dao cắt')).toBe(NHOM_GO)
    expect(nhomChoDongTuGo('Ghế bọc DA bò')).toBe(NHOM_VAI)
  })
})

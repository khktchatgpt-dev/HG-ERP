import { describe, expect, it } from 'vitest'
import { PO_STATUSES, PO_TRACK_STEPS, poTrackStep } from './po-status'

/*
  Lỗi thật đã xảy ra: bản cũ tính bước bằng `indexOf` trên một danh sách THIẾU
  ba trạng thái cuối, rồi `Math.max(0, -1)` kéo về 0 — nên đơn về một phần, về
  đủ và đã huỷ đều hiện "Nháp". Bộ test này canh đúng chỗ đó.
*/
describe('poTrackStep', () => {
  it('khai đủ CẢ CHÍN trạng thái — không trạng thái nào rơi vào mặc định', () => {
    for (const s of PO_STATUSES) {
      const r = poTrackStep(s)
      expect(r, s).toBeDefined()
      expect(Number.isInteger(r.at), s).toBe(true)
      expect(r.at, s).toBeGreaterThanOrEqual(-1)
      expect(r.at, s).toBeLessThanOrEqual(PO_TRACK_STEPS.length)
    }
  })

  it('sáu bước phát hành ánh xạ đúng thứ tự', () => {
    const doi = ['draft', 'pending_approval', 'approved', 'ordered', 'confirmed', 'in_transit'] as const // prettier-ignore
    doi.forEach((s, i) => expect(poTrackStep(s).at, s).toBe(i))
  })

  it('CHÍNH LỖI CŨ: về một phần / về đủ KHÔNG còn hiện là bước đầu', () => {
    for (const s of ['partial', 'received'] as const) {
      expect(poTrackStep(s).at, s).not.toBe(0)
      expect(poTrackStep(s).at, s).toBe(PO_TRACK_STEPS.length)
    }
  })

  it('đơn huỷ: trục lùi hẳn về nhạt, kèm một bậc KẾT THÚC màu dừng', () => {
    // Không tick xanh sáu bước — đơn huỷ lúc nháp chưa hề đi qua bước nào, mà
    // cột status bị ghi đè nên cũng không biết nó đã đi tới đâu.
    expect(poTrackStep('cancelled')).toEqual({
      at: -1,
      tone: 'stop',
      terminal: 'Đã huỷ',
    })
  })

  it('chỉ đơn huỷ mới có bậc kết thúc ngoài trục', () => {
    for (const s of PO_STATUSES) {
      expect(poTrackStep(s).terminal, s).toBe(s === 'cancelled' ? 'Đã huỷ' : undefined)
    }
  })

  it('chỉ đơn huỷ mới mang màu dừng', () => {
    for (const s of PO_STATUSES) {
      expect(poTrackStep(s).tone, s).toBe(s === 'cancelled' ? 'stop' : 'act')
    }
  })
})

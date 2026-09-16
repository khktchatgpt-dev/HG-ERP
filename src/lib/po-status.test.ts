import { describe, expect, it } from 'vitest'
import { PO_STATUSES, PO_TRACK_STEPS, poTrackStep, receiptTrackTone } from './po-status'

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

  /*
    ĐỔI LUẬT 16/09/2026: trước đây mọi bước đang chạy đều là 'act', nên bảy
    trên chín trạng thái ra cùng một màu xanh với nút chính — chủ dự án chấm
    "chỉ có mỗi màu xanh trắng". Nay tone nói nghĩa vòng đời, nên ca này chỉ
    còn canh MỘT chiều: 'stop' là của riêng đơn huỷ, không trạng thái nào khác
    được mượn màu dừng.
  */
  it('chỉ đơn huỷ mới mang màu dừng', () => {
    for (const s of PO_STATUSES) {
      if (s === 'cancelled') expect(poTrackStep(s).tone, s).toBe('stop')
      else expect(poTrackStep(s).tone, s).not.toBe('stop')
    }
  })
})

/*
  MÀU DẢI BƯỚC PHẢI NÓI NGHĨA (16/09/2026).

  `poTrackStep` bản 15/09 chỉ có hai màu — `act` cho mọi bước đang chạy và
  `stop` cho đơn huỷ — nên bảy trên chín trạng thái ra CÙNG một màu xanh với
  nút chính, và chủ dự án chấm "chỉ có mỗi màu xanh trắng, rất khó phân biệt".
  Test canh cho cái đó không quay lại: tô hết về một tone là đỏ ngay.
*/
describe('poTrackStep — tone nói nghĩa vòng đời, không dồn về một màu', () => {
  it('nháp xám · chờ duyệt và đã duyệt hổ phách · đã gửi trở đi lam', () => {
    expect(poTrackStep('draft').tone).toBe('idle')
    expect(poTrackStep('pending_approval').tone).toBe('wait')
    expect(poTrackStep('approved').tone).toBe('wait')
    for (const s of ['ordered', 'confirmed', 'in_transit'] as const) {
      expect(poTrackStep(s).tone).toBe('run')
    }
  })

  it('về đủ là lục, về một phần vẫn là đang chờ, huỷ là đỏ', () => {
    expect(poTrackStep('received').tone).toBe('done')
    expect(poTrackStep('partial').tone).toBe('wait')
    expect(poTrackStep('cancelled').tone).toBe('stop')
  })

  it('9 trạng thái không được dồn hết vào một màu', () => {
    const tones = new Set(PO_STATUSES.map((s) => poTrackStep(s).tone))
    expect(tones.size).toBeGreaterThanOrEqual(4)
  })
})

describe('receiptTrackTone — trục nhận hàng theo BƯỚC, không theo trạng thái đơn', () => {
  it('chưa nhận xám · một phần hổ phách · đủ lục', () => {
    expect(receiptTrackTone(0)).toBe('idle')
    expect(receiptTrackTone(1)).toBe('wait')
    expect(receiptTrackTone(2)).toBe('done')
  })
})

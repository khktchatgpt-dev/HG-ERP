import { describe, expect, it } from 'vitest'
import { PO_STATUSES, poTrackTone, receiptTrackTone } from './po-status'

describe('poTrackTone — màu dải bước nói NGHĨA, không mặc định xanh', () => {
  it('nháp là xám: chưa đi đâu cả', () => {
    expect(poTrackTone('draft')).toBe('idle')
  })

  it('đang chờ ai đó thì hổ phách — cùng nghĩa với vạch mép dòng', () => {
    for (const s of ['pending_approval', 'approved', 'partial']) {
      expect(poTrackTone(s)).toBe('wait')
    }
  })

  it('đã chốt và đang chạy thì lam', () => {
    for (const s of ['ordered', 'confirmed', 'in_transit']) {
      expect(poTrackTone(s)).toBe('run')
    }
  })

  it('xong là lục, huỷ là đỏ', () => {
    expect(poTrackTone('received')).toBe('done')
    expect(poTrackTone('cancelled')).toBe('stop')
  })

  /*
    Ràng buộc THẬT của thay đổi này: xanh `--act` chỉ còn nghĩa "bấm được".
    Trạng thái nào cũng tô 'run' thì dải lại về đúng chỗ cũ — một màu xanh cho
    hai nghĩa. Test canh cho có ít nhất ba nghĩa khác nhau trên 9 trạng thái.
  */
  it('9 trạng thái không được dồn hết vào một màu', () => {
    const tones = new Set(PO_STATUSES.map(poTrackTone))
    expect(tones.size).toBeGreaterThanOrEqual(4)
  })
})

describe('receiptTrackTone — theo BƯỚC nhận, không theo trạng thái đơn', () => {
  it('chưa nhận → xám, một phần → hổ phách, đủ → lục', () => {
    expect(receiptTrackTone(0)).toBe('idle')
    expect(receiptTrackTone(1)).toBe('wait')
    expect(receiptTrackTone(2)).toBe('done')
  })
})

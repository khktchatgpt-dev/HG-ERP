import { describe, expect, it, vi } from 'vitest'

// samples.service kéo theo db()/repo khi import — mock để test được allow-map
// thuần, không cần Supabase.
vi.mock('@/server/db', () => ({ db: () => ({}) }))
vi.mock('./technical.service', () => ({ isTechnicalStaff: async () => true }))
vi.mock('./samples.repo', () => ({ samplesRepo: {} }))
vi.mock('./loans.repo', () => ({ loansRepo: {} }))

import { canTransition } from './samples.service'
import { SAMPLE_STATUSES, type SampleStatus } from './samples.schema'

describe('canTransition — allow-map trạng thái mẫu', () => {
  it('vào on_loan KHÔNG bao giờ được phép qua đổi tay', () => {
    // Vào on_loan chỉ bằng ghi phiếu mượn. Cho đổi tay là `status` trôi khỏi sổ:
    // mẫu hiện "đang cho mượn" mà không có phiếu nào, không biết ai đang cầm.
    for (const from of SAMPLE_STATUSES) {
      expect(canTransition(from, 'on_loan')).toBe(false)
    }
  })

  it('disposed là điểm cuối — thanh lý rồi không quay lại lưu thông', () => {
    for (const to of SAMPLE_STATUSES) {
      expect(canTransition('disposed', to)).toBe(false)
    }
  })

  it('đang cho mượn thì chỉ có thể báo mất', () => {
    expect(canTransition('on_loan', 'lost')).toBe(true)
    // Trả mẫu phải đi qua ghi trả (loansService.return), không phải đổi status.
    expect(canTransition('on_loan', 'in_showroom')).toBe(false)
    expect(canTransition('on_loan', 'maintenance')).toBe(false)
    expect(canTransition('on_loan', 'disposed')).toBe(false)
  })

  it('ở showroom: đi sửa / mất / thanh lý', () => {
    expect(canTransition('in_showroom', 'maintenance')).toBe(true)
    expect(canTransition('in_showroom', 'lost')).toBe(true)
    expect(canTransition('in_showroom', 'disposed')).toBe(true)
  })

  it('sửa xong về showroom, hoặc thanh lý luôn', () => {
    expect(canTransition('maintenance', 'in_showroom')).toBe(true)
    expect(canTransition('maintenance', 'disposed')).toBe(true)
  })

  it('mẫu mất tìm lại được thì về showroom', () => {
    expect(canTransition('lost', 'in_showroom')).toBe(true)
    expect(canTransition('lost', 'disposed')).toBe(false)
  })

  it('không trạng thái nào tự chuyển sang chính nó', () => {
    for (const s of SAMPLE_STATUSES) {
      expect(canTransition(s, s)).toBe(false)
    }
  })

  it('mọi trạng thái đều có mục trong allow-map (không undefined)', () => {
    for (const from of SAMPLE_STATUSES) {
      for (const to of SAMPLE_STATUSES) {
        expect(typeof canTransition(from, to as SampleStatus)).toBe('boolean')
      }
    }
  })
})

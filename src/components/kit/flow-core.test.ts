import { describe, expect, it } from 'vitest'
import { buildPoMarks, daysHeld, isStale, poHolder } from './flow-core'

/*
  Dữ liệu đo thật từ DB 09/09/2026: PO-2026-0065 (nháp), created_at
  2026-09-03T12:17Z, updated_at 2026-09-03T15:56Z, mọi mốc sau đều null.
  65/68 đơn ở trạng thái nháp, 59/68 chưa có hẹn giao.
*/
const NHAP = {
  status: 'draft',
  created_at: '2026-09-03T12:17:03Z',
  created_by: 'u-nga',
  assigned_to: 'u-nga',
  updated_at: '2026-09-03T15:56:15Z',
  approved_at: null,
  ordered_at: null,
  confirmed_at: null,
}

describe('poHolder — ai đang giữ bóng', () => {
  it('đơn nháp của chính mình thì đến lượt mình', () => {
    const h = poHolder(NHAP, 'u-nga')
    expect(h.mine).toBe(true)
    expect(h.who).toBe('Cung ứng')
    expect(h.what).toContain('gửi Giám đốc')
  })

  it('đơn nháp của người khác thì KHÔNG phải lượt mình', () => {
    expect(poHolder(NHAP, 'u-khac').mine).toBe(false)
  })

  it('chờ duyệt thì bóng ở Giám đốc — kể cả với chính người soạn', () => {
    // Nói "đến lượt bạn" với người soạn ở bước này là đẩy họ đi giục nhầm chỗ.
    const h = poHolder({ ...NHAP, status: 'pending_approval' }, 'u-nga')
    expect(h.mine).toBe(false)
    expect(h.who).toBe('Giám đốc')
  })

  it('đã duyệt thì bóng quay lại Cung ứng để gửi NCC', () => {
    const h = poHolder(
      { ...NHAP, status: 'approved', approved_at: '2026-09-05T02:00:00Z' },
      'u-nga',
    )
    expect(h.mine).toBe(true)
    expect(h.since).toBe('2026-09-05T02:00:00Z')
  })

  it('đã gửi NCC: chưa xác nhận và đã xác nhận nói hai câu khác nhau', () => {
    const chua = poHolder({ ...NHAP, status: 'ordered', ordered_at: 'x' }, 'u-nga')
    const roi = poHolder(
      { ...NHAP, status: 'ordered', ordered_at: 'x', confirmed_at: 'y' },
      'u-nga',
    )
    expect(chua.who).toBe('Nhà cung cấp')
    expect(chua.what).toContain('xác nhận')
    expect(roi.what).toContain('chờ giao')
    expect(roi.what).not.toBe(chua.what)
  })

  it('về một phần thì bóng ở Kho', () => {
    expect(poHolder({ ...NHAP, status: 'partially_received' }, 'u-nga').who).toBe('Kho')
  })

  it('không ai giữ đơn đã xong hoặc đã huỷ', () => {
    for (const s of ['received', 'cancelled']) {
      const h = poHolder({ ...NHAP, status: s }, 'u-nga')
      expect(h.mine).toBe(false)
      expect(h.who).toBe('—')
    }
  })
})

describe('daysHeld / isStale', () => {
  const now = new Date('2026-09-09T10:00:00Z')

  it('đếm đúng số ngày', () => {
    expect(daysHeld('2026-09-09T09:00:00Z', now)).toBe(0)
    expect(daysHeld('2026-09-06T10:00:00Z', now)).toBe(3)
  })

  it('không có mốc thì không đoán bừa', () => {
    expect(daysHeld(null, now)).toBeNull()
    expect(isStale(null, now)).toBe(false)
  })

  it('mốc tương lai (lệch giờ máy) trả 0, không trả số âm', () => {
    expect(daysHeld('2026-09-10T10:00:00Z', now)).toBe(0)
  })

  it('ngưỡng cũ là 3 ngày, không phải 2', () => {
    // Nằm qua cuối tuần là bình thường; sang ngày thứ ba mới đáng báo.
    expect(isStale('2026-09-07T10:00:00Z', now)).toBe(false)
    expect(isStale('2026-09-06T10:00:00Z', now)).toBe(true)
  })
})

describe('buildPoMarks — dòng thời gian', () => {
  it('đơn nháp KHÔNG BAO GIỜ ra 0 mốc', () => {
    // Lỗi thật của bản v3: bỏ sót created_at nên đơn nháp hiện "0 mốc" rồi
    // đổ lỗi "chưa phát sinh sự kiện nào".
    const marks = buildPoMarks(NHAP)
    const daXayRa = marks.filter((m) => m.at)
    expect(daXayRa.length).toBeGreaterThan(0)
    expect(daXayRa[0].key).toBe('created')
  })

  it('mốc chưa tới vẫn có mặt với at = null', () => {
    const marks = buildPoMarks(NHAP)
    expect(marks.find((m) => m.key === 'approved')?.at).toBeNull()
    expect(marks.find((m) => m.key === 'ordered')?.at).toBeNull()
  })

  it('đang chờ duyệt thì suy ra mốc gửi duyệt từ updated_at', () => {
    const marks = buildPoMarks({ ...NHAP, status: 'pending_approval' })
    expect(marks.find((m) => m.key === 'submitted')?.at).toBe('2026-09-03T15:56:15Z')
  })

  it('đơn nháp KHÔNG có mốc gửi duyệt', () => {
    expect(buildPoMarks(NHAP).find((m) => m.key === 'submitted')?.at).toBeNull()
  })

  it('đơn huỷ có thêm mốc huỷ, tone stop', () => {
    const m = buildPoMarks({ ...NHAP, status: 'cancelled' }).find(
      (x) => x.key === 'cancelled',
    )
    expect(m?.tone).toBe('stop')
    expect(m?.at).toBe('2026-09-03T15:56:15Z')
  })

  it('mốc theo đúng thứ tự quy trình', () => {
    const keys = buildPoMarks(NHAP).map((m) => m.key)
    expect(keys).toEqual(['created', 'submitted', 'approved', 'ordered', 'confirmed'])
  })

  it('gắn được tên người soạn và người duyệt', () => {
    const marks = buildPoMarks(NHAP, { creatorName: 'Nga', approverName: 'GĐ Hùng' })
    expect(marks.find((m) => m.key === 'created')?.actor).toBe('Nga')
    expect(marks.find((m) => m.key === 'approved')?.actor).toBe('GĐ Hùng')
  })
})

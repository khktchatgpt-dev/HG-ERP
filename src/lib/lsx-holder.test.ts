import { describe, expect, it } from 'vitest'
import { STALE_DAYS, daysHeld, isStale, resolveHolder } from './lsx-holder'

const NOW = new Date('2026-09-18T08:00:00Z')

const base = {
  status: 'draft',
  created_at: '2026-09-01T00:00:00Z',
  approved_at: null,
  materials_received_at: null,
  completed_at: null,
  updated_at: null,
}

describe('daysHeld', () => {
  it('đếm ngày trọn', () => {
    expect(daysHeld('2026-09-15T08:00:00Z', NOW)).toBe(3)
    expect(daysHeld('2026-09-18T07:00:00Z', NOW)).toBe(0)
  })

  it('mốc ở TƯƠNG LAI → 0, không trả số âm', () => {
    // Lệch giờ máy chủ/máy trạm là chuyện thường; "-2 ngày" đọc ra vô nghĩa.
    expect(daysHeld('2026-09-20T00:00:00Z', NOW)).toBe(0)
  })

  it('không có mốc / mốc hỏng → null, không đoán', () => {
    expect(daysHeld(null, NOW)).toBeNull()
    expect(daysHeld('hôm qua', NOW)).toBeNull()
  })
})

describe('resolveHolder', () => {
  it('nháp → Bán hàng đang soạn, đếm từ lúc tạo', () => {
    const h = resolveHolder({ ...base, status: 'draft' }, NOW)
    expect(h.who).toBe('Bán hàng')
    expect(h.days).toBe(17)
    expect(h.closed).toBe(false)
  })

  it('chờ duyệt → Giám đốc', () => {
    const h = resolveHolder({ ...base, status: 'pending_approval' }, NOW)
    expect(h.who).toBe('Giám đốc')
  })

  it('bị từ chối → bóng QUAY VỀ Bán hàng, không phải Giám đốc', () => {
    const h = resolveHolder({ ...base, status: 'rejected' }, NOW)
    expect(h.who).toBe('Bán hàng')
    expect(h.what).toContain('sửa')
  })

  describe('ĐÃ DUYỆT — một trạng thái, HAI người giữ (lỗ hổng D)', () => {
    it('chưa có vật tư → Cung ứng, đếm từ lúc duyệt', () => {
      const h = resolveHolder(
        {
          ...base,
          status: 'approved',
          approved_at: '2026-09-10T00:00:00Z',
          materials_received_at: null,
        },
        NOW,
      )
      expect(h.who).toBe('Cung ứng')
      expect(h.what).toContain('vật tư')
      expect(h.days).toBe(8)
    })

    it('vật tư đã về → Xưởng, và ĐỒNG HỒ ĐẾM LẠI từ lúc nhận vật tư', () => {
      // Quan trọng: nếu vẫn đếm từ approved_at thì Xưởng bị tính cả những
      // ngày chờ Cung ứng — đổ lỗi nhầm người.
      const h = resolveHolder(
        {
          ...base,
          status: 'approved',
          approved_at: '2026-09-01T00:00:00Z',
          materials_received_at: '2026-09-16T00:00:00Z',
        },
        NOW,
      )
      expect(h.who).toBe('Xưởng sản xuất')
      expect(h.days).toBe(2)
    })
  })

  it('đang sản xuất → Xưởng', () => {
    const h = resolveHolder(
      { ...base, status: 'in_progress', approved_at: '2026-09-12T00:00:00Z' },
      NOW,
    )
    expect(h.who).toBe('Xưởng sản xuất')
    expect(h.closed).toBe(false)
  })

  it('hoàn thành → bóng sang Bán hàng để GIAO, và lệnh coi như khép', () => {
    const h = resolveHolder(
      { ...base, status: 'completed', completed_at: '2026-09-17T00:00:00Z' },
      NOW,
    )
    expect(h.who).toBe('Bán hàng')
    expect(h.closed).toBe(true)
  })

  it('đã huỷ → không ai giữ, khép', () => {
    const h = resolveHolder({ ...base, status: 'cancelled' }, NOW)
    expect(h.who).toBe('—')
    expect(h.closed).toBe(true)
  })

  it('trạng thái lạ → nói THẬT là chưa khai, không đoán bừa một vai', () => {
    // Thêm trạng thái mà quên sửa file này thì phải lộ ra, đừng im lặng gán
    // cho một phòng rồi người đọc đi gọi nhầm người.
    const h = resolveHolder({ ...base, status: 'nua_voi' }, NOW)
    expect(h.who).toBe('—')
    expect(h.what).toContain('nua_voi')
  })
})

describe('isStale', () => {
  it('quá ngưỡng và CHƯA khép → nằm im', () => {
    const h = resolveHolder(
      { ...base, status: 'approved', approved_at: '2026-09-10T00:00:00Z' },
      NOW,
    )
    expect(h.days).toBeGreaterThanOrEqual(STALE_DAYS)
    expect(isStale(h)).toBe(true)
  })

  it('lệnh ĐÃ KHÉP thì không bao giờ là nằm im, dù lâu bao nhiêu', () => {
    // Lệnh hoàn thành từ tháng trước không phải việc ai đang nợ.
    const h = resolveHolder(
      { ...base, status: 'completed', completed_at: '2026-01-01T00:00:00Z' },
      NOW,
    )
    expect(h.days).toBeGreaterThan(200)
    expect(isStale(h)).toBe(false)
  })

  it('chưa đếm được ngày → không kết luận nằm im', () => {
    const h = resolveHolder(
      { ...base, status: 'completed', completed_at: null, updated_at: null },
      NOW,
    )
    expect(isStale(h)).toBe(false)
  })
})

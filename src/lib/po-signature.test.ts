import { describe, expect, it } from 'vitest'
import {
  canSignLate,
  canUnapprove,
  canUrgentSend,
  isAwaitingLateSign,
  poWhereNow,
  signModeFor,
  questionKindFor,
} from './po-signature'

describe('canUnapprove — thu hồi chữ ký', () => {
  it('đơn đã duyệt, chưa gửi, chưa có phiếu nhập → được', () => {
    expect(canUnapprove({ status: 'approved', receiptDocs: 0 })).toEqual({ ok: true })
  })
  it('đã gửi NCC → không, chỉ đường "Yêu cầu xem lại"', () => {
    for (const status of ['ordered', 'confirmed', 'in_transit', 'partial', 'received']) {
      const g = canUnapprove({ status, receiptDocs: 0 })
      expect(g.ok).toBe(false)
      expect(!g.ok && g.reason).toContain('Yêu cầu xem lại')
    }
  })
  it('đang chờ duyệt → chưa có chữ ký để thu hồi', () => {
    expect(canUnapprove({ status: 'pending_approval', receiptDocs: 0 }).ok).toBe(false)
  })
  it('đã có phiếu nhập → chặn cứng', () => {
    expect(canUnapprove({ status: 'approved', receiptDocs: 1 }).ok).toBe(false)
  })
})

describe('canUrgentSend — gửi gấp, ký bù sau', () => {
  const base = { status: 'draft', isLead: true, hasEta: true, lineCount: 3 }
  it('trưởng phòng, nháp có hẹn giao + có dòng → được', () => {
    expect(canUrgentSend(base)).toEqual({ ok: true })
    expect(canUrgentSend({ ...base, status: 'pending_approval' })).toEqual({ ok: true })
  })
  it('không phải trưởng phòng → chặn, lý do chỉ người bấm thay', () => {
    const g = canUrgentSend({ ...base, isLead: false })
    expect(!g.ok && g.reason).toContain('trưởng phòng')
  })
  it('đơn đã duyệt → gửi theo đường thường, không cần gấp', () => {
    expect(canUrgentSend({ ...base, status: 'approved' }).ok).toBe(false)
  })
  it('thiếu hẹn giao / chưa có dòng → chặn', () => {
    expect(canUrgentSend({ ...base, hasEta: false }).ok).toBe(false)
    expect(canUrgentSend({ ...base, lineCount: 0 }).ok).toBe(false)
  })
})

describe('chờ ký bù', () => {
  it('đơn gửi gấp chưa ký → chờ ký bù, ký bù được', () => {
    const p = {
      status: 'ordered',
      urgent_sent_at: '2026-10-01T02:00:00Z',
      approved_at: null,
    }
    expect(isAwaitingLateSign(p)).toBe(true)
    expect(canSignLate(p)).toEqual({ ok: true })
  })
  it('đơn nạp từ file (không chữ ký, KHÔNG gửi gấp) → không phải chờ ký bù', () => {
    const p = { status: 'ordered', urgent_sent_at: null, approved_at: null }
    expect(isAwaitingLateSign(p)).toBe(false)
    expect(canSignLate(p).ok).toBe(false)
  })
  it('đã ký bù hoặc đã huỷ → hết chờ', () => {
    expect(isAwaitingLateSign({ status: 'ordered', urgent_sent_at: 'x', approved_at: 'y' })).toBe(false) // prettier-ignore
    expect(isAwaitingLateSign({ status: 'cancelled', urgent_sent_at: 'x', approved_at: null })).toBe(false) // prettier-ignore
  })
})

describe('questionKindFor — "Hỏi lại" hay "Yêu cầu xem lại"', () => {
  it('chờ duyệt / chờ ký bù → hỏi lại', () => {
    expect(questionKindFor({ status: 'pending_approval' })).toBe('ask')
    expect(questionKindFor({ status: 'ordered', urgent_sent_at: 'x', approved_at: null })).toBe('ask') // prettier-ignore
  })
  it('đã ký / đã gửi / đã về → yêu cầu xem lại', () => {
    expect(questionKindFor({ status: 'approved', approved_at: 'x' })).toBe('review')
    expect(questionKindFor({ status: 'received', approved_at: null })).toBe('review')
  })
  it('nháp / đã huỷ → không hỏi', () => {
    expect(questionKindFor({ status: 'draft' })).toBeNull()
    expect(questionKindFor({ status: 'cancelled' })).toBeNull()
  })
})

describe('poWhereNow — cột "Hiện ở đâu" ở Lịch sử ký', () => {
  const L = {
    approved: 'Đã duyệt',
    ordered: 'Đã gửi NCC',
    received: 'Về đủ',
    draft: 'Nháp',
  }
  it('đã duyệt chưa gửi → nói luôn là thu hồi được', () => {
    expect(poWhereNow({ status: 'approved', approved_at: 'x' }, L)).toBe('Chưa gửi NCC · thu hồi được') // prettier-ignore
  })
  it('gửi gấp chưa ký → chờ ký bù', () => {
    expect(poWhereNow({ status: 'ordered', urgent_sent_at: 'x', approved_at: null }, L)).toBe('Đã gửi NCC · chờ ký bù') // prettier-ignore
  })
  it('còn lại → nhãn trạng thái', () => {
    expect(poWhereNow({ status: 'received', approved_at: 'x' }, L)).toBe('Về đủ')
  })
})

describe('signModeFor — đầu màn ký theo chỗ đơn đứng', () => {
  it('đủ bảy chế độ', () => {
    expect(signModeFor({ status: 'pending_approval' })).toBe('decide')
    expect(signModeFor({ status: 'ordered', urgent_sent_at: 'x', approved_at: null })).toBe('late') // prettier-ignore
    expect(signModeFor({ status: 'approved', approved_at: 'x' })).toBe('signed')
    expect(signModeFor({ status: 'partial', approved_at: 'x' })).toBe('sent')
    expect(signModeFor({ status: 'received' })).toBe('received')
    expect(signModeFor({ status: 'draft' })).toBe('draft')
    expect(signModeFor({ status: 'cancelled', urgent_sent_at: 'x' })).toBe('cancelled')
  })
})

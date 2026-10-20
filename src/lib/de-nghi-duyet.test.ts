import { describe, expect, it } from 'vitest'
import { choToiDuyet, roDuyet, thangVn, tongTheoDuyet } from './de-nghi-duyet'

/** Danh sách đề nghị cho lãnh đạo (Đ5 · DN-6) — cùng luật Hộp ký + số đếm menu. */
const alex = { id: 'u-alex', role: 'employee' }
const admin = { id: 'u-admin', role: 'admin' }
const p = (x: Partial<Parameters<typeof roDuyet>[0]> = {}) => ({
  status: 'pending' as const,
  requested_by: 'u-hao',
  submitted_at: '2026-10-11T01:00:00Z',
  rejected_at: null,
  ...x,
})

describe('choToiDuyet', () => {
  it('chờ duyệt + không phải phiếu mình; admin duyệt được cả phiếu mình', () => {
    expect(choToiDuyet(p(), alex)).toBe(true)
    expect(choToiDuyet(p({ requested_by: 'u-alex' }), alex)).toBe(false)
    expect(choToiDuyet(p({ requested_by: 'u-admin' }), admin)).toBe(true)
    expect(choToiDuyet(p({ status: 'approved' }), alex)).toBe(false)
  })
})

describe('roDuyet', () => {
  it('xếp rổ theo trạng thái; nháp chưa gửi lần nào thì lãnh đạo không thấy', () => {
    expect(roDuyet(p(), alex)).toBe('cho')
    expect(roDuyet(p({ requested_by: 'u-alex' }), alex)).toBe('khac') // phiếu mình — người khác duyệt
    expect(roDuyet(p({ status: 'approved' }), alex)).toBe('mua')
    expect(roDuyet(p({ status: 'ordering' }), alex)).toBe('mua')
    expect(roDuyet(p({ status: 'done' }), alex)).toBe('xong')
    expect(roDuyet(p({ status: 'draft', rejected_at: '2026-10-12T01:00:00Z' }), alex)).toBe('tra_lai') // prettier-ignore
    expect(roDuyet(p({ status: 'draft' }), alex)).toBe('khac') // rút về nháp
    expect(roDuyet(p({ status: 'cancelled' }), alex)).toBe('khac')
    expect(roDuyet(p({ status: 'draft', submitted_at: null }), alex)).toBeNull()
  })
})

it('thangVn theo giờ VN — 17:30 UTC ngày 31/10 đã là 01/11 ở VN', () => {
  expect(thangVn('2026-10-31T17:30:00Z')).toBe('2026-11')
  expect(thangVn('2026-10-31T16:30:00Z')).toBe('2026-10')
})

it('tongTheoDuyet — theo số duyệt (null = số đề nghị), dòng chưa giá không cộng', () => {
  expect(
    tongTheoDuyet([
      { qty: 200, approved_qty: 150, unit_price: 5500 },
      { qty: 80, approved_qty: null, unit_price: 5000 },
      { qty: 10, approved_qty: 0, unit_price: 25000 },
      { qty: 20, approved_qty: null, unit_price: null },
    ]),
  ).toBe(825_000 + 400_000)
})

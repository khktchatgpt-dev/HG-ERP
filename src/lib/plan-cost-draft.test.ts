import { describe, expect, it } from 'vitest'
import { resolvePlanDraft, planDraftDirty, EMPTY_PLAN_DRAFT } from './plan-cost-draft'

const NONE = { direct: null, overhead: null, profit: null, price: null, currency: null }
const FULL = { direct: 144, overhead: 28.8, profit: 15.55, price: 188.34, currency: 'USD' }

describe('resolvePlanDraft — ghép ô gõ với số đang có', () => {
  it('ô trống hết = chưa sửa', () => {
    expect(planDraftDirty(EMPTY_PLAN_DRAFT)).toBe(false)
    expect(planDraftDirty(undefined)).toBe(false)
    expect(planDraftDirty({ ...EMPTY_PLAN_DRAFT, price: '1' })).toBe(true)
  })
  it('SP trống, chỉ gõ FOB → chỉ FOB', () => {
    const r = resolvePlanDraft({ ...EMPTY_PLAN_DRAFT, price: '83.58' }, NONE, '.', 'USD')
    expect(r).toMatchObject({ ok: true, fob_only: true, price: 83.58, direct: null })
  })
  it('SP trống, đủ chung + lợi nhuận + FOB → suy trực tiếp', () => {
    const r = resolvePlanDraft(
      { ...EMPTY_PLAN_DRAFT, overhead: '13.14', profit: '4.73', price: '83.58' },
      NONE,
      '.',
      'USD',
    )
    expect(r).toMatchObject({ ok: true, direct: 65.71, derived_direct: true, fob_only: false })
  })
  it('SP đủ bốn số, chỉ sửa FOB cho lệch → báo lệch tổng (ba số kia vẫn giữ)', () => {
    const r = resolvePlanDraft({ ...EMPTY_PLAN_DRAFT, price: '200' }, FULL, '.', 'USD')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/≠ FOB/)
  })
  it('SP đủ bốn số, sửa lợi nhuận và FOB cho khớp → ok, giữ trực tiếp/chung cũ', () => {
    const r = resolvePlanDraft(
      { ...EMPTY_PLAN_DRAFT, profit: '27.2', price: '200' },
      FULL,
      '.',
      'USD',
    )
    expect(r).toMatchObject({ ok: true, direct: 144, overhead: 28.8, profit: 27.2, price: 200 })
  })
  it('đổi tiền tệ thì KHÔNG mượn số đang có: USD cũ, gõ VND chỉ FOB → chỉ FOB', () => {
    const r = resolvePlanDraft({ ...EMPTY_PLAN_DRAFT, price: '2000000' }, FULL, '.', 'VND')
    expect(r).toMatchObject({ ok: true, fob_only: true })
  })
  it('dở dang 1–2 số → từ chối', () => {
    const r = resolvePlanDraft(
      { ...EMPTY_PLAN_DRAFT, overhead: '10', price: '100' },
      NONE,
      '.',
      'USD',
    )
    expect(r.ok).toBe(false)
  })
  it('chữ trong ô → "không phải số"; dấu phẩy đọc theo sep', () => {
    expect(resolvePlanDraft({ ...EMPTY_PLAN_DRAFT, price: 'abc' }, NONE, '.', 'USD').ok).toBe(false) // prettier-ignore
    const r = resolvePlanDraft({ ...EMPTY_PLAN_DRAFT, price: '83,58' }, NONE, ',', 'USD')
    expect(r).toMatchObject({ ok: true, price: 83.58 })
  })
  it('thiếu FOB → không lưu', () => {
    const r = resolvePlanDraft({ ...EMPTY_PLAN_DRAFT, direct: '10' }, NONE, '.', 'USD')
    expect(r).toMatchObject({ ok: false, reason: 'thiếu giá FOB' })
  })
})

import { describe, expect, it } from 'vitest'
import { parseStampConfig, poPdfName, poStampGuard } from './po-stamp'

const DIEN = 'u-dien'
const cfg = { signer_user_id: DIEN, path: 'company/po-stamp.png' }
const signed = {
  status: 'approved',
  approved_by: DIEN,
  approved_at: '2026-10-06T07:32:00Z',
}

describe('poStampGuard', () => {
  it('đơn Giám đốc tự duyệt, chưa điều chỉnh → đóng dấu', () => {
    expect(poStampGuard(signed, cfg, [])).toEqual({ ok: true })
    // Đã gửi NCC / đang về hàng vẫn đóng dấu — chữ ký không mất khi đơn đi tiếp.
    expect(poStampGuard({ ...signed, status: 'ordered' }, cfg, []).ok).toBe(true)
  })

  it('chưa cài ảnh → không đóng', () => {
    expect(poStampGuard(signed, null, []).ok).toBe(false)
  })

  it('chưa duyệt (nháp, chờ duyệt, gửi gấp chờ ký bù) → không đóng', () => {
    for (const status of ['draft', 'pending_approval', 'ordered']) {
      const g = poStampGuard({ status, approved_by: null, approved_at: null }, cfg, [])
      expect(g.ok).toBe(false)
    }
  })

  it('người khác duyệt → không đóng, nói rõ ai duyệt', () => {
    const g = poStampGuard(
      { ...signed, approved_by: 'u-thao' },
      cfg,
      [],
      'Vũ Phương Thảo',
    )
    expect(g).toEqual({ ok: false, reason: expect.stringContaining('Vũ Phương Thảo') })
  })

  it('đơn huỷ → không đóng dù đã ký', () => {
    expect(poStampGuard({ ...signed, status: 'cancelled' }, cfg, []).ok).toBe(false)
  })

  it('điều chỉnh SAU lúc ký → không đóng; điều chỉnh TRƯỚC lúc ký → vẫn đóng', () => {
    expect(poStampGuard(signed, cfg, [{ created_at: '2026-10-06T08:00:00Z' }]).ok).toBe(
      false,
    )
    expect(poStampGuard(signed, cfg, [{ created_at: '2026-10-05T08:00:00Z' }]).ok).toBe(
      true,
    )
  })
})

describe('parseStampConfig', () => {
  it('chỉ nhận object đủ hai trường', () => {
    expect(parseStampConfig(cfg)).toEqual(cfg)
    expect(parseStampConfig(null)).toBeNull()
    expect(parseStampConfig({ signer_user_id: DIEN })).toBeNull()
    expect(parseStampConfig({ path: 'x', signer_user_id: '' })).toBeNull()
    expect(parseStampConfig([cfg])).toBeNull()
  })
})

describe('poPdfName', () => {
  it('ghép mã + NCC, bỏ ký tự cấm', () => {
    expect(poPdfName('PO-2026-0136', 'Cty TNHH An Khánh / Gia Lai')).toBe(
      'PO-2026-0136_Cty TNHH An Khánh Gia Lai',
    )
    expect(poPdfName('PO-2026-0136', null)).toBe('PO-2026-0136')
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
  apiErrorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import { api } from '@/lib/api'
import { dateEditState, saveSuaTaiCho, suaTaiChoPreflight } from './sua-tai-cho'

const header = {
  expectedAt: '2026-10-05',
  contractNo: ' HĐ 12 ',
  terms: {
    quality: '',
    delivery_place: 'Xưởng',
    payment: 'COD',
    invoice: '',
    lead_time: '',
  },
  signerRole: 'TP Cung ứng',
  note: '',
}

describe('dateEditState — hẹn giao đổi được khi nào trong chế độ Sửa', () => {
  it('đơn đã gửi: mở, và "changed" chỉ khi ngày khác bản đang lưu', () => {
    const po = { status: 'ordered', expected_at: '2026-09-29T00:00:00Z' }
    expect(dateEditState(po, '2026-09-29', true)).toMatchObject({ ok: true, current: '2026-09-29', changed: false }) // prettier-ignore
    expect(dateEditState(po, '2026-10-05', true).changed).toBe(true)
    // Không ở chế độ sửa thì không có gì "đã đổi" dù header lệch.
    expect(dateEditState(po, '2026-10-05', false).changed).toBe(false)
  })

  it('đơn về đủ / chờ duyệt: khoá kèm lý do đọc được, không bao giờ "changed"', () => {
    const d = dateEditState({ status: 'received', expected_at: '2026-09-12' }, '2026-10-01', true) // prettier-ignore
    expect(d.ok).toBe(false)
    expect(d.why).toMatch(/về đủ/)
    expect(d.changed).toBe(false)
    expect(dateEditState({ status: 'pending_approval', expected_at: null }, '2026-10-01', true).why).toMatch(/Sửa đơn/) // prettier-ignore
  })

  it('đơn chưa từng hẹn: current rỗng, chọn ngày là "changed"', () => {
    expect(dateEditState({ status: 'ordered', expected_at: null }, '2026-10-01', true)).toMatchObject({ current: '', changed: true }) // prettier-ignore
  })
})

describe('suaTaiChoPreflight — chặn trước khi gọi server', () => {
  const open = { ok: true, current: '2026-09-29', changed: true }
  it('ghi chú quá dài, hoặc xoá trắng hạn giao → câu chặn', () => {
    expect(suaTaiChoPreflight(12, { ...open, changed: false }, '2026-09-29')).toMatch(
      /12 ký tự/,
    )
    expect(suaTaiChoPreflight(0, open, '')).toMatch(/Hạn giao đang trống/)
  })
  it('bình thường → null', () => {
    expect(suaTaiChoPreflight(0, open, '2026-10-05')).toBeNull()
  })
})

describe('saveSuaTaiCho — lưu theo phần, hỏng giữa chừng nói phần nào đã vào', () => {
  it('ngày đổi: gọi /reschedule TRƯỚC (lý do để trống được) rồi /terms; cắt khoảng trắng', async () => {
    vi.mocked(api).mockResolvedValue({})
    const r = await saveSuaTaiCho(
      'p1',
      header,
      { ok: true, current: '2026-09-29', changed: true },
      '  ',
    )
    expect(r.ok).toBe(true)
    const calls = vi.mocked(api).mock.calls.map((c) => [c[0], c[1]?.method, c[1]?.body])
    expect(calls[0]).toEqual(['/api/dept/supply/pos/p1/reschedule', 'POST', { expected_at: '2026-10-05', reason: '' }]) // prettier-ignore
    expect(calls[1][0]).toBe('/api/dept/supply/pos/p1/terms')
    expect(calls[1][2]).toMatchObject({
      contract_no: 'HĐ 12',
      terms_quality: null,
      terms_payment: 'COD',
    })
    if (r.ok) expect(r.detail).toMatch(/29\/09\/2026 → 05\/10\/2026/)
  })

  it('ngày không đổi: không gọi /reschedule', async () => {
    vi.mocked(api).mockClear().mockResolvedValue({})
    await saveSuaTaiCho(
      'p1',
      header,
      { ok: true, current: '2026-10-05', changed: false },
      '',
    )
    expect(vi.mocked(api).mock.calls.map((c) => c[0])).toEqual([
      '/api/dept/supply/pos/p1/terms',
    ])
  })

  it('dời hẹn xong mà điều khoản hỏng → báo phần đã ghi, phần chưa; dateSaved=true', async () => {
    vi.mocked(api)
      .mockClear()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Ghi chú quá dài'))
    const r = await saveSuaTaiCho(
      'p1',
      header,
      { ok: true, current: '2026-09-29', changed: true },
      'NCC báo trễ',
    )
    expect(r).toMatchObject({ ok: false, dateSaved: true, detail: 'Ghi chú quá dài' })
    if (!r.ok) expect(r.title).toMatch(/Đã ghi hẹn giao — phần còn lại CHƯA lưu/)
  })

  it('điều chỉnh dòng hàng (B3) chạy SAU điều khoản; đợt giao không còn ghi ở đây (07/10/2026)', async () => {
    vi.mocked(api).mockClear().mockResolvedValue({})
    const order: string[] = []
    const adjust = vi.fn(async () => {
      order.push('adjust')
      return { seq: 2, delta_total: -1_500_000 }
    })
    vi.mocked(api).mockImplementation(async (u) => {
      order.push(String(u).replace(/.*\//, ''))
      return {}
    })
    const noDate = { ok: true, current: '', changed: false }
    const r = await saveSuaTaiCho('p1', header, noDate, '', adjust)
    expect(order).toEqual(['terms', 'adjust'])
    if (r.ok) expect(r.detail).toMatch(/điều chỉnh lần 2 \(phát sinh −1\.500\.000\)/)

    vi.mocked(api).mockReset().mockResolvedValue({})
    const failing = vi.fn(async () => { throw new Error('Dòng đã nhận không bớt được') }) // prettier-ignore
    const r2 = await saveSuaTaiCho('p1', header, noDate, '', failing)
    expect(r2).toMatchObject({ ok: false, dateSaved: true })
    if (!r2.ok) expect(r2.title).toMatch(/Đã ghi điều khoản — phần còn lại CHƯA lưu/)
    // Không gọi route đợt giao nào nữa.
    expect(
      vi.mocked(api).mock.calls.some((c) => String(c[0]).includes('shipments')),
    ).toBe(false)
    // Không có thay đổi dòng → không truyền adjust → không gọi.
    vi.mocked(api).mockReset().mockResolvedValue({})
    adjust.mockClear()
    await saveSuaTaiCho('p1', header, noDate, '', null)
    expect(adjust).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { planPoCascade, type CascadePo } from './po-cancel-cascade'

const CODE: Record<string, string> = { L9: '09/26-27 - MX', L10: '10/26-27 - MX' }
const code = (id: string) => CODE[id] ?? id
const po = (p: Partial<CascadePo>): CascadePo => ({
  id: 'p', code: 'PO-1', status: 'approved', production_order_id: 'L9', extra_lsx_ids: [], ...p,
}) // prettier-ignore

describe('planPoCascade — huỷ lệnh thì đơn mua xử lý ra sao', () => {
  it('đơn chỉ của lệnh bị huỷ, chưa gửi NCC → tự huỷ (giữ luật cũ)', () => {
    for (const status of ['pending_approval', 'approved'])
      expect(planPoCascade([po({ status })], 'L9', code)).toEqual([{ id: 'p', code: 'PO-1', action: 'cancel' }]) // prettier-ignore
  })

  it('đơn GỘP, huỷ lệnh CHÍNH → KHÔNG huỷ (còn phần lệnh 10), báo chuyển lệnh chính', () => {
    const [a] = planPoCascade([po({ extra_lsx_ids: ['L10'] })], 'L9', code)
    expect(a.action).toBe('manual')
    expect(a.action === 'manual' && a.why).toContain('gộp cả lệnh 10/26-27 - MX')
    expect(a.action === 'manual' && a.why).toContain(
      'chuyển 10/26-27 - MX lên làm lệnh chính',
    )
  })

  it('đơn GỘP, huỷ lệnh GỘP → vẫn bắt được (bản cũ bỏ sót), báo xử lý tay', () => {
    const [a] = planPoCascade([po({ extra_lsx_ids: ['L10'] })], 'L10', code)
    expect(a.action).toBe('manual')
    expect(a.action === 'manual' && a.why).toContain('giảm phần của lệnh 10/26-27 - MX')
    expect(a.action === 'manual' && a.why).not.toContain('lệnh chính đã huỷ')
  })

  it('đơn gộp đã gửi NCC → nhắc báo NCC', () => {
    const [a] = planPoCascade(
      [po({ status: 'confirmed', extra_lsx_ids: ['L10'] })],
      'L10',
      code,
    )
    expect(a.action === 'manual' && a.why).toContain('báo NCC')
  })

  it('đơn nháp → báo xử lý tay, không bỏ quên', () => {
    expect(planPoCascade([po({ status: 'draft' })], 'L9', code)).toEqual([
      {
        id: 'p',
        code: 'PO-1',
        action: 'manual',
        why: 'đơn nháp — xoá hoặc chuyển sang lệnh khác',
      },
    ])
  })

  it('đơn một lệnh đã gửi NCC → xử lý tay (luật cũ)', () => {
    const [a] = planPoCascade([po({ status: 'partial' })], 'L9', code)
    expect(a.action).toBe('manual')
  })

  it('đơn đã nhận đủ / đã huỷ / không dính lệnh bị huỷ → không đụng', () => {
    expect(
      planPoCascade(
        [
          po({ status: 'received' }),
          po({ status: 'cancelled' }),
          po({ production_order_id: 'L10' }),
        ],
        'L9',
        code,
      ),
    ).toEqual([])
  })
})

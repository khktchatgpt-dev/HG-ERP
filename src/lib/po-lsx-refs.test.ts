import { describe, expect, it } from 'vitest'
import { poLsxRefs, poRevisionLabel } from './po-lsx-refs'

describe('poLsxRefs', () => {
  it('đơn gộp in đủ đơn khách của MỌI lệnh, không chỉ lệnh chính', () => {
    expect(
      poLsxRefs({ code: '09/26-27 - MX', order_codes: ['18056 HG-MX'] }, [
        { code: '10/26-27 - MX', order_codes: ['18064 HG-MX'] },
      ]),
    ).toEqual({
      lsx_code: '09/26-27 - MX + 10/26-27 - MX',
      order_code: '18056 HG-MX + 18064 HG-MX',
    })
  })

  it('lệnh chính không có đơn khách vẫn in đơn của lệnh gộp', () => {
    expect(
      poLsxRefs({ code: '02/26-27 - ROSCO', order_codes: [] }, [
        { code: '09/26-27 - MX', order_codes: ['18056 HG-MX'] },
      ]).order_code,
    ).toBe('18056 HG-MX')
  })

  it('hai lệnh cùng một đơn khách thì in đơn đó một lần', () => {
    expect(
      poLsxRefs({ code: 'A', order_codes: ['X'] }, [{ code: 'B', order_codes: ['X'] }])
        .order_code,
    ).toBe('X')
  })

  it('đơn ngoài lệnh → cả hai dòng null (phiếu không in)', () => {
    expect(poLsxRefs(null, [])).toEqual({ lsx_code: null, order_code: null })
  })
})

describe('poRevisionLabel', () => {
  it('lấy lần điều chỉnh MỚI NHẤT, ngày theo giờ VN', () => {
    expect(
      poRevisionLabel([
        { seq: 1, created_at: '2026-09-20T03:00:00Z' },
        { seq: 2, created_at: '2026-09-25T18:30:00Z' }, // 01:30 sáng 26/09 giờ VN
      ]),
    ).toBe('lần 2 · 26/09/2026')
  })
  it('chưa điều chỉnh → null', () => {
    expect(poRevisionLabel([])).toBeNull()
  })
})

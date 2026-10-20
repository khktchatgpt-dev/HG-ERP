import { describe, expect, it } from 'vitest'
import { compactOrderCodes, poLsxRefs, poRevisionLabel } from './po-lsx-refs'

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

describe('compactOrderCodes — đơn cùng gốc khác ngày giao in một lần (02/10/2026)', () => {
  it('PO-2026-0130: 11 đơn LAURA 01/26-27 g.… → một gốc, ngày xếp theo thời gian', () => {
    const codes = ['30/12/26', '20/01/27', '10/02/27', '03/02/27', '13/01/27'].map(
      (d) => `LAURA 01/26-27 g.${d}`,
    )
    expect(compactOrderCodes(codes)).toEqual([
      'LAURA 01/26-27 g.30/12/26, 13/01/27, 20/01/27, 03/02/27, 10/02/27',
    ])
  })

  it('mã không có đuôi ngày giao giữ nguyên, thứ tự xuất hiện giữ nguyên', () => {
    expect(
      compactOrderCodes([
        '18056 HG-MX',
        'GIGA 01 g.05/01/27',
        '18064 HG-MX',
        'GIGA 01 g.01/01/27',
      ]),
    ).toEqual(['18056 HG-MX', 'GIGA 01 g.01/01/27, 05/01/27', '18064 HG-MX'])
  })

  it('poLsxRefs dùng bản gộp', () => {
    expect(
      poLsxRefs(
        {
          code: '01/26-27 - LAURA',
          order_codes: ['LAURA 01 g.20/01/27', 'LAURA 01 g.30/12/26'],
        },
        [],
      ).order_code,
    ).toBe('LAURA 01 g.30/12/26, 20/01/27')
  })
})

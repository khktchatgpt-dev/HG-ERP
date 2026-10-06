import { describe, expect, it } from 'vitest'
import { poPdfName } from './print-file-name'

describe('poPdfName', () => {
  it('ghép mã + NCC, bỏ ký tự cấm', () => {
    expect(poPdfName('PO-2026-0136', 'Cty TNHH An Khánh / Gia Lai')).toBe(
      'PO-2026-0136_Cty TNHH An Khánh Gia Lai',
    )
    expect(poPdfName('PO-2026-0136', null)).toBe('PO-2026-0136')
  })
})

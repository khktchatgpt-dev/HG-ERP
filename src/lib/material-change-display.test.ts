import { describe, it, expect } from 'vitest'
import { supplierIdsIn, withSupplierNames } from './material-change-display'

const A = '03375374-3786-42f3-85c0-5318a10d5c63'
const B = '9f7a0e36-33df-45c6-a53e-689a14235488'
const rows = [
  { field: 'default_supplier_id', before_value: null, after_value: A },
  { field: 'default_supplier_id', before_value: A, after_value: B },
  { field: 'name', before_value: A, after_value: 'Ốc' },
]

describe('sổ vết vật tư — tên NCC thay UUID', () => {
  it('chỉ gom UUID của cột NCC, không trùng', () => {
    expect(supplierIdsIn(rows).sort()).toEqual([A, B].sort())
  })
  it('dịch cả trước lẫn sau, cột khác giữ nguyên dù trông như UUID', () => {
    const out = withSupplierNames(
      rows,
      new Map([
        [A, 'An Khánh Hưng Mỹ'],
        [B, 'Tiến Đạt'],
      ]),
    )
    expect(out[0]).toMatchObject({ before_value: null, after_value: 'An Khánh Hưng Mỹ' })
    expect(out[1]).toMatchObject({
      before_value: 'An Khánh Hưng Mỹ',
      after_value: 'Tiến Đạt',
    })
    expect(out[2].before_value).toBe(A)
  })
  it('NCC không còn tên thì giữ UUID, không để trống', () => {
    expect(withSupplierNames([rows[0]], new Map())[0].after_value).toBe(A)
  })
})

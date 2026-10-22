import { describe, expect, it } from 'vitest'
import { normalizeSearch, searchTokens } from '@/lib/search-text'
import { supplierOption } from './supplier-option'

/** Cùng phép lọc của Combobox kit: bỏ dấu, AND từng từ trên `label + hint`. */
const tim = (o: { label: string; hint?: string }, q: string) => {
  const hay = normalizeSearch(`${o.label} ${o.hint ?? ''}`)
  return searchTokens(q).every((t) => hay.includes(t))
}

describe('supplierOption — ô chọn NCC tìm được theo tên đầy đủ', () => {
  it('tên ngắn khác tên thật → nhãn gọn, tên thật vào hint nên gõ "hong phat" vẫn ra', () => {
    const o = supplierOption({ id: 's1', code: 'ATP', name: 'CÔNG TY TNHH SX TM & TH Hồng Phát', short_name: 'HP' }) // prettier-ignore
    expect(o.label).toBe('ATP · HP')
    expect(tim(o, 'hong phat')).toBe(true)
    expect(tim(o, 'atp')).toBe(true)
  })

  it('không mã → nhãn là tên đầy đủ, không cần hint; tên ngắn trùng tên thật cũng vậy', () => {
    expect(supplierOption({ id: 's2', code: null, name: 'Phước Khang', short_name: 'PK' })).toEqual({ value: 's2', label: 'Phước Khang' }) // prettier-ignore
    expect(supplierOption({ id: 's3', code: 'TV', name: 'Tân Vinh', short_name: 'Tân Vinh' })).toEqual({ value: 's3', label: 'TV · Tân Vinh' }) // prettier-ignore
    expect(supplierOption({ id: 's4', code: 'TV', name: 'Tân Vinh', short_name: ' ' })).toEqual({ value: 's4', label: 'TV · Tân Vinh' }) // prettier-ignore
  })
})

import { describe, expect, it } from 'vitest'
import { gopLap, type LuotQuet } from './luot'

const l = (...gio: string[]): LuotQuet[] => gio.map((g) => ({ may: '.203', gio: g }))

describe('gopLap', () => {
  it('gộp lượt cách nhau dưới 2 phút, đếm số lượt lặp', () => {
    const r = gopLap(l('11:45:23', '11:45:29', '11:45:31', '06:59:38'))
    expect(r.map((x) => x.gio)).toEqual(['06:59:38', '11:45:23'])
    expect(r[1].lap).toBe(2)
  })
})

import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER } from '@/app/(workspace)/planning/pos/po-filter'
import { PARAM_KEYS, decodeView, encodeView } from './views'

/**
 * KHUNG NHÌN TRÊN URL phải đi TRỌN VÒNG: mã hoá ra rồi giải mã lại phải bằng
 * đúng cái ban đầu, và trang phải NHẬN RA url đó có bộ lọc riêng.
 *
 * Vì sao cần: `hasCustom` ở `page.tsx` từng là mảng tên tham số gõ tay và đã
 * lỗi thời HAI LẦN trong hai ngày (thiếu `lsx`, rồi thiếu `tu`/`den`). Lỗi im
 * lặng: bấm chip thì lọc chạy, nhưng dán link hoặc F5 thì màn rớt về khung
 * nhìn mặc định — đúng thứ khung nhìn-trên-URL sinh ra để tránh.
 */
describe('khung nhìn trên URL — trọn vòng', () => {
  const day = {
    filter: {
      ...EMPTY_FILTER,
      q: 'thép',
      bucket: 'draft' as const,
      supplierId: 'sup-1',
      lsxId: 'lsx-1',
      type: 'lsx' as const,
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      mine: true,
      late: true,
      noEta: true,
    },
    groupBy: 'ncc' as const,
    sortBy: 'ma' as const,
  }

  it('mã hoá rồi giải mã lại ra đúng trạng thái ban đầu', () => {
    const sp = Object.fromEntries(new URLSearchParams(encodeView(day)))
    expect(decodeView(sp)).toEqual(day)
  })

  it('MỌI tham số sinh ra đều nằm trong PARAM_KEYS — nếu không, dán link mất lọc', () => {
    for (const k of new URLSearchParams(encodeView(day)).keys()) {
      expect(PARAM_KEYS.has(k)).toBe(true)
    }
  })

  it('từng bộ lọc RIÊNG LẺ cũng phải được nhận ra', () => {
    const rieng = [
      { ...day, filter: { ...EMPTY_FILTER, lsxId: 'lsx-1' } },
      { ...day, filter: { ...EMPTY_FILTER, fromDate: '2026-09-01' } },
      { ...day, filter: { ...EMPTY_FILTER, toDate: '2026-09-30' } },
      { ...day, filter: { ...EMPTY_FILTER, supplierId: 'sup-1' } },
    ]
    for (const s of rieng) {
      const keys = [...new URLSearchParams(encodeView(s)).keys()]
      expect(keys.some((k) => PARAM_KEYS.has(k))).toBe(true)
    }
  })

  it('ngày rác trên thanh địa chỉ bị bỏ qua, không làm màn trống', () => {
    expect(decodeView({ tu: '01/09/2026' }).filter.fromDate).toBe('')
    expect(decodeView({ den: 'hôm-qua' }).filter.toDate).toBe('')
    expect(decodeView({ tu: '2026-09-01' }).filter.fromDate).toBe('2026-09-01')
  })
})

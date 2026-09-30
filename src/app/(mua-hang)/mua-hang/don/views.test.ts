import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER } from '@/app/(mua-hang)/mua-hang/don/_lib/po-filter'
import {
  ALL_VIEW,
  DEFAULT_VIEW,
  PARAM_KEYS,
  decodeView,
  encodeView,
  sortPos,
} from './views'
import type { Po } from '@/app/(mua-hang)/mua-hang/don/_lib/po-types'

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

describe('rổ mặc định "còn mở" (27/09/2026)', () => {
  it('vào trang mở ở rổ còn mở; "xem tất cả" và link ?mo= mở cả sổ', () => {
    expect(DEFAULT_VIEW.filter.bucket).toBe('open')
    expect(ALL_VIEW.filter.bucket).toBe('all')
    expect(ALL_VIEW.groupBy).toBe(DEFAULT_VIEW.groupBy)
  })

  it('rổ còn mở đi trọn vòng qua URL; trang_thai=all đọc lại được là cả sổ', () => {
    const sp = Object.fromEntries(new URLSearchParams(encodeView(DEFAULT_VIEW)))
    expect(sp.trang_thai).toBe('open')
    expect(decodeView(sp).filter.bucket).toBe('open')
    expect(decodeView({ trang_thai: 'all' }).filter.bucket).toBe('all')
  })
})

describe('bảng phẳng, nháp lên đầu (30/09/2026)', () => {
  const po = (id: string, status: string, created_at: string) =>
    ({ id, code: id, status, created_at }) as unknown as Po

  it('vào trang: không gom, sắp việc cần làm trước; URL mặc định không mang sap', () => {
    expect(DEFAULT_VIEW.groupBy).toBe('none')
    expect(DEFAULT_VIEW.sortBy).toBe('viec')
    const sp = Object.fromEntries(new URLSearchParams(encodeView(DEFAULT_VIEW)))
    expect(sp.sap).toBeUndefined()
    expect(decodeView(sp).sortBy).toBe('viec')
  })

  it('nháp → chờ duyệt → đã duyệt → đang về → về đủ → huỷ; trong bậc mới tạo trước', () => {
    const out = sortPos(
      [
        po('a', 'received', '2026-09-20'),
        po('b', 'ordered', '2026-09-21'),
        po('c', 'draft', '2026-09-01'),
        po('d', 'cancelled', '2026-09-29'),
        po('e', 'draft', '2026-09-15'),
        po('f', 'pending_approval', '2026-09-10'),
        po('g', 'approved', '2026-09-10'),
      ],
      'viec',
    )
    expect(out.map((p) => p.id)).toEqual(['e', 'c', 'f', 'g', 'b', 'a', 'd'])
  })

  it('trạng thái lạ xếp cuối, không chui lên đầu', () => {
    const out = sortPos(
      [po('x', 'weird', '2026-09-30'), po('y', 'received', '2026-01-01')],
      'viec',
    )
    expect(out.map((p) => p.id)).toEqual(['y', 'x'])
  })
})

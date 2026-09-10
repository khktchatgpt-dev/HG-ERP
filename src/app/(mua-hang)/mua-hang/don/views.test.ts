import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER } from '@/app/(workspace)/planning/pos/po-filter'
import type { Po } from '@/app/(workspace)/planning/pos/po-types'
import {
  NAMED_VIEWS,
  decodeView,
  encodeView,
  groupSimple,
  isoWeekLabel,
  matchNamedView,
  sortPos,
} from './views'

const po = (over: Partial<Po>): Po => ({
  id: over.id ?? 'x',
  code: over.code ?? 'PO-1',
  production_order_id: null,
  supplier_id: over.supplier_id ?? 's1',
  status: over.status ?? 'draft',
  currency: over.currency ?? 'VND',
  vat_rate: null,
  price_includes_vat: false,
  expected_at: over.expected_at ?? null,
  terms: null,
  note: null,
  created_at: over.created_at ?? '2026-09-01',
  supplier_name: over.supplier_name ?? 'NCC A',
  lsx_code: null,
  order_code: null,
  total: over.total ?? 0,
  assigned_to: over.assigned_to ?? null,
  assignee_name: over.assignee_name ?? null,
  ...over,
})

describe('khung nhìn đặt sẵn ↔ URL', () => {
  it('mỗi khung nhìn đặt sẵn mã hoá thành đúng ?nhin=<id> và giải mã về chính nó', () => {
    for (const v of NAMED_VIEWS) {
      const qs = encodeView(v.state)
      expect(qs).toBe(`nhin=${v.id}`)
      expect(decodeView(Object.fromEntries(new URLSearchParams(qs)))).toEqual(v.state)
    }
  })

  it('sửa lọc đi thì rớt về dạng đầy đủ, vẫn giải mã lại y nguyên', () => {
    const s = {
      filter: {
        ...EMPTY_FILTER,
        bucket: 'pending' as const,
        supplierId: 'ncc-9',
        q: 'thép',
      },
      groupBy: 'ncc' as const,
      sortBy: 'tien' as const,
    }
    const qs = encodeView(s)
    expect(qs).not.toContain('nhin=')
    expect(qs).toContain('trang_thai=pending')
    expect(qs).toContain('ncc=ncc-9')
    expect(decodeView(Object.fromEntries(new URLSearchParams(qs)))).toEqual(s)
  })

  it('tham số lạ trên URL không làm vỡ — về mặc định', () => {
    const s = decodeView({ trang_thai: 'xyz', gom: 'abc', sap: 'zzz', loai: 'q' })
    expect(s.filter.bucket).toBe('all')
    expect(s.groupBy).toBe('none')
    expect(s.sortBy).toBe('moi_nhat')
    expect(s.filter.type).toBe('all')
  })

  it('matchNamedView không nhận nhầm khi chỉ khác gom nhóm', () => {
    const v = NAMED_VIEWS.find((x) => x.id === 'cho-duyet')!
    expect(matchNamedView(v.state)).toBe('cho-duyet')
    expect(matchNamedView({ ...v.state, groupBy: 'ncc' })).toBeNull()
  })

  it('id khung nhìn không trùng', () => {
    const ids = NAMED_VIEWS.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('sắp xếp', () => {
  it('hẹn gần trước — chưa hẹn dồn cuối', () => {
    const r = sortPos(
      [po({ id: 'a', expected_at: null }), po({ id: 'b', expected_at: '2026-09-20' }), po({ id: 'c', expected_at: '2026-09-10' })], // prettier-ignore
      'hen_gan',
    )
    expect(r.map((p) => p.id)).toEqual(['c', 'b', 'a'])
  })

  it('không đổi mảng gốc', () => {
    const src = [po({ id: 'a', total: 1 }), po({ id: 'b', total: 9 })]
    sortPos(src, 'tien')
    expect(src[0].id).toBe('a')
  })
})

describe('gom nhóm', () => {
  it('theo NCC: tiền cộng theo TỪNG loại tiền, không quy đổi', () => {
    const g = groupSimple(
      [
        po({
          id: '1',
          supplier_id: 's',
          supplier_name: 'S',
          total: 100,
          currency: 'VND',
        }),
        po({ id: '2', supplier_id: 's', supplier_name: 'S', total: 5, currency: 'USD' }),
        po({ id: '3', supplier_id: 's', supplier_name: 'S', total: 999, currency: 'VND', status: 'cancelled' }), // prettier-ignore
      ],
      'ncc',
    )
    expect(g).toHaveLength(1)
    expect(g[0].meta).toBe('3 đơn · 100 VND · 5 USD')
  })

  it('theo trạng thái: xếp theo vòng đời, không theo chữ cái', () => {
    const g = groupSimple(
      [po({ id: '1', status: 'received' }), po({ id: '2', status: 'draft' }), po({ id: '3', status: 'approved' })], // prettier-ignore
      'trang_thai',
    )
    expect(g.map((x) => x.name)).toEqual(['Nháp', 'Đã duyệt', 'Về đủ'])
  })

  it('theo người phụ trách: "Chưa giao ai" xuống cuối', () => {
    const g = groupSimple(
      [po({ id: '1' }), po({ id: '2', assigned_to: 'u', assignee_name: 'An' })],
      'phu_trach',
    )
    expect(g.map((x) => x.name)).toEqual(['An', 'Chưa giao ai'])
  })

  it('theo tuần hẹn giao: đúng tuần ISO, chưa hẹn thành nhóm riêng ở cuối', () => {
    const g = groupSimple(
      [po({ id: '1', expected_at: '2026-09-10' }), po({ id: '2' }), po({ id: '3', expected_at: '2026-09-02' })], // prettier-ignore
      'tuan_hen',
    )
    expect(g.map((x) => x.key)).toEqual(['2026-W36', '2026-W37', '@no_eta'])
  })
})

describe('isoWeekLabel', () => {
  it('10/09/2026 là thứ năm tuần 37, tuần chạy 07/09–13/09', () => {
    expect(isoWeekLabel('2026-09-10')).toEqual({
      key: '2026-W37',
      label: 'Tuần 37 · 07/09–13/09',
    })
  })
  it('đầu năm xếp đúng vào tuần của năm trước khi cần', () => {
    // 01/01/2027 là thứ sáu → thuộc tuần 53 của 2026.
    expect(isoWeekLabel('2027-01-01').key).toBe('2026-W53')
  })
})

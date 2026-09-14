import { describe, expect, it } from 'vitest'
import {
  columnsToShipments,
  lsxJoinedLabel,
  pendingNeeds,
  planColumnsFromShipments,
  planLeft,
  splitLineFields,
  GRID_MAX,
} from './soan-don'
import { PO_FIELDS } from '@/lib/po-fields'
import { PO_TEMPLATES } from '@/lib/po-template'

describe('columnsToShipments', () => {
  it('bỏ cột chưa có ngày hoặc không có số, sắp theo ngày', () => {
    const out = columnsToShipments([
      { date: '2026-09-20', qty: { 0: 100, 1: '' } },
      { date: '', qty: { 0: 50 } },
      { date: '2026-09-10', qty: { 1: 30 } },
      { date: '2026-09-25', qty: { 0: 0 } },
    ])
    expect(out).toEqual([
      { expected_date: '2026-09-10', lines: [{ line_index: 1, qty: 30 }] },
      { expected_date: '2026-09-20', lines: [{ line_index: 0, qty: 100 }] },
    ])
  })
})

describe('planColumnsFromShipments', () => {
  it('đợt đã lưu → cột theo chỉ số dòng, bỏ đợt huỷ và dòng không còn trên đơn', () => {
    const cols = planColumnsFromShipments(
      [
        { status: 'planned', expected_date: '2026-09-10', lines: [{ po_line_id: 'b', qty: 40 }, { po_line_id: 'zzz', qty: 9 }] }, // prettier-ignore
        { status: 'cancelled', expected_date: '2026-09-11', lines: [{ po_line_id: 'a', qty: 1 }] }, // prettier-ignore
      ],
      ['a', 'b', undefined],
    )
    expect(cols).toEqual([{ date: '2026-09-10', qty: { 1: 40 } }])
    expect(planLeft(cols, 1, 100)).toBe(60)
    expect(planLeft(cols, 0, 100)).toBe(100)
  })
})

describe('pendingNeeds', () => {
  it('chỉ nhu cầu còn thiếu và chưa có trên đơn', () => {
    const needs = [
      { material_id: 'a', material_code: 'A', material_name: 'A', unit: 'kg', qty_needed: 10, available: 0, suggest: 10 }, // prettier-ignore
      { material_id: 'b', material_code: 'B', material_name: 'B', unit: 'kg', qty_needed: 10, available: 10, suggest: 0 }, // prettier-ignore
      { material_id: 'c', material_code: 'C', material_name: 'C', unit: 'kg', qty_needed: 5, available: 0, suggest: 5 }, // prettier-ignore
    ]
    expect(pendingNeeds(needs, [{ material_id: 'c' }]).map((n) => n.material_id)).toEqual(
      ['a'],
    )
  })
})

describe('lsxJoinedLabel', () => {
  it('lệnh chính trước, phụ sau; không lệnh chính thì null', () => {
    const lsxs = [
      { id: '1', code: 'LSX-04' },
      { id: '2', code: 'LSX-02' },
    ]
    expect(lsxJoinedLabel('1', ['2'], lsxs)).toBe('LSX-04 + LSX-02')
    expect(lsxJoinedLabel('', ['2'], lsxs)).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   CHIA Ô NHẬP GIỮA LƯỚI VÀ KHAY CHI TIẾT — canh cho MỌI mẫu đơn.

   Vì sao cần: bộ cột phiếu IN đã có test riêng (`po-fields.test.ts`), nhưng
   thứ tự in là DANH SÁCH KHÁC với bộ ô trên FORM. Trước 14/09/2026 phép chia
   này là hai dòng `useMemo` với hằng private trong file màn 2.600 dòng — đổi
   `kind` của một ô, hoặc sửa `GRID_KINDS`, là ô đó biến mất khỏi form mà mọi
   test vẫn xanh. Rà tay 12 mẫu trên trình duyệt hôm đó không thấy mẫu nào
   mất ô; bộ test này giữ nguyên kết quả ấy.
   ══════════════════════════════════════════════════════════════════════════ */
describe('splitLineFields — không mẫu nào mất ô nhập', () => {
  it.each(PO_TEMPLATES)('mẫu %s: lưới + khay = đúng đủ bộ ô đã khai', (t) => {
    const all = PO_FIELDS[t]
    const { grid, detail } = splitLineFields(all)
    // Không mất, không nhân đôi: hợp của hai nhóm đúng bằng tập gốc.
    expect([...grid, ...detail].length).toBe(all.length)
    expect(new Set([...grid, ...detail]).size).toBe(all.length)
    for (const f of all) expect(grid.includes(f) || detail.includes(f)).toBe(true)
  })

  it.each(PO_TEMPLATES)('mẫu %s: lưới không quá 3 ô', (t) => {
    expect(splitLineFields(PO_FIELDS[t]).grid.length).toBeLessThanOrEqual(GRID_MAX)
  })

  it('ô kiểu đặc thù luôn xuống khay, kể cả khi đứng đầu', () => {
    // Mẫu nhôm mở đầu bằng ô Mã khuôn (kind 'die', ngoài GRID_KINDS): nếu nó
    // lọt vào lưới thì ba ô số kg/m · dài cây · SL đơn hàng bị đẩy đi một.
    const { grid, detail } = splitLineFields(PO_FIELDS.aluminium)
    expect(grid.some((f) => f.kind === 'die')).toBe(false)
    expect(detail.some((f) => f.kind === 'die')).toBe(true)
    expect(grid.map((f) => f.key)).toEqual(['kgm', 'barlen', 'demand'])
  })

  it('ô tính sẵn (Tổng kg) vẫn được xếp chỗ, không rơi ra ngoài', () => {
    for (const t of PO_TEMPLATES) {
      const calc = PO_FIELDS[t].filter((f) => f.kind === 'calc')
      const { grid, detail } = splitLineFields(PO_FIELDS[t])
      for (const f of calc) expect(grid.includes(f) || detail.includes(f)).toBe(true)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { approvalLineCols, type ApprovalColLine } from './po-approval-cols'

const line = (x: Record<string, unknown>): ApprovalColLine =>
  ({ material_unit: 'Cái', ...x }) as ApprovalColLine

const labels = (cols: ReturnType<typeof approvalLineCols>) =>
  cols.map((c) => (c.kind === 'fixed' ? c.key : c.label))

describe('approvalLineCols', () => {
  it('phụ kiện: theo thứ tự phiếu in, bỏ cột trống ở mọi dòng, không có @note/@stt', () => {
    // PO-2026-0131 dòng 3: không có quy cách, nhưng dòng 1 có → cột vẫn giữ.
    const cols = approvalLineCols('accessory', [
      line({
        material_grade: 'Nhựa màu đen',
        spec: 'M8',
        qty_demand: 8960,
        dm_per_sp: 4,
      }),
      line({
        material_grade: 'Nhựa màu đen',
        spec: null,
        qty_demand: 4190,
        dm_per_sp: 4,
      }),
    ])
    expect(labels(cols)).toEqual([
      '@name',
      'Vật liệu',
      'Quy cách',
      'SL đơn hàng',
      'Đm/sp',
      '@unit',
      '@qty',
      '@price',
      '@amount',
    ])
    const demand = cols.find((c) => c.kind === 'field' && c.label === 'SL đơn hàng')
    expect(demand?.kind === 'field' && demand.right).toBe(true)
    expect(demand?.kind === 'field' && demand.text(line({ qty_demand: 8960 }))).toBe(
      '8.960',
    )
  })

  it('cột khai báo trống ở MỌI dòng thì không hiện', () => {
    const cols = approvalLineCols('accessory', [line({ material_grade: 'Inox' })])
    expect(labels(cols)).toEqual([
      '@name',
      'Vật liệu',
      '@unit',
      '@qty',
      '@price',
      '@amount',
    ])
  })

  it('nhôm: cột tính (Tổng kg) đọc qty2, căn phải', () => {
    const cols = approvalLineCols('aluminium', [
      line({ die_code: 'HG-01', weight_per_m: 0.45, bar_length_m: 6, qty2: 270 }),
    ])
    const kg = cols.find((c) => c.kind === 'field' && c.label === 'Tổng kg')
    expect(kg?.kind === 'field' && kg.text(line({ qty2: 270 }))).toBe('270')
    expect(kg?.kind === 'field' && kg.right).toBe(true)
  })

  it('carton: lọt lòng ghép ba số D×R×C', () => {
    const cols = approvalLineCols('carton', [
      line({ inner_l_mm: 600, inner_w_mm: 400, inner_h_mm: 1200 }),
    ])
    const inner = cols.find((c) => c.kind === 'field' && c.label.startsWith('Lọt lòng'))
    expect(inner?.kind === 'field' && inner.text(line({ inner_l_mm: 600, inner_w_mm: 400, inner_h_mm: 1200 }))).toBe('600×400×1.200') // prettier-ignore
  })

  it('inox: Kích thước chưa nhập thì lấy tạm quy cách, như phiếu in', () => {
    const cols = approvalLineCols('metal_kg', [line({ spec: 'phi 15.9x1.5' })])
    const dim = cols.find((c) => c.kind === 'field' && c.label === 'Kích thước')
    expect(dim?.kind === 'field' && dim.text(line({ spec: 'phi 15.9x1.5' }))).toBe(
      'phi 15.9x1.5',
    )
  })

  it('mẫu lạ / null rơi về đơn giản', () => {
    expect(labels(approvalLineCols(null, [line({ spec: 'A4' })]))).toEqual([
      '@name',
      'Quy cách',
      '@unit',
      '@qty',
      '@price',
      '@amount',
    ])
  })
})

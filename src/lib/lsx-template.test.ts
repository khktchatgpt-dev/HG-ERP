import { describe, it, expect } from 'vitest'
import {
  LSX_FORM,
  checkColumnsOf,
  colKey,
  hasCbm,
  resolveLsxTemplate,
  specColumnsOf,
} from './lsx-template'

/**
 * MỘT FORM CHUẨN cho mọi khách (chốt 04/08/2026). Test khoá lại hai điều dễ bị
 * phá: trật tự cột của form, và việc khách KHÔNG được đổi bộ cột — chỉ đổi được
 * khối "lưu ý chung" cuối phiếu.
 */
const labels = LSX_FORM.columns.map((c) => c.label)

describe('form phiếu LSX chuẩn', () => {
  it('trật tự cột cố định: định danh → số lượng/khối → vật liệu → giao → kiểm tra', () => {
    expect(labels).toEqual([
      'STT',
      'Đơn hàng',
      'Số PO',
      'Hình ảnh sp',
      'Mã SP',
      'Mã khách',
      'Tên nước ngoài\n(nội dung trên shipping mark)',
      'Tên tiếng việt',
      'Số barcode',
      'ĐVT',
      'Số lượng',
      'CBM',
      'Tổng CBM',
      'Mây',
      'Nệm',
      'Sơn',
      'Kính',
      'Gỗ',
      'Đóng gói',
      'Thời gian xuất',
      'Note',
      'BOM',
      'Bản vẽ',
      'Mẫu',
      'Mẫu tại showroom',
    ])
  })

  it('in CẢ mã HG lẫn mã khách — xưởng và khách gọi SP khác nhau', () => {
    const fields = LSX_FORM.columns
      .filter((c) => c.source.kind === 'line')
      .map((c) => (c.source as { field: string }).field)
    expect(fields).toContain('product_code')
    expect(fields).toContain('customer_item_code')
  })

  it('cột vật liệu gọi là MÂY (đan mây/dây dù), không phải "Máy"', () => {
    const specs = specColumnsOf(LSX_FORM)
    expect(specs.map(colKey)).toEqual(['may', 'nem', 'son', 'kinh', 'go'])
    expect(specs[0].label).toBe('Mây')
    expect(labels).not.toContain('Máy')
  })

  it('nhóm bày bằng CỘT GỘP Ô (đơn hàng / số PO), khép nhóm và khép phiếu bằng dòng cộng', () => {
    expect(LSX_FORM.group_mode).toBe('columns')
    expect(LSX_FORM.stt_mode).toBe('line')
    expect(LSX_FORM.group_total).toBe('cube')
    expect(LSX_FORM.grand_total).toBe('qty')
    const groupCols = LSX_FORM.columns
      .filter((c) => c.source.kind === 'group')
      .map((c) => c.label)
    expect(groupCols).toEqual(['Đơn hàng', 'Số PO'])
  })

  it('checklist hồ sơ nằm dưới một tiêu đề gộp', () => {
    const checks = checkColumnsOf(LSX_FORM)
    expect(checks.map(colKey)).toEqual(['bom', 'ban_ve', 'mau', 'showroom'])
    expect(checks.every((c) => c.band === 'Kiểm tra hồ sơ')).toBe(true)
  })

  it('luôn có cột CBM (kiểm tra đóng đầy container)', () => {
    expect(hasCbm(LSX_FORM)).toBe(true)
  })

  it('tô nổi ĐÚNG chỗ Sales đang bôi trong file Excel', () => {
    const red = LSX_FORM.columns.filter((c) => c.emphasis === 'red').map((c) => c.label)
    // Cả 4 file đều bôi đỏ ba cột này — sai là hỏng lô hàng.
    expect(red).toEqual(['Số PO', 'Số lượng', 'Thời gian xuất'])
    // MERXX bôi vàng nguyên khối kiểm tra hồ sơ.
    const yellow = LSX_FORM.columns.filter((c) => c.emphasis === 'yellow')
    expect(yellow.map((c) => c.label)).toEqual([
      'BOM',
      'Bản vẽ',
      'Mẫu',
      'Mẫu tại showroom',
    ])
    expect(yellow.every((c) => c.band === 'Kiểm tra hồ sơ')).toBe(true)
  })
})

describe('resolveLsxTemplate — khách KHÔNG đổi được bộ cột', () => {
  it('khách chưa khai gì → đúng form chuẩn', () => {
    expect(resolveLsxTemplate(null).columns).toEqual(LSX_FORM.columns)
    expect(resolveLsxTemplate({}).columns).toEqual(LSX_FORM.columns)
  })

  it('khách khai cột riêng (dữ liệu cũ) → BỎ QUA, vẫn ra form chuẩn', () => {
    const t = resolveLsxTemplate({
      preset: 'rosco',
      columns: [{ label: 'Cột lạ', source: { kind: 'stt' } }],
      stt_mode: 'group',
    })
    expect(t.columns).toEqual(LSX_FORM.columns)
    expect(t.stt_mode).toBe('line')
  })

  it('phần RIÊNG duy nhất là khối lưu ý chung cuối phiếu', () => {
    const t = resolveLsxTemplate({ notes_footer: '1/ Bảo hành khung và mây 3 năm.' })
    expect(t.notes_footer).toBe('1/ Bảo hành khung và mây 3 năm.')
    expect(t.columns).toEqual(LSX_FORM.columns)
    expect(resolveLsxTemplate({ notes_footer: '   ' }).notes_footer).toBeNull()
  })
})

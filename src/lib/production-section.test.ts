import { describe, it, expect } from 'vitest'
import {
  componentSection,
  productCodeSection,
  productSection,
} from './production-section'

const mat = (
  material_type: string | null,
  material_name: string | null = null,
  material_code: string | null = null,
) => ({ material_type, material_name, material_code })

describe('componentSection', () => {
  it('đoán từ chữ có dấu lẫn không dấu', () => {
    expect(componentSection(mat('Nhôm định hình'))).toBe('nhom')
    expect(componentSection(mat('nhom'))).toBe('nhom')
    expect(componentSection(mat('Sắt hộp'))).toBe('sat')
    expect(componentSection(mat('Thép ống'))).toBe('sat')
    expect(componentSection(mat(null, 'Ống inox 304'))).toBe('inox')
  })

  it('inox thắng "thép" khi ghi "thép không gỉ"', () => {
    expect(componentSection(mat('Thép không gỉ'))).toBe('inox')
  })

  it('mã vật tư NH-/IX- quyết định trước chữ', () => {
    expect(componentSection(mat(null, null, 'NH-0123'))).toBe('nhom')
    expect(componentSection(mat('Sắt gì đó', null, 'IX-9'))).toBe('inox')
  })

  it('không đoán được → null (đừng bịa)', () => {
    expect(componentSection(mat(null))).toBeNull()
    expect(componentSection(mat('Gỗ tràm'))).toBeNull()
  })
})

describe('productCodeSection', () => {
  it('đuôi vật liệu khung của mã SP', () => {
    expect(productCodeSection('CH0221HG-AL')).toBe('nhom')
    expect(productCodeSection('TB0101HG-IR')).toBe('sat')
    expect(productCodeSection('CH0001HG-IN')).toBe('inox')
    expect(productCodeSection('CH0001HG-WD')).toBe('khac')
    expect(productCodeSection('RHONE-CHAIR')).toBe('khac')
  })
})

describe('productSection', () => {
  it('đa số chi tiết quyết định', () => {
    expect(
      productSection('CH0221HG-AL', [
        mat('Nhôm'),
        mat('Nhôm'),
        mat('Sắt hộp'),
        mat('Gỗ'),
      ]),
    ).toBe('nhom')
  })

  it('không chi tiết nào đoán được → theo mã SP', () => {
    expect(productSection('TB0101HG-IR', [mat('Gỗ'), mat(null)])).toBe('sat')
  })

  it('hoà nhau → mã SP phân xử nếu nằm trong nhóm hoà', () => {
    expect(productSection('CH0221HG-AL', [mat('Nhôm'), mat('Sắt hộp')])).toBe('nhom')
    // Mã không phân xử được (WD) → nhóm đứng trước theo thứ tự sổ (sắt).
    expect(productSection('CH0001HG-WD', [mat('Nhôm'), mat('Sắt hộp')])).toBe('sat')
  })
})

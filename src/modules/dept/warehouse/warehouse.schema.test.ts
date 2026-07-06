import { describe, it, expect } from 'vitest'
import {
  materialCreateSchema,
  materialUpdateSchema,
  materialListQuerySchema,
} from './warehouse.schema'

describe('materialCreateSchema', () => {
  const valid = {
    code: 'VT-001',
    name: 'Ốc vít M6',
    unit: 'con',
    group_name: 'Ngũ kim',
    min_stock: 100,
    shelf_location: 'A-01',
  }

  it('parse OK đầy đủ', () => {
    const p = materialCreateSchema.parse(valid)
    expect(p.code).toBe('VT-001')
    expect(p.min_stock).toBe(100)
  })

  it('ĐVT mặc định "cái" khi bỏ trống', () => {
    const p = materialCreateSchema.parse({ code: 'X', name: 'Tấm gỗ' })
    expect(p.unit).toBe('cái')
  })

  it('min_stock mặc định 0 và ép kiểu từ chuỗi', () => {
    const p = materialCreateSchema.parse({ code: 'X', name: 'Y', min_stock: '5' })
    expect(p.min_stock).toBe(5)
    const p2 = materialCreateSchema.parse({ code: 'X', name: 'Y' })
    expect(p2.min_stock).toBe(0)
  })

  it('reject thiếu mã', () => {
    expect(() => materialCreateSchema.parse({ name: 'Y' })).toThrow()
  })

  it('reject mã rỗng', () => {
    expect(() => materialCreateSchema.parse({ code: '', name: 'Y' })).toThrow()
  })

  it('reject tên rỗng', () => {
    expect(() => materialCreateSchema.parse({ code: 'X', name: '' })).toThrow()
  })

  it('reject min_stock âm', () => {
    expect(() =>
      materialCreateSchema.parse({ code: 'X', name: 'Y', min_stock: -1 }),
    ).toThrow()
  })

  it('trim khoảng trắng ở mã/tên', () => {
    const p = materialCreateSchema.parse({ code: '  VT-9  ', name: '  Sơn  ' })
    expect(p.code).toBe('VT-9')
    expect(p.name).toBe('Sơn')
  })
})

describe('materialUpdateSchema', () => {
  it('partial — cập nhật 1 trường', () => {
    const p = materialUpdateSchema.parse({ shelf_location: 'B-02' })
    expect(p.shelf_location).toBe('B-02')
  })

  it('cho phép is_active', () => {
    const p = materialUpdateSchema.parse({ is_active: false })
    expect(p.is_active).toBe(false)
  })
})

describe('materialListQuerySchema', () => {
  it('mặc định: active_only=false, page=1, page_size=500', () => {
    const p = materialListQuerySchema.parse({})
    expect(p.active_only).toBe(false)
    expect(p.page).toBe(1)
    expect(p.page_size).toBe(500)
  })

  it('ép kiểu page/page_size từ chuỗi (query string)', () => {
    const p = materialListQuerySchema.parse({ page: '3', page_size: '50' })
    expect(p.page).toBe(3)
    expect(p.page_size).toBe(50)
  })

  it('reject page_size vượt 1000', () => {
    expect(() => materialListQuerySchema.parse({ page_size: '5000' })).toThrow()
  })
})

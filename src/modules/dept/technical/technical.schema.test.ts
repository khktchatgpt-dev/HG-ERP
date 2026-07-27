import { describe, it, expect } from 'vitest'
import {
  packingSchema,
  productCreateSchema,
  productUpdateSchema,
  productCloneSchema,
  productListQuerySchema,
} from './technical.schema'

describe('packingSchema', () => {
  it('parse OK đầy đủ + ép kiểu số từ chuỗi (form gửi string)', () => {
    const p = packingSchema.parse({
      l_cm: '75',
      w_cm: 168,
      h_cm: 63,
      carton_l_cm: 77,
      carton_w_cm: 169.5,
      carton_h_cm: 46,
      qty_per_carton: '1',
      loading_40hc: '112',
    })
    expect(p.l_cm).toBe(75)
    expect(p.carton_w_cm).toBe(169.5)
    expect(p.loading_40hc).toBe(112)
  })

  it('mọi field optional — object rỗng hợp lệ', () => {
    expect(packingSchema.parse({})).toEqual({})
  })

  it('từ chối kích thước âm hoặc 0', () => {
    expect(() => packingSchema.parse({ l_cm: -1 })).toThrow()
    expect(() => packingSchema.parse({ qty_per_carton: 0 })).toThrow()
  })

  it('từ chối loading_40hc lẻ (phải nguyên)', () => {
    expect(() => packingSchema.parse({ loading_40hc: 1.5 })).toThrow()
  })

  it('NW/GW per thùng (0037): ép kiểu số, từ chối âm', () => {
    const p = packingSchema.parse({ nw_kg: '12.5', gw_kg: 14 })
    expect(p.nw_kg).toBe(12.5)
    expect(p.gw_kg).toBe(14)
    expect(() => packingSchema.parse({ gw_kg: -1 })).toThrow()
  })
})

describe('productCreateSchema — thông tin XK & đặc tính nội thất (0037)', () => {
  const base = { code: 'SP-1', name: 'Bộ bàn ghế sân vườn' }

  it('parse OK đủ trường: HS code, xuất xứ, chất liệu, tải trọng, lắp ráp, bộ gồm', () => {
    const p = productCreateSchema.parse({
      ...base,
      hs_code: '9401.69.90',
      origin_country: 'Việt Nam',
      material: 'Khung nhôm sơn tĩnh điện + mây nhựa HDPE',
      max_load_kg: '120',
      assembly: 'kd',
      set_contents: '1 bàn + 6 ghế',
    })
    expect(p.max_load_kg).toBe(120) // form gửi string — coerce
    expect(p.assembly).toBe('kd')
  })

  it('assembly ngoài enum → từ chối; tải trọng âm → từ chối', () => {
    expect(() => productCreateSchema.parse({ ...base, assembly: 'flatpack' })).toThrow()
    expect(() => productCreateSchema.parse({ ...base, max_load_kg: -5 })).toThrow()
  })

  it('các trường XK đều optional — SP tối giản vẫn hợp lệ', () => {
    expect(() => productCreateSchema.parse(base)).not.toThrow()
  })
})

describe('productCreateSchema', () => {
  it('parse OK: SP theo khách với mã KH đặt', () => {
    const p = productCreateSchema.parse({
      code: '1705775',
      name: 'Ghế Hali khung sắt, dây dù',
      customer_name: 'Möbel Hali GmbH',
      customer_item_code: 'P334',
      description_en: 'FSC eucalyptus wood with powder-coated aluminium frame',
      unit: 'pcs',
      packing: { l_cm: 75, w_cm: 67, h_cm: 63 },
    })
    expect(p.customer_item_code).toBe('P334')
    expect(p.customer_name).toBe('Möbel Hali GmbH')
    expect(p.packing?.l_cm).toBe(75)
  })

  it('unit mặc định "cai"; customer_name nullable (mẫu chung)', () => {
    const p = productCreateSchema.parse({ code: 'X', name: 'Y', customer_name: null })
    expect(p.unit).toBe('cai')
    expect(p.customer_name).toBeNull()
  })

  // 0091: Kỹ thuật gõ nhãn khách tự do — KHÔNG còn ràng buộc uuid của sales_customers.
  it('customer_name nhận tên bất kỳ, không cần là khách có trong danh mục', () => {
    const p = productCreateSchema.parse({
      code: 'X',
      name: 'Y',
      customer_name: '  Khách lẻ Đà Nẵng  ',
    })
    expect(p.customer_name).toBe('Khách lẻ Đà Nẵng')
  })

  it('KHÔNG nhận bom_status khi tạo (mặc định none từ DB)', () => {
    const p = productCreateSchema.parse({ code: 'X', name: 'Y' })
    expect('bom_status' in p).toBe(false)
  })
})

describe('productUpdateSchema', () => {
  it('đổi cờ BOM đúng giá trị cho phép (FR-ENG-05)', () => {
    expect(productUpdateSchema.parse({ bom_status: 'drawing' }).bom_status).toBe(
      'drawing',
    )
    expect(productUpdateSchema.parse({ bom_status: 'done' }).bom_status).toBe('done')
    expect(() => productUpdateSchema.parse({ bom_status: 'approved' })).toThrow()
  })
})

describe('productCloneSchema', () => {
  it('chỉ cần code mới; name/customer tuỳ chọn', () => {
    const p = productCloneSchema.parse({ code: 'NEW-01' })
    expect(p.code).toBe('NEW-01')
    expect(p.name).toBeUndefined()
  })

  it('từ chối thiếu code', () => {
    expect(() => productCloneSchema.parse({})).toThrow()
  })
})

describe('productListQuerySchema', () => {
  it('lọc theo nhãn khách + cờ BOM (FR-ENG-06)', () => {
    const p = productListQuerySchema.parse({
      customer_name: 'Möbel Hali GmbH',
      bom_status: 'none',
    })
    expect(p.customer_name).toBe('Möbel Hali GmbH')
    expect(p.bom_status).toBe('none')
    expect(p.page).toBe(1)
  })

  it('từ chối bom_status lạ', () => {
    expect(() => productListQuerySchema.parse({ bom_status: 'xxx' })).toThrow()
  })
})

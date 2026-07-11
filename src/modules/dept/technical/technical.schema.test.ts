import { describe, it, expect } from 'vitest'
import {
  packingSchema,
  productCreateSchema,
  productUpdateSchema,
  productCloneSchema,
  bomSaveSchema,
  productListQuerySchema,
} from './technical.schema'

const UUID = '11111111-1111-4111-8111-111111111111'

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
      customer_id: UUID,
      customer_item_code: 'P334',
      description_en: 'FSC eucalyptus wood with powder-coated aluminium frame',
      unit: 'pcs',
      packing: { l_cm: 75, w_cm: 67, h_cm: 63 },
    })
    expect(p.customer_item_code).toBe('P334')
    expect(p.packing?.l_cm).toBe(75)
  })

  it('unit mặc định "cai"; customer_id nullable (mẫu chung)', () => {
    const p = productCreateSchema.parse({ code: 'X', name: 'Y', customer_id: null })
    expect(p.unit).toBe('cai')
    expect(p.customer_id).toBeNull()
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

describe('bomSaveSchema', () => {
  const UUID2 = '22222222-2222-4222-8222-222222222222'

  it('parse OK: nhiều dòng, ép kiểu số từ chuỗi', () => {
    const p = bomSaveSchema.parse({
      lines: [
        { material_id: UUID, qty_per_unit: '4', note: 'chân trước' },
        { material_id: UUID2, qty_per_unit: 0.326 },
      ],
    })
    expect(p.lines[0].qty_per_unit).toBe(4)
    expect(p.lines[1].qty_per_unit).toBe(0.326)
  })

  it('BOM rỗng hợp lệ (xoá hết dòng)', () => {
    expect(bomSaveSchema.parse({ lines: [] }).lines).toEqual([])
  })

  it('từ chối định mức ≤ 0 (logic tồn/mua phụ thuộc số này)', () => {
    expect(() =>
      bomSaveSchema.parse({ lines: [{ material_id: UUID, qty_per_unit: 0 }] }),
    ).toThrow()
    expect(() =>
      bomSaveSchema.parse({ lines: [{ material_id: UUID, qty_per_unit: -1 }] }),
    ).toThrow()
  })

  it('từ chối vật tư trùng dòng (unique product+material ở DB)', () => {
    expect(() =>
      bomSaveSchema.parse({
        lines: [
          { material_id: UUID, qty_per_unit: 1 },
          { material_id: UUID, qty_per_unit: 2 },
        ],
      }),
    ).toThrow()
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
  it('lọc theo khách + cờ BOM (FR-ENG-06)', () => {
    const p = productListQuerySchema.parse({ customer_id: UUID, bom_status: 'none' })
    expect(p.customer_id).toBe(UUID)
    expect(p.bom_status).toBe('none')
    expect(p.page).toBe(1)
  })

  it('từ chối bom_status lạ', () => {
    expect(() => productListQuerySchema.parse({ bom_status: 'xxx' })).toThrow()
  })
})

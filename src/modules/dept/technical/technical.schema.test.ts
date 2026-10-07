import { describe, it, expect } from 'vitest'
import {
  packingSchema,
  productCreateSchema,
  productUpdateSchema,
  productCloneSchema,
  productListQuerySchema,
  productPickQuerySchema,
  productFillSpecsSchema,
  productLockSchema,
  productUnlockSchema,
  productClusterUpdateSchema,
} from './technical.schema'

describe('packingSchema', () => {
  it('parse OK đầy đủ + ép kiểu số từ chuỗi (form gửi string)', () => {
    const p = packingSchema.parse({
      carton_l_cm: 77,
      carton_w_cm: 169.5,
      carton_h_cm: 46,
      qty_per_carton: '1',
      loading_40hc: '112',
    })
    expect(p.carton_w_cm).toBe(169.5)
    expect(p.loading_40hc).toBe(112)
  })

  it('mọi field optional — object rỗng hợp lệ', () => {
    expect(packingSchema.parse({})).toEqual({})
  })

  it('từ chối kích thước âm hoặc 0', () => {
    expect(() => packingSchema.parse({ carton_l_cm: -1 })).toThrow()
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
      packing: { carton_l_cm: 75, carton_w_cm: 67, carton_h_cm: 63 },
    })
    expect(p.customer_item_code).toBe('P334')
    // Nhãn khách VIẾT HOA ngay tại biên — xem `normalizeCustomerLabel`.
    expect(p.customer_name).toBe('MÖBEL HALI GMBH')
    expect(p.packing?.carton_l_cm).toBe(75)
  })

  it('unit mặc định "cái" (cách viết của 799/807 SP); customer_name nullable (mẫu chung)', () => {
    const p = productCreateSchema.parse({ code: 'X', name: 'Y', customer_name: null })
    expect(p.unit).toBe('cái')
    expect(p.customer_name).toBeNull()
  })

  // 0091: Kỹ thuật gõ nhãn khách tự do — KHÔNG còn ràng buộc uuid của sales_customers.
  it('customer_name nhận tên bất kỳ, không cần là khách có trong danh mục', () => {
    const p = productCreateSchema.parse({
      code: 'X',
      name: 'Y',
      customer_name: '  Khách lẻ  Đà Nẵng  ',
    })
    // Gọt khoảng trắng thừa + viết hoa: "Laura" và "LAURA" từng là hai nhóm
    // khác nhau trên màn lọc, chia đôi danh sách của người tìm.
    expect(p.customer_name).toBe('KHÁCH LẺ ĐÀ NẴNG')
  })

  it('nhãn khách chỉ toàn khoảng trắng = mẫu chung (null)', () => {
    const p = productCreateSchema.parse({ code: 'X', name: 'Y', customer_name: '   ' })
    expect(p.customer_name).toBeNull()
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
    // Ô lọc chuẩn hoá y như ô ghi — link cũ '?customer_name=Laura' vẫn ra đúng
    // rổ sau đợt gộp nhãn 21/08/2026.
    expect(p.customer_name).toBe('MÖBEL HALI GMBH')
    expect(p.bom_status).toBe('none')
    expect(p.page).toBe(1)
  })

  it('lọc "mẫu chung" không bị viết hoa thành nhãn khách', () => {
    // '__common' là mã sentinel, không phải tên khách — chuẩn hoá nó là hỏng lọc.
    expect(
      productListQuerySchema.parse({ customer_name: '__common' }).customer_name,
    ).toBe('__common')
  })

  it('từ chối bom_status lạ', () => {
    expect(() => productListQuerySchema.parse({ bom_status: 'xxx' })).toThrow()
  })
})

describe('productPickQuerySchema — ô chọn SP ở báo giá/đơn', () => {
  it('mặc định giới hạn 25 dòng (không cho kéo cả thư viện)', () => {
    expect(productPickQuerySchema.parse({}).limit).toBe(25)
    expect(() => productPickQuerySchema.parse({ limit: 500 })).toThrow()
  })

  it('ids: CSV → mảng, loại uuid rác im lặng', () => {
    const ok = '11111111-1111-1111-1111-111111111111'
    const p = productPickQuerySchema.parse({ ids: `${ok},khong-phai-uuid,${ok}` })
    expect(p.ids).toEqual([ok, ok])
  })

  it('ids rỗng / toàn rác → undefined (rơi về nhánh tìm kiếm)', () => {
    expect(productPickQuerySchema.parse({ ids: '' }).ids).toBeUndefined()
    expect(productPickQuerySchema.parse({ ids: 'a,b,c' }).ids).toBeUndefined()
  })
})

describe('productFillSpecsSchema — Kinh doanh bổ sung quy cách', () => {
  it('nhận packing một phần + ép số từ chuỗi (form gửi string)', () => {
    const p = productFillSpecsSchema.parse({ packing: { qty_per_carton: '2' } })
    expect(p.packing).toEqual({ qty_per_carton: 2 })
  })

  it('KHÔNG cho sửa mã / tên / BOM qua đường này', () => {
    const p = productFillSpecsSchema.parse({
      code: 'HACK-01',
      name: 'Đổi tên',
      bom_status: 'done',
      description_en: 'Alu frame',
    }) as Record<string, unknown>
    expect(p.description_en).toBe('Alu frame')
    expect(p.code).toBeUndefined()
    expect(p.name).toBeUndefined()
    expect(p.bom_status).toBeUndefined()
  })

  it('payload rỗng bị từ chối (không ghi DB vô ích)', () => {
    expect(() => productFillSpecsSchema.parse({})).toThrow()
  })
})

/*
 * KIỂM SOÁT BẢN BOM (0140 — 13/08/2026): Kỹ thuật tự đánh dấu đã kiểm tra,
 * chọn file đang dùng, khoá/mở khoá hồ sơ.
 */
describe('schema kiểm soát bản BOM', () => {
  it('mở khoá BẮT lý do — gỡ bản cả xưởng đang dùng thì phải nói vì sao', () => {
    expect(productUnlockSchema.safeParse({ reason: '' }).success).toBe(false)
    expect(productUnlockSchema.safeParse({ reason: '  ' }).success).toBe(false)
    expect(productUnlockSchema.safeParse({}).success).toBe(false)
    expect(
      productUnlockSchema.parse({ reason: '  Khách đổi quy cách chân bàn  ' }).reason,
    ).toBe('Khách đổi quy cách chân bàn')
  })

  it('khoá thì ghi chú là tuỳ chọn — khoá là việc thường, đừng bắt gõ', () => {
    expect(productLockSchema.safeParse({}).success).toBe(true)
    expect(productLockSchema.parse({ note: ' chốt bản 13/08 ' }).note).toBe(
      'chốt bản 13/08',
    )
  })
})

/**
 * KHAI CỤM (`ProductPartsCard` → PATCH clusters/[clusterId]).
 *
 * Hợp đồng này mới trở thành load-bearing 23/09/2026: `components.service.suggest`
 * đọc đúng ba trường dưới đây để sinh dòng CỤM lúc định hình, và trước đó chưa
 * màn nào gửi chúng đi (đo 22/09: 0/136 cụm có SL, 2/136 có lộ trình). Sai một
 * trường ở biên là tầng cụm im lặng rỗng lại.
 */
describe('productClusterUpdateSchema — ba trường khai cụm', () => {
  it('nhận đúng payload của hộp khai, ép số từ chuỗi (form gửi string)', () => {
    const p = productClusterUpdateSchema.parse({
      qty_per_product: '2',
      first_stage: 'han',
      final_stage: 'son',
    })
    expect(p.qty_per_product).toBe(2)
    expect(p.first_stage).toBe('han')
    expect(p.final_stage).toBe('son')
  })

  it('null là hợp lệ — bỏ trống nghĩa là "suy theo nhóm vật tư", không phải lỗi', () => {
    const p = productClusterUpdateSchema.parse({
      qty_per_product: null,
      first_stage: null,
      final_stage: null,
    })
    expect(p.qty_per_product).toBeNull()
    expect(p.first_stage).toBeNull()
  })

  it('SL cụm/SP phải dương — 0 hay âm là số vô nghĩa, chặn ở biên', () => {
    expect(productClusterUpdateSchema.safeParse({ qty_per_product: 0 }).success).toBe(
      false,
    )
    expect(productClusterUpdateSchema.safeParse({ qty_per_product: -1 }).success).toBe(
      false,
    )
  })

  it('partial — đổi tên không kéo theo hai trường kia', () => {
    expect(productClusterUpdateSchema.safeParse({ name: 'Cụm chân trước' }).success).toBe(
      true,
    )
  })
})

describe('productUpdateSchema — sửa một phần không đụng ô khác (07/10/2026)', () => {
  it('PATCH chỉ có packing / ảnh KHÔNG chèn unit mặc định', () => {
    expect(
      productUpdateSchema.parse({ packing: { qty_per_carton: 2 } }),
    ).not.toHaveProperty('unit')
    expect(productUpdateSchema.parse({ image_file_id: null })).not.toHaveProperty('unit')
  })
  it('giữ đủ khoá thông số + KL cân thực tế của trang chi tiết', () => {
    const p = productUpdateSchema.parse({
      tech_spec: {
        paint: 'RAL 7016',
        fabric: 'Olefin',
        hardware: 'Inox 304',
        finish: 'Matt',
      },
      actual_weight_kg: 12.5,
    })
    expect(p.tech_spec).toEqual({
      paint: 'RAL 7016',
      fabric: 'Olefin',
      hardware: 'Inox 304',
      finish: 'Matt',
    })
    expect(p.actual_weight_kg).toBe(12.5)
  })
})

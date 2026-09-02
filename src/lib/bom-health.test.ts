import { describe, expect, it } from 'vitest'
import { calcPartDerived } from './bom-calc'
import {
  classifyPart,
  isHollowWithoutWall,
  summarizeProduct,
  KG_DEVIATION_LIMIT,
  type HealthPart,
} from './bom-health'

/**
 * Dòng khung mẫu, ĐỦ số và sạch — mỗi test chỉ đổi đúng thứ nó đang xét.
 * Số lấy từ ca thật trong `bom-derived-fix.mjs`: hộp 25×50, δ=1, dài 675, SL 2.
 */
const base = (over: Partial<HealthPart> = {}): HealthPart => {
  const p: HealthPart = {
    profile_shape: 'HOP',
    material_kind: 'IR', // mã hệ vật liệu của app là IR (sắt), không phải chữ thường
    dim_a_mm: 25,
    dim_b_mm: 50,
    wall_thickness_mm: 1,
    cut_length_mm: 675,
    qty: 2,
    ...over,
  }
  return p
}

/** Dựng dòng sạch bằng chính máy tính của app — khỏi gõ tay số dẫn xuất. */
const clean = (over: Partial<HealthPart> = {}): HealthPart => {
  const p = base(over)
  return { ...p, ...calcPartDerived(p) }
}

describe('isHollowWithoutWall', () => {
  it('bắt hộp/tròn/vuông không khai δ', () => {
    for (const shape of ['HOP', 'TRON', 'VUONG']) {
      expect(isHollowWithoutWall({ profile_shape: shape, wall_thickness_mm: null })).toBe(
        true,
      )
    }
  })

  it('có δ thì không phải lỗi', () => {
    expect(isHollowWithoutWall({ profile_shape: 'HOP', wall_thickness_mm: 1 })).toBe(
      false,
    )
  })

  it('dạng ĐẶC thiếu δ không phải lỗi — nó vốn không có thành', () => {
    expect(isHollowWithoutWall({ profile_shape: 'DAC', wall_thickness_mm: null })).toBe(
      false,
    )
  })
})

describe('classifyPart', () => {
  it('dòng đủ số là dòng sạch', () => {
    expect(classifyPart(clean())).toEqual([])
  })

  it('thiếu SL → chỉ báo thieu_sl, KHÔNG kèm thieu_dan_xuat', () => {
    // Thiếu SL thì mọi ô dẫn xuất đều không tính được; báo thêm chỉ là nhiễu,
    // người sửa vẫn chỉ cần điền đúng một ô.
    expect(classifyPart(base({ qty: null }))).toEqual(['thieu_sl'])
  })

  it('ống rỗng thiếu δ → thieu_delta', () => {
    expect(classifyPart(clean({ wall_thickness_mm: null }))).toContain('thieu_delta')
  })

  it('ống thiếu δ thì KHÔNG đòi điền kg — số hình học ở đó mới là số sai', () => {
    // Dựng từ dòng SẠCH rồi mới bỏ δ + kg: các ô dẫn xuất khác đã đầy, nên
    // nếu còn báo thieu_dan_xuat thì đúng là đang đòi ô kg.
    const p = { ...clean(), wall_thickness_mm: null, weight_kg: null }
    const issues = classifyPart(p)
    expect(issues).toContain('thieu_delta')
    expect(issues).not.toContain('thieu_dan_xuat')
  })

  it('ống thiếu δ thì KHÔNG đem kg ra so lệch', () => {
    // kg đặc của hộp 25×50 gấp ~8,6 lần kg thật — nếu đem so sẽ báo lech_kg oan.
    const p = base({ wall_thickness_mm: null, weight_kg: 0.525 })
    expect(classifyPart(p)).not.toContain('lech_kg')
  })

  it('ô dẫn xuất trống mà tính được → thieu_dan_xuat', () => {
    expect(classifyPart(base())).toContain('thieu_dan_xuat')
  })

  it('ô tính KHÔNG ra thì không tính là nợ', () => {
    // Ngũ kim: không hình học, chỉ có SL. Không được đòi kg/m³ của nó.
    expect(classifyPart({ part_name: 'Ốc vít', qty: 100 } as HealthPart)).toEqual([])
  })

  it('kg nhập lệch quá ngưỡng → lech_kg', () => {
    const c = clean()
    const off = (c.weight_kg ?? 0) * (1 + KG_DEVIATION_LIMIT * 2)
    expect(classifyPart({ ...c, weight_kg: off })).toContain('lech_kg')
  })

  it('lệch DƯỚI ngưỡng thì bỏ qua — sai số bo mép không phải lỗi', () => {
    const c = clean()
    const off = (c.weight_kg ?? 0) * (1 + KG_DEVIATION_LIMIT / 2)
    expect(classifyPart({ ...c, weight_kg: off })).not.toContain('lech_kg')
  })
})

describe('summarizeProduct', () => {
  it('hồ sơ chưa có BOM được điểm 0, không phải 100', () => {
    // Chốt có chủ đích: "chưa nhập gì" là trạng thái TỆ NHẤT để đi mua hàng.
    // Cho 100 thì nó tụt xuống cuối danh sách cần làm — đúng chỗ không ai nhìn.
    expect(summarizeProduct([])).toMatchObject({ parts: 0, dirtyParts: 0, score: 0 })
  })

  it('mọi dòng sạch → 100', () => {
    expect(summarizeProduct([clean(), clean()]).score).toBe(100)
  })

  it('điểm theo tỉ lệ dòng SẠCH', () => {
    const s = summarizeProduct([clean(), clean(), clean(), base({ qty: null })])
    expect(s).toMatchObject({ parts: 4, dirtyParts: 1, score: 75 })
  })

  it('một dòng nhiều lỗi chỉ tính MỘT dòng bẩn, nhưng góp vào từng ô đếm', () => {
    const p = base({ wall_thickness_mm: null, qty: null })
    const s = summarizeProduct([p])
    expect(s.dirtyParts).toBe(1)
    expect(s.counts.thieu_sl).toBe(1)
    expect(s.counts.thieu_delta).toBe(1)
  })
})

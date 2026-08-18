import { describe, expect, it } from 'vitest'
import {
  fieldsClearedByPayload,
  groupFieldConfig,
  quickReviewFields,
} from './material-group-fields'

/*
 * Cấu hình bộ-trường-theo-nhóm (0137) — tên nhóm lấy đúng 14 nhóm thật trong
 * danh mục. Khớp theo từ khoá không dấu: tên nhóm dài, một ký tự lệch không
 * được làm rơi cả khối ô.
 */
describe('groupFieldConfig — mỗi loại vật tư một bộ ô', () => {
  it('bao bì: hỏi cách mở + pcs/thùng, quy cách gợi ý lọt lòng', () => {
    const c = groupFieldConfig('Bao bì - đóng gói - tem nhãn')
    expect(c.showCarton).toBe(true)
    expect(c.showFinish).toBe(false)
    expect(c.specPlaceholder).toContain('lọt lòng')
  })

  it('kim loại: hỏi màu/bề mặt', () => {
    const c = groupFieldConfig('Sắt thép - inox - nhôm - tôn')
    expect(c.showFinish).toBe(true)
    expect(c.showCarton).toBe(false)
  })

  it('kính / xốp: gợi ý quy cách D×R×dày để form đơn tự bóc', () => {
    expect(groupFieldConfig('Gỗ - kính - nhựa tấm').specPlaceholder).toContain('D×R×dày')
    expect(groupFieldConfig('Mút - xốp - nệm - gòn').specPlaceholder).toContain('D×R×dày')
  })

  it('sơn/hoá chất: vật liệu gợi ý MÃ MÀU NCC; mây: định mức g/5m', () => {
    expect(groupFieldConfig('Sơn - dầu - keo - hoá chất').gradePlaceholder).toContain(
      'Mã màu',
    )
    expect(groupFieldConfig('Vải - mây - chỉ - sợi').gradePlaceholder).toContain(
      'Định mức',
    )
  })

  it('nhóm lạ / chưa chọn → bộ mặc định, không ô thừa', () => {
    for (const g of [null, '', 'Phụ kiện nội thất', 'Điện - chiếu sáng - điều khiển']) {
      const c = groupFieldConfig(g)
      expect(c.showCarton).toBe(false)
      expect(c.showFinish).toBe(false)
    }
  })
})

/*
 * Đợt 2 cải thiện vật tư (13/08/2026) — hai helper thuần của form khai.
 */
describe('fieldsClearedByPayload — cảnh báo trước khi null đè', () => {
  const saved = {
    kg_per_m: 0.248,
    default_bar_length_m: 6,
    open_style: null,
    finish: 'inox bóng',
    spec: '25×50×1.2mm',
    pcs_per_ctn: null,
  }

  it('đổi nhóm kim loại → bao bì: liệt kê đúng barem + bề mặt sắp mất', () => {
    // corePayload của nhóm bao bì ghi null cho kg/m, dài cây, finish.
    const cleared = fieldsClearedByPayload(saved, {
      kg_per_m: null,
      default_bar_length_m: null,
      finish: null,
      open_style: 'AD',
      spec: '900x605x115',
    })
    expect(cleared.map((c) => c.field)).toEqual([
      'kg_per_m',
      'default_bar_length_m',
      'finish',
    ])
    // Giá trị cũ đi kèm để người dùng biết mình sắp mất gì.
    expect(cleared[0]).toMatchObject({ label: 'kg/m', oldValue: '0.248' })
  })

  it('đổi GIÁ TRỊ không cảnh báo — chỉ soi chiều có-giá-trị → null', () => {
    expect(fieldsClearedByPayload(saved, { kg_per_m: 0.25, finish: 'xi trắng' })).toEqual(
      [],
    )
  })

  it('trường vốn đã trống thì null đè không tính là mất', () => {
    expect(
      fieldsClearedByPayload(saved, { open_style: null, pcs_per_ctn: null }),
    ).toEqual([])
  })

  it('trường ngoài danh sách nhãn (name, unit…) không bao giờ vào cảnh báo', () => {
    expect(fieldsClearedByPayload({ name: 'Vít 4x20' }, { name: null })).toEqual([])
  })
})

describe('quickReviewFields — khai vội thiếu gì thì Kho rà đúng chỗ đó', () => {
  const full = {
    spec: '25×50×1li',
    sub_group: 'Vít',
    material_grade: 'Sắt xi trắng',
    kg_per_m: '',
    kg_per_unit: '',
    open_style: '',
    pcs_per_ctn: '',
    finish: '',
  }
  const NO_WEIGHT = {
    groupCfg: groupFieldConfig('Phụ kiện nội thất'),
    needsBarWeight: false,
    needsSheetWeight: false,
    derivedKg: null,
  }

  it('khai đủ theo nhóm thường → không có gì phải rà', () => {
    expect(quickReviewFields(full, NO_WEIGHT)).toEqual([])
  })

  it('bỏ trống quy cách + vật liệu → chấm đúng hai trường', () => {
    expect(
      quickReviewFields({ ...full, spec: '', material_grade: '' }, NO_WEIGHT),
    ).toEqual(['spec', 'material_grade'])
  })

  it('hàng cây cần barem: kg/m trống VÀ máy không đọc được mới tính là thiếu', () => {
    const ctx = { ...NO_WEIGHT, needsBarWeight: true }
    expect(quickReviewFields(full, ctx)).toContain('kg_per_m')
    expect(quickReviewFields(full, { ...ctx, derivedKg: 0.248 })).not.toContain(
      'kg_per_m',
    )
  })

  it('bao bì: cách mở + pcs/thùng trống là phải rà; kim loại: bề mặt', () => {
    const carton = {
      ...NO_WEIGHT,
      groupCfg: groupFieldConfig('Bao bì - đóng gói - tem nhãn'),
    }
    expect(quickReviewFields(full, carton)).toEqual(
      expect.arrayContaining(['open_style', 'pcs_per_ctn']),
    )
    const metal = {
      ...NO_WEIGHT,
      groupCfg: groupFieldConfig('Sắt thép - inox - nhôm - tôn'),
    }
    expect(quickReviewFields(full, metal)).toContain('finish')
  })
})

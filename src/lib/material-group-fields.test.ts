import { describe, expect, it } from 'vitest'
import { groupFieldConfig } from './material-group-fields'

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

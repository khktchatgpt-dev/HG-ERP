import { describe, expect, it } from 'vitest'
import { viTriLapRap } from './lsx-bang-ke'

/**
 * Cột "Vị trí lắp ráp" chỉ đáng bày khi nó nói thêm được gì. Test canh đúng ba
 * ca đã gặp trên dữ liệu thật (07/09/2026) — hỏng cái này thì cột biến thành
 * bản sao của cột tên vật tư mà không ai báo lỗi.
 */
describe('viTriLapRap', () => {
  it('bỏ tên chi tiết chỉ chép lại tên vật tư, kể cả lệch dấu cách/hoa thường', () => {
    expect(
      viTriLapRap({ material_name: 'Túi vải', positions: ['Túi vải', 'túi vải'] }),
    ).toEqual([])
    expect(
      viTriLapRap({ material_name: 'Vít dù  4x18 7M', positions: ['Vít dù 4x18 7M'] }),
    ).toEqual([])
  })

  it('giữ vị trí thật và bỏ trùng, giữ nguyên thứ tự gặp', () => {
    expect(
      viTriLapRap({
        material_name: 'Nhôm hộp 20x40x1li',
        positions: ['Diềm ngắn', 'Diềm  ngắn', 'Giang mặt cánh'],
      }),
    ).toEqual(['Diềm ngắn', 'Giang mặt cánh'])
  })

  it('không có gì thì trả mảng rỗng, không nổ', () => {
    expect(viTriLapRap({ material_name: 'X' })).toEqual([])
    expect(viTriLapRap({ material_name: 'X', positions: ['', '  '] })).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { dangO, dongTrong, tongDuKien, vuongGuiDuyet } from './de-nghi'

/** Dòng theo tờ giấy 13/10 của Kho vật tư (rút gọn). */
const d = (p: Partial<Parameters<typeof vuongGuiDuyet>[0][number]> = {}) => ({
  material_id: 'm1',
  name: 'Băng keo trong 4F7',
  unit: 'Cuộn',
  qty: 200 as number | null,
  ...p,
})

describe('vuongGuiDuyet', () => {
  it('đủ tên + ĐVT + SL → gửi được; dòng chưa có mã (gõ tên tự do) vẫn gửi được', () => {
    expect(vuongGuiDuyet([d(), d({ material_id: null, name: 'Giẻ lau', unit: 'Kg', qty: 20 })])).toEqual([]) // prettier-ignore
  })

  it('phiếu rỗng / toàn dòng trống → một câu cho cả phiếu', () => {
    expect(vuongGuiDuyet([])).toEqual([
      { dong: null, cau: 'Phiếu chưa có dòng vật tư nào' },
    ])
    expect(vuongGuiDuyet([d({ material_id: null, name: '', qty: null })])).toHaveLength(1)
  })

  it('chỉ đúng dòng vướng, kèm tên để nhảy tới', () => {
    expect(
      vuongGuiDuyet([
        d(),
        d({ name: 'Que hàn', qty: 0 }),
        d({ name: 'Túi nilon', unit: ' ' }),
      ]),
    ).toEqual([
      // prettier-ignore
      { dong: 1, cau: 'Dòng 2 (Que hàn) chưa có số lượng' },
      { dong: 2, cau: 'Dòng 3 (Túi nilon) thiếu đơn vị tính' },
    ])
  })
})

describe('tongDuKien', () => {
  it('cộng SL × giá, đếm dòng chưa có giá, bỏ dòng SL 0', () => {
    expect(
      tongDuKien([
        { qty: 200, unit_price: 5500 },
        { qty: 10, unit_price: null },
        { qty: 0, unit_price: 9000 },
        { qty: 2.5, unit_price: 25000 },
      ]),
    ).toEqual({ tong: 1_162_500, thieuGia: 1 })
  })
})

describe('dangO + dongTrong', () => {
  it('ai giữ phiếu ở từng trạng thái', () => {
    expect(dangO('pending')).toBe('Lãnh đạo (chờ duyệt)')
    expect(dangO('draft', true)).toMatch(/từ chối/)
    expect(dangO('approved')).toMatch(/Cung ứng/)
  })
  it('dòng trống = chưa mã, chưa tên, chưa SL', () => {
    expect(dongTrong({ material_id: null, name: ' ', qty: null })).toBe(true)
    expect(dongTrong({ material_id: null, name: 'Giẻ lau', qty: null })).toBe(false)
  })
})

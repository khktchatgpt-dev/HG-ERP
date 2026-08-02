import { describe, it, expect } from 'vitest'
import { kgPerM, kgPerOrderUnit, rhoFor, RHO } from './metal-weight'

/*
 * Số đối chiếu lấy từ BAREM XƯỞNG đang dùng (sheet `WeightList`,
 * `Data/QC BÀN 150 NAN POLYWOOD.xlsx`), không bịa — sửa công thức mà ba case
 * mốc dưới đây lệch thì barem trên đơn đặt đã khác barem xưởng cân.
 */
describe('kgPerM — khớp barem xưởng', () => {
  it.each([
    ['Sắt vuông 30x30x0.8', 0.7445],
    ['Sắt vuông 25x25x0.8', 0.617],
    ['Sắt la 40x1', 0.3187],
  ])('%s → %s kg/m', (name, expected) => {
    expect(kgPerM(name, RHO.sat).kg).toBeCloseTo(expected, 4)
  })

  it('nhôm la 22x2 → 0,121 kg/m, khớp bảng khuôn trong sai số tỷ trọng', () => {
    /*
     * Bảng khuôn gốc ghi "0,714/ 6 mét" → 0,119 kg/m, và docs/po-templates.md
     * đối chiếu bằng 2,7 g/cm³. Ở đây RHO.nhom = 2750 (tỷ trọng xưởng khai
     * trong sheet WeightList) nên ra 0,121 — lệch 1,7%, trong sai số của chính
     * hợp kim. Giữ 2750 cho thống nhất với sắt/inox; ai cần con số chính xác
     * của một khuôn cụ thể thì tra `technical_dies`, đừng suy từ tên.
     */
    expect(kgPerM('La nhôm 22x2', RHO.nhom).kg).toBeCloseTo(0.121, 3)
  })
})

describe('kgPerM — đọc được các kiểu ghi độ dày', () => {
  it('"li" là độ dày', () => {
    expect(kgPerM('Sắt hộp 20x40 dày 1li', RHO.sat).kg).toBeGreaterThan(0)
  })

  it('số nhỏ cuối tên là độ dày dù không ghi "li"', () => {
    // "Hộp 25x50x1" — bỏ qua kiểu này thì mất gần nửa danh mục.
    expect(kgPerM('Sắt hộp 25x50x1', RHO.sat).kg).toBeGreaterThan(0)
  })

  it('vuông chỉ ghi MỘT cạnh vẫn tính được', () => {
    const one = kgPerM('Sắt vuông 30x0.8', RHO.sat).kg
    const two = kgPerM('Sắt vuông 30x30x0.8', RHO.sat).kg
    expect(one).toBeCloseTo(two!, 4)
  })

  it('DẤU PHẨY THẬP PHÂN không bị đọc thành dấu tách', () => {
    // "50x100x1,8li" đọc dày 8 thay vì 1,8 là sai gần 7 lần khối lượng.
    const phay = kgPerM('Sắt hộp 50x100x1,8li', RHO.sat).kg
    const cham = kgPerM('Sắt hộp 50x100x1.8li', RHO.sat).kg
    expect(phay).toBeCloseTo(cham!, 4)
    expect(phay!).toBeLessThan(5)
  })
})

describe('kgPerM — THÀ BỎ QUA CÒN HƠN ĐOÁN', () => {
  it.each([
    ['Sắt hộp 20x40', 'thiếu độ dày'],
    ['Tole 3li - Inox 304', 'hàng tấm/cuộn — không tính theo mét'],
    ['Lưới B40 khổ 1m8', 'hàng tấm/cuộn — không tính theo mét'],
    ['Bản lề inox 3 tấc', 'không nhận ra hình dạng'],
  ])('%s → null (%s)', (name, reason) => {
    const r = kgPerM(name, RHO.sat)
    expect(r.kg).toBeNull()
    expect(r.reason).toBe(reason)
  })
})

describe('rhoFor — tin TÊN trước, nhóm sau', () => {
  it('tên nói nhôm thì lấy tỷ trọng nhôm dù nhóm ghi Sắt', () => {
    // Danh mục có mã xếp sai nhóm; tính nhôm bằng tỷ trọng sắt là sai gần 3 lần.
    expect(rhoFor('La nhôm 22x2', 'Sắt')).toBe(RHO.nhom)
  })

  it('tên trung tính thì theo nhóm', () => {
    expect(rhoFor('Hộp 20x40x1', 'Inox')).toBe(RHO.inox)
    expect(rhoFor('Hộp 20x40x1', 'Sắt')).toBe(RHO.sat)
  })

  it('không rõ gì thì mặc định sắt', () => {
    expect(rhoFor('Hộp 20x40x1', null)).toBe(RHO.sat)
  })
})

/*
 * kg/m (barem theo mét) KHÁC kg/đơn-vị-đặt (theo cây). Inox Kim Vĩnh Phú trên
 * đơn thật là 9,325 kg/cây — điền thẳng kg/m vào ô đó là đơn hụt 6 lần.
 */
describe('kgPerOrderUnit — chỉ quy đổi khi biết chắc', () => {
  it('ĐVT mét → chính là kg/m', () => {
    expect(kgPerOrderUnit(1.5542, 'm', null)).toBeCloseTo(1.5542, 4)
  })

  it('ĐVT cây + đã khai dài cây → nhân ra kg/cây', () => {
    expect(kgPerOrderUnit(1.5542, 'cây', 6)).toBeCloseTo(9.3252, 4)
  })

  it('ĐVT cây mà CHƯA khai dài cây → null, không mặc định 6m', () => {
    expect(kgPerOrderUnit(1.5542, 'cây', null)).toBeNull()
  })

  it('chưa có barem → null', () => {
    expect(kgPerOrderUnit(null, 'cây', 6)).toBeNull()
    expect(kgPerOrderUnit(0, 'cây', 6)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { kgPerM, kgPerOrderUnit, kgPerUnitOf, rhoFor, RHO } from './metal-weight'

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
    // "tam giác" KHÔNG phải "tấm" — bỏ dấu xong hai chữ trùng nhau, nên trước
    // 10/08/2026 cái pát này bị báo là hàng tấm/cuộn ngay trên form đặt hàng.
    ['Pát tam giác inox 304 chân sau Lucca', 'không nhận ra hình dạng'],
  ])('%s → null (%s)', (name, reason) => {
    const r = kgPerM(name, RHO.sat)
    expect(r.kg).toBeNull()
    expect(r.reason).toBe(reason)
  })

  it.each([
    // Mác thép đứng TRƯỚC tiết diện trong tên — số đầu tiên không phải cạnh.
    ['Hộp inox sus 304 25x50x1.2', RHO.inox, 1.3817],
    ['Inox 201 phi 25x1', RHO.inox, 0.5978],
    ['La inox 304 40x3', RHO.inox, 0.9516],
  ])('%s: bỏ qua mác thép, đọc đúng tiết diện', (name, rho, expected) => {
    // Hồi quy 10/08/2026: "hộp inox sus 304 25x50x1.2" từng ra 6,216 kg/m vì
    // lấy (304, 25) làm hai cạnh — sai 4,5 lần, và số này nhân với đơn giá/kg
    // rồi đi thẳng lên bàn duyệt Giám đốc.
    expect(kgPerM(name, rho).kg).toBeCloseTo(expected, 3)
  })

  it('vẫn nhận đúng hàng tấm khi tên gõ THIẾU DẤU', () => {
    // Sót một tấm thật thì `kgPerM` đi tính như thanh đặc và đọc "304" thành
    // chiều rộng — 7,3 kg/m cho một tấm tole. Nhận nhầm nguy hiểm hơn bỏ sót.
    expect(kgPerM('Inox tam 304 kho 1220x2440', RHO.inox).reason).toBe(
      'hàng tấm/cuộn — không tính theo mét',
    )
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

  it('ĐVT KG → 1, dù vật tư có khai kg/m và dài cây', () => {
    /*
     * Hồi quy 10/08/2026. "Nhôm la 5x50" (NHO0129) bán theo KG nhưng danh mục
     * vẫn khai kg/m 0,6773 + dài cây 6m, nên nhánh cũ trả 4,0638: đặt 100 kg
     * thì thành tiền tính trên 406 kg. SL đặt đã là kg thì không nhân gì nữa.
     */
    expect(kgPerOrderUnit(0.6773, 'Kg', 6)).toBe(1)
    expect(kgPerOrderUnit(0.6773, 'kg', null)).toBe(1)
  })

  it('chưa có barem → null', () => {
    expect(kgPerOrderUnit(null, 'cây', 6)).toBeNull()
    expect(kgPerOrderUnit(0, 'cây', 6)).toBeNull()
  })
})

/*
 * BA NGUỒN kg/ĐƠN-VỊ. Danh mục có sẵn cặp `price_unit` + `unit2_factor` (giá đơn
 * vị kép, 0053) từ lâu nhưng form đặt hàng không đọc — 82 mã khai đủ ở danh mục
 * vẫn ra ô trống và người mua gõ lại. Nối vào từ 10/08/2026.
 */
describe('kgPerUnitOf — chọn nguồn theo độ tin', () => {
  const cay = { unit: 'cây', kg_per_m: 1.5542, default_bar_length_m: 6 }

  it('cân thật ở danh mục thắng tất cả', () => {
    const r = kgPerUnitOf({ ...cay, kg_per_unit: 9.41, price_unit: 'kg', unit2_factor: 8.2 })
    expect(r.kg).toBe(9.41)
    expect(r.source).toBe('cân thật')
    // Vẫn trả barem kèm để form đối chiếu.
    expect(r.barem).toBeCloseTo(9.3252, 4)
  })

  it('hệ số giá/kg của danh mục thắng số suy từ barem', () => {
    // "Sắt hộp 40x80x1li x4m30": khai dài cây 6 m nên barem ra 11,28 kg/cây,
    // còn hệ số 8,24 mới khớp cây 4,3 m thật. Số người khai đúng hơn số suy ra.
    const r = kgPerUnitOf({
      unit: 'cây',
      kg_per_m: 1.8804,
      default_bar_length_m: 6,
      price_unit: 'kg',
      unit2_factor: 8.24,
    })
    expect(r.kg).toBe(8.24)
    expect(r.source).toBe('danh mục (giá/kg)')
    expect(r.barem).toBeCloseTo(11.2824, 4)
  })

  it('hệ số CHỈ dùng khi giá tính theo kg', () => {
    // price_unit 'm³' thì unit2_factor là m³/tấm, nhét vào ô kg là sai đơn vị.
    const r = kgPerUnitOf({ ...cay, price_unit: 'm³', unit2_factor: 0.05 })
    expect(r.kg).toBeCloseTo(9.3252, 4)
    expect(r.source).toBe('barem')
  })

  it('không nguồn nào có → null, không đoán', () => {
    const r = kgPerUnitOf({ unit: 'tấm', kg_per_m: null, default_bar_length_m: null })
    expect(r.kg).toBeNull()
    expect(r.source).toBeNull()
    expect(r.barem).toBeNull()
  })
})

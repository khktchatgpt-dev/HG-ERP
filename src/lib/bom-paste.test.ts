import { describe, expect, it } from 'vitest'
import { parseBomPaste } from './bom-paste'
import { parseShape } from './bom-calc'

describe('parseShape', () => {
  it('đọc được dạng profile bất kể dấu và hoa thường', () => {
    for (const s of ['Hộp', 'hộp', 'HỘP', 'hop']) expect(parseShape(s)).toBe('HOP')
    for (const s of ['Tròn', 'tron', 'TRÒN', 'Ống']) expect(parseShape(s)).toBe('TRON')
    expect(parseShape('Tròn đặc')).toBe('TRONDAC')
    expect(parseShape('Vuông')).toBe('VUONG')
    expect(parseShape('La')).toBe('LA')
    expect(parseShape('Oval')).toBe('OVAN')
  })

  it('Tole và "nhôm tấm" đều là tấm', () => {
    expect(parseShape('Tole')).toBe('TAM')
    expect(parseShape('Nhôm tấm')).toBe('TAM')
    expect(parseShape('Sắt tấm')).toBe('TAM')
  })

  it('không đoán bừa khi không nhận ra', () => {
    expect(parseShape('TD-HG04')).toBeNull()
    expect(parseShape('')).toBeNull()
    expect(parseShape(null)).toBeNull()
  })
})

describe('parseBomPaste — dán từ biểu mẫu BOM gốc (13 cột)', () => {
  // Đúng các dòng của B0012HG-AL, sheet "THEO REPORT".
  const paste = [
    'Stt\tTên chi tiết\tLoại\tDày\tRộng\tDài\tPhi hao\tSố lượng\tTổng chiều dài (m)\tTrọng lượng (kg)\tDiện tích sơn (M²)\tDày vật liệu (δ)\tGhi chú',
    '1\tChân\tHộp\t18\t70\t650\t\t4\t2.60\t1.6747\t0.4576\t1.4\t',
    '6\tNan ngồi\tTole\t1.2\t131\t468\t\t3\t1.40\t0.5959\t0.3712\t1.2\tNhấn C 8 x 95',
    '\tTổng cộng\t\t\t\t\t\t15\t7.83\t4.11455\t1.29008\t\t',
  ].join('\n')

  it('nhận đúng bố cục biểu mẫu và bỏ dòng tiêu đề / tổng cộng', () => {
    const r = parseBomPaste(paste)
    expect(r.source).toBe('header')
    expect(r.rows).toHaveLength(2)
    expect(r.skipped.map((s) => s.reason)).toEqual(['dòng tiêu đề', 'dòng tổng cộng'])
  })

  it('map đúng cột, bỏ cột tính được, giữ trọng lượng của file', () => {
    const [chan, nan] = parseBomPaste(paste).rows
    expect(chan).toMatchObject({
      part_no: 1,
      part_name: 'Chân',
      profile_shape: 'HOP',
      dim_a_mm: 18,
      dim_b_mm: 70,
      cut_length_mm: 650,
      qty: 4,
      wall_thickness_mm: 1.4,
      weight_kg: 1.6747,
    })
    expect(nan.profile_shape).toBe('TAM')
    expect(nan.note).toBe('Nhấn C 8 x 95')
  })
})

describe('parseBomPaste — dán gọn theo thứ tự lưới nhập', () => {
  it('đọc đúng 7 cột: tên, dạng, A, B, dày thành, dài cắt, SL', () => {
    const r = parseBomPaste(
      ['Chân trước\tHộp\t20\t40\t1\t500\t4', 'Tay\tTròn\t25\t25\t1.2\t380\t2'].join('\n'),
    )
    expect(r.source).toBe('guess')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({
      part_name: 'Chân trước',
      profile_shape: 'HOP',
      dim_a_mm: 20,
      dim_b_mm: 40,
      wall_thickness_mm: 1,
      cut_length_mm: 500,
      qty: 4,
    })
    expect(r.rows[1].profile_shape).toBe('TRON')
  })

  it('bỏ dòng không có tên chi tiết và nói rõ lý do', () => {
    const r = parseBomPaste(
      ['Chân\tHộp\t20\t40\t1\t500\t4', '\tHộp\t20\t40\t1\t500\t4'].join('\n'),
    )
    expect(r.rows).toHaveLength(1)
    expect(r.skipped[0].reason).toBe('không có tên chi tiết')
  })
})

describe('parseBomPaste — số kiểu Việt Nam', () => {
  it('đọc dấu phẩy thập phân', () => {
    const r = parseBomPaste('Chân\tHộp\t18\t70\t1,4\t650\t4')
    expect(r.rows[0].wall_thickness_mm).toBe(1.4)
  })

  it('bỏ dấu chấm phân nhóm nghìn', () => {
    const r = parseBomPaste('Nan\tHộp\t20\t40\t1\t1.440\t2')
    expect(r.rows[0].cut_length_mm).toBe(1440)
  })

  it('ô rỗng ra null, không ra 0', () => {
    const r = parseBomPaste('Bu lông M6\t\t\t\t\t\t6')
    expect(r.rows[0].dim_a_mm).toBeNull()
    expect(r.rows[0].cut_length_mm).toBeNull()
    expect(r.rows[0].qty).toBe(6)
  })
})

describe('parseBomPaste — đầu vào lạ', () => {
  it('chuỗi rỗng ra mảng rỗng, không nổ', () => {
    expect(parseBomPaste('').rows).toEqual([])
    expect(parseBomPaste('   \n  \n').rows).toEqual([])
  })

  it('tách được khi dán bằng dấu ; hoặc nhiều khoảng trắng', () => {
    expect(parseBomPaste('Chân;Hộp;20;40;1;500;4').rows[0].part_name).toBe('Chân')
    expect(parseBomPaste('Chân   Hộp   20   40   1   500   4').rows[0].qty).toBe(4)
  })
})

/**
 * BIỂU MẪU MỚI (hiệu lực 28-02-2026) — chèn cột `Parts/ Bộ phận` giữa Stt và Tên
 * chi tiết. Dòng lấy đúng từ `BOM_Shelter Home_ ghế 3 30x100 uống cong.xlsx`.
 */
describe('parseBomPaste — biểu mẫu BOM mới, có cột Cụm', () => {
  const head =
    'Stt\tParts/ Bộ phận\tTên chi tiết\tLoại\tDày\tRộng\tDài\tPhi hao chi tiết uốn\tSố lượng\tTổng chiều dài (m)\tTrọng lượng (kg)\tDiện tích sơn (M²)\tDày vật liệu (δ)\tGhi chú'
  const rows = [
    '\tCụm khung\tChân trước + Tay vin\tHộp\t30\t100\t1575\t\t2\t3.15\t3.6608922\t0.819\t1.7\t',
    '\tCụm khung\tChân sau\tHộp\t30\t100\t475\t60\t2\t1.07\t1.24354116\t0.247\t1.7\t',
    '\t\tPát góc\tHộp\t20\t40\t60\t\t4\t0.24\t0.08957952\t0.0288\t1.2\t',
  ]

  it('đọc cột Cụm và KHÔNG lệch quy cách một ô', () => {
    const r = parseBomPaste([head, ...rows].join('\n'))
    expect(r.source).toBe('header')
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0]).toMatchObject({
      cluster_name: 'Cụm khung',
      part_name: 'Chân trước + Tay vin',
      profile_shape: 'HOP',
      dim_a_mm: 30,
      dim_b_mm: 100,
      cut_length_mm: 1575,
      qty: 2,
      wall_thickness_mm: 1.7,
    })
    // Dòng không thuộc cụm nào → về nhóm Rời, không phải chuỗi rỗng.
    expect(r.rows[2].cluster_name).toBeNull()
  })

  it('lấy PHI HAO UỐN và bỏ các cột tính được', () => {
    const r = parseBomPaste([head, ...rows].join('\n'))
    expect(r.rows[1].bend_waste_mm).toBe(60)
    expect(r.rows[0].bend_waste_mm).toBeNull()
    // Tổng chiều dài + diện tích sơn là công thức của file — app tự tính lại.
    expect(r.mapped.some((m) => m.field === 'cut_length_mm')).toBe(true)
    expect(r.mapped.every((m) => m.label !== 'Tổng chiều dài')).toBe(true)
  })

  it('không có tiêu đề vẫn neo đúng nhờ vị trí cột "Loại"', () => {
    const r = parseBomPaste(rows.join('\n'))
    expect(r.source).toBe('guess')
    expect(r.rows[0]).toMatchObject({
      cluster_name: 'Cụm khung',
      part_name: 'Chân trước + Tay vin',
      dim_a_mm: 30,
      cut_length_mm: 1575,
      qty: 2,
    })
    expect(r.rows[1].bend_waste_mm).toBe(60)
  })
})

describe('parseBomPaste — khối gỗ và khối vật tư', () => {
  it('khối GỖ: không có cột "Loại", có cột Mộng', () => {
    const r = parseBomPaste(
      [
        'Stt\tTên chi tiết\tDày\tRộng\tDài\tMộng\tSố lượng\tDiện Tích (m2)\tK. Lượng (m3)\tGhi chú',
        '1\tTay Vịn\t20\t52\t520\t\t2\t0.14976\t0.0010816\t',
        '2\tĐố trước\t25\t70\t2230\t15\t1\t0.4237\t0.0039025\t',
      ].join('\n'),
    )
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ part_name: 'Tay Vịn', dim_a_mm: 20, qty: 2 })
    expect(r.rows[1].tenon_mm).toBe(15)
    // Không có cột Loại thì đừng bịa ra dạng.
    expect(r.rows[0].profile_shape).toBeNull()
  })

  it('khối NGŨ KIM: chỉ có ĐVT · SL · Vật Liệu, không kích thước nào', () => {
    const r = parseBomPaste(
      [
        'STT\tTÊN HÀNG HÓA\tĐVT\tSL/SP\tVật Liệu\tGhi chú',
        '4\tBulon M6x25 + Londen + tán rút\tcái\t27\tsắt xi đen\t',
        '5\tlục giác\t\t1\t\t',
      ].join('\n'),
    )
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({
      part_name: 'Bulon M6x25 + Londen + tán rút',
      unit: 'cái',
      qty: 27,
      material_note: 'sắt xi đen',
    })
    expect(r.rows[0].dim_a_mm).toBeNull()
  })
})

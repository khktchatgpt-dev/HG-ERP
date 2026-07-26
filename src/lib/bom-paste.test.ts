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
    expect(r.layout).toBe('bom-form')
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
    expect(r.layout).toBe('compact')
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

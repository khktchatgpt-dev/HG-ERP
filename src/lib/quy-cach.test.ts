import { describe, expect, it } from 'vitest'
import { docQuyCach, khopKim } from './quy-cach'

const NHOM = { template: 'aluminium', group: 'Nhôm định hình - tấm' }
const THEP = { template: 'metal_kg', group: 'Sắt thép - tôn - tấm' }
const BUL = { template: 'accessory', group: 'Bu lông - vít - đinh - liên kết' }

describe('docQuyCach — kim loại: bỏ chiều dài cây, gom mọi cách viết của một quy cách', () => {
  it('nhôm phi 25 dày 1.0: 4 cách viết của 3 NCC ra MỘT khoá (tên thật trên đơn 28/10)', () => {
    const ten = [
      'Nhôm phi 25x1li',
      'Nhôm phi 25x1li dài 5.65m',
      'Nhôm phi 25 x1.0 (dài 5.8m)',
      'Nhôm phi 25 x1.0 (dài 5.7m)',
    ]
    const qs = ten.map((t) => docQuyCach(t, NHOM))
    expect(new Set(qs.map((q) => q.key)).size).toBe(1)
    expect(qs[0].label).toBe('Nhôm ống phi 25 · dày 1.0')
    expect(qs[0].dv).toBe('kg')
  })

  it('"vuông 20 x1.0" của Ngô Sơn = "vuông 20 x 20 T1.0" của Quang Minh', () => {
    const a = docQuyCach('Nhôm vuông 20 x1.0 (dài 5.8m)', NHOM)
    const b = docQuyCach('Nhôm vuông 20 x 20 T1.0 dài 5.48m', NHOM)
    expect(a.key).toBe(b.key)
    expect(a.label).toBe('Nhôm vuông 20×20 · dày 1.0')
  })

  it('"hộp vuông 20x40" là HỘP (hai cạnh khác nhau); 0.8 và 1.0 là hai quy cách', () => {
    const a = docQuyCach('Thép hộp vuông 20x40x1.0', THEP)
    const b = docQuyCach('Sắt hộp 20x40 x0.8mm (dài 5.9m)', THEP)
    expect(a.label).toBe('Thép hộp 20×40 · dày 1.0')
    expect(b.label).toBe('Thép hộp 20×40 · dày 0.8')
    expect(a.key).not.toBe(b.key)
  })

  it('"8dem" = dày 0.8; cờ mềm / kẽm vào khoá vì làm đổi giá', () => {
    expect(docQuyCach('Thép hộp 20x40 8dem', THEP).kim?.t).toBe(0.8)
    const mem = docQuyCach('Hộp 25x50x1.2li Nhôm mềm dài 5.1m', { template: 'simple', group: 'Nhôm định hình - tấm' }) // prettier-ignore
    expect(mem.label).toBe('Nhôm hộp 25×50 · dày 1.2 · mềm')
    const kem = docQuyCach('Thép vuông 20x20x0.8', { ...THEP, finish: 'mạ kẽm' })
    expect(kem.kim?.co).toEqual(['kẽm'])
  })

  it('nhôm tấm theo độ dày (khổ tấm không phải quy cách giá); nhôm la', () => {
    expect(docQuyCach('Nhôm tấm 3 li, khổ 1200x2400', NHOM).label).toBe(
      'Nhôm tấm · dày 3.0',
    )
    expect(docQuyCach('Nhôm La 3x25 dài 4m', NHOM).label).toBe('Nhôm la 25 · dày 3.0')
  })

  it('profile riêng của NCC chỉ gom các chiều dài của CHÍNH nó', () => {
    const a = docQuyCach('Nhôm thanh TD-B477 dài 5.7m', NHOM)
    const b = docQuyCach('Nhôm thanh TD-B477 dài 5.9m', NHOM)
    const c = docQuyCach('Nhôm thanh TD-HG04 dài 5.7m', NHOM)
    expect(a.loai).toBe('profile')
    expect(a.key).toBe(b.key)
    expect(a.key).not.toBe(c.key)
  })

  it('inox là vật liệu riêng — bản script cũ coi mọi thứ không phải nhôm là thép', () => {
    const q = docQuyCach('inox hộp 20x20 dày 1.0')
    expect(q.kim?.vl).toBe('Inox')
    expect(q.label).toBe('Inox vuông 20×20 · dày 1.0')
  })
})

describe('docQuyCach — món còn lại: tên chuẩn hoá, lớp xi là biến thể', () => {
  it('bulông 6x20x13 trơn / xi đen ra cùng khoá, giữ biến thể để bày', () => {
    const a = docQuyCach('Bulon 6x20x13', BUL)
    const b = docQuyCach('Bulon 6x20x13, xi đen', BUL)
    expect(a.key).toBe(b.key)
    expect(b.bien).toBe('xi đen')
    expect(b.label).toBe('Bulon 6x20x13')
  })

  it('viết tắt của xưởng: "7M" = "7 màu" (cùng luật khoá trùng của danh mục)', () => {
    expect(docQuyCach('Vít dù 4x15, 7M', BUL).key).toBe(
      docQuyCach('Vít dù 4x15 7 màu', BUL).key,
    )
  })

  it('mẫu đơn không phải kim loại thì chữ "thép" trong tên không biến nó thành thanh thép', () => {
    expect(docQuyCach('Vít thép 4x15', BUL).loai).toBe('khac')
  })

  it('xốp gom theo tên (bỏ chiều dài), so theo đ/m³', () => {
    const q = docQuyCach('xốp hông 1 bàn vuông ibiza D18', { template: 'foam', group: 'Mút - xốp - nệm - gòn' }) // prettier-ignore
    expect(q.loai).toBe('xop')
    expect(q.dv).toBe('m³')
  })
})

describe('khopKim — chữ người gõ có khớp quy cách của dòng không', () => {
  const dong = (t: string) => docQuyCach(t, THEP).kim!
  it('gõ thiếu độ dày thì khớp mọi độ dày', () => {
    const go = docQuyCach('thép hộp 20x40').kim!
    expect(go.t).toBeNull()
    expect(khopKim(go, dong('Thép hộp vuông 20x40x1.0'))).toBe(true)
    expect(khopKim(go, dong('Sắt hộp 20x40 x0.8mm'))).toBe(true)
  })
  it('gõ đủ độ dày thì chỉ khớp đúng độ dày', () => {
    const go = docQuyCach('sắt hộp 20x40 0.8').kim!
    expect(khopKim(go, dong('Thép hộp vuông 20x40x1.0'))).toBe(false)
    expect(khopKim(go, dong('Sắt hộp 20x40 x0.8mm'))).toBe(true)
  })
  it('người gõ không ghi "mềm" vẫn khớp hàng mềm; ghi "kẽm" thì dòng phải có kẽm', () => {
    const mem = docQuyCach('Hộp 25x50x1.2li Nhôm mềm', NHOM).kim!
    expect(khopKim(docQuyCach('nhôm hộp 25x50 1.2').kim!, mem)).toBe(true)
    expect(khopKim(docQuyCach('thép vuông 20x20 0.8 kẽm').kim!, dong('Thép vuông 20x20x0.8'))).toBe(false) // prettier-ignore
  })
})

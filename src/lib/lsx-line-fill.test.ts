import { describe, expect, it } from 'vitest'
import {
  lineOrigins,
  lineReadiness,
  originOf,
  packingText,
  parsePacking,
  sameCbm,
  samePacking,
  sheetReadiness,
  type LineLike,
  type ProfileSnapshot,
  type ReadinessOpts,
} from './lsx-line-fill'

/**
 * Luật "ô này lấy từ đâu" + "dòng đã đủ chưa" (0117). Test khoá đúng những chỗ
 * dễ sai nhất: so đóng gói/CBM (chuỗi và số dấu phẩy động), và cách đối xử với
 * placeholder "Thông báo sau" — chặn nhầm nó là chặn một luồng hợp lệ.
 */

const OPTS: ReadinessOpts = {
  specKeys: [
    { key: 'may', label: 'Mây' },
    { key: 'nem', label: 'Nệm' },
    { key: 'son', label: 'Sơn' },
    { key: 'kinh', label: 'Kính' },
    { key: 'go', label: 'Gỗ' },
  ],
  checkKeys: [
    { key: 'bom', label: 'BOM' },
    { key: 'ban_ve', label: 'Bản vẽ' },
    { key: 'mau', label: 'Mẫu' },
    { key: 'showroom', label: 'Mẫu tại showroom' },
  ],
  needCbm: true,
}

const snap = (over: Partial<ProfileSnapshot> = {}): ProfileSnapshot => ({
  specs: {},
  name_foreign: null,
  barcode: null,
  customer_item_code: null,
  packing: null,
  cbm: null,
  gaps: [],
  ...over,
})

/** Dòng đủ mọi thứ — mỗi test chỉ đục một lỗ để thấy đúng cái đang kiểm. */
const fullLine = (over: Partial<LineLike> = {}): LineLike => ({
  product_code: 'HG-01',
  name_vi: 'Ghế Alicante',
  unit: 'cái',
  qty: 10,
  packing: '4 cái/thùng',
  cbm: 0.35,
  ship_label: 'w37.26',
  specs: { may: 'Dây dù kem' },
  checks: { bom: 'Có', ban_ve: 'Có', mau: 'Có', showroom: 'Không' },
  ...over,
})

describe('packing — so theo ý nghĩa, không so chuỗi thô', () => {
  it('dựng chuỗi đúng khuôn nạp dòng', () => {
    expect(packingText(4, 'cái', 'thùng')).toBe('4 cái/thùng')
    expect(packingText(4, null, null)).toBe('4 cái/thùng')
    expect(packingText(0, 'cái', 'thùng')).toBeNull()
    expect(packingText(null, 'cái', 'thùng')).toBeNull()
  })

  it('tách được mọi biến thể Sales gõ tay', () => {
    expect(parsePacking('4 cái/thùng')).toEqual({ qty: 4, label: 'thùng' })
    expect(parsePacking('4 cái / thùng')).toEqual({ qty: 4, label: 'thùng' })
    expect(parsePacking('12/ Thùng')).toEqual({ qty: 12, label: 'Thùng' })
    expect(parsePacking('1 mặt bàn /thùng')).toEqual({ qty: 1, label: 'thùng' })
    expect(parsePacking('Bench trái+đôn mỗi thùng')).toBeNull()
    expect(parsePacking(null)).toBeNull()
  })

  it('lệch khoảng trắng / hoa thường vẫn là CÙNG một cách đóng', () => {
    expect(samePacking('4 cái/thùng', '4 cái / Thùng')).toBe(true)
    expect(samePacking('4 cái/thùng', '6 cái/thùng')).toBe(false)
    // Không tách được thì tụt về so chuỗi chuẩn hoá.
    expect(samePacking('2 cái/ thùng chữ L', '2 cái/thùng chữ l')).toBe(true)
  })
})

describe('sameCbm — dung sai cho phép tính L×W×H/1e6', () => {
  it('0.576 ≡ số tính ra từ 3 chiều', () => {
    expect(sameCbm(0.576, (120 * 80 * 60) / 1_000_000)).toBe(true)
  })
  it('lệch thấy được trên phiếu thì là khác', () => {
    expect(sameCbm(0.576, 0.58)).toBe(false)
  })
  it('null chỉ bằng null', () => {
    expect(sameCbm(null, 0)).toBe(false)
    expect(sameCbm(null, null)).toBe(true)
  })
})

describe('originOf — ba tình huống nguồn', () => {
  it('giống hồ sơ → profile; khác → edited; hồ sơ trống → own', () => {
    expect(originOf('Sơn xám', 'Sơn xám')).toBe('profile')
    expect(originOf(' sơn XÁM ', 'Sơn xám')).toBe('profile') // chuẩn hoá
    expect(originOf('Sơn trắng', 'Sơn xám')).toBe('edited')
    expect(originOf('', 'Sơn xám')).toBe('edited') // Sales xoá đi cũng là lệch
    expect(originOf('Sales gõ', null)).toBe('own')
    expect(originOf('', null)).toBe('own')
  })

  it('trường sinh từ đơn gắn nhãn tĩnh, không so với hồ sơ', () => {
    const o = lineOrigins(fullLine({ sales_order_line_id: 'ol1' }), snap())
    expect(o.qty).toBe('order')
    expect(o.product_code).toBe('order')
    expect(o.ship_label).toBeNull()
  })

  it('đóng gói/CBM so theo ý nghĩa nên không báo lệch giả', () => {
    const o = lineOrigins(
      fullLine({ packing: '4 cái / Thùng', cbm: (120 * 80 * 60) / 1_000_000 }),
      snap({ packing: '4 cái/thùng', cbm: 0.576 }),
    )
    expect(o.packing).toBe('profile')
    expect(o.cbm).toBe('profile')
  })
})

describe('lineReadiness — mức A (chặn) vs mức B (cảnh báo)', () => {
  it('dòng đầy đủ → ok, không chặn không cảnh báo', () => {
    const r = lineReadiness(fullLine(), snap({ specs: { may: 'Dây dù kem' } }), OPTS)
    expect(r.level).toBe('ok')
    expect(r.blocking).toEqual([])
    expect(r.warn).toEqual([])
  })

  it('thiếu mã SP / SL / ĐVT → chặn', () => {
    expect(lineReadiness(fullLine({ product_code: '' }), snap(), OPTS).blocking).toEqual([
      { key: 'product_code', label: 'Mã SP' },
    ])
    expect(lineReadiness(fullLine({ qty: 0 }), snap(), OPTS).blocking).toEqual([
      { key: 'qty', label: 'Số lượng' },
    ])
    expect(lineReadiness(fullLine({ unit: '' }), snap(), OPTS).blocking).toEqual([
      { key: 'unit', label: 'ĐVT' },
    ])
  })

  it('mã SP là "Thông báo sau" → KHÔNG chặn, nhưng đếm là ô chờ chốt', () => {
    const r = lineReadiness(
      fullLine({ product_code: 'Thông báo sau', specs: { may: 'xác nhận sau' } }),
      snap({ specs: { may: 'Dây dù kem' } }),
      OPTS,
    )
    expect(r.blocking).toEqual([])
    expect(r.pending).toBe(1) // ô spec — mã SP không nằm trong nhóm đếm chờ chốt
    expect(r.warn.map((w) => w.key)).toContain('specs') // chờ chốt ≠ đã đủ
  })

  it('vật liệu: CHỈ đòi spec mà hồ sơ SP có giá trị', () => {
    // Hồ sơ có Mây + Sơn; dòng mới điền Mây → cảnh báo đúng "Sơn", không đòi Kính/Gỗ.
    const r = lineReadiness(
      fullLine({ specs: { may: 'Dây dù kem' } }),
      snap({ specs: { may: 'Dây dù kem', son: 'PT-7476' } }),
      OPTS,
    )
    const spec = r.warn.find((w) => w.key === 'specs')
    expect(spec?.label).toBe('Vật liệu (Sơn)')
    expect(spec?.label).not.toContain('Kính')
    expect(r.meters.find((m) => m.key === 'specs')?.state).toBe('partial')
  })

  it('spec mà cả dòng lẫn hồ sơ đều trống → không phải lỗi dòng', () => {
    const r = lineReadiness(
      fullLine({ specs: { may: 'Dây dù kem' } }),
      snap({ specs: { may: 'Dây dù kem' } }),
      OPTS,
    )
    expect(r.warn.some((w) => w.key === 'specs')).toBe(false)
  })

  it('kiểm tra hồ sơ ghi "Không" = đã trả lời, không cảnh báo', () => {
    const r = lineReadiness(
      fullLine({
        checks: { bom: 'Không', ban_ve: 'Không', mau: 'Không', showroom: 'Không' },
      }),
      snap(),
      OPTS,
    )
    expect(r.warn.some((w) => w.key === 'checks')).toBe(false)
    expect(r.meters.find((m) => m.key === 'checks')?.state).toBe('ok')
  })

  it('mẫu cột không có CBM → thiếu CBM cũng không cảnh báo', () => {
    const noCbm = { ...OPTS, needCbm: false }
    const r = lineReadiness(fullLine({ cbm: null }), snap(), noCbm)
    expect(r.warn.some((w) => w.key === 'cbm')).toBe(false)
  })

  it('thiếu đợt xuất / đóng gói → cảnh báo, không chặn', () => {
    const r = lineReadiness(
      fullLine({ ship_label: null, ship_date: null, packing: null }),
      snap(),
      OPTS,
    )
    expect(r.level).toBe('warn')
    expect(r.blocking).toEqual([])
    expect(r.warn.map((w) => w.key)).toEqual(expect.arrayContaining(['packing', 'ship']))
  })
})

describe('sheetReadiness — tổng hợp cả phiếu', () => {
  it('đếm đúng ok / chặn / cảnh báo và gom ô chờ chốt', () => {
    const mk = (line: LineLike, groupTitle: string, index: number) => ({
      groupTitle,
      index,
      line,
      readiness: lineReadiness(line, snap({ specs: { may: 'x' } }), OPTS),
    })
    const out = sheetReadiness([
      mk(fullLine({ specs: { may: 'x' } }), 'PO-1', 1),
      mk(fullLine({ qty: 0 }), 'PO-1', 2),
      mk(fullLine({ specs: { may: 'x' }, ship_label: null, ship_date: null }), 'PO-2', 1),
      mk(fullLine({ specs: { may: 'xác nhận sau' } }), 'PO-2', 2),
    ])
    expect(out.total).toBe(4)
    expect(out.ok).toBe(1)
    expect(out.blocked).toHaveLength(1)
    expect(out.blocked[0]).toMatchObject({ groupTitle: 'PO-1', index: 2 })
    expect(out.blocked[0].issues).toContain('Số lượng')
    expect(out.warned).toHaveLength(2)
    expect(out.pending).toBe(1)
  })

  it('dòng chưa có mã hiện nhãn thay chỗ trống', () => {
    const line = fullLine({ product_code: '' })
    const out = sheetReadiness([
      {
        groupTitle: 'PO-1',
        index: 1,
        line,
        readiness: lineReadiness(line, snap(), OPTS),
      },
    ])
    expect(out.blocked[0].code).toBe('(chưa có mã)')
  })
})

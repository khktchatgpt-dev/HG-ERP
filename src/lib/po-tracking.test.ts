import { describe, expect, it } from 'vitest'
import { lineConfirm, moqHint, priceDrift, slipDays } from './po-tracking'

const L = { id: 'L1', qty_ordered: 500 }
const ship = (status: string, qty: number) => ({
  status,
  lines: [{ po_line_id: 'L1', qty }],
})

describe('lineConfirm — NCC xác nhận theo TỪNG dòng', () => {
  it('đơn chưa gửi: không có gì để xác nhận', () => {
    expect(lineConfirm(L, { status: 'approved', confirmed_at: null }, [])).toBeNull()
  })
  it('đã gửi, NCC chưa phản hồi', () => {
    expect(lineConfirm(L, { status: 'ordered', confirmed_at: null }, [])?.kind).toBe(
      'chua_phan_hoi',
    )
  })
  it('Gỗ A 1000/1000 đủ · Keo B 300/500 một phần · Sơn C 0 không xác nhận', () => {
    const po = { status: 'confirmed', confirmed_at: '2026-09-27' }
    expect(lineConfirm(L, po, [ship('planned', 300), ship('planned', 200)])?.kind).toBe(
      'du',
    )
    expect(lineConfirm(L, po, [ship('planned', 300)])).toMatchObject({ kind: 'mot_phan', committed: 300 }) // prettier-ignore
    expect(lineConfirm(L, po, [{ status: 'planned', lines: [{ po_line_id: 'khac', qty: 9 }] }])?.kind).toBe('khong') // prettier-ignore
  })
  it('đợt đã huỷ / đề nghị đã bị thay không tính là cam kết', () => {
    const po = { status: 'confirmed', confirmed_at: '2026-09-27' }
    expect(lineConfirm(L, po, [ship('cancelled', 500), ship('planned', 100)])?.kind).toBe('mot_phan') // prettier-ignore
  })
  it('NCC xác nhận cả đơn không chia đợt → đủ', () => {
    expect(
      lineConfirm(L, { status: 'confirmed', confirmed_at: '2026-09-27' }, [])?.kind,
    ).toBe('du')
  })
})

describe('slipDays — NCC dời hẹn bao nhiêu ngày so với lần hứa đầu', () => {
  const log = [
    { kind: 'de_nghi', date_after: '2026-10-05', created_at: '2026-09-20T01:00:00Z' },
    {
      kind: 'ncc_xac_nhan',
      date_after: '2026-10-03',
      created_at: '2026-09-21T01:00:00Z',
    },
    { kind: 'doi_hen', date_after: '2026-10-08', created_at: '2026-10-02T01:00:00Z' },
  ]
  it('cam kết 03/10, nay sớm nhất 08/10 → trễ 5 ngày', () => {
    expect(slipDays(log, '2026-10-08')).toBe(5)
  })
  it('chưa có cam kết nào → null', () => {
    expect(slipDays(log.slice(0, 1), '2026-10-08')).toBeNull()
  })
  it('LẤY TRƯỚC (mình kéo hàng lên) không phải cam kết NCC → không làm mốc so', () => {
    const split = [{ kind: 'them_dot', date_after: '2026-10-08', created_at: '2026-09-27T01:00:00Z', reason: 'Lấy trước từ đợt 2: xưởng cần gấp' }] // prettier-ignore
    expect(slipDays(split, '2026-10-05')).toBeNull()
  })
})

describe('moqHint — chỉ nhắc khi đọc chắc được số + đơn vị', () => {
  it('500 kg mà đơn đặt 320 kg → nhắc', () => {
    expect(moqHint('500 kg', [{ unit: 'kg', qty: 320 }])).toMatch(/Dưới MOQ.*320 kg/)
  })
  it('đủ MOQ → không nhắc', () => {
    expect(
      moqHint('500 kg', [
        { unit: 'kg', qty: 300 },
        { unit: 'kg', qty: 250 },
      ]),
    ).toBeNull()
  })
  it('đơn vị không khớp dòng nào / chữ không có số → không đoán', () => {
    expect(moqHint('1 xe', [{ unit: 'kg', qty: 1 }])).toBeNull()
    expect(moqHint('theo thoả thuận', [{ unit: 'kg', qty: 1 }])).toBeNull()
    expect(moqHint(null, [{ unit: 'kg', qty: 1 }])).toBeNull()
  })
  it('số kiểu Việt "1.000 cái"', () => {
    expect(moqHint('1.000 cái', [{ unit: 'Cái', qty: 800 }])).toMatch(/800 cái/)
  })
})

describe('priceDrift — giá lệch lần mua trước ≥ 5%', () => {
  it('50.000 → 53.000 = +6%', () => {
    expect(priceDrift(53_000, 50_000)).toBe(6)
  })
  it('lệch dưới 5% hoặc thiếu giá cũ → null', () => {
    expect(priceDrift(51_000, 50_000)).toBeNull()
    expect(priceDrift(51_000, null)).toBeNull()
  })
  it('giảm giá cũng nhắc (số âm)', () => {
    expect(priceDrift(45_000, 50_000)).toBe(-10)
  })
})

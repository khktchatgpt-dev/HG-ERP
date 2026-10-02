import { describe, expect, it } from 'vitest'
import {
  canXuLy,
  dongThieuKg,
  ketQuaPhieu,
  type DongNhanVe,
  type PhieuNhanVe,
} from './da-ve'

const dong = (p: Partial<DongNhanVe> = {}): DongNhanVe => ({
  movement_id: 'mv',
  material_code: 'VT-1',
  unit: 'Cây',
  qty: 90,
  stock_status: 'ok',
  qty2_actual: null,
  can_kg: false,
  qty_ordered: 90,
  kg_don: null,
  ...p,
})
const phieu = (p: Partial<PhieuNhanVe> = {}): PhieuNhanVe => ({
  doc_id: 'd1',
  reversed: false,
  lines: [dong()],
  po_status: 'received',
  latest_for_po: true,
  po_open_lines: 0,
  over_lines: 0,
  ...p,
})
const kinds = (p: PhieuNhanVe) => ketQuaPhieu(p).map((k) => k.kind)

describe('ketQuaPhieu — đọc kết quả một lần nhận', () => {
  it('về đủ, không gì bất thường → du, không vào Cần xử lý', () => {
    expect(kinds(phieu())).toEqual(['du'])
    expect(canXuLy(phieu())).toBe(false)
  })

  it('ca thật 27/09: phiếu thép chưa ghi kg cân KHÔNG còn là việc phải làm (02/10)', () => {
    const p = phieu({ lines: [dong({ can_kg: true }), dong({ can_kg: true })] })
    expect(kinds(p)).toEqual(['du'])
    expect(canXuLy(p)).toBe(false)
    expect(dongThieuKg(p)).toHaveLength(2) // vẫn đếm được nếu cần ghi bổ sung
  })

  it('đã ghi kg cân thì hết thiếu kg', () => {
    const p = phieu({
      lines: [dong({ can_kg: true, qty2_actual: 108.4, kg_don: 110.16 })],
    })
    expect(kinds(p)).toEqual(['du'])
  })

  it('còn thiếu chỉ gắn vào phiếu MỚI NHẤT của đơn', () => {
    const base = { po_status: 'partial', po_open_lines: 1 }
    expect(kinds(phieu({ ...base, latest_for_po: true }))).toEqual(['thieu'])
    expect(kinds(phieu({ ...base, latest_for_po: false }))).toEqual(['du'])
    // phiếu cũ của đơn còn chờ: không nói "Đủ" (sai) mà nói đơn còn chờ
    expect(ketQuaPhieu(phieu({ ...base, latest_for_po: false }))[0].text).toContain(
      'còn chờ',
    )
  })

  it('sai quy cách vào Cần xử lý; nhận vượt và chênh kg chỉ là thông tin', () => {
    expect(canXuLy(phieu({ lines: [dong({ stock_status: 'blocked' })] }))).toBe(true)
    expect(canXuLy(phieu({ over_lines: 1 }))).toBe(false)
    const chenh = phieu({
      lines: [dong({ can_kg: true, qty2_actual: 106, kg_don: 110 })], // −3,6%
    })
    expect(kinds(chenh)).toEqual(['chenh_kg'])
    expect(canXuLy(chenh)).toBe(false)
  })

  it('lệch kg dưới ngưỡng 3% là sai số cân — không nói', () => {
    const p = phieu({
      lines: [dong({ can_kg: true, qty2_actual: 108.4, kg_don: 110.16 })],
    }) // −1,6%
    expect(kinds(p)).toEqual(['du'])
  })

  it('phiếu đã đảo: chỉ một nhãn, không bao giờ vào Cần xử lý', () => {
    const p = phieu({ reversed: true, lines: [dong({ can_kg: true })] })
    expect(kinds(p)).toEqual(['da_dao'])
    expect(canXuLy(p)).toBe(false)
  })

  it('nhiều kết quả cùng lúc: thứ tự = cái chặn chốt tiền trước', () => {
    const p = phieu({
      po_status: 'partial',
      po_open_lines: 2,
      lines: [dong({ can_kg: true }), dong({ stock_status: 'blocked' })],
    })
    expect(kinds(p)).toEqual(['thieu', 'sai_quy_cach'])
  })

  it('đảo để SỬA mà chưa lập lại → Cần xử lý; đảo hẳn thì không', () => {
    expect(canXuLy(phieu({ reversed: true, cho_lap_lai: true }))).toBe(true)
    expect(ketQuaPhieu(phieu({ reversed: true, cho_lap_lai: true }))[0].text).toContain('chưa lập lại')
    expect(canXuLy(phieu({ reversed: true }))).toBe(false)
  })
})

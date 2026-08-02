import { describe, expect, it } from 'vitest'
import { parseBkvt } from './bkvt-parse'

/**
 * Lưới ô lấy nguyên văn từ file thật (E:\PO):
 *  · LSX 04 — header "SL Đặt Hàng · Tồn Kho · SL cần đặt · NCC", mã SP lặp mỗi dòng
 *  · LSX 02 — header "SL/ĐH · VTRL · SL dặt hàng" (gõ thiếu dấu), mã SP CHỈ ghi ở
 *    dòng đầu mỗi khối sản phẩm
 */

const LSX04 = [
  ['LSX 04 / 26-27'],
  [
    'STT',
    'Mã SP',
    'Tên SP',
    'Tên Vật Tư',
    'Đvt',
    'đm/sp',
    'Vật liệu',
    'SL',
    'VTRL',
    'SL Đặt Hàng',
    'Tồn Kho',
    'SL cần đặt',
    'Đgiá',
    'TT',
    'NCC',
  ],
  [
    '1',
    '22024-217',
    'Bàn Santorin',
    'Nút nhựa vuông 76',
    'Cái',
    '4',
    'Nhựa đen',
    '50',
    'Gót chân',
    '200',
    '',
    '206',
    '2,000',
    '412,000',
    'TTL',
  ],
  [
    '2',
    '22024-217',
    'Bàn Santorin',
    'Pat xoay 3 lỗ vít',
    'Cái',
    '2',
    'sắt xi 7M',
    '50',
    '',
    '100',
    '',
    '103',
    '',
    '',
    'HGIA',
  ],
]

const LSX02 = [
  ['Mã SP', 'Tên SP', 'TÊN VẬT TƯ', 'ĐVT', 'Đm/sp', 'SL/ĐH', 'VTRL', 'SL dặt hàng'],
  [
    '22150-011',
    'Bồn hoa lớn',
    'Nút nhựa vuông 40 màu đen',
    'cái',
    '8',
    '700',
    'nút chân 2 đầu',
    '5600',
  ],
  ['', '', 'Vít 6x20x13, 7 màu', 'con', '16', '700', '8 con VTR', '11200'],
  ['22151-011', 'Bồn hoa nhỏ', 'Lục giác 4, 7 màu', 'cái', '1', '350', '', '350'],
]

describe('parseBkvt', () => {
  it('đọc đúng dòng của BKVT LSX 04', () => {
    const rows = parseBkvt(LSX04)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      product_code: '22024-217',
      product_name: 'Bàn Santorin',
      material_name: 'Nút nhựa vuông 76',
      unit: 'Cái',
      qty_per_product: 4,
      product_qty: 50,
      qty_required: 200,
      qty_to_order: 206,
      unit_price: 2000, // "2,000" là ngăn nghìn, không phải 2 phẩy 0
      supplier_label: 'TTL',
      note: 'Gót chân',
    })
    // Ô tồn bỏ trống = CHƯA TRA, không phải tồn 0.
    expect(rows[0].qty_on_hand).toBeNull()
    expect(rows[1].supplier_label).toBe('HGIA')
  })

  it('mã SP bỏ trống thì kế thừa dòng trên — nếu không là mất truy vết sản phẩm', () => {
    const rows = parseBkvt(LSX02)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toMatchObject({
      product_code: '22150-011',
      product_name: 'Bồn hoa lớn',
      material_name: 'Vít 6x20x13, 7 màu',
      qty_per_product: 16,
      product_qty: 700,
      qty_required: 11200,
    })
    expect(rows[2].product_code).toBe('22151-011')
  })

  it('bám tiêu đề cột, không bám vị trí — hai file đặt cột khác nhau vẫn ra đúng', () => {
    // LSX 02 không có cột "SL cần đặt"/"NCC"; đừng lấy nhầm cột bên cạnh.
    const rows = parseBkvt(LSX02)
    expect(rows[0].qty_to_order).toBeNull()
    expect(rows[0].supplier_label).toBeNull()
  })

  it('sheet không phải BKVT thì trả rỗng chứ không nạp rác', () => {
    expect(parseBkvt([['Stt', 'Tên chi tiết', 'Loại', 'Quy cách (mm)']])).toEqual([])
    expect(parseBkvt([])).toEqual([])
  })
})

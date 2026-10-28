import { describe, expect, it } from 'vitest'
import { dangChon, phuongAn, thanhTien, type GiaHoi } from './tra-gia-chon'
import type { TgKetQua, TgNcc } from './tra-gia'

const N = (p: Partial<TgNcc>): TgNcc => ({
  supplier_id: 'qm',
  supplier_name: 'Nhôm Thép Quang Minh',
  gia: 108000,
  dv: 'kg',
  currency: 'VND',
  quy: null,
  at: '2026-10-03',
  po_id: 'po1',
  po_code: 'PO-2026-0113',
  status: 'received',
  chot: true,
  so_duoc: true,
  ma: ['NH-0573'],
  ten: 'Nhôm phi 25x1li dài 5.65m',
  bien: null,
  so_dong: 1,
  ...p,
})

const KQ = (p: Partial<TgKetQua>): TgKetQua => ({
  text: 'nhôm phi 25 x1.0',
  trang_thai: 'ok',
  quy_cach: { key: 'k', label: 'Nhôm ống phi 25 · dày 1.0', loai: 'kim', dv: 'kg' },
  so_ma: 5,
  nhom: 'Nhôm định hình - tấm',
  ncc: [],
  re_nhat: null,
  dv_so: 'kg',
  ung_vien: [],
  so_ung_vien: 0,
  goi_y: [],
  goi_y_theo: null,
  ...p,
})

const H = (p: Partial<GiaHoi>): GiaHoi => ({ id: 'h1', ncc: 'Nhôm Hoàng Vũ', gia: 105000, ghi_chu: null, at: '2026-10-28', ...p }) // prettier-ignore

describe('phuongAn', () => {
  const kq = KQ({
    ncc: [
      N({}),
      N({ supplier_id: 'ns', supplier_name: 'SX TM Ngô Sơn', gia: 113000 }),
      N({ supplier_id: 'nh', supplier_name: 'Kim khí Nam Hưng', gia: 100000, chot: false, so_duoc: false, status: 'draft' }), // prettier-ignore
    ],
  })

  it('giá hỏi được xếp hạng chung với giá đơn; đơn nháp đứng cuối, không tính rẻ nhất', () => {
    const { ds, re } = phuongAn(kq, [H({})])
    expect(ds.map((p) => [p.ten, p.nguon])).toEqual([
      ['Nhôm Hoàng Vũ', 'hoi'],
      ['Nhôm Thép Quang Minh', 'don'],
      ['SX TM Ngô Sơn', 'don'],
      ['Kim khí Nam Hưng', 'don'],
    ])
    expect(re).toBe(105000)
  })

  it('món mới: gợi ý có giá đ/kg thành phương án THAM KHẢO, không xếp hạng', () => {
    const moi = KQ({
      trang_thai: 'moi',
      quy_cach: null,
      dv_so: null,
      goi_y: [
        { supplier_id: 'qm', supplier_name: 'Quang Minh', gia: 108000, dv: 'kg', at: '2026-10-03', so_dong: 9, mau: [] }, // prettier-ignore
        { supplier_id: 'ht', supplier_name: 'Hồng Phát', gia: null, dv: null, at: '2026-09-08', so_dong: 3, mau: [] }, // prettier-ignore
      ],
    })
    const { ds, re } = phuongAn(moi, [])
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ key: 'goiy:qm', tham_khao: true, so_duoc: false })
    expect(re).toBeNull()
  })
})

describe('dangChon + thanhTien', () => {
  const { ds } = phuongAn(
    KQ({ ncc: [N({}), N({ supplier_id: 'ns', supplier_name: 'Ngô Sơn', gia: 113000 }), N({ supplier_id: 'nh', gia: 100000, chot: false, so_duoc: false })] }), // prettier-ignore
    [],
  )
  it('mặc định chọn rẻ nhất so được; chọn tay thì giữ; chọn đơn nháp thì không nhận', () => {
    expect(dangChon(ds, null)?.key).toBe('qm')
    expect(dangChon(ds, 'ns')?.key).toBe('ns')
    expect(dangChon(ds, 'nh')?.key).toBe('qm')
    expect(dangChon(ds, 'khong-con')?.key).toBe('qm')
  })
  it('món chỉ có tham khảo: không tự chọn', () => {
    const { ds: tk } = phuongAn(
      KQ({ trang_thai: 'moi', dv_so: null, goi_y: [{ supplier_id: 'qm', supplier_name: 'QM', gia: 108000, dv: 'kg', at: '2026-10-03', so_dong: 1, mau: [] }] }), // prettier-ignore
      [],
    )
    expect(dangChon(tk, null)).toBeNull()
    expect(dangChon(tk, 'goiy:qm')?.tham_khao).toBe(true)
  })
  it('thành tiền = SL × giá, làm tròn đồng; tham khảo hoặc thiếu SL thì không có', () => {
    expect(thanhTien(ds[0], 650)).toBe(70_200_000)
    expect(thanhTien(ds[0], null)).toBeNull()
    expect(thanhTien({ ...ds[0], tham_khao: true }, 650)).toBeNull()
  })
})

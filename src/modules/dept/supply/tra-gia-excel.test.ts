import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import type { TgKetQua, TgNcc } from '@/lib/tra-gia'
import { dangChon, phuongAn, thanhTien, type GiaHoi } from '@/lib/tra-gia-chon'
import {
  buildTraGiaExcel,
  ghiChuMon,
  traGiaExcelFilename,
  type TraGiaExcelMon,
} from './tra-gia-excel'

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
  ma: ['NH-0003', 'NH-0573'],
  ten: 'Nhôm phi 25x1li dài 5.65m',
  bien: null,
  so_dong: 3,
  ...p,
})
const KQ = (p: Partial<TgKetQua>): TgKetQua => ({
  text: '',
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

/** Dựng một món đúng như service: phương án → NCC chọn → thành tiền. */
function mon(
  text: string,
  sl: number | null,
  kq: TgKetQua,
  chon?: string,
  hoi: GiaHoi[] = [],
): TraGiaExcelMon {
  // prettier-ignore
  const { ds, re, dv } = phuongAn(kq, hoi)
  const c = dangChon(ds, chon)
  return { text, nhan: kq.quy_cach?.label ?? text, sl, dvt: null, kq, ds, re, dv, chon: c, tien: thanhTien(c, sl) } // prettier-ignore
}

const PHI25 = KQ({
  ncc: [
    N({}),
    N({ supplier_id: 'ns', supplier_name: 'SX TM Ngô Sơn', gia: 113000, po_code: 'PO-2026-0178', ma: ['NH-0607'] }), // prettier-ignore
    N({ supplier_id: 'nh', supplier_name: 'Kim khí Nam Hưng', gia: 100000, chot: false, so_duoc: false, status: 'draft', po_code: 'PO-2026-0215' }), // prettier-ignore
  ],
})
const THEP = KQ({
  quy_cach: { key: 't', label: 'Thép hộp 20×40 · dày 1.0', loai: 'kim', dv: 'kg' },
  ncc: [
    N({
      supplier_id: 'asia',
      supplier_name: 'Thép Asia',
      gia: 19500,
      po_code: 'PO-2026-0068',
    }),
    N({ supplier_id: 'visa', supplier_name: 'Thép Visa', gia: 19505.49, po_code: 'PO-2026-0116', quy: { gia_goc: 106500, dv_goc: 'Cây', moi: 5.46, dv_moi: 'kg' } }), // prettier-ignore
  ],
})
const MO_HO = KQ({
  trang_thai: 'mo_ho',
  quy_cach: null,
  dv_so: null,
  ung_vien: [
    { key: 'a', label: 'Thép hộp 20×40 · dày 1.0', so_ncc: 2, so_dong: 2 },
    { key: 'b', label: 'Thép hộp 20×40 · dày 0.8', so_ncc: 1, so_dong: 3 },
  ],
  so_ung_vien: 2,
})

async function doc() {
  const buf = await buildTraGiaExcel({
    mons: [
      mon('nhôm phi 25 x1.0', 650, PHI25, 'ns'),
      mon('thép hộp 20x40 dày 1.0', 1000, THEP),
      mon('thép hộp 20x40', 10, MO_HO),
    ],
    nguoiLap: 'Trương Thanh Truyền',
    ngayLap: '2026-10-28',
    tuNgay: '2026-04-28',
    denNgay: '2026-10-28',
    soDong: 707,
  })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}
const giaTri = (ws: ExcelJS.Worksheet) => JSON.stringify(ws.getSheetValues())
/** Hàng đầu tiên có ô cột 2 bằng `ten`. */
const hangCo = (ws: ExcelJS.Worksheet, ten: string) => {
  for (let r = 1; r <= ws.rowCount; r++)
    if (ws.getRow(r).getCell(2).value === ten) return ws.getRow(r)
  throw new Error(`không thấy ${ten}`)
}

describe('buildTraGiaExcel', () => {
  it('ba tờ đúng tên', async () => {
    expect((await doc()).worksheets.map((w) => w.name)).toEqual(['So sánh giá', 'Theo NCC', 'Chi tiết lần mua']) // prettier-ignore
  })

  it('tờ 1: NCC xếp rẻ → đắt, ô NCC đang chọn tô xanh, thành tiền theo NCC chọn', async () => {
    const ws = (await doc()).getWorksheet('So sánh giá')!
    const r = hangCo(ws, 'Nhôm ống phi 25 · dày 1.0')
    expect([r.getCell(7).value, r.getCell(8).value, r.getCell(9).value, r.getCell(10).value]).toEqual(['Nhôm Thép Quang Minh', 108000, 'SX TM Ngô Sơn', 113000]) // prettier-ignore
    // Đơn nháp KHÔNG lên hàng so sánh.
    expect(giaTri(ws)).not.toContain('Kim khí Nam Hưng')
    expect((r.getCell(9).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFE5F3EA')
    expect((r.getCell(7).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb).not.toBe('FFE5F3EA') // prettier-ignore
    expect(r.getCell(15).value).toBe('SX TM Ngô Sơn')
    expect(r.getCell(17).value).toBe(73_450_000)
    expect(r.getCell(18).value).toBe('Đắt hơn rẻ nhất 4,6%')
  })

  it('tờ 1: giá quy đổi làm tròn đồng; món mơ hồ ghi rõ chưa chọn quy cách', async () => {
    const ws = (await doc()).getWorksheet('So sánh giá')!
    expect(hangCo(ws, 'Thép hộp 20×40 · dày 1.0').getCell(10).value).toBe(19505)
    expect(hangCo(ws, 'thép hộp 20x40').getCell(18).value).toBe(
      'Chưa chọn quy cách — khớp 2: Thép hộp 20×40 · dày 1.0 / Thép hộp 20×40 · dày 0.8',
    )
  })

  it('tờ 1: dòng tổng chỉ cộng món có giá chốt; có dòng ký ba bên + tên người lập', async () => {
    const ws = (await doc()).getWorksheet('So sánh giá')!
    const tong = hangCo(ws, 'Tổng cộng (chưa VAT) — không gồm món chưa có giá chốt và giá tham khảo') // prettier-ignore
    expect(tong.getCell(17).value).toBe(73_450_000 + 19_500_000)
    const v = giaTri(ws)
    for (const t of ['NGƯỜI LẬP', 'TRƯỞNG PHÒNG CUNG ỨNG', 'GIÁM ĐỐC', 'Trương Thanh Truyền']) expect(v).toContain(t) // prettier-ignore
    expect(v).toContain('707 dòng đơn')
  })

  it('tờ 3: mỗi phương án một dòng kèm nguồn, phép quy đổi và dấu đang chọn', async () => {
    const ws = (await doc()).getWorksheet('Chi tiết lần mua')!
    const v = giaTri(ws)
    expect(v).toContain('Đơn nháp (chưa chốt)')
    expect(v).toContain('106.500 đ/Cây ÷ 5,46 kg/Cây')
    expect(v).toContain('Về đủ')
    const chon = hangCo(ws, 'Nhôm ống phi 25 · dày 1.0')
    expect(chon.getCell(3).value).toBe('Nhôm Thép Quang Minh')
  })
})

describe('ghiChuMon', () => {
  it('giá hỏi được ghi ngày + lời ghi chú', () => {
    const m = mon('nhôm phi 25', 1, PHI25, 'hoi:h1', [{ id: 'h1', ncc: 'Nhôm Hoàng Vũ', gia: 105000, ghi_chu: 'báo qua Zalo', at: '2026-10-28' }]) // prettier-ignore
    expect(ghiChuMon(m)).toBe('Giá hỏi 28/10/2026: báo qua Zalo')
  })
})

it('tên file theo ngày lập, không dấu', () => {
  expect(traGiaExcelFilename('2026-10-28')).toBe('Tra-gia-vat-tu_28-10-2026.xlsx')
})

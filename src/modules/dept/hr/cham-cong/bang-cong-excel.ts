import ExcelJS from 'exceljs'
import {
  SO_CAP,
  ghiChuNgay,
  type CongNgay,
  type TongCong,
} from '@/lib/cham-cong/chi-tiet-cong'
import { LOAI_NGHI, KY_NGHI, TEN_NGHI } from '@/lib/cham-cong/dieu-chinh'
import type { NhomTc } from '@/lib/cham-cong/chi-tiet-cong'

/**
 * HAI FILE EXCEL CHẤM CÔNG THEO MẪU PHẦN MỀM CŨ (user 20/10/2026: "1 dữ liệu chấm công và
 * 1 file tổng hợp như thư mục tôi gửi" — `E:\chấm công\tổ X.xlsx` + `tổng hợp tổ X.xlsx`):
 *   - CHI TIẾT: mỗi người một khối "BẢNG CHI TIẾT CHẤM CÔNG" (tổng đầu khối, các loại vắng,
 *     mỗi ngày một dòng Vào/Ra ×3 · Trễ · Sớm · Công · T.Giờ · T.Ca1–3 · Nơi làm việc, chỗ
 *     ký), mỗi khối một trang in.
 *   - TỔNG HỢP: tờ "Xuất tổng" — đơn vị, kỳ, mỗi người một dòng, ghi chú ký hiệu.
 * Khác mẫu cũ có chủ đích: cột "Q.Đêm" (ERP không tách ca đêm) thay bằng "Lễ"; ký hiệu
 * nghỉ theo ERP (P/Ô/R/CT/KL); thêm "Thiếu lượt" vì ngày 1 lượt không được tính âm thầm.
 * Số lấy từ Bảng công (`gioCongService.bang` + `chiTietNgay` + `tongCong`).
 */

export type NguoiXuat = {
  ma: string
  ten: string
  boPhan: string
  chucVu: string | null
  ngayVao: string | null
  ngay: CongNgay[]
  /** 'YYYY-MM-DD' → máy đã quẹt ngày đó ('Máy 201'…). */
  may: Record<string, string[]>
  tong: TongCong
}

export type BangXuat = {
  tu: string
  den: string
  /** Tên nhóm đang xuất (tổ / "Khối văn phòng" / "Cả công ty"). */
  nhom: string
  congTy: { ten: string; diaChi: string }
  nhanTc: Record<NhomTc, string>
  phutMotCong: number
  /** Kỳ đã chốt hay đang tạm tính — in lên đầu tờ để không ai lấy số tạm đi trả lương. */
  tinhTrang: string
  nguoi: NguoiXuat[]
}

const THU = ['CN', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy']
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const r2 = (x: number) => Math.round(x * 100) / 100
const VANG = 'FFFFFF00'
const nen = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const
const vien = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
} as const

/** Ký hiệu cột "Các loại vắng" của khối chi tiết + tổng hợp. */
const LOAI_VANG = ['V', '?', ...LOAI_NGHI.map((k) => KY_NGHI[k]), 'L'] as const

function demVang(n: NguoiXuat): number[] {
  const le = n.ngay.filter((d) => d.loai === 'le' && !d.tinhDuoc).length
  return [n.tong.vang, n.tong.thieu, ...LOAI_NGHI.map((k) => n.tong.nghi[k] ?? 0), le]
}

// ───────────────────────────── CHI TIẾT ─────────────────────────────

/** Ngày, Thứ · cặp Vào/Ra · Trễ, Sớm, Công, T.Giờ, T.Ca1–3 · Nơi làm việc, Ghi chú. */
const COT_CT = 2 + 2 * SO_CAP + 7 + 2

/** Vẽ các khối "BẢNG CHI TIẾT CHẤM CÔNG" của `ds` vào tờ `ws`, mỗi người một trang in. */
function veChiTiet(ws: ExcelJS.Worksheet, b: BangXuat, ds: NguoiXuat[]): void {
  const p1 = b.phutMotCong
  let r = 1
  const gop = (row: number, c1: number, c2: number) => {
    if (c2 > c1) ws.mergeCells(row, c1, row, c2)
  }
  const o = (row: number, col: number, v: ExcelJS.CellValue, bold = false) => {
    const c = ws.getCell(row, col)
    c.value = v
    if (bold) c.font = { bold: true }
    return c
  }

  for (const [idx, n] of ds.entries()) {
    // Tiêu đề khối
    o(r, 1, 'BẢNG CHI TIẾT CHẤM CÔNG').font = { bold: true, size: 14 }
    ws.getCell(r, 1).alignment = { horizontal: 'center' }
    gop(r, 1, COT_CT)
    ws.getRow(r).height = 21
    r++
    o(
      r,
      1,
      `Mã nhân viên: ${n.ma}   Tên nhân viên: ${n.ten}   Bộ phận: ${n.boPhan}   Kỳ: ${dmy(b.tu)} → ${dmy(b.den)}`,
      true,
    ).fill = nen(VANG)
    gop(r, 1, COT_CT)
    r++

    // Khối tổng: công · tăng ca · trễ/sớm (cùng chỗ như tờ cũ)
    const t = n.tong
    const hcT = t.hcThuong + t.hcCn + t.hcLe
    const tong: [
      string,
      number,
      number,
      string,
      number,
      string,
      number | string,
      string,
      number | string,
    ][] = [
      [
        'Ngày thường',
        r2(t.hcThuong / p1),
        r2(t.hcThuong / 60),
        `Tăng ca 1 (${b.nhanTc.tc1})`,
        r2(t.tc1 / 60),
        'Đi trễ',
        '',
        'Về sớm',
        '',
      ],
      [
        'Chủ nhật',
        r2(t.hcCn / p1),
        r2(t.hcCn / 60),
        `Tăng ca 2 (${b.nhanTc.tc2})`,
        r2(t.tc2 / 60),
        'Số lần',
        t.lanTre,
        'Số lần',
        t.lanSom,
      ],
      [
        'Ngày lễ',
        r2(t.hcLe / p1),
        r2(t.hcLe / 60),
        `Tăng ca 3 (${b.nhanTc.tc3})`,
        r2(t.tc3 / 60),
        'Số phút',
        t.phutTre,
        'Số phút',
        t.phutSom,
      ],
      [
        'TỔNG',
        r2(hcT / p1),
        r2(hcT / 60),
        'Tổng tăng ca',
        r2((t.tc1 + t.tc2 + t.tc3) / 60),
        '',
        '',
        '',
        '',
      ],
    ]
    for (const [a, cong, gio, tcN, tcV, treN, treV, somN, somV] of tong) {
      o(r, 1, a, true)
      gop(r, 1, 2)
      o(r, 3, cong, true)
      o(r, 4, gio, true)
      o(r, 6, tcN, true)
      gop(r, 6, 8)
      o(r, 9, tcV, true)
      o(r, 11, treN, true)
      gop(r, 11, 12)
      o(r, 13, treV, true)
      o(r, 14, somN, true)
      gop(r, 14, 15)
      o(r, 16, somV, true)
      r++
    }
    // Các loại vắng
    o(r, 2, 'Các loại vắng (ngày)').alignment = { horizontal: 'center' }
    gop(r, 2, 1 + LOAI_VANG.length)
    r++
    LOAI_VANG.forEach(
      (k, i) => (o(r, 2 + i, k, true).alignment = { horizontal: 'center' }),
    )
    r++
    demVang(n).forEach(
      (v, i) => (o(r, 2 + i, v, true).alignment = { horizontal: 'center' }),
    )
    r++
    o(r, 1, 'Chi tiết').alignment = { horizontal: 'center' }
    gop(r, 1, COT_CT)
    r++

    // Đầu bảng 2 dòng: 1 / 2 / 3 trên, Vào / Ra dưới
    const d1 = r
    const d2 = r + 1
    const dau = (col: number, text: string) => {
      o(d1, col, text, true)
      ws.mergeCells(d1, col, d2, col)
    }
    dau(1, 'Ngày')
    dau(2, 'Thứ')
    for (let i = 0; i < SO_CAP; i++) {
      o(d1, 3 + 2 * i, i + 1, true)
      gop(d1, 3 + 2 * i, 4 + 2 * i)
      o(d2, 3 + 2 * i, 'Vào', true)
      o(d2, 4 + 2 * i, 'Ra', true)
    }
    const sau = 3 + 2 * SO_CAP
    ;[
      'Trễ',
      'Sớm',
      'Công',
      'T.Giờ',
      'T.Ca1',
      'T.Ca2',
      'T.Ca3',
      'Nơi làm việc',
      'Ghi chú',
    ].forEach((h, i) => dau(sau + i, h))
    for (const row of [d1, d2])
      for (let c = 1; c <= COT_CT; c++) {
        const cell = ws.getCell(row, c)
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.fill = nen('FFF3F5F8')
        cell.border = vien
      }
    r += 2

    for (const d of n.ngay) {
      const vals: ExcelJS.CellValue[] = [
        dmy(d.ngay),
        THU[new Date(`${d.ngay}T00:00:00Z`).getUTCDay()],
      ]
      for (let i = 0; i < SO_CAP; i++) {
        const p = d.cap[i]
        vals.push(p?.vao ?? '', p ? (p.ra ?? (d.thieu ? '?' : '')) : '')
      }
      vals.push(
        d.tre || 0,
        d.som || 0,
        d.tinhDuoc ? r2(d.hc / p1) : 0,
        d.tinhDuoc ? r2(d.hc / 60) : 0,
        r2(d.tc1 / 60),
        r2(d.tc2 / 60),
        r2(d.tc3 / 60),
        (n.may[d.ngay] ?? []).join(', '),
        ghiChuNgay(
          {
            ngay: d.ngay,
            luot: (n.may[d.ngay] ?? []).map((m) => ({ may: m })),
            soLuotTho: 0,
            daLay: true,
          },
          d,
        )
          .filter((g) => g.tone !== 'mute' || /lượt giữa|đoạn/.test(g.text))
          .map((g) => g.text)
          .join(', '),
      )
      const row = ws.getRow(r)
      row.values = vals
      for (let c = 1; c <= COT_CT; c++) {
        const cell = row.getCell(c)
        cell.border = vien
        if (c > 2 && c < sau + 7) cell.alignment = { horizontal: 'center' }
      }
      const to = d.thieu
        ? 'FFFBECEB'
        : d.loai === 'le'
          ? 'FFFBF2E2'
          : d.loai === 'cn'
            ? 'FFF1EEF6'
            : null
      if (to) for (let c = 1; c <= COT_CT; c++) row.getCell(c).fill = nen(to)
      r++
    }

    // Chỗ ký
    r++
    o(r, sau, 'Kí tên', true).alignment = { horizontal: 'center' }
    gop(r, sau, sau + 3)
    r += 3
    o(r, sau, n.ten, true).alignment = { horizontal: 'center' }
    gop(r, sau, sau + 3)
    if (idx < ds.length - 1) ws.getRow(r).addPageBreak()
    r += 2
  }

  ws.columns.forEach((c, i) => {
    c.width =
      i === 0
        ? 11
        : i === 1
          ? 6
          : i < 2 + 2 * SO_CAP
            ? 7
            : i === COT_CT - 2
              ? 12
              : i === COT_CT - 1
                ? 22
                : 6.5
  })
}

// ───────────────────────────── TỔNG HỢP ─────────────────────────────

/** Vẽ tờ "Xuất tổng" cho `ds` (nhãn nhóm `tenNhom` ở dòng kỳ) vào tờ `ws`. */
function veTongHop(
  ws: ExcelJS.Worksheet,
  b: BangXuat,
  ds: NguoiXuat[],
  tenNhom: string,
): void {
  const p1 = b.phutMotCong
  const nhom: [string, string[]][] = [
    [
      '',
      ['STT', 'Mã nhân viên', 'Tên nhân viên', 'Phòng ban', 'Chức vụ', 'Ngày vào làm'],
    ],
    ['Ngày công', ['Thường', 'C.Nhật', 'Lễ']],
    ['Giờ công', ['Thường', 'C.Nhật', 'Lễ']],
    ['Vào trễ', ['Lần', 'Phút']],
    ['Ra sớm', ['Lần', 'Phút']],
    ['Tăng ca (giờ)', ['TC1', 'TC2', 'TC3']],
    ['', ['Vắng KP', 'Thiếu lượt']],
    ['Ngày nghỉ', LOAI_NGHI.map((k) => KY_NGHI[k])],
  ]
  const cot = nhom.reduce((s, [, c]) => s + c.length, 0)
  const tieuDe = (row: number, text: string, size = 11) => {
    ws.mergeCells(row, 1, row, cot)
    const c = ws.getCell(row, 1)
    c.value = text
    c.font = { bold: true, size }
    return c
  }
  tieuDe(1, `Đơn vị: ${b.congTy.ten}`)
  tieuDe(2, `Địa chỉ: ${b.congTy.diaChi}`)
  tieuDe(3, 'TỔNG HỢP CHẤM CÔNG', 14).alignment = { horizontal: 'center' }
  ws.getRow(3).height = 20
  tieuDe(
    4,
    `Từ ngày ${dmy(b.tu)} đến ngày ${dmy(b.den)} · ${tenNhom} · ${b.tinhTrang}`,
  ).alignment = { horizontal: 'center' }

  // Đầu bảng 2 dòng (dòng 6–7)
  let c = 1
  for (const [ten, cs] of nhom) {
    if (!ten) {
      cs.forEach((x, i) => {
        ws.getCell(6, c + i).value = x
        ws.mergeCells(6, c + i, 7, c + i)
      })
    } else {
      ws.getCell(6, c).value = ten
      ws.mergeCells(6, c, 6, c + cs.length - 1)
      cs.forEach((x, i) => (ws.getCell(7, c + i).value = x))
    }
    c += cs.length
  }
  for (const row of [6, 7]) {
    ws.getRow(row).height = row === 7 ? 25.5 : 18
    for (let i = 1; i <= cot; i++) {
      const cell = ws.getCell(row, i)
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.fill = nen('FFF3F5F8')
      cell.border = vien
    }
  }

  let r = 8
  for (const [i, n] of ds.entries()) {
    const t = n.tong
    const row = ws.getRow(r++)
    row.values = [
      i + 1,
      n.ma,
      n.ten,
      n.boPhan,
      n.chucVu ?? '',
      n.ngayVao ? dmy(n.ngayVao) : '',
      r2(t.hcThuong / p1),
      r2(t.hcCn / p1),
      r2(t.hcLe / p1),
      r2(t.hcThuong / 60),
      r2(t.hcCn / 60),
      r2(t.hcLe / 60),
      t.lanTre,
      t.phutTre,
      t.lanSom,
      t.phutSom,
      r2(t.tc1 / 60),
      r2(t.tc2 / 60),
      r2(t.tc3 / 60),
      t.vang,
      t.thieu,
      ...LOAI_NGHI.map((k) => t.nghi[k] ?? 0),
    ]
    for (let k = 1; k <= cot; k++) row.getCell(k).border = vien
    if (t.thieu) row.getCell(21).font = { bold: true, color: { argb: 'FFB0241A' } }
  }

  // Dòng cộng
  const tong = ws.getRow(r)
  tong.getCell(3).value = `Cộng ${ds.length} người`
  for (let k = 7; k <= cot; k++) {
    const col = ws.getColumn(k).letter
    tong.getCell(k).value = { formula: `SUM(${col}8:${col}${r - 1})` }
  }
  tong.font = { bold: true }
  for (let k = 1; k <= cot; k++) {
    tong.getCell(k).border = vien
    tong.getCell(k).fill = nen('FFF3F5F8')
  }
  r += 2

  // Ghi chú ký hiệu (như tờ cũ)
  const ghi = [
    'Ghi chú:',
    `Ngày công = giờ ca hành chính ÷ ${p1 / 60}; Thường: ngày thường, C.Nhật: chủ nhật, Lễ: ngày lễ`,
    `TC1: tăng ca ${b.nhanTc.tc1}, TC2: tăng ca ${b.nhanTc.tc2}, TC3: tăng ca ${b.nhanTc.tc3}`,
    `Vắng KP: ngày thường không quẹt, không nghỉ có lý do; Thiếu lượt: có 1 lượt, chưa bổ sung (0 giờ)`,
    LOAI_NGHI.map((k) => `${KY_NGHI[k]}: ${TEN_NGHI[k]}`).join('; '),
  ]
  for (const [i, g] of ghi.entries()) ws.getCell(r + i, i === 0 ? 2 : 3).value = g
  ws.getCell(r, 2).font = { bold: true }

  ws.columns.forEach((col, i) => {
    col.width = [5, 11, 26, 18, 14, 12][i] ?? 7.5
    if (i >= 6) col.numFmt = '#,##0.##'
  })
  ws.views = [{ state: 'frozen', ySplit: 7, xSplit: 3 }]
}

// ───────────────────────────── CHIA THEO TỔ ─────────────────────────────

const KHO_IN = (orientation: 'portrait' | 'landscape') => ({
  pageSetup: {
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  },
})

/**
 * Người theo tổ, giữ thứ tự xuất hiện (đúng thứ tự Bảng công). User 20/10/2026 chọn
 * "một file, mỗi tổ một tờ" thay vì file nén mỗi tổ một file.
 */
function theoTo(ds: NguoiXuat[]): [string, NguoiXuat[]][] {
  const m = new Map<string, NguoiXuat[]>()
  for (const n of ds) m.set(n.boPhan, [...(m.get(n.boPhan) ?? []), n])
  return [...m]
}

/** Tên tờ Excel hợp lệ: bỏ ký tự cấm `[]:*?/\`, tối đa 31 ký tự, không trùng. */
function tenTo(ten: string, daDung: Set<string>): string {
  const goc =
    ten
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Tờ'
  let t = goc
  for (let i = 2; daDung.has(t.toLowerCase()); i++) t = `${goc.slice(0, 28)} ${i}`
  daDung.add(t.toLowerCase())
  return t
}

/** File CHI TIẾT: một tổ thì một tờ; nhiều tổ thì mỗi tổ một tờ mang tên tổ. */
export async function buildChiTietExcel(b: BangXuat): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const nhom = theoTo(b.nguoi)
  const daDung = new Set<string>()
  if (nhom.length <= 1)
    veChiTiet(wb.addWorksheet('Chi Tiet', KHO_IN('portrait')), b, b.nguoi)
  else
    for (const [to, ds] of nhom)
      veChiTiet(wb.addWorksheet(tenTo(to, daDung), KHO_IN('portrait')), b, ds)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/**
 * File TỔNG HỢP: một tổ thì một tờ "Xuất tổng"; nhiều tổ thì tờ đầu là cả nhóm
 * ("Cả công ty" / "Khối văn phòng"), sau đó mỗi tổ một tờ.
 */
export async function buildTongHopExcel(b: BangXuat): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const nhom = theoTo(b.nguoi)
  const daDung = new Set<string>()
  veTongHop(
    wb.addWorksheet(
      nhom.length <= 1 ? 'Xuất tổng' : tenTo(b.nhom, daDung),
      KHO_IN('landscape'),
    ),
    b,
    b.nguoi,
    b.nhom,
  )
  if (nhom.length > 1)
    for (const [to, ds] of nhom)
      veTongHop(wb.addWorksheet(tenTo(to, daDung), KHO_IN('landscape')), b, ds, to)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

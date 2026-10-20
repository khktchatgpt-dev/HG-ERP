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
      `Mã nhân viên: ${maSo(n.ma)}   Tên nhân viên: ${n.ten}   Bộ phận: ${n.boPhan}   Kỳ: ${dmy(b.tu)} → ${dmy(b.den)}`,
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

/**
 * Mã như sổ NS / KT: mã máy 1–3 chữ số đệm 0 thành 5 ký tự (494 → "00494"), mã 4 chữ số
 * giữ nguyên ("1058", "6049"). Bảng lương KT VLOOKUP theo đúng chuỗi này.
 */
export const maSo = (ma: string) => (/^\d{1,3}$/.test(ma) ? ma.padStart(5, '0') : ma)

/**
 * Cột của tờ "Xuất tổng" — ĐÚNG VỊ TRÍ file TH tháng 9 Nhân sự chốt (user 20/10/2026):
 * bảng lương KT tra `VLOOKUP(mã, B8:AE…, 6)` = G ngày công và cột 27 / 28 / 29 = AB / AC /
 * AD tăng ca quy đổi. Đổi thứ tự cột là KT lấy sai số — có test canh.
 */
const COT_TH = 31 // A … AE
const TIEU_DE_TH: { cot: number; den?: number; ten: string; con?: string[] }[] = [
  { cot: 1, ten: 'STT' },
  { cot: 2, ten: 'Mã nhân viên' },
  { cot: 3, ten: 'Tên nhân viên' },
  { cot: 4, ten: 'Phòng ban' },
  { cot: 5, ten: 'Chức vụ' },
  { cot: 6, ten: 'Ngày vào làm' },
  { cot: 7, den: 9, ten: 'Ngày công', con: ['Thường', 'C.Tuần', 'Q.Đêm'] },
  { cot: 10, den: 12, ten: 'Giờ công', con: ['Thường', 'Q.Đêm', 'C.Tuần'] },
  { cot: 13, den: 14, ten: 'Vào trễ', con: ['Lần', 'Phút'] },
  { cot: 15, den: 16, ten: 'Ra sớm', con: ['Lần', 'Phút'] },
  { cot: 17, den: 19, ten: 'Tăng ca', con: ['TC1', 'TC2', 'TC3'] },
  { cot: 20, ten: 'Vắng KP' },
  { cot: 21, den: 27, ten: 'Ngày nghỉ', con: ['OM', 'TS', 'R', 'Ro', 'F', 'CO', 'CT'] },
  { cot: 28, ten: 'TCA 16h-19h' },
  { cot: 29, ten: 'TCA 19h-22h' },
  { cot: 30, ten: 'TC 22h-6h' },
  { cot: 31, ten: 'TỔNG CÔNG' },
]
/** Độ rộng cột như file TH tổ Phôi. */
const RONG_TH = [
  4.4, 12.4, 27.1, 16, 11.6, 11, 8, 8, 8, 7.6, 7.4, 7.4, 7.4, 7.4, 7.4, 6.1, 6.1, 6.1,
  6.1, 6.1, 6.1, 3.9, 3.9, 3.9, 3.9, 3.9, 3.9, 6.1, 6.1, 6.1, 7.3,
]
const ARIAL = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({
  name: 'Arial',
  size: 10,
  ...o,
})

/** Vẽ tờ "Xuất tổng" cho `ds` vào tờ `ws` — bố cục file TH tháng 9 (A–AE). */
function veTongHop(
  ws: ExcelJS.Worksheet,
  b: BangXuat,
  ds: NguoiXuat[],
  tenNhom: string,
): void {
  const p1 = b.phutMotCong
  const dong = (
    row: number,
    text: string,
    o: Partial<ExcelJS.Font> = {},
    giua = false,
  ) => {
    ws.mergeCells(row, 1, row, COT_TH)
    const c = ws.getCell(row, 1)
    c.value = text
    c.font = ARIAL({ bold: true, ...o })
    if (giua) c.alignment = { horizontal: 'center' }
  }
  dong(1, `Đơn vị: ${b.congTy.ten}`)
  dong(2, `Địa chỉ: ${b.congTy.diaChi}`)
  dong(3, 'TỔNG HỢP CHẤM CÔNG', { size: 14 }, true)
  dong(4, `Từ ngày ${dmy(b.tu)} đến ngày ${dmy(b.den)}`, {}, true)

  // Đầu bảng hai dòng 6–7
  for (const h of TIEU_DE_TH) {
    ws.getCell(6, h.cot).value = h.ten
    if (h.con) {
      ws.mergeCells(6, h.cot, 6, h.den!)
      h.con.forEach((t, i) => (ws.getCell(7, h.cot + i).value = t))
    } else ws.mergeCells(6, h.cot, 7, h.cot)
  }
  for (const row of [6, 7])
    for (let c = 1; c <= COT_TH; c++) {
      const cell = ws.getCell(row, c)
      cell.font = ARIAL({ bold: true })
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = vien
    }
  ws.getRow(6).height = 30
  ws.getRow(7).height = 25.5

  let r = 8
  for (const [i, n] of ds.entries()) {
    const t = n.tong
    // Ngày công gồm cả chủ nhật, lễ có đi làm — đúng như sổ NS chốt (C.Tuần, Q.Đêm để trống).
    // Cộng công TỪNG NGÀY đã làm tròn 2 số như file Chi tiết, không chia tổng phút.
    const cong = r2(n.ngay.reduce((s, d) => s + (d.tinhDuoc ? r2(d.hc / p1) : 0), 0))
    const gioHc = r2((t.hcThuong + t.hcCn + t.hcLe) / 60)
    const so = (x: number) => (x ? x : null)
    const row = ws.getRow(r)
    row.values = [
      i + 1,
      maSo(n.ma),
      n.ten,
      n.boPhan,
      n.chucVu ?? '',
      n.ngayVao ? new Date(`${n.ngayVao}T00:00:00Z`) : '',
      cong,
      null,
      null,
      gioHc,
      null,
      null,
      t.lanTre,
      t.phutTre,
      t.lanSom,
      t.phutSom,
      so(r2(t.tc1 / 60)),
      so(r2(t.tc2 / 60)),
      so(r2(t.tc3 / 60)),
      t.vang,
      t.nghi.sick ?? 0,
      0,
      t.nghi.personal ?? 0,
      t.nghi.unpaid ?? 0,
      t.nghi.annual ?? 0,
      0,
      t.nghi.business_trip ?? 0,
    ]
    // Bốn cột quy đổi — CÔNG THỨC như file TH (KT đọc được cách ra số), kèm kết quả sẵn.
    const tc1 = r2(t.tc1 / 60),
      tc2 = r2(t.tc2 / 60),
      tc3 = r2(t.tc3 / 60)
    const ab = r2((tc1 * 0.5) / 3),
      ac = r2((tc2 * 0.5) / 3),
      ad = r2((tc3 / 8) * 2.1)
    row.getCell(28).value = { formula: `ROUND((Q${r}*0.5/3),2)`, result: ab }
    row.getCell(29).value = { formula: `ROUND((R${r}*0.5/3),2)`, result: ac }
    row.getCell(30).value = { formula: `ROUND(S${r}/8*2.1,2)`, result: ad }
    row.getCell(31).value = {
      formula: `ROUND(G${r}+H${r}+I${r}+AB${r}+AC${r}+AD${r},2)`,
      result: r2(cong + ab + ac + ad),
    }
    for (let c = 1; c <= COT_TH; c++) {
      const cell = row.getCell(c)
      cell.border = vien
      cell.font = ARIAL(c === 31 ? { bold: true } : {})
    }
    row.getCell(6).font = ARIAL({ size: 8 })
    row.getCell(6).numFmt = 'dd/mm/yyyy'
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
    for (const c of [28, 29, 30, 31]) row.getCell(c).numFmt = '0.00'
    r++
  }

  // Ghi chú như file TH, thêm cách ra số và người còn thiếu lượt chưa bổ sung.
  r++
  ws.getCell(r, 2).value = 'Ghi chú:'
  ws.getCell(r, 2).font = ARIAL({ bold: true })
  const thieu = ds.filter((n) => n.tong.thieu > 0)
  const ghi = [
    'Thường: Ngày thường, CTuần: Cuối tuần, Q.Đêm: Ca làm việc có qua đêm',
    `TC1: Tăng ca ${b.nhanTc.tc1}, TC2: Tăng ca ${b.nhanTc.tc2}, TC3: Tăng ca ${b.nhanTc.tc3}`,
    'OM:Nghỉ ốm; TS:Nghỉ Thai Sản; R:Việc riêng có lương; Ro:Việc riêng không lương; F:Nghỉ phép năm; CO:Con ốm; CT:Nghỉ công tác;',
    `Ngày công gồm cả chủ nhật và ngày lễ có đi làm; công = giờ ca hành chính ÷ ${p1 / 60}. TCA = giờ × 0,5 ÷ 3; TC 22h-6h = giờ ÷ 8 × 2,1.`,
    `Xuất từ ERP · ${tenNhom} · ${b.tinhTrang}.`,
    thieu.length
      ? `Còn thiếu lượt chưa bổ sung (0 công những ngày đó): ${thieu.map((n) => `${maSo(n.ma)} ${n.ten} ${n.tong.thieu} ngày`).join('; ')}`
      : 'Không còn ngày thiếu lượt chưa bổ sung.',
  ]
  ghi.forEach((g, i) => {
    const c = ws.getCell(r + 1 + i, 3)
    c.value = g
    c.font = ARIAL(i >= 5 && thieu.length ? { color: { argb: 'FFB0241A' } } : {})
  })

  RONG_TH.forEach((w, i) => (ws.getColumn(i + 1).width = w))
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
  // Cột AB–AE là công thức; ô có kết quả 0 không được lưu sẵn → bắt Excel tính lại khi mở.
  wb.calcProperties.fullCalcOnLoad = true
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

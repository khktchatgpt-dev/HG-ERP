import ExcelJS from 'exceljs'
import {
  DATE_FMT,
  MONEY_FMT,
  NUM_FMT_LE,
  applyWidths,
  dateCell,
  finishTable,
  groupRow,
  headerRow,
  noteRow,
  stampWorkbook,
  titleRow,
  totalRow,
} from '@/modules/dept/supply/excel-kit'
import { NHAN_COT } from '@/lib/kho-nxt'
import type { NxtBaoCao, NxtDong } from './nxt.service'

/**
 * XUẤT EXCEL BÁO CÁO NHẬP–XUẤT–TỒN (B6, Q5 duyệt 19/10/2026) — hai tờ:
 *
 *   Tổng hợp N–X–T — đúng các cột của màn, theo nhóm, có dòng cộng nhóm. Có
 *                    thêm cột tiền tồn đầu / nhập / xuất cho kế toán lên sổ 152.
 *   Chi tiết phiếu — mỗi dòng sổ một hàng (ngày CT, số phiếu, mã lý do, mã VT,
 *                    nhập, xuất, đơn giá), có lọc tự động để kế toán tự lọc.
 *
 * Số lượng không có dòng cộng (mỗi mã một ĐVT); chỉ cộng TIỀN.
 */

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export function nxtExcelFilename(bc: Pick<NxtBaoCao, 'tu' | 'den' | 'homNay'>): string {
  const tam = bc.den > bc.homNay ? ' (tam tinh)' : ''
  return `Nhap xuat ton ${bc.tu.slice(8, 10)}-${bc.tu.slice(5, 7)} den ${bc.den.slice(8, 10)}-${bc.den.slice(5, 7)}-${bc.den.slice(0, 4)}${tam}.xlsx` // prettier-ignore
}

const COT_TONG = [
  'Mã',
  'Tên vật tư',
  'ĐVT',
  'Tồn đầu',
  'Giá trị tồn đầu',
  NHAN_COT.mua,
  NHAN_COT.hoan,
  NHAN_COT.kkThua,
  NHAN_COT.nhapKhac,
  'Cộng nhập',
  'Giá trị nhập',
  NHAN_COT.choLenh,
  NHAN_COT.kkThieu,
  'Xuất khác',
  'Cộng xuất',
  'Giá trị xuất',
  'Tồn cuối',
  'Đơn giá BQ',
  'Giá trị tồn cuối',
  'Ghi chú',
]
const SL_COLS = [4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 17]
const TIEN_COLS = [5, 11, 16, 18, 19]

function ghiChu(r: NxtDong): string {
  const p: string[] = []
  if (r.thieu_gia > 0) p.push(`thiếu giá ${r.thieu_gia}/${r.lan_mua} lần nhập`)
  if (r.thieu_ty_gia > 0) p.push(`${r.thieu_ty_gia} dòng ngoại tệ thiếu tỷ giá`)
  if (r.ton_cuoi < 0) p.push('tồn âm — không định giá')
  if (r.don_gia == null) p.push('chưa lần nhập nào có giá')
  return p.join(' · ')
}

export async function buildNxtExcel(
  bc: NxtBaoCao,
  chiPhatSinh: boolean,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, 'Báo cáo nhập xuất tồn')
  const rows = chiPhatSinh ? bc.rows.filter((r) => r.phat_sinh) : bc.rows
  const tam = bc.den > bc.homNay

  /* ── 1. Tổng hợp ─────────────────────────────────────────────────────── */
  const ws = wb.addWorksheet('Tổng hợp N–X–T')
  titleRow(ws, `BÁO CÁO NHẬP – XUẤT – TỒN KHO · ${dmy(bc.tu)} – ${dmy(bc.den)}`)
  if (tam) noteRow(ws, `TẠM TÍNH đến ${dmy(bc.homNay)} — kỳ chưa kết thúc, đơn giá bình quân còn đổi khi có phiếu nhập mới.`, 'warn') // prettier-ignore
  noteRow(ws, 'Kỳ theo NGÀY CHỨNG TỪ. Đơn giá xuất = bình quân gia quyền cả kỳ: (giá trị tồn đầu + giá trị nhập có giá) ÷ (SL tồn đầu + SL nhập có giá).') // prettier-ignore
  noteRow(ws, 'Đảo phiếu trừ vào cột của phiếu gốc. Nhập chưa có giá không tính là 0 (để trống). Dòng đơn USD quy VND theo tỷ giá chốt trên đơn.') // prettier-ignore
  ws.addRow([])
  const head = headerRow(ws, COT_TONG)
  const n = COT_TONG.length
  const nhom = new Map<string, NxtDong[]>()
  for (const r of rows) {
    const k = r.group_name ?? '(chưa phân nhóm)'
    const ds = nhom.get(k)
    if (ds) ds.push(r)
    else nhom.set(k, [r])
  }
  const tong = { dau: 0, nhap: 0, xuat: 0, cuoi: 0 }
  for (const [ten, ds] of nhom) {
    groupRow(ws, `${ten} · ${ds.length} mã`, n)
    const cong = { dau: 0, nhap: 0, xuat: 0, cuoi: 0 }
    for (const r of ds) {
      const row = ws.addRow([
        r.code,
        r.name,
        r.unit,
        r.ton_dau,
        r.gt_dau,
        r.nhap.mua,
        r.nhap.hoan,
        r.nhap.kkThua,
        r.nhap.nhapKhac,
        r.cong_nhap,
        r.gt_nhap,
        r.xuat.choLenh,
        r.xuat.kkThieu,
        r.xuat.xuatKhac,
        r.cong_xuat,
        r.gt_xuat,
        r.ton_cuoi,
        r.don_gia,
        r.gt_cuoi,
        ghiChu(r),
      ])
      for (const c of SL_COLS) row.getCell(c).numFmt = NUM_FMT_LE
      for (const c of TIEN_COLS) row.getCell(c).numFmt = MONEY_FMT
      cong.dau += r.gt_dau ?? 0
      cong.nhap += r.gt_nhap ?? 0
      cong.xuat += r.gt_xuat ?? 0
      cong.cuoi += r.gt_cuoi ?? 0
    }
    const t = totalRow(ws, `Cộng ${ten}`, { 5: cong.dau, 11: cong.nhap, 16: cong.xuat, 19: cong.cuoi }) // prettier-ignore
    for (const c of TIEN_COLS) t.getCell(c).numFmt = MONEY_FMT
    tong.dau += cong.dau
    tong.nhap += cong.nhap
    tong.xuat += cong.xuat
    tong.cuoi += cong.cuoi
  }
  const t = totalRow(ws, `TỔNG CỘNG ${rows.length} mã`, { 5: tong.dau, 11: tong.nhap, 16: tong.xuat, 19: tong.cuoi }) // prettier-ignore
  for (const c of TIEN_COLS) t.getCell(c).numFmt = MONEY_FMT
  applyWidths(
    ws,
    [12, 40, 8, 11, 15, 11, 10, 10, 10, 11, 16, 11, 10, 10, 11, 16, 11, 13, 16, 34],
  )
  finishTable(ws, { head, autoFilter: false, landscape: true, freezeCols: 2 })

  /* ── 2. Chi tiết phiếu ───────────────────────────────────────────────── */
  const wd = wb.addWorksheet('Chi tiết phiếu')
  titleRow(wd, `CHI TIẾT DÒNG SỔ KHO · ${dmy(bc.tu)} – ${dmy(bc.den)}`)
  noteRow(wd, 'Mỗi dòng sổ một hàng. Dòng đảo phiếu mang số ÂM ở phía của phiếu gốc. "Mã suy ra" = dòng cũ không ghi mã, suy theo loại chứng từ.') // prettier-ignore
  wd.addRow([])
  const hd = headerRow(wd, ['Ngày CT', 'Số phiếu', 'Mã lý do', 'Mã suy ra', 'Mã VT', 'Tên vật tư', 'ĐVT', 'Nhập', 'Xuất', 'Đơn giá dòng', 'Diễn giải']) // prettier-ignore
  const theoId = new Map(bc.rows.map((r) => [r.material_id, r]))
  const tat = Object.entries(bc.chiTiet)
    .flatMap(([mid, ds]) => ds.map((x) => ({ x, m: theoId.get(mid) })))
    .sort((a, b) => a.x.ngay.localeCompare(b.x.ngay) || (a.x.doc_code ?? '').localeCompare(b.x.doc_code ?? '')) // prettier-ignore
  for (const { x, m } of tat) {
    const row = wd.addRow([
      dateCell(x.ngay),
      x.doc_code ?? '',
      x.ma ?? '',
      x.suy ? 'có' : '',
      m?.code ?? '',
      m?.name ?? '',
      m?.unit ?? '',
      x.nhap,
      x.xuat,
      x.gia,
      x.dien_giai ?? '',
    ])
    row.getCell(1).numFmt = DATE_FMT
    row.getCell(8).numFmt = NUM_FMT_LE
    row.getCell(9).numFmt = NUM_FMT_LE
    row.getCell(10).numFmt = MONEY_FMT
  }
  applyWidths(wd, [11, 15, 9, 9, 12, 40, 8, 11, 11, 13, 60])
  finishTable(wd, { head: hd, autoFilter: true, landscape: true })

  return Buffer.from(await wb.xlsx.writeBuffer())
}

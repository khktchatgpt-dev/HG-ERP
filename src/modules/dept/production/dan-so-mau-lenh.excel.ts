import ExcelJS from 'exceljs'
import type { MauLenh } from './dan-so.service'
import { tenTo } from '@/lib/dan-so-mau'

/**
 * FILE MẪU NHẬP LIỆU THEO LỆNH (bản vẽ v2, 19/11/2026).
 * Mỗi công đoạn một tờ. Bốn hàng đầu mang thông tin để tải lên khỏi phải chọn:
 *   1: Lệnh · Công đoạn · Tổ (danh sách chọn) · Đếm theo
 *   2: Khoảng ngày · Mã khoá (LSX:<id>|CD:<mã>|v1 — tải lên chỉ tin mã này, không tin tên tờ)
 *   3: hướng dẫn · 4: tiêu đề cột
 * Cột cố định (xám, khoá): Mã SP · Cụm · Chi tiết/Cụm · CT/SP · Cần · Đã làm. Cột ngày (vàng,
 * mở khoá): số ĐẠT trong ngày; ô có sẵn số là số hệ thống đã ghi cho tổ điền sẵn.
 * Tờ ẩn `_khoa`: id lệnh, phiên bản, danh sách tổ và mã SP cho ô chọn.
 */
export const MAU_PHIEN_BAN = 1
const FILL = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
})
const XAM = FILL('FFECEFF3')
const VANG = FILL('FFFFF8D6')
const DAM = FILL('FF1F2A3D')
const dmy = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const SO_DONG_MOI = 6

export async function buildMauLenhExcel(m: MauLenh): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const dung = new Set<string>(['_KHOA'])
  const tenTos = [...new Set(m.teams.map((t) => t.name))]
  const maList = [...new Set(m.to.flatMap((t) => t.dong.map((d) => d.ma)))]

  for (const t of m.to) {
    const ws = wb.addWorksheet(tenTo(t.label, dung), {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
    })
    const nCot = 6 + m.cot.length
    const hanhMoi = t.don_vi === 'chi tiết' ? SO_DONG_MOI : 0

    ws.getRow(1).values = [
      'Lệnh',
      m.lsx_code,
      '',
      '',
      'Công đoạn',
      t.label,
      'Tổ',
      t.to?.name ?? '',
      '',
      'Đếm theo',
      t.don_vi,
    ]
    ws.getRow(2).values = [
      'Khoảng ngày',
      `${dmy(m.cot[0])} → ${dmy(m.cot[m.cot.length - 1])}`,
      '',
      '',
      'Mã khoá',
      `LSX:${m.lsx_id}|CD:${t.stage}|v${MAU_PHIEN_BAN}`,
    ]
    ws.getRow(3).values = [
      'Điền số lượng ĐẠT trong ngày vào ô vàng. Ô đã có số là số hệ thống đã ghi — sửa số cũ ở Sổ theo ngày, không sửa ở đây. Đừng sửa mã khoá.',
    ]
    ws.mergeCells(3, 1, 3, Math.max(nCot, 10))
    for (const r of [1, 2]) {
      ws.getRow(r).eachCell((c, i) => {
        if ((r === 1 && [1, 5, 7, 10].includes(i)) || (r === 2 && [1, 5].includes(i))) {
          c.font = { bold: true }
        }
        c.fill = XAM
      })
    }
    ws.getCell('H1').fill = VANG
    ws.getCell('H1').protection = { locked: false }
    // Ô Tổ: chọn trong danh sách các tổ sản xuất.
    if (tenTos.length > 0) {
      ws.getCell('H1').dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`_khoa!$D$1:$D$${tenTos.length}`],
        showErrorMessage: true,
        errorTitle: 'Tổ',
        error: 'Chọn tổ trong danh sách.',
      }
    }

    const head = [
      'Mã SP',
      'Cụm',
      t.don_vi === 'cụm' ? 'Cụm (đại diện)' : 'Chi tiết',
      'CT/SP',
      'Cần',
      'Đã làm',
      ...m.cot.map(dmy),
    ]
    const hr = ws.getRow(4)
    hr.values = head
    hr.eachCell((c) => {
      c.fill = DAM
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    })

    let r = 5
    for (const d of t.dong) {
      const row = ws.getRow(r++)
      row.values = [
        d.ma,
        d.cum ?? '',
        d.ten,
        d.ct_sp,
        d.can,
        d.da_lam,
        ...m.cot.map((iso) => d.o[iso] ?? null),
      ]
      for (let i = 1; i <= nCot; i++) {
        const c = row.getCell(i)
        if (i <= 6) c.fill = XAM
        else {
          c.fill = VANG
          c.protection = { locked: false }
        }
      }
    }
    // Dòng mới (chỉ tờ đếm chi tiết): gõ Mã SP / Cụm / Tên / CT/SP + số.
    for (let k = 0; k < hanhMoi; k++) {
      const row = ws.getRow(r++)
      for (let i = 1; i <= nCot; i++) {
        const c = row.getCell(i)
        c.fill = VANG
        c.protection = { locked: false }
      }
      if (maList.length > 0) {
        row.getCell(1).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_khoa!$F$1:$F$${maList.length}`],
        }
      }
    }
    ws.getColumn(1).width = 14
    ws.getColumn(2).width = 18
    ws.getColumn(3).width = 34
    ws.getColumn(4).width = 7
    ws.getColumn(5).width = 10
    ws.getColumn(6).width = 10
    for (let i = 7; i <= nCot; i++) ws.getColumn(i).width = 11
    // Khoá phần cố định, mở các ô vàng; không đặt mật khẩu (gỡ khoá được nếu cần).
    await ws.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatColumns: true,
      formatRows: true,
    })
  }

  const kh = wb.addWorksheet('_khoa')
  kh.getCell('A1').value = 'lenh_id'
  kh.getCell('B1').value = m.lsx_id
  kh.getCell('A2').value = 'phien_ban'
  kh.getCell('B2').value = MAU_PHIEN_BAN
  tenTos.forEach((n, i) => (kh.getCell(`D${i + 1}`).value = n))
  maList.forEach((n, i) => (kh.getCell(`F${i + 1}`).value = n))
  kh.state = 'hidden'

  return Buffer.from(await wb.xlsx.writeBuffer())
}

export const mauLenhFilename = (m: MauLenh) =>
  `mau-nhap-lieu_${m.lsx_code.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-')}_${m.cot[0].slice(5).replace('-', '')}-${m.cot[m.cot.length - 1].slice(5).replace('-', '')}.xlsx`

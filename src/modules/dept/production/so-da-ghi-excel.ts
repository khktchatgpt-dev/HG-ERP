import ExcelJS from 'exceljs'
import type { SoDaGhiPayload } from './so-da-ghi.service'
import { isDraftStatus } from '@/lib/so-da-ghi'

/**
 * EXCEL Sổ đã ghi (Q7 bản vẽ 13/11/2026) — ĐÚNG CỘT sheet "Năng suất" của sổ
 * Excel cũ (ngày · mã hàng · cụm · chi tiết · ĐM kg · công đoạn · ca · CN ·
 * giờ/CN · SL · kg), thêm lỗi / người làm / phiếu ở cuối, để thống kê đối
 * chiếu song song trong thời gian ghi cả hai nơi. Đổ từ CÙNG payload màn bày.
 * Giờ công thuộc PHIẾU — chép lên từng dòng như sổ cũ, nhưng cột cuối nói rõ
 * "giờ của phiếu", đừng cộng dọc.
 */
const fmtD = (d: string) => d.split('-').reverse().join('/')

export async function buildSoDaGhiExcel(p: SoDaGhiPayload): Promise<Buffer> {
  const docById = new Map(p.docs.map((d) => [d.id, d]))
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Nang suat')
  const widths = [11, 15, 16, 26, 9, 12, 5, 6, 8, 9, 10, 7, 18, 16, 14, 12, 16]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  const team = p.team_id ? p.teams.find((t) => t.id === p.team_id)?.name : 'Mọi tổ'
  const t = ws.addRow([
    `SỔ ĐÃ GHI — ${team ?? ''} — ${p.from === p.to ? fmtD(p.from) : `${fmtD(p.from)} – ${fmtD(p.to)}`}`,
  ])
  t.font = { bold: true, size: 12 }
  const s = ws.addRow([
    'Giờ công là của PHIẾU (số CN × giờ), chép lên từng dòng như sổ cũ — đừng cộng dọc cột giờ. Dòng nháp chưa vào số.',
  ])
  s.font = { italic: true, color: { argb: 'FF666666' } }

  const h = ws.addRow([
    'Ngày',
    'Mã hàng',
    'Cụm',
    'Chi tiết',
    'ĐM kg',
    'Công đoạn',
    'Ca',
    'Số CN',
    'Giờ/CN',
    'SL',
    'Kg',
    'Lỗi',
    'Người làm',
    'Phiếu',
    'Trạng thái',
    'Lệnh',
    'Tổ',
  ])
  h.font = { bold: true }
  h.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1FC' } }
    c.border = { bottom: { style: 'thin' } }
  })

  const lines = [...p.lines].sort(
    (a, b) =>
      a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at),
  )
  for (const l of lines) {
    const d = l.doc_id ? docById.get(l.doc_id) : undefined
    const draft = isDraftStatus(d?.status)
    const row = ws.addRow([
      fmtD(l.entry_date),
      l.product_code ?? '',
      l.cluster ?? '',
      l.name,
      l.dm_kg,
      d?.stage_label ?? l.stage,
      d?.shift ?? null,
      d?.worker_count ?? null,
      d?.hours_per_worker ?? null,
      l.qty,
      l.kg,
      l.defect || null,
      l.worker,
      d?.doc_no ?? '',
      d?.kind === 'dau_ky'
        ? 'Đầu kỳ — luỹ kế tới hết ngày'
        : draft
          ? 'Nháp — chưa vào số'
          : 'Chính thức',
      d?.lsx_code ?? '',
      d?.team_name ?? '',
    ])
    row.getCell(5).numFmt = '0.0000'
    row.getCell(10).numFmt = '#,##0'
    row.getCell(11).numFmt = '#,##0.0'
    if (draft) row.font = { color: { argb: 'FF8A5200' } }
  }
  if (lines.length === 0) ws.addRow(['Không có dòng sổ nào trong khoảng này.'])
  return Buffer.from(await wb.xlsx.writeBuffer())
}

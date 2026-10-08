import ExcelJS from 'exceljs'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import { groupForBangKe, type BangKeRow } from '@/lib/lsx-bang-ke'
import {
  THU_TU_MUA,
  TINH_TRANG_MUA,
  demTinhTrangMua,
  tinhDongMua,
  type DongMua,
  type TinhTrangMua,
} from '@/lib/lsx-bang-ke-mua'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import type { LsxBangKe } from './lsx-bang-ke.service'
import {
  ACCENT,
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
} from './excel-kit'

/**
 * FILE EXCEL BẢNG KÊ VẬT TƯ CỦA LỆNH (08/10/2026) — cùng nguồn số với màn
 * `/mua-hang/bang-ke/[id]` (`loadLsxBangKe` + `tinhDongMua`), nên file và màn
 * không thể nói khác nhau về cùng một lệnh. Thay bản cũ trong
 * `lsx-detail-excel.ts` (kind 'bangke'): bản đó tách Cần mua / Đã đủ theo luật
 * `suggest` cũ, không trừ nháp, không làm tròn theo đơn vị mua.
 *
 * Chủ dự án: "file xuất dễ hiểu và có các tính năng phụ trợ đi kèm để dễ dùng".
 * Sáu tờ, mỗi tờ một việc:
 *   Tóm tắt      · lệnh, SP, nguồn số, đếm theo tình trạng, cách đọc file.
 *   Bảng kê      · mọi mã, gom theo nhóm; CÒN PHẢI ĐẶT và ƯỚC TIỀN là CÔNG THỨC
 *                  Excel — sửa Tồn / Nháp / Giá là số tự tính lại; tô màu theo
 *                  tình trạng; lọc + ghim đầu cột; cột Ghi chú trống để điền.
 *   Cần đặt      · chỉ mã còn phải đặt, có cột NCC chọn / Giá chào / Thành tiền
 *                  (công thức) — tờ gửi hỏi giá hoặc dán vào đơn.
 *   Theo SP      · mã × sản phẩm: định mức/SP × SL lệnh = cần, để dò ngược.
 *   Chưa quy đổi · dòng định mức bị chặn, vướng gì, ai gỡ.
 *   Đơn của lệnh · các đơn đang mang mã của lệnh.
 *
 * Thuần: nhận dữ liệu đã nạp, không chạm DB — test dựng file không cần Supabase.
 */

type Dong = { r: BangKeRow; d: DongMua }

const FILL: Partial<Record<TinhTrangMua, string>> = {
  chua_dat: 'FFFCECEB',
  nhap_thieu: 'FFFBF2E2',
  da_gui_thieu: 'FFFBF2E2',
  ngoai_dm: 'FFF3F5F8',
  chua_xac_nhan: 'FFF3F5F8',
  chua_dien: 'FFF3F5F8',
}

const fmtD = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('vi-VN') : '—'

function kv(ws: ExcelJS.Worksheet, label: string, value: ExcelJS.CellValue): void {
  const r = ws.addRow([label, value])
  r.getCell(1).font = { bold: true }
}

/** Ai gỡ dòng bị chặn — cùng luật với khối cuối màn (`bang-ke-chan.tsx`). */
export function aiGo(reason: string): string {
  return /dài một|chiều dài/i.test(reason)
    ? 'Cung ứng · khai dài cây ở hồ sơ vật tư'
    : 'Kỹ thuật · sửa ở hồ sơ SP'
}

function fillRow(row: ExcelJS.Row, argb: string, lastCol: number): void {
  for (let c = 1; c <= lastCol; c++) {
    row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  }
}

function numCells(row: ExcelJS.Row, cols: number[], fmt = NUM_FMT_LE): void {
  for (const c of cols) {
    row.getCell(c).numFmt = fmt
    row.getCell(c).alignment = { horizontal: 'right' }
  }
}

export async function buildBangKeExcel(
  bk: LsxBangKe,
  today: string,
  nguoiLap?: string | null,
): Promise<Buffer> {
  const { lsx } = bk
  const dong: Dong[] = bk.rows.map((r) => ({ r, d: tinhDongMua(r) }))
  const byId = new Map(dong.map((x) => [x.r.material_id, x]))
  const dem = demTinhTrangMua(dong.map((x) => x.d))
  const kiem = bk.products.filter((p) => p.bom_confirmed).length

  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `Bảng kê vật tư — LSX ${lsx.code}`)

  // ── Tóm tắt ─────────────────────────────────────────────────────────────
  const s0 = wb.addWorksheet('Tóm tắt')
  applyWidths(s0, [26, 70])
  titleRow(s0, `BẢNG KÊ VẬT TƯ — LSX ${lsx.code}`, 14)
  noteRow(s0, `Ngày lập ${fmtD(today)}${nguoiLap ? ` · ${nguoiLap}` : ''}`)
  s0.addRow([])
  kv(s0, 'Khách hàng', lsx.customer_name)
  kv(s0, 'Đơn hàng', lsx.order_codes.join(', ') || '—')
  kv(s0, 'Ngày xuất', fmtD(lsx.ship_date))
  kv(s0, 'Mốc vật tư', fmtD(lsx.materials_due_at))
  kv(
    s0,
    'Sản phẩm',
    bk.products
      .map((p) => `${p.code} × ${p.qty.toLocaleString('vi-VN')} — ${p.name}`)
      .join('\n') || '—',
  )
  s0.lastRow!.getCell(2).alignment = { wrapText: true, vertical: 'top' }
  s0.addRow([])
  s0.addRow(['NGUỒN SỐ CẦN']).font = { bold: true }
  kv(s0, 'Định mức', `${bk.products.length} SP × số lượng trên lệnh`)
  kv(s0, 'Kỹ thuật đã kiểm', `${kiem} / ${bk.products.length} SP`)
  kv(
    s0,
    'Định mức chưa kiểm',
    bk.include_draft
      ? 'ĐANG TÍNH (số để chuẩn bị, Kỹ thuật kiểm xong mới chốt)'
      : 'KHÔNG tính',
  )
  kv(s0, 'Dòng nhập tay', bk.manual_count)
  kv(s0, 'Chưa quy đổi được', `${bk.blocked.length} dòng — xem tờ "Chưa quy đổi"`)
  if (bk.unsplit_pos.length > 0) {
    kv(
      s0,
      'Đơn gộp lệnh chưa chia số',
      `${bk.unsplit_pos.map((p) => p.po_code).join(', ')} — phần của lệnh này đang tính 0`,
    )
  }
  s0.addRow([])
  s0.addRow(['TÌNH TRẠNG MUA']).font = { bold: true }
  headerRow(s0, ['Tình trạng', 'Số mã'])
  for (const t of THU_TU_MUA) {
    if (dem[t] === 0) continue
    const r = s0.addRow([TINH_TRANG_MUA[t].label, dem[t]])
    const f = FILL[t]
    if (f) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: f } }
  }
  s0.addRow(['Cộng', dong.length]).font = { bold: true }
  s0.addRow([])
  s0.addRow(['CÁCH ĐỌC FILE']).font = { bold: true }
  for (const t of [
    'Cần = định mức/SP × số lượng lệnh, làm tròn LÊN theo đơn vị mua (cây/con/cái tròn số; kg/m³/mét hai số lẻ).',
    'Tồn = tồn kho − đã giữ cho lệnh khác. Đã gửi NCC = đơn đã gửi, chưa về. Nháp = đơn nháp + chờ duyệt.',
    'Còn phải đặt = Cần − Tồn − Đã gửi − Nháp (CÔNG THỨC trong tờ "Bảng kê": sửa số là tự tính lại).',
    'Ước tiền = Còn phải đặt × giá mua gần nhất — chỉ để ước, không phải giá chào.',
    'Tờ "Cần đặt" lọc sẵn mã còn phải đặt, có cột NCC chọn / Giá chào để gửi hỏi giá hoặc dán vào đơn.',
    'Tờ "Theo SP" dò ngược mỗi mã đến từ sản phẩm nào. Tờ "Chưa quy đổi" là việc của Kỹ thuật / Cung ứng.',
  ]) {
    const r = s0.addRow([t])
    s0.mergeCells(r.number, 1, r.number, 2)
    r.getCell(1).alignment = { wrapText: true }
  }
  s0.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  // ── Bảng kê ─────────────────────────────────────────────────────────────
  const s1 = wb.addWorksheet('Bảng kê')
  const COLS1 = 17
  applyWidths(s1, [5, 11, 34, 18, 26, 7, 11, 9, 11, 10, 13, 16, 14, 24, 12, 14, 24])
  titleRow(s1, `BẢNG KÊ VẬT TƯ — LSX ${lsx.code} · ${lsx.customer_name}`)
  noteRow(
    s1,
    `Xuất ${fmtD(lsx.ship_date)} · mốc vật tư ${fmtD(lsx.materials_due_at)} · lập ${fmtD(today)} · ${dong.length} mã`,
  )
  noteRow(
    s1,
    'Còn phải đặt (K) và Ước tiền (P) là công thức — sửa Tồn / Nháp / Giá thì số tự tính lại.',
  )
  if (bk.include_draft)
    noteRow(
      s1,
      'Đang tính cả định mức Kỹ thuật chưa kiểm — số để chuẩn bị, chưa phải số chốt.',
      'warn',
    )
  s1.addRow([])
  const head1 = headerRow(s1, [
    'STT',
    'Mã VT',
    'Vật tư',
    'Quy cách',
    'Vị trí lắp',
    'ĐVT',
    'Cần',
    'Tồn',
    'Đã gửi NCC',
    'Nháp',
    'Còn phải đặt',
    'Tình trạng',
    'Đơn',
    'NCC gần nhất',
    'Giá gần nhất',
    'Ước tiền',
    'Ghi chú',
  ])
  let stt = 0
  const dataRows: number[] = []
  const khoi = groupForBangKe(bk.rows, partGroupLabel, partGroupRank)
  for (const k of khoi) {
    groupRow(s1, `${k.name} · ${k.rows.length} mã`, COLS1)
    for (const sub of k.subs) {
      if (sub.name)
        groupRow(s1, `${sub.name} · ${sub.rows.length} mã`, COLS1, { sub: true })
      for (const r of sub.rows) {
        const x = byId.get(r.material_id)!
        const m = x.d
        stt++
        const row = s1.addRow([
          stt,
          r.material_code,
          r.material_name,
          r.spec ?? '',
          (r.positions ?? []).join(', '),
          r.unit,
          m.can > 0 ? m.can : null,
          m.tonKhaDung,
          m.daGui > 0 ? m.daGui : null,
          m.nhap > 0 ? m.nhap : null,
          null,
          TINH_TRANG_MUA[m.tinhTrang].label,
          r.pos.map((p) => p.code).join(', '),
          r.last_price?.supplier_name ?? '',
          r.last_price ? r.last_price.unit_price : null,
          null,
          '',
        ])
        const n = row.number
        dataRows.push(n)
        row.getCell(11).value = {
          formula: `MAX(G${n}-H${n}-I${n}-J${n},0)`,
          result: m.conPhaiDat,
        }
        row.getCell(16).value = {
          formula: `IF(O${n}="","",K${n}*O${n})`,
          result: r.last_price ? m.conPhaiDat * r.last_price.unit_price : '',
        }
        numCells(row, [7, 8, 9, 10, 11])
        numCells(row, [15, 16], MONEY_FMT)
        row.getCell(11).font = { bold: m.conPhaiDat > 0 }
        const f = FILL[m.tinhTrang]
        if (f) fillRow(row, f, COLS1)
        if (r.from_products.length > 0) {
          row.getCell(7).note = r.from_products
            .map(
              (p) =>
                `${p.code} × ${p.qty}: ${p.per} ${r.unit}/SP${p.confirmed ? '' : ' (chưa kiểm)'}`,
            )
            .join('\n')
        }
      }
    }
  }
  const last1 = s1.lastRow!.number
  const tong = s1.addRow([])
  tong.getCell(3).value =
    `Cộng ${dong.length} mã — không cộng số lượng giữa các mã (khác đơn vị)`
  if (dataRows.length > 0) {
    tong.getCell(16).value = {
      formula: `SUM(P${dataRows[0]}:P${last1})`,
      result: dong.reduce(
        (s, x) => s + (x.r.last_price ? x.d.conPhaiDat * x.r.last_price.unit_price : 0),
        0,
      ),
    }
    numCells(tong, [16], MONEY_FMT)
  }
  tong.font = { bold: true }
  fillRow(tong, ACCENT, COLS1)
  finishTable(s1, {
    head: head1,
    lastRow: last1,
    freezeCols: 3,
    autoFilter: true,
    landscape: true,
  })

  // ── Cần đặt ─────────────────────────────────────────────────────────────
  const s2 = wb.addWorksheet('Cần đặt')
  const COLS2 = 12
  applyWidths(s2, [5, 11, 34, 18, 7, 12, 24, 12, 20, 12, 14, 24])
  titleRow(s2, `CẦN ĐẶT — LSX ${lsx.code}`)
  const canDat = dong.filter((x) => x.d.conPhaiDat > 0)
  noteRow(
    s2,
    `${canDat.length} mã còn phải đặt. Điền NCC chọn và Giá chào; Thành tiền tự tính. Dán cột Mã VT + SL vào màn soạn đơn.`,
  )
  s2.addRow([])
  const head2 = headerRow(s2, [
    'STT',
    'Mã VT',
    'Vật tư',
    'Quy cách',
    'ĐVT',
    'SL cần đặt',
    'NCC gần nhất',
    'Giá gần nhất',
    'NCC chọn',
    'Giá chào',
    'Thành tiền',
    'Ghi chú',
  ])
  let stt2 = 0
  const rows2: number[] = []
  for (const k of groupForBangKe(
    canDat.map((x) => x.r),
    partGroupLabel,
    partGroupRank,
  )) {
    groupRow(s2, `${k.name} · ${k.rows.length} mã`, COLS2)
    for (const sub of k.subs)
      for (const r of sub.rows) {
        const m = byId.get(r.material_id)!.d
        stt2++
        const row = s2.addRow([
          stt2,
          r.material_code,
          r.material_name,
          r.spec ?? '',
          r.unit,
          m.conPhaiDat,
          r.last_price?.supplier_name ?? '',
          r.last_price ? r.last_price.unit_price : null,
          '',
          null,
          null,
          '',
        ])
        const n = row.number
        rows2.push(n)
        row.getCell(11).value = { formula: `IF(J${n}="","",F${n}*J${n})`, result: '' }
        numCells(row, [6])
        numCells(row, [8, 10, 11], MONEY_FMT)
        // Ô để người dùng điền: nền vàng nhạt cho biết chỗ gõ.
        for (const c of [9, 10, 12])
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF8DC' },
          }
      }
  }
  if (canDat.length === 0) {
    s2.addRow([
      'Không còn mã nào phải đặt — mọi mã đã đủ tồn, trên đơn, hoặc đang về.',
    ]).font = {
      bold: true,
    }
  } else {
    const last2 = s2.lastRow!.number
    const t2 = s2.addRow([])
    t2.getCell(3).value = `Cộng ${canDat.length} mã`
    t2.getCell(11).value = { formula: `SUM(K${rows2[0]}:K${last2})`, result: 0 }
    numCells(t2, [11], MONEY_FMT)
    t2.font = { bold: true }
    fillRow(t2, ACCENT, COLS2)
    finishTable(s2, {
      head: head2,
      lastRow: last2,
      freezeCols: 3,
      autoFilter: true,
      landscape: true,
    })
  }

  // ── Theo SP ─────────────────────────────────────────────────────────────
  const s3 = wb.addWorksheet('Theo SP')
  applyWidths(s3, [11, 34, 7, 14, 10, 14, 14, 12])
  titleRow(s3, `MÃ × SẢN PHẨM — LSX ${lsx.code}`)
  noteRow(
    s3,
    'Mỗi dòng: một mã dùng cho một sản phẩm. Cần = định mức/SP × SL lệnh (chưa làm tròn).',
  )
  s3.addRow([])
  const head3 = headerRow(s3, [
    'Mã VT',
    'Vật tư',
    'ĐVT',
    'Sản phẩm',
    'SL lệnh',
    'Định mức/SP',
    'Cần',
    'Kỹ thuật kiểm',
  ])
  for (const x of dong)
    for (const p of x.r.from_products) {
      const row = s3.addRow([
        x.r.material_code,
        x.r.material_name,
        x.r.unit,
        p.code,
        p.qty,
        p.per,
        p.per * p.qty,
        p.confirmed ? 'đã kiểm' : 'chưa',
      ])
      numCells(row, [5, 6, 7])
    }
  if (s3.lastRow!.number > head3.number)
    finishTable(s3, { head: head3, freezeCols: 2, autoFilter: true })
  else s3.addRow(['— Chưa có mã nào từ định mức —'])

  // ── Chưa quy đổi ────────────────────────────────────────────────────────
  const s4 = wb.addWorksheet('Chưa quy đổi')
  applyWidths(s4, [13, 26, 11, 30, 7, 60, 34])
  titleRow(s4, `CHƯA QUY ĐỔI ĐƯỢC — LSX ${lsx.code}`)
  noteRow(
    s4,
    `${bk.blocked.length} dòng định mức có mã nhưng không đổi được sang đơn vị mua. Số của chúng CHƯA nằm trong tờ "Bảng kê".`,
  )
  s4.addRow([])
  const head4 = headerRow(s4, [
    'SP',
    'Chi tiết',
    'Mã VT',
    'Vật tư',
    'ĐVT',
    'Vướng gì',
    'Ai gỡ · ở đâu',
  ])
  for (const b of bk.blocked) {
    const row = s4.addRow([
      b.product_code,
      b.part_name,
      b.material_code,
      b.material_name,
      b.unit,
      b.reason,
      aiGo(b.reason),
    ])
    row.getCell(6).alignment = { wrapText: true }
  }
  if (bk.blocked.length > 0)
    finishTable(s4, { head: head4, freezeCols: 2, autoFilter: true })
  else s4.addRow(['— Không có dòng nào bị chặn —'])

  // ── Đơn của lệnh ────────────────────────────────────────────────────────
  const s5 = wb.addWorksheet('Đơn của lệnh')
  applyWidths(s5, [16, 34, 16, 12, 10])
  titleRow(s5, `ĐƠN MUA ĐANG MANG MÃ CỦA LỆNH — LSX ${lsx.code}`)
  s5.addRow([])
  const head5 = headerRow(s5, [
    'Mã đơn',
    'Nhà cung cấp',
    'Trạng thái',
    'Hẹn giao',
    'Số mã',
  ])
  const pos = new Map<
    string,
    { code: string; supplier: string; status: string; expected: string | null; n: number }
  >()
  for (const x of dong)
    for (const p of x.r.pos) {
      const cur = pos.get(p.id)
      if (cur) cur.n++
      else
        pos.set(p.id, {
          code: p.code,
          supplier: p.supplier_name,
          status: p.status,
          expected: p.expected_at,
          n: 1,
        })
    }
  for (const p of [...pos.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    const row = s5.addRow([
      p.code,
      p.supplier,
      isPoStatus(p.status) ? PO_STATUS_LABEL[p.status] : p.status,
      dateCell(p.expected),
      p.n,
    ])
    row.getCell(4).numFmt = 'dd/mm/yyyy'
    numCells(row, [5])
  }
  if (pos.size > 0) finishTable(s5, { head: head5, freezeCols: 1, autoFilter: true })
  else s5.addRow(['— Lệnh chưa có đơn mua nào —'])

  return Buffer.from(await wb.xlsx.writeBuffer())
}

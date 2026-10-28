/**
 * PHIẾU ĐỐI CHIẾU GHI BÙ (28/10/2026) — Kho in ra đi đếm, rồi ghi bù phần tổ đã lấy
 * cho các lệnh TRƯỚC 31/10 (giá thành kỳ 10). Chỉ ĐỌC, không ghi gì vào DB.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/kho-phieu-doi-chieu-1028.ts
 *
 * Số lấy bằng ĐÚNG hàm của màn: `hangLenhService.tatCa` (Hàng của lệnh / Tồn theo
 * lệnh / Cập nhật số thực tế — phần tồn CHIA cho từng lệnh) + tồn trên sổ
 * (`warehouse_stock.on_hand`, cùng số Cập nhật số thực tế so với).
 *
 * Hai sheet:
 *  · "Đếm theo kệ" — MỖI MÃ MỘT DÒNG, xếp theo kệ: đi kệ một lượt, mã dùng chung
 *    nhiều lệnh không bị đếm hai lần. Cột "Đếm được" để trống, "Chênh" tự tính.
 *  · "Theo lệnh"   — từng lệnh: về cho lệnh / đã xuất / còn trên sổ (tham khảo
 *    khi chọn lệnh ghi bù).
 * Đếm xong: nhập số ở Kho › Cập nhật số thực tế — dòng hụt hàng của lệnh chọn
 * "tổ đã lấy" thì máy ghi phiếu xuất bù X1 cho lệnh đó.
 */
import ExcelJS from 'exceljs'
import { mkdirSync } from 'node:fs'
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { hangLenhService } from '@/modules/dept/warehouse/hang-lenh.service'
import { khoaChia, lenhXong } from '@/lib/kho-ton-lenh'
import { nhanTrangThaiLenh } from '@/lib/kho-phieu-xuat'
import { todayVn } from '@/lib/date-vn'

const OUT_DIR = 'xuat'
const EPS = 1e-9
const so = (n: number) => Math.round(n * 10_000) / 10_000
const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—') // prettier-ignore
/** "02/26-27 - ROSCO" → "02-ROSCO" — gọn trong ô. */
const lenhGon = (code: string) => code.replace(/^(\d+)\/\d+-\d+\s*-\s*/, '$1-')

type TonSo = {
  id: string
  code: string
  name: string
  unit: string
  ke: string | null
  nhom: string | null
  on_hand: number
}

async function tonTrenSo(): Promise<TonSo[]> {
  const out: TonSo[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from('warehouse_stock')
      .select('material_id, code, name, unit, shelf_location, group_name, on_hand')
      .eq('is_active', true)
      .gt('on_hand', 0)
      .order('code')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Record<string, unknown>[]
    out.push(
      ...rows.map((r) => ({
        id: String(r.material_id),
        code: String(r.code),
        name: String(r.name),
        unit: String(r.unit ?? ''),
        ke: (r.shelf_location as string | null) ?? null,
        nhom: (r.group_name as string | null) ?? null,
        on_hand: Number(r.on_hand ?? 0),
      })),
    )
    if (rows.length < 1000) break
  }
  return out
}

async function main() {
  const adm = await usersRepo.findByEmail('admin@hg.com')
  const user = adm ? await usersRepo.findById((adm as { id: string }).id) : null
  if (!user) throw new Error('Không thấy tài khoản admin@hg.com')

  const [t, ton] = await Promise.all([hangLenhService.tatCa(user), tonTrenSo()])
  const lenhById = new Map(t.lenh.map((l) => [l.id, l]))

  // Lệnh đang được chia tồn của từng mã — phần lớn trước.
  const chiaTheoMa = new Map<string, { lsx_id: string; chia: number }[]>()
  for (const r of t.rows) {
    if (r.chia <= EPS) continue
    const ds = chiaTheoMa.get(r.material_id) ?? []
    ds.push({ lsx_id: r.lsx_id, chia: r.chia })
    chiaTheoMa.set(r.material_id, ds)
  }
  for (const ds of chiaTheoMa.values()) ds.sort((a, b) => b.chia - a.chia)

  const nhieuLenh = ton.filter((m) => (chiaTheoMa.get(m.id)?.length ?? 0) > 1).length
  const motLenh = ton.filter((m) => (chiaTheoMa.get(m.id)?.length ?? 0) === 1).length
  const lenhCoHang = new Set(t.rows.filter((r) => r.chia > EPS).map((r) => r.lsx_id))
  console.log(
    `Mã có tồn trên sổ: ${ton.length} · thuộc 1 lệnh: ${motLenh} · dùng chung nhiều lệnh: ${nhieuLenh} · tồn chung (không lệnh): ${ton.length - motLenh - nhieuLenh}`,
  )
  console.log(`Lệnh đang được chia tồn: ${lenhCoHang.size}`)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG-ERP'
  const homNay = todayVn()
  const gio = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) // prettier-ignore
  const vien = { style: 'thin' as const, color: { argb: 'FFB8C0CC' } }
  const khung = { top: vien, left: vien, bottom: vien, right: vien }
  const dauBang = (ws: ExcelJS.Worksheet, r: number) => {
    const row = ws.getRow(r)
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.height = 30
    row.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF25324A' } }
      c.border = khung
    })
  }
  const inA4 = (ws: ExcelJS.Worksheet, hangTieuDe: number) => {
    ws.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printTitlesRow: `${hangTieuDe}:${hangTieuDe}`,
    }
    ws.headerFooter.oddFooter = '&L&8HG-ERP · số trên sổ lúc in&R&8Trang &P / &N'
    ws.views = [{ state: 'frozen', ySplit: hangTieuDe }]
  }

  // Tạo theo thứ tự hiện tab: "Cách dùng" đầu tiên (nội dung điền ở cuối).
  const s0 = wb.addWorksheet('Cách dùng', {
    properties: { tabColor: { argb: 'FF1F4BB8' } },
  })

  // ── Sheet 1: Đếm theo kệ ──────────────────────────────────────────────
  const s1 = wb.addWorksheet('Đếm theo kệ')
  s1.columns = [
    { key: 'stt', width: 5 },
    { key: 'ke', width: 10 },
    { key: 'ma', width: 15 },
    { key: 'ten', width: 46 },
    { key: 'dvt', width: 7 },
    { key: 'so', width: 12 },
    { key: 'lenh', width: 34 },
    { key: 'dem', width: 12 },
    { key: 'chenh', width: 11 },
    { key: 'gc', width: 26 },
  ]
  s1.mergeCells('A1:J1')
  s1.getCell('A1').value = 'PHIẾU ĐỐI CHIẾU TỒN KHO — ĐẾM ĐỂ GHI BÙ XUẤT CHO LỆNH'
  s1.getCell('A1').font = { bold: true, size: 14 }
  s1.mergeCells('A2:J2')
  s1.getCell('A2').value = `Số trên sổ lúc in: ${dm(homNay)} ${gio} · ${ton.length} mã đang có tồn · đi theo kệ, MỖI MÃ ĐẾM MỘT LẦN (mã dùng chung nhiều lệnh cũng chỉ một dòng)` // prettier-ignore
  s1.getCell('A2').font = { size: 10, color: { argb: 'FF5D6675' } }
  s1.mergeCells('A3:J3')
  s1.getCell('A3').value = 'Người đếm: ………………………………   Ngày đếm: ……/……/2026   Ký: ……………………   Trưởng kho xác nhận: ……………………' // prettier-ignore
  s1.getCell('A3').font = { size: 10 }
  const H1 = 5
  s1.getRow(H1).values = ['STT', 'Kệ', 'Mã VT', 'Tên vật tư', 'ĐVT', 'Tồn trên sổ', 'Thuộc lệnh (số chia trên sổ)', 'ĐẾM ĐƯỢC', 'Chênh (đếm − sổ)', 'Ghi chú'] // prettier-ignore
  dauBang(s1, H1)

  const theoKe = [...ton].sort(
    (a, b) =>
      (a.ke ?? '￿').localeCompare(b.ke ?? '￿', 'vi') || a.code.localeCompare(b.code),
  )
  let r = H1 + 1
  let keTruoc: string | null | undefined
  for (const [i, m] of theoKe.entries()) {
    if (m.ke !== keTruoc) {
      keTruoc = m.ke
      const g = s1.getRow(r++)
      s1.mergeCells(`A${g.number}:J${g.number}`)
      g.getCell(1).value =
        `KỆ ${m.ke ?? '— CHƯA GHI KỆ'} · ${theoKe.filter((x) => x.ke === m.ke).length} mã`
      g.font = { bold: true, size: 10 }
      g.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEF1F6' },
      }
    }
    const ds = chiaTheoMa.get(m.id) ?? []
    const chung = m.on_hand - ds.reduce((s, x) => s + x.chia, 0)
    const lenhChu = [
      ...ds.map((x) => `${lenhGon(lenhById.get(x.lsx_id)?.code ?? '?')} ${so(x.chia)}`),
      ...(chung > EPS ? [`chung ${so(chung)}`] : []),
    ].join(' · ')
    const row = s1.getRow(r)
    row.values = [i + 1, m.ke ?? '', m.code, m.name, m.unit, so(m.on_hand), lenhChu || 'tồn chung', null, null, null] // prettier-ignore
    row.getCell(9).value = { formula: `IF(H${r}="","",H${r}-F${r})` }
    row.getCell(6).numFmt = '#,##0.####'
    row.getCell(9).numFmt = '+#,##0.####;-#,##0.####;0'
    row.getCell(8).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF8DC' },
    }
    row.font = { size: 10 }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.eachCell({ includeEmpty: true }, (c) => (c.border = khung))
    r++
  }
  inA4(s1, H1)

  // ── Sheet 2: Theo lệnh (tham khảo) ──────────────────────────────────────
  const s2 = wb.addWorksheet('Theo lệnh')
  s2.columns = [
    { key: 'ma', width: 15 },
    { key: 'ten', width: 46 },
    { key: 'dvt', width: 7 },
    { key: 'ke', width: 10 },
    { key: 've', width: 12 },
    { key: 'xuat', width: 12 },
    { key: 'con', width: 12 },
    { key: 'chia', width: 13 },
    { key: 'gc', width: 30 },
  ]
  s2.mergeCells('A1:I1')
  s2.getCell('A1').value = 'HÀNG CỦA TỪNG LỆNH TRÊN SỔ — tham khảo khi chọn lệnh ghi bù'
  s2.getCell('A1').font = { bold: true, size: 14 }
  s2.mergeCells('A2:I2')
  s2.getCell('A2').value = `Số trên sổ lúc in: ${dm(homNay)} ${gio} · "Còn của lệnh" = về cho lệnh − đã xuất; "Trên sổ chia cho lệnh" = phần tồn thật đang chia cho lệnh (mã chung chia theo hạn xuất sớm trước)` // prettier-ignore
  s2.getCell('A2').font = { size: 10, color: { argb: 'FF5D6675' } }
  const H2 = 4
  s2.getRow(H2).values = ['Mã VT', 'Tên vật tư', 'ĐVT', 'Kệ', 'Về cho lệnh', 'Đã xuất', 'Còn của lệnh', 'Trên sổ chia cho lệnh', 'Ghi chú'] // prettier-ignore
  dauBang(s2, H2)
  const keCua = new Map(ton.map((m) => [m.id, m.ke]))
  const lenhXep = [...t.lenh]
    .filter((l) => t.rows.some((x) => x.lsx_id === l.id && x.con > EPS))
    .sort((a, b) => khoaChia(a).localeCompare(khoaChia(b)))
  let r2 = H2 + 1
  for (const l of lenhXep) {
    const dong = t.rows
      .filter((x) => x.lsx_id === l.id && x.con > EPS)
      .sort((a, b) => b.chia - a.chia || (t.vatTu.get(a.material_id)?.code ?? '').localeCompare(t.vatTu.get(b.material_id)?.code ?? '')) // prettier-ignore
    const coHang = dong.filter((x) => x.chia > EPS).length
    const g = s2.getRow(r2++)
    s2.mergeCells(`A${g.number}:I${g.number}`)
    g.getCell(1).value = `${l.code}${l.khach ? ` · ${l.khach}` : ''} · ${nhanTrangThaiLenh(l.status)} · hạn xuất ${dm(l.ship_date)} · ${dong.length} mã còn của lệnh, ${coHang} mã kho còn trên sổ${lenhXong(l) ? ' · LỆNH ĐÃ XONG: ghi bù hết phần tổ đã lấy' : ''}` // prettier-ignore
    g.font = { bold: true, size: 10 }
    g.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEF1F6' },
    }
    for (const x of dong) {
      const vt = t.vatTu.get(x.material_id)
      const row = s2.getRow(r2++)
      row.values = [
        vt?.code ?? '',
        vt?.name ?? '',
        vt?.unit ?? '',
        keCua.get(x.material_id) ?? '',
        so(x.ve),
        so(x.xuat),
        so(x.con),
        so(x.chia),
        x.chia <= EPS
          ? 'kho hết trên sổ'
          : x.chia < x.con - EPS
            ? 'sổ ít hơn phần của lệnh'
            : '',
      ]
      for (const c of [5, 6, 7, 8]) row.getCell(c).numFmt = '#,##0.####'
      row.font = { size: 10, color: x.chia <= EPS ? { argb: 'FF8A93A3' } : undefined }
      row.alignment = { vertical: 'middle', wrapText: true }
      row.eachCell({ includeEmpty: true }, (c) => (c.border = khung))
    }
  }
  inA4(s2, H2)

  // ── Sheet 0: Cách dùng ─────────────────────────────────────────────────
  s0.getColumn(1).width = 110
  s0.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } // prettier-ignore
  ;[
    ['PHIẾU ĐỐI CHIẾU GHI BÙ — làm xong TRƯỚC 31/10/2026', true],
    [
      `In lúc ${dm(homNay)} ${gio}. Số trên sổ đổi khi có phiếu mới — đếm xong mà để lâu thì in lại.`,
      false,
    ],
    ['', false],
    [
      '1. In sheet "Đếm theo kệ" (A4 ngang). Đi theo kệ, ghi số đếm được vào cột ĐẾM ĐƯỢC (ô vàng). Mã dùng chung nhiều lệnh chỉ có MỘT dòng — đếm cả kệ.',
      false,
    ],
    [
      '2. Cột "Chênh" tự tính (đếm − sổ). Số ÂM = trên sổ còn mà kệ không còn — thường là tổ đã lấy chưa ghi.',
      false,
    ],
    [
      '3. Vào Kho › Cập nhật số thực tế, gõ mã + số đếm được. Dòng hụt hàng của lệnh: chọn "Tổ đã lấy" → máy ghi phiếu xuất bù (X1) cho lệnh đó, giá vào giá thành lệnh.',
      false,
    ],
    [
      '   Hụt vì hỏng / mất / nhầm thì chọn lý do tương ứng (không vào giá thành lệnh). Trưởng kho ghi là áp ngay; người khác ghi thì chờ trưởng kho duyệt.',
      false,
    ],
    [
      '4. Hoặc ghi bù theo từng lệnh: Kho › Xuất hàng → chọn lệnh → "Lấy hàng của lệnh" (số điền sẵn) → sửa đúng số tổ đã lấy → Ghi sổ, ngày chứng từ lùi về ngày tổ lấy.',
      false,
    ],
    [
      '5. Sheet "Theo lệnh" để tra: lệnh nào còn những mã gì trên sổ, về bao nhiêu, đã xuất bao nhiêu.',
      false,
    ],
    ['', false],
    [
      'Chưa ghi bù xong thì đừng mở kiểm kê định kỳ: hàng tổ đã dùng sẽ thành "xuất thiếu sau kiểm kê" (X5), rời giá thành lệnh.',
      true,
    ],
  ].forEach(([text, dam], i) => {
    const c = s0.getCell(`A${i + 1}`)
    c.value = text as string
    c.font = { size: i === 0 ? 14 : 11, bold: dam as boolean }
    c.alignment = { wrapText: true, vertical: 'top' }
  })
  mkdirSync(OUT_DIR, { recursive: true })
  const file = `${OUT_DIR}/Phieu-doi-chieu-ghi-bu_${homNay}.xlsx`
  await wb.xlsx.writeFile(file)
  console.log(
    `Đã ghi ${file} · Đếm theo kệ: ${ton.length} mã · Theo lệnh: ${lenhXep.length} lệnh`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

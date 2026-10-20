import ExcelJS from 'exceljs'
import type { BangLuongTrang } from './bang-luong.service'

const NEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F5F8' } } as const
const TEN_TT = {
  draft: 'NHÁP — chưa duyệt',
  submitted: 'CHỜ DUYỆT',
  approved: 'ĐÃ DUYỆT',
  paid: 'ĐÃ CHI',
}

/**
 * Excel bảng lương (B5): tờ "Bảng lương" (mỗi người một dòng, đủ khoản) + tờ "Chuyển khoản"
 * đúng các cột của "DS chuyển lương" Kế toán đang dùng (Q7). Cùng nguồn số với màn.
 */
export async function buildBangLuongExcel(
  b: BangLuongTrang,
  /** Người tải — in lên dòng "TÀI LIỆU MẬT" đầu mỗi tờ (0253, lương chỉ một người quản lý). */
  nguoiTai?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ky = `${b.thang.slice(5)}/${b.thang.slice(0, 4)}`
  const tt = b.bang ? TEN_TT[b.bang.trangThai] : 'CHƯA TÍNH'
  const ws = wb.addWorksheet('Bảng lương')
  ws.addRow([`BẢNG LƯƠNG KỲ ${ky} · ${tt} · lần tính ${b.bang?.lanTinh ?? 0}`]).font = {
    bold: true,
    size: 13,
  }
  ws.addRow([`Công chuẩn ${b.congChuan ?? '—'} · ${b.phieu.length} người`])
  ws.addRow([])
  const head = ws.addRow([
    'Tổ',
    'Mã NV',
    'Họ tên',
    'Cách trả',
    'Công',
    'Lương công',
    'Nghỉ có lương',
    'Tăng ca',
    'Phụ cấp',
    'Khoản cộng',
    'Tổng thu nhập',
    'BH NLĐ 10,5%',
    'Đoàn phí 0,5%',
    'Thuế TNCN đã trừ',
    'Tạm ứng / khoản trừ',
    'Thực lĩnh',
    'BH DN 21,5%',
    'KPCĐ 2%',
    'Thuế TNCN tính được (chưa trừ)',
  ])
  head.font = { bold: true }
  head.eachCell((c) => (c.fill = NEN))
  const ds = [...b.phieu].sort(
    (x, y) =>
      (x.to ?? '').localeCompare(y.to ?? '', 'vi') ||
      x.ma.localeCompare(y.ma, 'vi', { numeric: true }),
  )
  for (const p of ds)
    ws.addRow([
      p.to ?? '',
      p.ma,
      p.ten,
      p.cachTra === 'daily' ? 'Theo công' : p.cachTra === 'monthly' ? 'Theo tháng' : '—',
      p.cong,
      p.luongCong,
      p.nghiCoLuong,
      p.tangCa,
      p.phuCap,
      p.khoanCong,
      p.tong,
      p.bhNld,
      p.doanPhi,
      p.truThue ? p.thue : 0,
      p.khoanTru,
      p.thucLinh,
      p.bhDn,
      p.kpcd,
      p.truThue ? 0 : p.thue,
    ])
  const sum = (f: (x: (typeof ds)[number]) => number) => ds.reduce((s, x) => s + f(x), 0)
  const t = ws.addRow([
    'Cộng',
    '',
    `${ds.length} người`,
    '',
    sum((x) => x.cong),
    sum((x) => x.luongCong),
    sum((x) => x.nghiCoLuong),
    sum((x) => x.tangCa),
    sum((x) => x.phuCap),
    sum((x) => x.khoanCong),
    sum((x) => x.tong),
    sum((x) => x.bhNld),
    sum((x) => x.doanPhi),
    sum((x) => (x.truThue ? x.thue : 0)),
    sum((x) => x.khoanTru),
    sum((x) => x.thucLinh),
    sum((x) => x.bhDn),
    sum((x) => x.kpcd),
    sum((x) => (x.truThue ? 0 : x.thue)),
  ])
  t.font = { bold: true }
  t.eachCell((c) => (c.fill = NEN))
  ws.columns.forEach((c, i) => (c.width = i === 2 ? 26 : i === 0 ? 22 : 13))
  for (let i = 5; i <= 19; i++) ws.getColumn(i).numFmt = '#,##0'
  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 3 }]

  const ck = wb.addWorksheet('Chuyển khoản')
  ck.addRow([`DANH SÁCH THANH TOÁN TIỀN LƯƠNG KỲ ${ky}`]).font = { bold: true, size: 13 }
  ck.addRow([])
  const h2 = ck.addRow([
    'STT',
    'TÊN NGƯỜI THỤ HƯỞNG',
    'SỐ TÀI KHOẢN',
    'SỐ TIỀN',
    'TÊN NGÂN HÀNG',
    'DIỄN GIẢI',
    'PHÒNG BAN',
  ])
  h2.font = { bold: true }
  h2.eachCell((c) => (c.fill = NEN))
  ds.filter((p) => p.thucLinh > 0).forEach((p, i) =>
    ck.addRow([
      i + 1,
      p.ten,
      p.stk ?? '',
      p.thucLinh,
      p.nganHang ?? '',
      `Thanh toán tiền lương kỳ ${ky}`,
      p.to ?? '',
    ]),
  )
  ck.getColumn(3).numFmt = '@'
  ck.getColumn(4).numFmt = '#,##0'
  ck.columns.forEach((c, i) => (c.width = [6, 28, 20, 14, 16, 32, 22][i] ?? 12))
  if (nguoiTai) {
    const luc = new Date(Date.now() + 7 * 3600_000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')
    for (const ws of wb.worksheets) {
      ws.insertRow(1, [
        `TÀI LIỆU MẬT — chỉ người quản lý lương · tải bởi ${nguoiTai} lúc ${luc}`,
      ])
      ws.getRow(1).font = { bold: true, color: { argb: 'FFB0241A' } }
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

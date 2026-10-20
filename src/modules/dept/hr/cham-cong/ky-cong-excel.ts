import ExcelJS from 'exceljs'
import { CHUA_CO_TO, TEN_TRANG_THAI } from '@/lib/cham-cong/ky-cong'
import type { GioCong } from './gio-cong.service'

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const gio = (phut: number) => Math.round((phut / 60) * 100) / 100
const NEN_DAU = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F5F8' },
} as const
const NEN_TO = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE9ECF1' },
} as const

/**
 * Excel KỲ CÔNG (B3) — cùng nguồn số với màn Kỳ công (`gioCongService.bang`: kỳ đã chốt
 * thì là bản chốt). Một tờ: nhóm theo tổ, mỗi người một dòng giờ theo khung + công, cột
 * Ký nhận để in làm PHIẾU XÁC NHẬN CÔNG khi lọc một tổ; cả kỳ thì là bảng cho Kế toán.
 */
export async function buildKyCongExcel(g: GioCong, to?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Kỳ công ${g.thang.slice(5)}-${g.thang.slice(0, 4)}`)
  const trangThai = g.ky?.trangThai ?? 'open'
  const tt =
    trangThai === 'open'
      ? 'ĐANG MỞ — số tạm tính, chưa chốt'
      : `${TEN_TRANG_THAI[trangThai].toUpperCase()} — bản chốt lần ${g.ky!.lanChot}`
  ws.addRow([to ? `PHIẾU XÁC NHẬN CÔNG · ${to}` : 'BẢNG TỔNG HỢP CÔNG']).font = {
    bold: true,
    size: 13,
  }
  ws.addRow([
    `Kỳ ${g.thang.slice(5)}/${g.thang.slice(0, 4)} · ${dmy(g.tu)} → ${dmy(g.den)} · ${tt} · Bản cách tính ${g.ban ?? 'mặc định'} · công = giờ ÷ ${g.phutMotCong / 60}`,
  ])
  ws.addRow([])
  const khung = g.khung
  const head = ws.addRow([
    'Tổ',
    'Mã NV',
    'Họ tên',
    ...khung.map((k) => `${k.ma} ${k.ten} (giờ)`),
    'Làm trưa (giờ)',
    'Tổng giờ',
    'Công',
    'Ngày thiếu lượt',
    'Ký nhận',
  ])
  head.font = { bold: true }
  head.eachCell((c) => (c.fill = NEN_DAU))

  const ds = g.nguoi.filter((n) => !to || (n.boPhan ?? CHUA_CO_TO) === to)
  const theoTo = new Map<string, typeof ds>()
  for (const n of ds) {
    const t = n.boPhan ?? CHUA_CO_TO
    theoTo.set(t, [...(theoTo.get(t) ?? []), n])
  }
  const cot = 3 + khung.length
  for (const [t, ns] of [...theoTo].sort((a, b) => a[0].localeCompare(b[0], 'vi'))) {
    ns.sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true }))
    for (const n of ns)
      ws.addRow([
        t,
        n.ma,
        n.ten,
        ...khung.map((k) => gio(n.tong.k[k.ma] ?? 0)),
        gio(n.tong.truaCong),
        gio(n.tong.tong),
        n.tong.cong,
        n.tong.thieu || null,
        '',
      ])
    const sum = (f: (x: (typeof ns)[number]) => number) =>
      ns.reduce((s, x) => s + f(x), 0)
    const r = ws.addRow([
      `Cộng ${t} · ${ns.length} người`,
      '',
      '',
      ...khung.map((k) => gio(sum((x) => x.tong.k[k.ma] ?? 0))),
      gio(sum((x) => x.tong.truaCong)),
      gio(sum((x) => x.tong.tong)),
      Math.round((sum((x) => x.tong.tong) / g.phutMotCong) * 100) / 100,
      sum((x) => x.tong.thieu) || null,
      '',
    ])
    r.font = { bold: true }
    r.eachCell((c) => (c.fill = NEN_TO))
  }
  ws.addRow([])
  ws.addRow([
    `Không gồm ${g.khongCham} người không chấm công. Ngày thiếu lượt đã được tổ đồng ý tính 0 giờ.`,
  ]).font = { italic: true }
  ws.columns.forEach((c, i) => {
    c.width = i === 0 ? 24 : i === 2 ? 26 : i === 1 ? 9 : i === cot + 4 ? 18 : 12
  })
  for (let i = 4; i <= cot + 3; i++) ws.getColumn(i).numFmt = '#,##0.##'
  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 3 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}

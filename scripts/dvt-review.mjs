// RÀ SOÁT ĐƠN VỊ TÍNH của danh mục vật tư — xuất Excel để phòng Cung ứng chốt.
// CHỈ ĐỌC `warehouse_materials`, không sửa gì trên DB.
//
// Vì sao cần: ĐVT in thẳng lên đơn đặt gửi NCC, mà danh mục đang có 79 giá trị
// khác nhau, trong đó có cả "bill", "chuyến", "700". Gom lại phải do người của
// phòng quyết — Yard/Inch/Lố là ĐƠN VỊ ĐO KHÁC, đổi suông là sai số lượng tồn.
//
// Usage:
//   node scripts/dvt-review.mjs [--out <đường-dẫn.xlsx>]
//
// Đọc NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY từ môi trường, không có
// thì lấy trong .env.local. Chạy từ thư mục gốc dự án.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

const argOut = process.argv.indexOf('--out')
const OUT = argOut > -1 ? process.argv[argOut + 1] : './Ra-soat-DVT-danh-muc-vat-tu.xlsx'

function env() {
  const out = { ...process.env }
  if (out.NEXT_PUBLIC_SUPABASE_URL && out.SUPABASE_SECRET_KEY) return out
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    throw new Error(
      'Thiếu .env.local — cần NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY',
    )
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const e = env()
const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

/** Đề xuất cho từng ĐVT đang có. hành động: giữ | gộp | quy đổi | sửa */
const PROPOSAL = {
  // — Gộp: chỉ khác cách viết, cùng nghĩa —
  Chiếc: ['Cái', 'gộp', 'chắc', 'Cùng nghĩa với Cái (5.423 mã đang dùng Cái)'],
  PCS: ['Cái', 'gộp', 'chắc', 'Viết tắt tiếng Anh của cái/chiếc'],
  SET: ['Bộ', 'gộp', 'chắc', 'Viết tắt tiếng Anh của bộ'],
  'cái/ bộ': [
    'Bộ',
    'gộp',
    'cần xác nhận',
    'Phần gỗ ghế 5 bậc Capri — bán theo bộ hay theo cái?',
  ],
  Chụp: ['Cái', 'gộp', 'cần xác nhận', 'Đầu cos 95-12 + Mũ'],
  Bịch: ['Bì', 'gộp', 'cần xác nhận', 'Bì/Bịch/Bao/Túi đang dùng lẫn'],
  Bao: ['Bì', 'gộp', 'cần xác nhận', 'Bì/Bịch/Bao/Túi đang dùng lẫn'],
  Túi: ['Bì', 'gộp', 'cần xác nhận', 'Bì/Bịch/Bao/Túi đang dùng lẫn'],
  Hột: ['Con', 'gộp', 'cần xác nhận', 'Hột hay dùng cho hạt/viên nhỏ'],
  Tem: ['Nhãn', 'gộp', 'cần xác nhận', 'Tem và Nhãn đang tách đôi'],
  Thẻ: ['Nhãn', 'gộp', 'cần xác nhận', 'Thẻ treo — cùng loại tem nhãn?'],
  Lá: ['Tấm', 'gộp', 'cần xác nhận', ''],
  Miếng: ['Tấm', 'gộp', 'cần xác nhận', ''],
  Khúc: ['Thanh', 'gộp', 'cần xác nhận', ''],
  Lọ: ['Chai', 'gộp', 'cần xác nhận', ''],
  Sổ: ['Quyển', 'gộp', 'cần xác nhận', ''],
  Cục: ['Cái', 'gộp', 'cần xác nhận', ''],
  Lưỡi: ['Cái', 'gộp', 'cần xác nhận', 'Lưỡi cắt/lưỡi cưa — đếm theo cái?'],
  Bánh: ['Cuộn', 'gộp', 'cần xác nhận', 'Bánh xích/bánh dây?'],

  // — Quy đổi: đơn vị đo KHÁC nhau, gộp phải nhân hệ số —
  Yard: [
    'Mét',
    'quy đổi',
    'cần xác nhận',
    '1 yard = 0,9144 m — đổi ĐVT phải nhân lại SL tồn, KHÔNG sửa suông',
  ],
  Inch: ['Mét', 'quy đổi', 'cần xác nhận', '1 inch = 0,0254 m — như trên'],
  MTK: [
    'M²',
    'quy đổi',
    'cần xác nhận',
    'MTK thường là mét tới/mét khối — phải xác định trước khi đổi',
  ],
  Lố: ['Cái', 'quy đổi', 'cần xác nhận', '1 lố = 12 cái — đổi phải nhân 12'],

  // — Sửa: không phải đơn vị tính —
  cal: ['Can', 'sửa', 'chắc', 'Nhớt bán theo can/lít — "cal" là gõ nhầm'],
  ve: ['Chai', 'sửa', 'cần xác nhận', 'Keo ron/keo đỏ — "ve" là tiếng địa phương'],
  len: ['Chai', 'sửa', 'cần xác nhận', 'Keo 300g — nhiều khả năng là "lon"'],
  bo: ['', 'sửa', 'chắc', 'Dòng PHÍ hàng nhập, không phải vật tư'],
  cá: ['Cái', 'sửa', 'cần xác nhận', 'Cánh quạt máy bơm'],
  cài: ['Cái', 'sửa', 'cần xác nhận', 'Bơm lá thủy lực'],
  thang: ['Cái', 'sửa', 'cần xác nhận', 'Pát I Inox (Riva)'],
  max: ['Con', 'sửa', 'cần xác nhận', 'Nút bóp 4 phân'],
  mm: ['', 'sửa', 'chắc', 'TEMPERED FROSTED — mm là kích thước, không phải ĐVT'],
  700: ['', 'sửa', 'chắc', 'GHẾ XC NAXOS — 700 là số lượng lọt vào ô ĐVT'],
  đvt: [
    '',
    'sửa',
    'chắc',
    'Mã NK-0045 tên "Tên vật tư" — dòng tiêu đề lọt vào khi import, nên XOÁ',
  ],

  // — Dòng dịch vụ / phí: xử lý theo sheet 4 —
  chuyến: ['', 'sửa', 'chắc', 'Cước vận chuyển — xem sheet 4'],
  cont: ['', 'sửa', 'chắc', 'Phí hàng nhập — xem sheet 4'],
  "cont 20'": ['', 'sửa', 'chắc', 'Cước vận chuyển kính — xem sheet 4'],
  CNT: ['', 'sửa', 'chắc', 'Phí hàng nhập — xem sheet 4'],
  bill: ['', 'sửa', 'chắc', 'Phí hàng nhập kính — xem sheet 4'],
  'báo cáo': ['', 'sửa', 'chắc', 'Phí kiểm định — xem sheet 4'],
  lần: ['', 'sửa', 'chắc', 'Phí phát triển khuôn — xem sheet 4'],
  Máy: ['', 'sửa', 'chắc', 'Đại tu đầu nén — xem sheet 4'],
}

const CANON = [
  ['Cái', 'Đếm chiếc lẻ — phụ kiện, chi tiết rời'],
  ['Con', 'Vít, tán, ốc, bulong'],
  ['Bộ', 'Bán theo cụm đi kèm'],
  ['Cặp', 'Hai chiếc đi liền'],
  ['Đôi', 'Găng tay, giày'],
  ['Cây', 'Nhôm, inox, sắt dạng thanh dài'],
  ['Thanh', 'Nan, thanh nhựa'],
  ['Tấm', 'Tôn, tole, ván, mút tấm'],
  ['Cuộn', 'Dây, màng, băng keo'],
  ['Sợi', 'Dây đơn'],
  ['Mét', 'Bán theo chiều dài'],
  ['M²', 'Bán theo diện tích'],
  ['M³', 'Bán theo khối'],
  ['Kg', 'Cân — sơn, hoá chất, mây, thép cân'],
  ['Lít', 'Dung dịch đong theo lít'],
  ['Thùng', 'Bao bì carton'],
  ['Hộp', 'Đóng hộp'],
  ['Bì', 'Bao/bì/túi — gộp về một tên'],
  ['Bó', 'Bó dây, bó thanh'],
  ['Can', 'Hoá chất 20-25 lít'],
  ['Chai', 'Keo, dung môi chai nhỏ'],
  ['Lon', 'Sơn/dầu lon'],
  ['Phuy', 'Thùng phuy'],
  ['Vỉ', 'Đóng vỉ'],
  ['Viên', 'Đá mài, viên rời'],
  ['Tờ', 'Giấy, decal'],
  ['Nhãn', 'Tem/nhãn/thẻ treo'],
  ['Ống', 'Keo ống, silicon'],
  ['Vòng', 'Vòng bi, gioăng'],
  ['Mũi', 'Mũi khoan, mũi taro'],
  ['Ổ', 'Ổ bi, ổ khoá'],
  ['Lô', 'Mua theo lô (hàng nhập)'],
]

const HEAD_FILL = 'FFE2E8F0'
const WARN_FILL = 'FFFEF3C7'
const INPUT_FILL = 'FFFFFDE7'

function sheet(wb, name) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 0 }] })
  ws.properties.defaultRowHeight = 16
  return ws
}

function head(ws, row, labels, widths) {
  ws.columns = widths.map((w) => ({ width: w }))
  labels.forEach((l, i) => {
    const c = ws.getCell(row, i + 1)
    c.value = l
    c.font = { name: 'Arial', size: 9.5, bold: true }
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEAD_FILL },
    }
    c.alignment = { vertical: 'middle', wrapText: true }
    c.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  ws.getRow(row).height = 26
  ws.views = [{ state: 'frozen', ySplit: row }]
}

function body(ws, row, rows, inputCols = []) {
  rows.forEach((r, ri) => {
    r.forEach((v, ci) => {
      const c = ws.getCell(row + ri, ci + 1)
      c.value = v
      c.font = { name: 'Arial', size: 9.5 }
      c.alignment = { vertical: 'top', wrapText: true }
      c.border = {
        top: { style: 'hair' },
        left: { style: 'hair' },
        bottom: { style: 'hair' },
        right: { style: 'hair' },
      }
      if (inputCols.includes(ci)) {
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: INPUT_FILL },
        }
      }
    })
  })
}

/**
 * Kéo TOÀN BỘ danh mục theo trang. PostgREST trần 1.000 dòng/lượt: quên phân
 * trang là báo cáo chỉ soi 1.000/13.168 mã rồi kết luận "chỉ có 26 ĐVT" — con
 * số nghe hợp lý nên không ai nghi.
 */
async function allMaterials() {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('warehouse_materials')
      .select('code, name, unit, group_name, is_active')
      .order('code')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

const main = async () => {
  const mats = await allMaterials()

  const counts = new Map()
  for (const m of mats) counts.set(m.unit, (counts.get(m.unit) ?? 0) + 1)

  const isService = (n) => /^phí |^cước |vận chuyển|^đại tu|phí hàng nhập/i.test(n ?? '')
  const services = mats.filter((m) => isService(m.name))
  const badUnits = Object.entries(PROPOSAL)
    .filter(([, p]) => p[1] === 'sửa')
    .map(([u]) => u)
  const badRows = mats.filter((m) => badUnits.includes(m.unit))

  const wb = new ExcelJS.Workbook()

  /* ── Đọc trước ─────────────────────────────────────────────────────────── */
  let ws = sheet(wb, 'Đọc trước')
  ws.columns = [{ width: 3 }, { width: 30 }, { width: 108 }]
  ws.getCell('B2').value = 'RÀ SOÁT ĐƠN VỊ TÍNH — DANH MỤC VẬT TƯ'
  ws.getCell('B2').font = { name: 'Arial', size: 15, bold: true }
  const intro = [
    [
      'Vì sao có file này',
      `Danh mục đang có ${counts.size} ĐVT khác nhau trên ${mats.length} mã vật tư. ĐVT in thẳng lên đơn đặt gửi NCC, nên "1 bill", "3 chuyến", "700" ra giấy là NCC đọc không hiểu.`,
    ],
    [
      'Cần anh/chị làm gì',
      'Điền cột nền VÀNG (ĐVT chốt / Xử lý) rồi gửi lại. Chưa chốt thì chưa đụng vào dữ liệu — file này chỉ ĐỌC, không sửa gì trên hệ thống.',
    ],
    [
      'Sheet 1',
      'Bộ ĐVT chuẩn đề xuất — danh sách đóng, sau này ô ĐVT chỉ cho chọn trong đây.',
    ],
    [
      'Sheet 2',
      `Toàn bộ ${counts.size} ĐVT đang dùng, kèm số mã và đề xuất: giữ / gộp / quy đổi / sửa.`,
    ],
    ['Sheet 3', `${badRows.length} mã có ĐVT sai hẳn — cần chốt từng mã.`],
    [
      'Sheet 4',
      `${services.length} dòng là CƯỚC VẬN CHUYỂN / PHÍ dịch vụ đang nằm trong danh mục vật tư. Không phải vật tư, ĐVT của chúng chép theo món hàng đi kèm.`,
    ],
    [
      'Lưu ý "quy đổi"',
      'Yard / Inch / MTK / Lố là đơn vị đo KHÁC, không phải cách viết khác. Đổi sang Mét/Cái phải nhân hệ số cho cả tồn kho lẫn đơn đang chạy — sửa suông là sai số lượng.',
    ],
  ]
  intro.forEach(([k, v], i) => {
    const r = 4 + i
    ws.getCell(r, 2).value = k
    ws.getCell(r, 2).font = { name: 'Arial', size: 10, bold: true }
    ws.getCell(r, 2).alignment = { vertical: 'top', wrapText: true }
    ws.getCell(r, 3).value = v
    ws.getCell(r, 3).font = { name: 'Arial', size: 10 }
    ws.getCell(r, 3).alignment = { vertical: 'top', wrapText: true }
    ws.getRow(r).height = 30
  })

  /* ── 1. ĐVT chuẩn đề xuất ──────────────────────────────────────────────── */
  ws = sheet(wb, '1. ĐVT chuẩn đề xuất')
  head(
    ws,
    1,
    ['ĐVT chuẩn', 'Dùng cho', 'Số mã đang dùng đúng tên này', 'Đồng ý? (x)'],
    [14, 46, 26, 14],
  )
  body(
    ws,
    2,
    CANON.map(([u, d]) => [u, d, counts.get(u) ?? 0, '']),
    [3],
  )

  /* ── 2. Gom đồng nghĩa ─────────────────────────────────────────────────── */
  ws = sheet(wb, '2. Gom đồng nghĩa')
  head(
    ws,
    1,
    [
      'ĐVT đang dùng',
      'Số mã',
      'Đề xuất đổi thành',
      'Hành động',
      'Độ chắc',
      'Ghi chú',
      'ĐVT chốt',
    ],
    [16, 8, 18, 12, 14, 52, 16],
  )
  const unitRows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([u, c]) => {
      const p = PROPOSAL[u]
      if (!p) return [u, c, u, 'giữ', 'chắc', '', '']
      return [u, c, p[0] || '(cần chốt)', p[1], p[2], p[3], '']
    })
  body(ws, 2, unitRows, [6])
  unitRows.forEach((r, i) => {
    if (r[3] !== 'giữ') {
      for (let ci = 1; ci <= 6; ci++) {
        ws.getCell(2 + i, ci).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: WARN_FILL },
        }
      }
    }
  })

  /* ── 3. ĐVT sai cần sửa ────────────────────────────────────────────────── */
  ws = sheet(wb, '3. ĐVT sai cần sửa')
  head(
    ws,
    1,
    ['Mã VT', 'Tên vật tư', 'Nhóm', 'ĐVT hiện tại', 'Đề xuất', 'Vì sao sai', 'ĐVT chốt'],
    [12, 46, 30, 14, 14, 44, 16],
  )
  body(
    ws,
    2,
    badRows.map((m) => {
      const p = PROPOSAL[m.unit] ?? ['', '', '', '']
      return [m.code, m.name, m.group_name ?? '', m.unit, p[0] || '(cần chốt)', p[3], '']
    }),
    [6],
  )

  /* ── 4. Dòng dịch vụ / phí ─────────────────────────────────────────────── */
  ws = sheet(wb, '4. Dòng dịch vụ - phí')
  head(
    ws,
    1,
    ['Mã VT', 'Tên', 'Nhóm', 'ĐVT hiện tại', 'Xử lý (tách nhóm Dịch vụ / giữ / xoá)'],
    [12, 52, 30, 14, 34],
  )
  body(
    ws,
    2,
    services.map((m) => [m.code, m.name, m.group_name ?? '', m.unit, '']),
    [4],
  )

  await wb.xlsx.writeFile(OUT)
  console.log('saved:', OUT)
  console.log(
    `vật tư ${mats.length} · ĐVT ${counts.size} · ĐVT sai ${badRows.length} mã · dịch vụ/phí ${services.length} dòng`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

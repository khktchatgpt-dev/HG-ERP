// NẠP 5 ĐƠN MUA LỆNH 09/26-27 - MX TỪ FILE "LSX 09.26.27( 18056 HG-MX).xls"
// + GHI HỘ VIỆC SẾP ĐÃ KÝ DUYỆT TRÊN GIẤY — 27/09/2026.
//
//   node scripts/po-import-lsx0926-mx.mjs [đường dẫn .xls]            # dò khô
//   node scripts/po-import-lsx0926-mx.mjs [đường dẫn .xls] --apply    # ghi
//
// File có 9 sheet; 6 sheet là tờ đơn NCC. Nạp 5:
//   thái danh → 2/2026- HG/TD      (gòn ép + gòn cuộn)   22/09
//   BB        → 03-2026 HG/3/2     (thùng carton)        21/09  LSX 9+10
//   MT        → 9/2026- HG/TN      (vít, bulon)          25/09
//   tem nhãn  → 9-2026/ HG -PQ     (nhãn, thẻ treo)      19/09
//   TTL       → 9/2026- HG/TTL     (nút nhựa, mạc đồng)  24/09  LSX 9+10
// KHÔNG nạp sheet "tấn phát": là tờ "BỔ SUNG ĐƠN ĐẶT HÀNG" số 7/2026- HG/TN ngày
// 03/09 (5.000 vít 4x15 cho "Ghế XC santorin" — không có trong lệnh 09). Số
// 7/2026- HG/TN đã là PO-2026-0044 (nạp từ file LSX 06, đã nhận hàng), và tờ MT
// ngày 25/09 có dòng vít 4x15 ghi "BS đơn cũ" — nạp nữa là rủi ro đếm hai lần.
//
// Người dùng chỉ đạo "xem đã duyệt ký của sếp" → đơn vào hệ thống ở bậc ĐÃ DUYỆT
// (approved), KHÔNG phải đã gửi NCC: bấm "Gửi NCC" trên app khi đã gửi thật (app
// bắt khai hẹn giao ở bước đó — BB và TTL không ghi thời gian giao cụ thể).
// Ghi hộ đúng dạng scripts/po-ghi-ho-duyet-giay.mjs: approval_events submitted
// (chị Nga) + approved (Vũ Phương Thảo — vai po_approver), approved_at = ngày
// trên tờ 08:00 (giấy không ghi giờ), không phát thông báo.
//
// SỐ ĐỌC TỪ FILE (ô công thức lấy kết quả đã tính), mã vật tư CHỌN TAY từng dòng
// kèm lý do — bộ khớp tự động từng khớp "4x100" vào "14x100" (xem
// po-import-vt-rosco2.mjs). Ưu tiên mã ĐANG NẰM TRONG ĐỊNH MỨC SP (để nhu cầu lệnh
// và đơn nói về cùng một mã) rồi đến mã đã dùng ở đơn trước cùng NCC.
// Dòng đơn: price_basis 'unit' (SL × đơn giá như tờ) — gòn tấm giá theo TẤM,
// thùng giá theo THÙNG; quy cách/m²/giá m² vẫn ghi để phiếu in đủ cột.
import { readFileSync } from 'node:fs'
import XLSX from 'xlsx'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const FILE =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ??
  'C:/Users/HP/Downloads/LSX 09.26.27( 18056 HG-MX).xls'
const FILE_NAME = 'LSX 09.26.27( 18056 HG-MX).xls'
const sb = await client(import.meta.url)
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const APPROVER_EMAIL = 'ketoan2@hoanggia.de' // Vũ Phương Thảo — ký duyệt đơn mua
const LSX_MAIN = '09/26-27 - MX'
const LSX_EXTRA = '10/26-27 - MX' // tờ BB, TTL ghi "LSX 9+10"
const TODAY = '27/09/2026'

const wb = XLSX.read(readFileSync(FILE))
const cell = (sheet, a) => wb.Sheets[sheet]?.[a]?.v ?? null
const txt = (sheet, a) => {
  const v = cell(sheet, a)
  return v == null ? '' : String(v).replace(/\s+/g, ' ').trim()
}
const num = (sheet, a) => {
  const v = cell(sheet, a)
  if (typeof v === 'number') return v
  const s = String(v ?? '')
    .replace(/,/g, '')
    .trim()
  return s !== '' && !isNaN(+s) ? +s : null
}

const XI7 = 'Sắt xi 7 màu' // ô "Sắt xi 7M" gộp D15:D20 của tờ MT
const TERMS_TT = {
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_invoice: 'Hóa đơn GTGT',
}

/*
 * Vật tư KHAI MỚI — danh mục không có mã đúng quy cách (dò 13.297 mã, 27/09).
 * `needs_review` để Cung ứng soát.
 */
const NEW_MATS = {
  NUT3060NAU: {
    name: 'Nút chân 30x60x10, nâu',
    unit: 'Cái',
    group_name: 'Phụ kiện nội thất',
    spec: '30×60×10',
    material_grade: 'Nhựa nâu',
    po_template: 'accessory',
    prefix: ['PKN', false, 4],
    why: 'danh mục chỉ có 30x60 đen/xám (PKN0382/PKN0383); không có màu nâu',
  },
  LOT3L810: {
    name: 'Lót tấm 3 lớp 810x145mm',
    unit: 'Tấm',
    group_name: 'Bao bì - đóng gói - tem nhãn',
    spec: '810×145 mm',
    material_grade: null,
    po_template: 'carton',
    prefix: ['BAO', false, 4],
    why: 'BB-0006 "Lót tấm 3L" là 815x105, BB-0005 là 805x105 — khác quy cách 810x145',
  },
  HOPCHAN670: {
    name: 'Hộp chân 3 lớp 670x255x65mm',
    unit: 'Thùng',
    group_name: 'Bao bì - đóng gói - tem nhãn',
    spec: '670×255×65 mm (lọt lòng)',
    material_grade: null,
    po_template: 'carton',
    prefix: ['BAO', false, 4],
    why: 'BAO0081 là 665x309x80, BB-0017 là 660x250x35 — khác quy cách 670x255x65',
  },
}

// ---------------------------------------------------------------- tờ đơn ---
// rows: số dòng Excel (1-based) của từng dòng hàng + mã chọn + lý do.
const ORDERS = [
  {
    sheet: 'thái danh',
    supplierName: 'CÔNG TY TNHH THÁI DANH', // tờ để trống MST — không tự điền
    docNo: '2/2026- HG/TD',
    date: '2026-09-22',
    onPaper: 'LSX 9.26.27 (HG - MERXX)',
    contact: 'Chị Hằng - 0988006071',
    template: 'foam',
    subtotalCell: 'J25',
    lead: 'Từ 7 đến 10 ngày kể ngày xác nhận đơn đặt hàng ( không tính ngày lễ và Chủ nhật)',
    leadDays: 10,
    terms: {
      terms_quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu trên đơn hàng.',
      terms_payment: 'Thanh toán công nợ cuối tháng',
    },
    cols: {
      name: 'B',
      spec: 'D',
      qty: 'E',
      unit: 'H',
      price: 'I',
      amount: 'J',
      note: 'K',
    },
    grade: 'D20', // ô C16:C22 gộp — áp cho 7 dòng gòn ép
    lines: [
      {
        row: 16,
        mat: 'MUT0515',
        dims: [685, 355, 20],
        why: 'Xơ gòn tấm 685x355x20 — đúng quy cách',
      },
      {
        row: 17,
        mat: 'MUT0500',
        dims: [485, 350, 20],
        why: 'Xơ gòn tấm 485x350x20 — đúng quy cách',
      },
      {
        row: 18,
        mat: 'MUT0487',
        dims: [1120, 370, 20],
        why: 'Xơ gòn tấm 1120x370x20 — đúng quy cách',
      },
      {
        row: 19,
        mat: 'MUT0503',
        dims: [490, 370, 20],
        why: 'Xơ gòn tấm 490x370x20 — đúng quy cách',
      },
      {
        row: 20,
        mat: 'MUT0518',
        dims: [720, 370, 20],
        why: 'Xơ gòn tấm 720x370x20 — đúng quy cách',
      },
      {
        row: 21,
        mat: 'MUT0512',
        dims: [670, 550, 50],
        why: 'Xơ gòn tấm 670x550x50 — đúng quy cách',
      },
      {
        row: 22,
        mat: 'MUT0508',
        dims: [570, 550, 50],
        why: 'Xơ gòn tấm 570x550x50 — đúng quy cách',
      },
      {
        row: 23,
        mat: 'GON0070',
        qtyCol: 'G', // SL đặt theo KG (cột G); cột F là 650 mét
        grade: null,
        extraNote: 'SL mét 650 (khổ 600, 1,3 m/cái mê)',
        why: '"Gòn quấn R110" — gòn cuộn R110 tính theo kg',
      },
    ],
  },
  {
    sheet: 'BB',
    supplierTax: '4200528940', // có mã "3/2"; bản trùng "CÔNG TY CỔ PHẦN 3/2" không MST — không dùng
    docNo: '03-2026 HG/3/2',
    date: '2026-09-21',
    onPaper: 'LSX 9+10/26-27 (HG-MX)',
    contact: 'Chị Hạnh - 0903793232',
    template: 'carton',
    extraLsx: true,
    subtotalCell: 'N25',
    lead: 'Thời gian giao hàng sẽ thông tin sau.',
    leadDays: null,
    terms: {
      terms_quality:
        'Đúng định lượng, Đúng quy cách, Thùng vuông góc, không rách móp ẩm mốc, in rõ đúng nội dung.',
      terms_payment: 'Công nợ cuối tháng.',
    },
    cols: {
      product: 'B', name: 'C', open: 'D', demand: 'E', perCtn: 'F', qty: 'G',
      L: 'H', W: 'I', H: 'J', m2: 'K', priceM2: 'L', price: 'M', amount: 'N', note: 'O',
    }, // prettier-ignore
    lines: [
      { row: 16, mat: 'BAO0210', why: 'Thùng carton ghế Atrani' },
      { row: 17, mat: 'BAO0323', why: 'Thùng carton mái che Riva' },
      { row: 18, mat: 'BAO0326', why: 'Thùng carton nệm Riva — "Bộ đệm Riva"' },
      { row: 19, mat: 'BAO0205', why: 'Thùng carton ghế 5 bậc Verona' },
      {
        row: 20,
        mat: { new: 'LOT3L810' },
        unit: 'Tấm',
        why: 'khai mới — ' + NEW_MATS.LOT3L810.why,
      },
      {
        row: 21,
        mat: 'BAO0143',
        why: 'Thùng carton bàn Polywood (1525x925x110) — đúng quy cách',
      },
      {
        row: 22,
        mat: { new: 'HOPCHAN670' },
        why: 'khai mới — ' + NEW_MATS.HOPCHAN670.why,
      },
      { row: 23, mat: 'BAO0259', why: 'Thùng carton ghế relax' },
    ],
  },
  {
    sheet: 'MT',
    supplierTax: '4100577768', // TƯỜNG NGUYÊN
    docNo: '9/2026- HG/TN',
    date: '2026-09-25',
    onPaper: 'LSX 9.26.27 HG-MX',
    contact: 'Cô Thu - 0914412818',
    template: 'accessory',
    subtotalCell: 'K22',
    lead: 'Từ 7 đến 10 ngày kể ngày xác nhận đơn đặt hàng ( không tính ngày lễ và Chủ nhật)',
    leadDays: 10,
    terms: {
      terms_quality: 'Đúng mẫu, đúng chuẩn loại như trên đơn hàng',
      terms_payment: 'Thanh toán công nợ cuối tháng',
    },
    cols: {
      name: 'C', spec: 'E', demand: 'F', onhand: 'G', qty: 'H', unit: 'I', price: 'J', amount: 'K', note: 'L',
    }, // prettier-ignore
    grade: XI7,
    lines: [
      {
        row: 15,
        mat: 'NK-0083',
        why: '"vít 4x20, 7M" — mã đang nằm trong định mức SP; mã "đầu dù ren gỗ" (GO0191) không có bản 7 màu',
      },
      { row: 16, mat: 'NK-0104', why: '"Vít 4x30 ren gỗ, 7M" — mã trong định mức SP' },
      {
        row: 17,
        mat: 'NK-0086',
        why: '"Vít dù 4x15, 7M" — đầu dù, mã trong định mức SP',
      },
      {
        row: 18,
        mat: 'NK-0116',
        why: '"Vít 4x15 đầu bằng ren gỗ, 7M" — đúng tên ("đầu =" trên tờ = đầu bằng)',
      },
      { row: 19, mat: 'VIT0087', why: '"Vít 6x50x13, 7 màu" — đúng tên' },
      {
        row: 20,
        mat: 'NK-0041',
        why: '"Bulon 6x25x13, 7 màu" — mã trong định mức SP (NK-0036 ghi lẫn "(6x20)")',
      },
    ],
  },
  {
    sheet: 'tem nhãn',
    supplierTax: '4100777083', // DNTN PQ
    docNo: '9-2026/ HG -PQ',
    date: '2026-09-19',
    onPaper: 'LSX 9/ 26-27 (HG-MX)',
    contact: 'Anh Ẩn - 0935772772',
    template: 'accessory',
    subtotalCell: 'K31',
    // Ô K31 là SUM(K15:K24) — công thức chỉ cộng 10 dòng đầu, SÓT 6 dòng cuối
    // (dòng 25–30: 28340-277 ×2, 92800-262, 92801-210, 92802-262, 92803-228 =
    // 224.000 đ). Tờ in đủ 16 dòng nên đơn ghi đủ 16 dòng; nói rõ ở ghi chú.
    knownLech: 224_000,
    lechNote:
      '⚠ Ô "CỘNG TIỀN HÀNG" trên tờ = 742.000 đ là công thức SUM(K15:K24) — chỉ cộng 10 dòng đầu, SÓT 6 dòng cuối (STT 11–16, 224.000 đ). Tờ in đủ 16 dòng nên đơn ghi đủ: 966.000 đ, +VAT 8% = 1.043.280 đ (tờ in 801.360 đ). Xác nhận lại với NCC số tiền đúng.',
    lead: 'Giao hàng từ 5 đến 7 ngày kể từ ngày nhận ĐH.( không tính ngày lễ và chủ nhật)',
    leadDays: 7,
    terms: {
      terms_quality: 'Giao hàng đúng chủng loại, đúng kích thước như trên đơn hàng.',
      terms_payment: 'Công nợ cuối tháng.',
      terms_delivery_place:
        'Xưởng SX Cty TNHH Hoàng Gia - Cụm CN Cát Nhơn, Xã Xuân An, Tỉnh Gia Lai',
    },
    cols: {
      product: 'B', name: 'C', gradeCol: 'D', sp: 'E', spec: 'F', dm: 'G', qty: 'H', unit: 'I', price: 'J', amount: 'K',
    }, // prettier-ignore
    // Nhãn/thẻ in theo SP → mã chung + `product_code` trên dòng (giá, quy cách
    // như nhau), không đẻ 16 mã vật tư mỗi SP một mã.
    lines: [15, 17, 23, 25, 27, 28, 29, 30]
      .map((row) => ({
        row,
        mat: 'BAO0483',
        why: '"Nhãn hình sản phẩm" — mã chung, SP ghi ở cột Mã SP',
      }))
      .concat(
        [16, 18, 20, 22, 24, 26].map((row) => ({
          row,
          mat: 'THE0020',
          why: '"Thẻ treo tuần 2 mặt" — mã chung, SP ghi ở cột Mã SP',
        })),
      )
      .concat([
        {
          row: 19,
          mat: 'CN1072',
          why: '26315-309 = Amalfi CÓ ben (theo tờ LSX) → "Thẻ treo 2 mặt ghế Amalfi có ben"',
        },
        {
          row: 21,
          mat: 'CN1105',
          why: '26316-309 = Amalfi KHÔNG ben → "Thẻ treo 2 mặt ( Amalfi không ben)"',
        },
      ])
      .sort((a, b) => a.row - b.row),
  },
  {
    sheet: 'TTL',
    supplierTax: '4101075030', // TÂN THÀNH LONG
    docNo: '9/2026- HG/TTL',
    date: '2026-09-24',
    onPaper: 'LSX 9+10',
    contact: 'Chị Yến - 097.557.3135',
    template: 'accessory',
    extraLsx: true,
    subtotalCell: 'K22',
    lead: 'Tháng', // tờ chỉ ghi đúng một chữ — chưa có mốc
    leadDays: null,
    terms: {
      terms_quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu trên đơn hàng.',
      terms_payment: 'Thanh toán công nợ cuối tháng',
    },
    cols: {
      name: 'C', gradeCol: 'D', spec: 'E', demand: 'F', onhand: 'G', qty: 'H', unit: 'I', price: 'J', amount: 'K', note: 'L',
    }, // prettier-ignore
    lines: [
      {
        row: 15,
        mat: 'NK-0143',
        grade: 'Nhựa đen',
        why: '"Pat nhựa gắn sắt" (SAT0279 là mã trùng nghĩa); ô Nhựa đen gộp D15:D17',
      },
      {
        row: 16,
        mat: 'BUL0434',
        grade: 'Nhựa đen',
        why: '"Long đền nhựa 6x15x10 đen" — ĐVT kg, đúng tờ',
      },
      {
        row: 17,
        mat: 'NK-0015',
        grade: 'Nhựa đen',
        why: '"Gót chân 25x50 cong, đen" — mã trong định mức SP (NUT0013 trùng nghĩa)',
      },
      {
        row: 18,
        mat: { new: 'NUT3060NAU' },
        why: 'khai mới — ' + NEW_MATS.NUT3060NAU.why,
      },
      {
        row: 19,
        mat: 'NUT0042',
        why: '"Nút nhựa 10x20 đen" — đúng tên (bảng kê ghi xám, tờ đơn ghi đen: theo tờ)',
      },
      {
        row: 20,
        mat: 'NK-0018',
        why: '"Mạc đồng dán" — mã trong 19 định mức SP + đơn TTL trước (PO-2026-0039)',
      },
      {
        row: 21,
        mat: 'CN1556',
        why: '"Vuông 60x10 đen" — cùng mã đơn TTL trước (PO-2026-0039)',
        extraNote:
          'Tờ có 3 ô lạc ở cột ngoài bảng: "9/5/26 · 1000 · -388" — không nạp, có lẽ sót từ tờ cũ',
      },
    ],
  },
]

// ------------------------------------------------------------------ đọc DB ---
async function every(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}
const [mats, sups, { data: users }, { data: lsxs }, { data: done }] = await Promise.all([
  every('warehouse_materials', 'id, code, name, unit, is_active'),
  every('supply_suppliers', 'id, code, name, tax_no, currency, can_order, is_active'),
  sb.from('users').select('id, name, email').in('email', [OWNER_EMAIL, APPROVER_EMAIL]),
  sb
    .from('production_orders')
    .select('id, code, status')
    .in('code', [LSX_MAIN, LSX_EXTRA]),
  sb
    .from('supply_purchase_orders')
    .select('code, supplier_doc_no, note')
    .or(
      `supplier_doc_no.in.(${ORDERS.map((o) => `"${o.docNo}"`).join(',')}),note.ilike.%${FILE_NAME}%`,
    ),
])
const owner = users.find((u) => u.email === OWNER_EMAIL)
const approver = users.find((u) => u.email === APPROVER_EMAIL)
const lsxMain = lsxs.find((l) => l.code === LSX_MAIN)
const lsxExtra = lsxs.find((l) => l.code === LSX_EXTRA)
if (!owner || !approver) throw new Error('thiếu tài khoản chị Nga / chị Thảo')
if (!lsxMain || !lsxExtra) throw new Error(`thiếu lệnh ${LSX_MAIN} / ${LSX_EXTRA}`)
const matBy = new Map(mats.map((m) => [m.code, m]))
const already = (o) =>
  (done ?? []).find(
    (p) => p.supplier_doc_no === o.docNo || p.note?.includes(`(sheet ${o.sheet})`),
  )

function supplierOf(o) {
  const hit = o.supplierTax
    ? sups.filter((s) => s.tax_no === o.supplierTax)
    : sups.filter((s) => s.name === o.supplierName)
  if (hit.length !== 1) throw new Error(`${o.sheet}: NCC khớp ${hit.length} bản ghi`)
  const s = hit[0]
  if (!s.is_active || s.can_order === false)
    throw new Error(`${o.sheet}: NCC ${s.name} đang khoá`)
  return s
}

// Hạn giao = ngày trên tờ + N ngày làm việc (bỏ CN), lấy mốc XA của khoảng.
function addWorkDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  for (let k = 0; k < n;) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0) k++
  }
  return d.toISOString().slice(0, 10)
}
const vn = (iso) => iso.split('-').reverse().join('/')
const fmt = (n) => Math.round(n).toLocaleString('vi-VN')
const r2 = (n) => Math.round(n * 100) / 100

// ------------------------------------------------------------- dựng dòng ---
function readOrder(o) {
  const c = o.cols
  const lines = o.lines.map((l) => {
    const g = (col) => (col ? num(o.sheet, `${col}${l.row}`) : null)
    const t = (col) => (col ? txt(o.sheet, `${col}${l.row}`) : '')
    const rawQty = g(l.qtyCol ?? c.qty)
    const priceRaw = g(c.price)
    // SL = số IN trên tờ (ô hiển thị làm tròn) — cùng luật po-import-vt-rosco2.
    const qty =
      Math.abs(rawQty - Math.round(rawQty)) < 1e-9 || rawQty < 100
        ? r2(rawQty)
        : Math.round(rawQty)
    const price = r2(priceRaw)
    const paperAmount = g(c.amount)
    const m = typeof l.mat === 'string' ? matBy.get(l.mat) : null
    if (typeof l.mat === 'string' && !m)
      throw new Error(`${o.sheet} dòng ${l.row}: không thấy mã ${l.mat}`)
    const product = t(c.product).replace(/\s+/g, ', ') || null
    const grade =
      l.grade !== undefined
        ? l.grade
        : c.gradeCol
          ? t(c.gradeCol) || null
          : (o.grade ?? null)
    const noteBits = [t(c.note), l.extraNote].filter(Boolean)
    const base = {
      row: l.row,
      name: t(c.name),
      mat: l.mat,
      matLabel: m ? `${m.code} ${m.name}` : `+ ${NEW_MATS[l.mat.new].name}`,
      unitOnPaper: t(c.unit) || l.unit || '',
      qty,
      rawQty,
      price,
      paperAmount,
      why: l.why,
      line: {
        qty_ordered: qty,
        unit_price: price,
        qty_basis: 'manual',
        price_basis: 'unit',
        spec: t(c.spec) || null,
        material_grade: grade,
        product_code: product,
        qty_demand: c.demand ? g(c.demand) : c.dm ? g(c.qty) : null,
        qty_on_hand: c.onhand ? g(c.onhand) : null,
        dm_per_sp: c.dm ? g(c.dm) : null,
        note: [...noteBits, `Chọn mã: ${l.why}`].join(' · '),
      },
    }
    if (o.template === 'foam' && l.dims) {
      Object.assign(base.line, {
        carton_basis: 'ctn',
        inner_l_mm: l.dims[0],
        inner_w_mm: l.dims[1],
        inner_h_mm: l.dims[2],
        spec: `${l.dims.join('x')} mm`,
      })
    }
    if (o.template === 'carton') {
      const dims = [g(c.L), g(c.W), g(c.H)]
      const full = dims.every((x) => x > 0)
      Object.assign(base.line, {
        carton_basis: 'ctn',
        open_style: t(c.open) || null,
        qty_demand: g(c.demand),
        pcs_per_ctn: g(c.perCtn),
        area_m2: g(c.m2) != null ? Math.round(g(c.m2) * 10000) / 10000 : null,
        price_per_m2: g(c.priceM2),
        inner_l_mm: full ? dims[0] : null,
        inner_w_mm: full ? dims[1] : null,
        inner_h_mm: full ? dims[2] : null,
        spec: `${dims.filter((x) => x > 0).join('x')} mm${full ? ' (lọt lòng)' : ''}`,
      })
      // Tờ ghi đơn giá thùng 4 lẻ (1.303,695) — cột chỉ giữ 2 lẻ.
      if (Math.abs(priceRaw - price) > 1e-9)
        base.line.note = `Tờ ghi đơn giá ${priceRaw.toLocaleString('vi-VN')} đ/thùng (m² × giá/m²), làm tròn 2 lẻ · ${base.line.note}`
    }
    if (Math.abs(rawQty - qty) > 1e-9)
      base.line.note = `Tờ tính SL lẻ ${rawQty.toLocaleString('vi-VN')}, in ${qty.toLocaleString('vi-VN')} — lấy số in · ${base.line.note}`
    return base
  })
  const sub = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const paperSubtotal = num(o.sheet, o.subtotalCell)
  const expected = o.leadDays ? addWorkDays(o.date, o.leadDays) : null
  return { ...o, lines, sub, paperSubtotal, expected }
}

const plans = ORDERS.map(readOrder)
let grand = 0
let bad = false
console.log(
  `File ${FILE_NAME} · lệnh ${LSX_MAIN} (+ ${LSX_EXTRA} cho đơn "9+10") · soạn ${owner.name} · duyệt ${approver.name}\n`,
)
for (const p of plans) {
  const sup = supplierOf(p)
  const had = already(p)
  const lech = p.sub - p.paperSubtotal
  grand += p.sub
  console.log(
    `=== ${p.sheet} · ${p.docNo} · ${vn(p.date)} · ${sup.code ?? '—'} ${sup.name} · mẫu ${p.template}${p.extraLsx ? ' · +LSX 10' : ''}${had ? `  ⟵ ĐÃ NẠP (${had.code}), bỏ qua` : ''}`,
  )
  for (const l of p.lines) {
    const a = l.qty * l.price
    const off = l.paperAmount != null && Math.abs(a - l.paperAmount) > 0.5
    console.log(
      `  ${String(l.row).padStart(2)} ${l.name.slice(0, 30).padEnd(30)} → ${l.matLabel.slice(0, 44).padEnd(44)} ${String(l.line.product_code ?? '').padEnd(9)} ${fmt(l.qty).padStart(7)} ${l.unitOnPaper.padEnd(5)} × ${l.price.toLocaleString('vi-VN').padStart(9)} = ${fmt(a).padStart(11)}${off ? ` (tờ ${fmt(l.paperAmount)})` : ''}`,
    )
  }
  if (Math.abs(lech - (p.knownLech ?? 0)) > 100) bad = true
  console.log(
    `  Tiền hàng ${fmt(p.sub)} · tờ ${fmt(p.paperSubtotal)} · lệch ${fmt(lech)} · +VAT 8% = ${fmt(p.sub * 1.08)} · hẹn giao ${p.expected ? vn(p.expected) : 'CHƯA CÓ (' + p.lead + ')'}\n`,
  )
}
console.log(`Tổng tiền hàng 5 đơn: ${fmt(grand)} đ · +VAT 8% = ${fmt(grand * 1.08)} đ`)
if (bad) throw new Error('có đơn lệch tờ > 100 đ — dừng')
if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ------------------------------------------------------------------ ghi -----
const newIds = {}
async function matId(ref) {
  if (typeof ref === 'string') return matBy.get(ref).id
  if (newIds[ref.new]) return newIds[ref.new]
  const spec = NEW_MATS[ref.new]
  const again = mats.find((m) => m.name === spec.name)
  if (again) return (newIds[ref.new] = again.id)
  const [prefix, dashed, width] = spec.prefix
  let no = 0
  for (const m of mats) {
    const hit = String(m.code).match(/^([A-Z]+)(-?)(\d+)$/)
    if (hit && hit[1] === prefix && !!hit[2] === dashed) no = Math.max(no, Number(hit[3]))
  }
  const code = `${prefix}${dashed ? '-' : ''}${String(no + 1).padStart(width, '0')}`
  const { why: _w, prefix: _p, ...row } = spec
  const { data, error } = await sb
    .from('warehouse_materials')
    .insert({ ...row, code, needs_review: true, is_active: true })
    .select('id, code, name, unit, is_active')
    .single()
  if (error) throw new Error(`khai vật tư ${spec.name}: ${error.message}`)
  mats.push(data)
  matBy.set(data.code, data)
  console.log(`  + vật tư ${data.code} ${data.name}`)
  return (newIds[ref.new] = data.id)
}

const at = (iso, hm) => `${iso}T${hm}:00+07:00`
for (const p of plans) {
  if (already(p)) {
    console.log(`  = ${p.sheet}: đã nạp (${already(p).code}), bỏ qua`)
    continue
  }
  const sup = supplierOf(p)
  const ids = []
  for (const l of p.lines) ids.push(await matId(l.mat))
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const lech = p.sub - p.paperSubtotal
  const note = [
    `Nạp từ file "${FILE_NAME}" (sheet ${p.sheet}) ngày ${TODAY}.`,
    `Ngày trên đơn: ${vn(p.date)}. Ghi trên đơn: ${p.onPaper}. Người liên hệ NCC: ${p.contact}.`,
    p.lechNote
      ? p.lechNote
      : Math.abs(lech) > 0.5
        ? `Tiền hàng ${fmt(p.sub)} đ; ô tiền trên tờ ${fmt(p.paperSubtotal)} đ (lệch ${fmt(lech)} đ — xem ghi chú dòng).`
        : `Tiền hàng ${fmt(p.sub)} đ khớp tờ.`,
    p.expected
      ? `Hẹn giao ${vn(p.expected)} = mốc xa của "${p.lead}" tính từ ngày trên đơn, bỏ chủ nhật.`
      : `Tờ chưa ghi hẹn giao ("${p.lead}") — khai khi bấm Gửi NCC.`,
    `Đã ký duyệt (${approver.name}) trên giấy ngày ${vn(p.date)} — trạng thái ghi hộ ${TODAY}.`,
  ].join(' ')
  const { data: po, error: pe } = await sb
    .from('supply_purchase_orders')
    .insert({
      code,
      production_order_id: lsxMain.id,
      supplier_id: sup.id,
      status: 'draft', // lên 'approved' sau khi ghi đủ dòng + nhật ký
      template: p.template,
      currency: sup.currency ?? 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      supplier_doc_no: p.docNo,
      expected_at: p.expected,
      note,
      ...TERMS_TT,
      ...p.terms,
      terms_lead_time: p.lead,
      signer_role: 'NGƯỜI LẬP',
      created_by: owner.id,
      assigned_to: owner.id,
    })
    .select('id, code')
    .single()
  if (pe) throw new Error(`tạo đơn ${p.sheet}: ${pe.message}`)
  const undo = async (msg) => {
    await sb.from('supply_purchase_orders').delete().eq('id', po.id)
    throw new Error(`${p.sheet} ${po.code}: ${msg} — đã gỡ đơn`)
  }
  const payload = p.lines.map((l, i) => ({
    ...l.line,
    po_id: po.id,
    material_id: ids[i],
    sort_order: i,
  }))
  const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
  if (le) await undo(`dòng đơn: ${le.message}`)
  if (p.extraLsx) {
    const { error: xe } = await sb
      .from('supply_po_extra_lsx')
      .insert({ po_id: po.id, production_order_id: lsxExtra.id })
    if (xe) await undo(`gộp LSX 10: ${xe.message}`)
  }
  const reason = `Ký duyệt TRÊN GIẤY ngày ${vn(p.date)} — ghi hộ lên hệ thống ngày ${TODAY} theo chỉ đạo; giấy không ghi giờ (08:00 là giờ quy ước).`
  const { error: ee } = await sb.from('approval_events').insert([
    {
      entity_type: 'po',
      entity_id: po.id,
      entity_code: po.code,
      action: 'submitted',
      actor_id: owner.id,
      created_at: at(p.date, '07:55'),
      reason: `Ghi hộ ${TODAY} — đơn đã trình ký trên giấy.`,
    },
    {
      entity_type: 'po',
      entity_id: po.id,
      entity_code: po.code,
      action: 'approved',
      actor_id: approver.id,
      created_at: at(p.date, '08:00'),
      reason,
    },
  ])
  if (ee) await undo(`nhật ký duyệt: ${ee.message}`)
  const { error: ue } = await sb
    .from('supply_purchase_orders')
    .update({
      status: 'approved',
      approved_by: approver.id,
      approved_at: at(p.date, '08:00'),
    })
    .eq('id', po.id)
    .eq('status', 'draft')
  if (ue)
    throw new Error(
      `${po.code} lên đã duyệt: ${ue.message} (đơn + dòng đã ghi, còn ở nháp)`,
    )
  console.log(
    `  ✓ ${po.code} ${p.docNo} — ${payload.length} dòng · ${fmt(p.sub)} đ · đã duyệt ${vn(p.date)}`,
  )
}
console.log('\nXong.')

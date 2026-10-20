// SỬA 16 ĐƠN MUA LỆNH 06/26-27 - MX THEO FILE "LSX 06.26.27( 18023 HG-MX) (1).xls" — 01/10/2026.
//
//   node scripts/po-sua-lsx0626-mx-1001.mjs           # dò khô: in đối chiếu + tổng tiền từng đơn
//   node scripts/po-sua-lsx0626-mx-1001.mjs --apply   # sao lưu rồi ghi
//
// Chủ dự án (01/10): "tất cả đơn hàng này đều đã đến bước chuẩn bị nhập kho",
// "trước hết cần đảm bảo chính xác các đơn hàng sau đó để nhân viên cung ứng ghi
// phiếu nhập kho", "nhà cung cấp đã xác nhận", "xử lí toàn bộ để chính xác theo file".
//
// VIỆC LÀM, theo thứ tự:
//  1. SỔ KHO. 9 đơn cũ (0038…0047) đang "đã về đủ" nhờ 9 phiếu NẠP NỀN 11/09
//     (PNK-2026-0023…0038) — không phải hàng về thật. Kiểm kê KK-2026-0004 (15/09)
//     đã trừ đúng các lượng đó để tồn về 0. Đảo thẳng 9 phiếu thì tồn âm, nên:
//       a) một phiếu điều chỉnh (kind stocktake) CỘNG LẠI đúng phần KK-0004 đã trừ
//          cho 9 phiếu đó — không gắn đơn mua;
//       b) 9 phiếu đảo (PXK, reversal_of_doc_id = phiếu gốc) như `stockService.reverseDoc`,
//          mang po_line_id + unit_cost của dòng gốc để số "đã nhận" và công nợ NET về 0.
//     Tồn từng mã trước/sau đều không đổi. Không xoá/sửa dòng sổ nào.
//  2. ĐƠN. Sửa dòng 8 đơn cho khớp file (giữ id dòng trùng khớp, thêm dòng thiếu,
//     bỏ dòng file không còn); huỷ PO-0047 (tờ VẢI TDS ghi "SL cần đặt −284" — tồn đủ,
//     không đặt); tạo 7 đơn chưa có (BS.ATP, TV, HVH ×2, gòn, TEM, HLH).
//  3. TRẠNG THÁI. 15 đơn → "NCC đã xác nhận": ghi hộ gửi duyệt (Nga) + duyệt (Thảo)
//     theo NGÀY TRÊN TỜ (giờ quy ước 07:55/08:00/08:05), NCC xác nhận ngày hôm sau
//     09:00, hẹn giao = mốc cuối của "thời gian giao" trên tờ (bỏ Chủ nhật).
//  4. GHI CHÚ NỘI BỘ mỗi đơn: sửa gì + cột theo dõi giao hàng trên file, để Cung
//     ứng lập phiếu nhập thật.
//
// Mã vật tư: dòng khớp dòng đơn cũ giữ mã cũ; dòng mới chọn theo (1) lịch sử mua
// cùng NCC, (2) đúng tên + màu/vật liệu trên tờ, (3) họ mã cùng NCC. 16 mã khai mới
// (needs_review). Danh sách lựa chọn in ra khi dò khô.
import fs from 'node:fs'
import * as XLSX from 'xlsx'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const FILE = 'C:/Users/HP/Downloads/LSX 06.26.27( 18023 HG-MX) (1).xls'
const TODAY = '2026-10-01'
const fmt = (n) => Math.round(n).toLocaleString('vi-VN')
const r2 = (n) => Math.round(n * 100) / 100
const round6 = (n) => Math.round(n * 1e6) / 1e6
const vn = (d) => d.split('-').reverse().join('/')

// ───────────────────────── người, lệnh, NCC ─────────────────────────
const one = async (q, what) => {
  const { data, error } = await q
  if (error || !data) throw new Error(`${what}: ${error?.message ?? 'không thấy'}`)
  return data
}
const NGA = await one(sb.from('users').select('id,name').eq('email', 'kehoach1@hoanggia.de').single(), 'Nga') // prettier-ignore
const THAO = await one(sb.from('users').select('id,name').eq('email', 'ketoan2@hoanggia.de').single(), 'Thảo') // prettier-ignore
const VIET = await one(sb.from('users').select('id,name').eq('email', 'it@hoanggia.de').single(), 'Việt') // prettier-ignore
const LSX06 = await one(sb.from('production_orders').select('id,code').eq('code', '06/26-27 - MX').single(), 'LSX 06') // prettier-ignore
const LSX07 = await one(sb.from('production_orders').select('id,code').eq('code', '07/26-27 - MX').single(), 'LSX 07') // prettier-ignore
const SUP = {
  ATP: '4793b72b-e6ee-4505-9487-36e3b950cfd9',
  HT: 'f3b8195d-92bf-4d4d-9765-a65f570a850a',
  KIMCUONG: 'b95841af-2999-4019-9492-b68fc56d9c91',
  THAIDANH: 'd475c3d2-3179-4dbd-99f9-a399fa5c2b05',
  PQ: '0832bc7f-5acd-468c-ad8a-33949356e60a',
  HLH: '331fe693-c4c8-4dce-9544-3d28eaedb4db',
}

// ───────────────────────── danh mục ─────────────────────────
const mats = []
for (let f = 0; ; f += 1000) {
  const { data, error } = await sb.from('warehouse_materials').select('id,code,name,unit').order('code').range(f, f + 999) // prettier-ignore
  if (error) throw error
  mats.push(...data)
  if (data.length < 1000) break
}
const byCode = new Map(mats.map((m) => [m.code, m]))
const maxNo = (p) =>
  mats.reduce((mx, { code }) => {
    if (!code.startsWith(p)) return mx
    const t = code.slice(p.length)
    return /^\d+$/.test(t) ? Math.max(mx, Number(t)) : mx
  }, 0)

const G_PK = 'Phụ kiện nội thất'
const G_BAO = 'Bao bì - đóng gói - tem nhãn'
const G_MUT = 'Mút - xốp - nệm - gòn'
// Khai mới: khoá → { prefix, name, unit, group, template, spec?, grade? }
const NEW = {
  truotNau: { p: 'NK-', name: 'Bộ thanh trượt nhựa màu nâu', unit: 'Bộ', group: G_PK, t: 'accessory', grade: 'Nhựa màu nâu' }, // prettier-ignore
  doKinhNho: {
    p: 'PKN',
    name: 'Pát đỡ kính nhỏ',
    unit: 'Cái',
    group: G_PK,
    t: 'accessory',
  },
  patCon: { p: 'PKN', name: 'Pát côn 3 lỗ, xi trắng', unit: 'Cái', group: G_PK, t: 'accessory', grade: 'XT' }, // prettier-ignore
  ty665: { p: 'NK-', name: 'Ty sắt phi 10x665', unit: 'Cây', group: 'Sắt thép - tôn - tấm', t: 'accessory', spec: 'Φ10×665' }, // prettier-ignore
  ty660: { p: 'NK-', name: 'Ty sắt phi 10x660', unit: 'Cây', group: 'Sắt thép - tôn - tấm', t: 'accessory', spec: 'Φ10×660' }, // prettier-ignore
  khopNoiS: { p: 'NK-', name: 'Khớp nối chân nhôm S (nhôm đúc, mua theo kg)', unit: 'Kg', group: 'Cơ khí - vòng bi - khuôn', t: 'accessory', grade: 'Nhôm đúc' }, // prettier-ignore
  bbBanDelos: { p: 'BAO', name: 'BB bàn Delos', unit: 'Cái', group: G_BAO, t: 'carton' },
  bbBalkon: { p: 'BAO', name: 'BB bàn Balkon', unit: 'Cái', group: G_BAO, t: 'carton' },
  bbNanNhom: {
    p: 'BAO',
    name: 'BB bàn nan nhôm',
    unit: 'Cái',
    group: G_BAO,
    t: 'carton',
  },
  bbElos: { p: 'BAO', name: 'BB bàn Elos', unit: 'Cái', group: G_BAO, t: 'carton' },
  mut520: { p: 'MUT', name: 'Mút D15 520x470x35', unit: 'Tấm', group: G_MUT, t: 'foam', spec: '520×470×35', grade: 'D15' }, // prettier-ignore
  mut700: { p: 'MUT', name: 'Mút D15 700x470x35', unit: 'Tấm', group: G_MUT, t: 'foam', spec: '700×470×35', grade: 'D15' }, // prettier-ignore
  mut480: { p: 'MUT', name: 'Mút D15 480x460x30', unit: 'Tấm', group: G_MUT, t: 'foam', spec: '480×460×30', grade: 'D15' }, // prettier-ignore
  dung25: { p: 'VAI', name: 'Vải dựng 25gr', unit: 'Mét', group: 'Vải - da - chỉ - phụ liệu may', t: 'accessory' }, // prettier-ignore
  theTreoSp: { p: 'THE', name: 'Thẻ treo sản phẩm 7x10', unit: 'Thẻ', group: G_BAO, t: 'accessory', spec: '7×10', grade: 'Giấy ĐL 230Gr' }, // prettier-ignore
  temTextilent: { p: 'TEM', name: 'Tem Textilent', unit: 'Cái', group: G_BAO, t: 'accessory', grade: 'Ruy băng 63% poly 37 % Nylon' }, // prettier-ignore
}
const nextNo = {}
const newCode = (p) => {
  nextNo[p] = (nextNo[p] ?? maxNo(p)) + 1
  return p === 'NK-' ? `NK-${String(nextNo[p]).padStart(4, '0')}` : `${p}${String(nextNo[p]).padStart(4, '0')}` // prettier-ignore
}
for (const [k, n] of Object.entries(NEW)) {
  const again = mats.find((m) => m.name === n.name)
  n.code = again?.code ?? newCode(n.p)
  n.exists = !!again
  NEW[k] = n
}
const matOf = (ref) => {
  if (ref.startsWith('+')) return { code: NEW[ref.slice(1)].code, name: NEW[ref.slice(1)].name, unit: NEW[ref.slice(1)].unit, isNew: !NEW[ref.slice(1)].exists } // prettier-ignore
  const m = byCode.get(ref)
  if (!m) throw new Error(`Không có mã ${ref}`)
  return m
}

// ───────────────────────── dòng theo file ─────────────────────────
// L(mat, qty, price, extra). `keep` = dùng lại dòng đơn cũ cùng mã (kèm SL cũ nếu
// đơn có nhiều dòng cùng mã). `u` = ĐVT trên tờ (ghi line_unit khi khác ĐVT danh mục).
const L = (mat, qty, price, x = {}) => ({ mat, qty, price, ...x })

// Hộp thư ngày & hẹn: lead = số ngày (bỏ Chủ nhật nếu sun=false)
function addDays(iso, n, skipSunday) {
  const d = new Date(iso + 'T00:00:00Z')
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (skipSunday && d.getUTCDay() === 0) continue
    left--
  }
  return d.toISOString().slice(0, 10)
}

const LEAD_7_10 = 'Từ 7 đến 10 ngày kể ngày xác nhận đơn đặt hàng ( không tính ngày lễ và Chủ nhật)' // prettier-ignore
const T_STD = {
  terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
  terms_payment: 'Thanh toán công nợ cuối tháng',
  terms_invoice: 'Hóa đơn GTGT',
}

const ORDERS = [
  {
    sheet: 'ATP',
    po: 'PO-2026-0038',
    date: '2026-09-08',
    lead: [10, true],
    doc: '6/2026- HG/ATP',
    track: [11, 12, 13], // prettier-ignore
    terms: { ...T_STD, terms_quality: 'Đúng chuẩn loại, màu sắc theo yêu cầu.', terms_lead_time: 'Từ 7 đến 10 ngày kể ngày xác nhận đơn đặt hàng ( không tính ngày lễ và Chủ nhật)' }, // prettier-ignore
    paper: 9_887_500,
    paperNote: 'Ô "Cộng tiền hàng" trên tờ ghi 5.577.000 nhưng công thức chỉ cộng dòng 1 — tổng 8 dòng là 9.887.500.', // prettier-ignore
    lines: [
      L('CN1552', 10140, 550, { keep: true, grade: 'Nhựa đen', spec: '75x75', demand: 10140, note: '1/ 50 bàn dán giấy (4c/sp) 2/ 1110 bàn Nk (4b/sp) 3/ 350 Bàn NK 80 4/ 300 bàn NK 65' }), // prettier-ignore
      L('NK-0171', 3440, 300, {
        u: 'Bộ',
        demand: 4640,
        onhand: 1200,
        name: 'Pát Âm dương',
      }),
      L('NK-0172', 3600, 310, { demand: 3600, name: 'Cục chặn', note: '1/ 1110 bàn NK(2c/sp) 2/ 500 bàn Polywood (2c/sp) 3/ 50 bàn Dán Giấy' }), // prettier-ignore
      L('NK-0121', 1200, 310, {
        demand: 1200,
        name: 'Con lăn nhỏ',
        note: '1/ 300 bàn 65 kính',
      }),
      L('CN1647', 2000, 260, { keep: true, demand: 2000 }),
      L('NK-0024', 400, 770, {
        demand: 1600,
        onhand: 1200,
        note: '1/ 400 ghế Thasos (4c/sp)',
      }),
      L('+truotNau', 85, 8500, { grade: 'nhựa màu nâu', demand: 85, note: '80 bàn 65 sơn nâu( 1b/sp)' }), // prettier-ignore
      L('PKN0381', 400, 600, { keep: true, grade: 'đen', spec: '25x65', demand: 400, note: '1/ 300 bàn NK 65' }), // prettier-ignore
    ],
  },
  {
    sheet: 'BS.ATP',
    po: null,
    sup: SUP.ATP,
    date: '2026-09-17',
    lead: [10, true],
    doc: '6/2026- HG/ATP (bổ sung 17/09/2026)',
    track: [11, 12, 13], // prettier-ignore
    terms: { ...T_STD, terms_quality: 'Đúng chuẩn loại, màu sắc theo yêu cầu.', terms_lead_time: LEAD_7_10 }, // prettier-ignore
    paper: 5_164_800,
    paperNote: 'Tờ "BỔ SUNG ĐƠN ĐẶT HÀNG" cùng số 6/2026- HG/ATP; tờ ghi MST 4101577898 và người liên hệ anh Ánh 0914.062.935 (khác tờ ATP).', // prettier-ignore
    lines: [
      L('NK-0084', 5200, 230, { grade: 'Nhựa đen', spec: '22x40x4', dm: 2, note: 'SL ĐH 2600 · 1/ 2100 ghế XC Santorin 2/ 150 XC Tilos (2 khuôn mới mở)' }), // prettier-ignore
      L('CN1654', 5200, 480, { dm: 2, note: 'SL ĐH 2600 · Nút chân hình thang' }),
      L('PKN0379', 400, 800, {
        grade: 'nhựa nâu',
        dm: 4,
        note: 'SL ĐH 100 · 1/ 100 cái võng sắt',
      }),
      L('PKN0380', 400, 1250, { dm: 4, note: 'SL ĐH 100 · tờ ghi "Nút phi 49 đầu dù"' }),
      L('+doKinhNho', 1280, 260, { dm: 16, note: 'SL ĐH 80 · 1/ 80 bàn NK màu nâu 65' }),
      L('NK-0197', 800, 400, {
        spec: '20x40x5',
        dm: 2,
        note: 'SL ĐH 400 · 1/ 400 Ghế XC',
      }),
    ],
  },
  {
    sheet: 'TTL',
    po: 'PO-2026-0039',
    date: '2026-09-03',
    lead: [10, true],
    doc: '5/2026- HG/TTL',
    track: [11, 12, 13], // prettier-ignore
    paper: 35_161_470,
    lines: [
      L('BUL0335', 3, 68000, { keep: true, u: 'kg', grade: 'Nhựa đen', spec: '10x20x13', demand: 800, note: '1/ 400 ghế 5 bậc Thasos (2c/sp)' }), // prettier-ignore
      L('NK-0042', 5, 68000, { keep: true, u: 'kg', spec: '6x16x5', demand: 2000, note: '1/ Hệ ghế 5 bậc + bàn CNKG' }), // prettier-ignore
      L('NK-0053', 10, 68000, { keep: true, u: 'kg', spec: '12x20x10', demand: 3000, note: '1/ Hệ ghế 5 bậc' }), // prettier-ignore
      L('PKN0382', 2266, 450, { keep: true, spec: '30x60x10', demand: 2200, note: '1/ 300 bàn Nk 65 2/ 250 bàn NK 80' }), // prettier-ignore
      L('PKN0383', 412, 650, { keep: true, grade: 'xám', spec: '30x60x10', demand: 400, note: '1/ 100 bàn Nk 80' }), // prettier-ignore
      L('PKN0384', 3708, 450, { keep: true, grade: 'đen', spec: '20x40x5', demand: 3600, note: '1/ 200 bộ lindoset (16c/sp) 2/ 100 bàn Elos(4c/sp)' }), // prettier-ignore
      L('PKN0385', 824, 350, { keep: true, spec: '15x35x5', demand: 800, note: '1/ 200 bộ lindoset' }), // prettier-ignore
      L('NK-0018', 3451, 2100, {
        keep: true,
        grade: 'đồng',
        demand: 3350,
        note: 'Logo Merxx',
      }),
      L('BXE0017', 268, 55000, { color: 'xám', demand: 260, name: 'Bánh xe Siena màu xám', note: '130 GTN (2c/2p)' }), // prettier-ignore
      L('NK-0143', 4532, 1400, { demand: 4400, note: '1/ 500 bàn Polywood (8c/sp) 2/ 50 Bàn nan nhôm( 8c/sp)' }), // prettier-ignore
      L('CN1556', 1978, 1200, { keep: true, spec: '60x60x10', demand: 1920, note: '1/ 100 bàn polywood 2/ 50 bàn nan nhôm' }), // prettier-ignore
    ],
  },
  {
    sheet: 'tân phát',
    po: 'PO-2026-0040',
    date: '2026-09-03',
    lead: [10, true],
    doc: '5/2026- HG/TP',
    track: [11, 12, 13], // prettier-ignore
    paper: 12_236_678,
    lines: [
      L('BUL0198', 412, 1850, { grade: 'sắt xi 7M', spec: '6x35x15', demand: 400, note: '1/ 100 bộ Sofa góc' }), // prettier-ignore
      L('BUL0212', 2060, 500, { keep: true, grade: 'sắt xi 7M', spec: '6x20x15', demand: 2000, note: '1/100 bộ Sofa góc(12c/sp) 2/ 400 ghế Athos(2c/sp)' }), // prettier-ignore
      L('BUL0230', 824, 2050, { keep: true, grade: 'sắt xi 7M', spec: '6x55x15', demand: 800, note: '1/400 ghế thasos (2c/sp)' }), // prettier-ignore
      L('BUL0214', 824, 1760, {
        keep: true,
        grade: 'sắt xi 7M',
        spec: '6x30x15',
        demand: 800,
      }),
      L('BUL0197', 504, 1730, { grade: 'sắt xi 7M', spec: '6x25x15', demand: 489, note: '1/120 bàn delos' }), // prettier-ignore
      L('BUL0237', 268, 2240, { keep: true, grade: 'XT', spec: '6x65x15', demand: 260, note: '1/ 130 GTN Navara' }), // prettier-ignore
      L('VIT0114', 32239, 55, { keep: true, grade: 'sắt xi 7M', spec: '4x20', demand: 31300, note: '1/ 500 bàn Polywood' }), // prettier-ignore
      L('VIT0043', 42539, 76, { grade: 'sắt xi 7M', spec: '4x30', demand: 41300, name: 'Vít dù 4x30' }), // prettier-ignore
      L('NK-0086', 5768, 46, { grade: 'sắt xi 7M', spec: '4x15', demand: 5600 }),
      L('NK-0178', 16068, 35, { grade: 'sắt xi 7M', spec: '4x15', demand: 15600, name: 'Vít 4x15 bằng' }), // prettier-ignore
    ],
  },
  {
    sheet: 'MT',
    po: 'PO-2026-0041',
    date: '2026-09-03',
    lead: [10, true],
    doc: '6/2026- HG/MT',
    track: [11, 12, 13], // prettier-ignore
    paper: 24_954_150,
    lines: [
      L('NK-0157', 1810, 6100, { grade: 'Sắt XT', demand: 1810, note: '1/ 430 bàn NK kéo giãn 2/ 380 bàn NK 65 3/ 50 bàn nan nhôm 4/ 600 bàn polywood 5/ 350 bàn Nk 80' }), // prettier-ignore
      L('NK-0125', 7457, 350, { keep: true, demand: 7240 }),
      L('NK-0161', 7457, 130, { demand: 7240 }),
      L('NK-0127', 18, 40000, { u: 'kg', spec: '10x20x1.5', demand: 7240, note: 'SL ĐH 7240 con — đặt 18 kg' }), // prettier-ignore
      L('CN1526', 19364, 105, { keep: true, spec: '4x15', demand: 18800, note: '1/ 430 bàn NK kéo giãn 2/ 380 Bàn NK 65 3/ 350 bàn NK 80 4/ 50 Bàn nan nhôm 5/ 400 bàn 80 polywood' }), // prettier-ignore
      L('BUL0604', 14111, 120, { keep: true, spec: '4x20', demand: 13700 }),
      L('CN1619', 7416, 140, { spec: '4x20', demand: 7200, name: 'Vít 4x20 Dù ĐC' }),
      L('NK-0149', 4841, 150, { spec: '4x25', demand: 4700, name: 'Vít 4x25, dù ĐC' }),
      L('BUL0605', 10094, 260, { keep: true, spec: '4x15', demand: 9800, note: 'Bàn CNKG nhôm gôz+ NK' }), // prettier-ignore
      L('CN1521', 412, 800, { keep: true, grade: '7M', spec: '8x70x15', demand: 400, note: '100 võng sắt' }), // prettier-ignore
      L('DCC0080', 103, 680, { keep: true, demand: 100 }),
      L('NK-0030', 1648, 45, { keep: true, grade: 'XT', demand: 1600, note: '1/ 400 ghế Thasos (4c/sp)' }), // prettier-ignore
      L('NK-0029', 1648, 95, { keep: true, demand: 1600 }),
      L('BUL0019', 2142, 200, { keep: true, grade: '7M', spec: '6x20x15', demand: 2080 }),
      L('NK-0093', 2142, 160, { keep: true, grade: 'XT', spec: '6x20x13', demand: 2080, note: '1/ 130 GTN Navara' }), // prettier-ignore
      L('SAT0112', 206, 450, {
        keep: true,
        grade: 'Inox 201',
        demand: 200,
        note: '100 Bàn BalKon',
      }),
    ],
  },
  {
    sheet: 'TV',
    po: null,
    sup: SUP.HT,
    date: '2026-08-24',
    lead: [10, false],
    doc: '3 HG/TV',
    contract: '3',
    vat: 10,
    extra07: true, // prettier-ignore
    terms: {
      terms_quality: 'Nhôm đúc đảm bảo hàng laze được, bề mặt lán,không sứt mẻ, lồi lõm.',
      terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
      terms_payment: 'Nhận hàng thanh toán trong vòng 15 ngày.',
      terms_invoice: 'Hóa đơn GTGT',
      terms_lead_time: '10 ngày, Kể từ ngày xác nhận đơn đặt hàng .',
    },
    paper: 40_800_000,
    paperNote: 'Tờ ghi "LSX 06 + Lsx 07", "Theo HD số: 3". Mua theo KG (300 kg × 136.000) — mã vật tư khai mới theo kg vì mã "khớp nối nhôm Siena" (NK-0076) đếm theo cái.', // prettier-ignore
    lines: [
      L('+khopNoiS', 300, 136000, { u: 'Kg', grade: 'Nhôm đúc', spec: '200', dm: 4, name: 'Khớp nối chân nhôm S', note: '400 Ghế 5 bậc Thasos 250 ghế 5 bậc Siena' }), // prettier-ignore
    ],
  },
  {
    sheet: 'T.nguyên',
    po: 'PO-2026-0043',
    date: '2026-09-03',
    lead: [10, true],
    doc: '6/2026- HG/TN',
    track: [11, 12, 13], // prettier-ignore
    paper: 94_584_750,
    lines: [
      L('+patCon', 515, 2000, { grade: 'XT', demand: 500, name: 'Pát côn 3 lỗ , XT', note: '100 bàn Balkon' }), // prettier-ignore
      L('PKN0387', 206, 15000, {
        keep: true,
        grade: 'Inox 304',
        demand: 200,
        note: '100 võng sắt',
      }),
      L('PKN0388', 412, 3000, { keep: true, spec: 'Phi 10 x143', demand: 400 }),
      L('HOP0002', 1246, 4500, { color: '7M', grade: '7M', demand: 1210, name: 'Hộp trượt 7 bậc, 7M', note: '1/ 400 ghế Athos 2/ 200 ghế Verona' }), // prettier-ignore
      L('NK-0044', 824, 2600, { keep: true, grade: 'sắt XT', demand: 800 }),
      L('NK-0003', 412, 4500, {
        demand: 400,
        name: 'Pát Thỏ Tilos',
        note: '1/200 ghế Verona',
      }),
      L('SAT0773', 412, 1200, {
        keep: true,
        grade: 'ko xi',
        spec: 'Phi 10x32',
        demand: 400,
      }),
      L('PKN0389', 412, 2800, { keep: true, spec: 'Phi 10x35', demand: 400 }),
      L('+ty665', 3520, 11400, { spec: 'phi 10x665', demand: 3520, name: 'Ty Sắt 665', note: '1/ 100 bàn polyood kéo giãn 2/ 350 bàn NK 80 3/ 430 Bàn NK kéo giãn' }), // prettier-ignore
      L('NK-0175', 1800, 11400, { spec: 'phi 10x680', demand: 1800, name: 'Ty sắt 680', note: '1/ 400 bàn kéo giãn polywood 2/ 50 bàn nan nhôm' }), // prettier-ignore
      L('+ty660', 1520, 11400, { spec: 'Phi 10x660', demand: 1520, name: 'Ty sắt 660', note: '1/ 380 bàn NK 65' }), // prettier-ignore
    ],
  },
  {
    sheet: 'TN2',
    po: 'PO-2026-0044',
    date: '2026-09-03',
    lead: [10, true],
    doc: '7/2026- HG/TN',
    extra07: true,
    track: [12, 13, 14], // prettier-ignore
    paper: 3_748_788,
    lines: [
      L('BUL0032', 1030, 150, { keep: true, grade: 'sắt xi 7M', spec: '6x15x13', demand: 1000, note: '1/ 100 bàn Balkon (2c/sp) 2/ 100 võng sắt (8c/sp)' }), // prettier-ignore
      L('BUL0041', 3399, 160, { keep: true, grade: 'sắt xi 7M', spec: '6x20x13', demand: 3300, note: '1.100 bàn Balkon(4c/sp) 2. 100 Bộ sofa(29c/sp)' }), // prettier-ignore
      L('BUL0049', 5727, 180, { keep: 5726.8, grade: 'sắt xi 7M', spec: '6x25x13', demand: 5560, note: '1/ 50 Bàn Nk 150(220) sơn graphit 2/120 Bàn NK 200(300) sơn graphit 3/ 80 bàn NK 200(340) sơn graphit' }), // prettier-ignore
      L('BUL0023', 1895, 240, {
        keep: 1895.2,
        grade: 'sắt xi 7M',
        spec: '6x35x13',
        demand: 1840,
      }),
      L('BUL0049', 1607, 200, { keep: 1606.8, grade: 'Sắt XT', spec: '6x25x13', demand: 1560, note: '1/ 90 Bàn NK 150(200) sơn bậc 2/ 40 bàn NK 200(300) sơn bạc 3/ 130 GTN Navara' }), // prettier-ignore
      L('BUL0023', 803, 240, {
        keep: 803.4,
        grade: 'Sắt XT',
        spec: '6x35x13',
        demand: 780,
      }),
      L('BUL0055', 1339, 200, { keep: true, grade: 'Sắt XT', spec: '6x30x13', demand: 1300, note: '1/ 130 GTN Navarra' }), // prettier-ignore
      L('VIT0082', 1854, 210, { keep: true, grade: 'Sắt xi 7M', spec: '6x40x13', demand: 1800, note: '1/ 400 ghế thasos (2c/sp)' }), // prettier-ignore
      L('VIT0094', 824, 380, {
        keep: true,
        grade: 'Sắt xi 7M',
        spec: '6x70x13',
        demand: 800,
      }),
      L('SAT0696', 2060, 39, { grade: 'Sắt xi 7M', spec: '4x10', demand: 2000, name: 'Vít dù 4x10', note: '1/50 Bàn KG nan nhôm' }), // prettier-ignore
    ],
  },
  {
    sheet: 'BB',
    po: 'PO-2026-0045',
    date: '2026-09-03',
    lead: [10, true],
    doc: '03-2026 HG/KP',
    extra07: true,
    carton: true, // prettier-ignore
    paper: 40_076_000,
    paperNote: 'Dòng BB Bàn Elos (100 thùng) và lót tấm của nó (200 tấm): tờ chưa có kích thước lọt lòng nên chưa có đơn giá — ghi giá 0, Cung ứng bổ sung khi có KT.', // prettier-ignore
    // [mat, mã SP, cách mở, pcs/ctn, SL ĐH, SL đặt, L, W, H, đ/m², thành tiền, ghi chú, keep]
    rows: [
      ['BAO0687', '21610-217', 'ĐK', 1, 150, 150, 410, 540, 590, 12212, 4_207_278, 'KTPB 410x540x590 layout con dao', true], // prettier-ignore
      [
        '+bbBanDelos',
        '21611-217',
        'MR',
        1,
        120,
        120,
        745,
        605,
        55,
        12212,
        1_766_661,
        'Layout con dao',
      ],
      [
        'BAO0692',
        null,
        'tấm',
        2,
        120,
        240,
        800,
        45,
        null,
        8963,
        77_440,
        'Lót tấm 2 đầu — bàn Delos',
      ],
      ['BAO0688', '21614-217', 'MR', 1, 400, 400, 905, 605, 150, 12212, 10_536_269, 'Layout con dao', true], // prettier-ignore
      [
        'BAO0692',
        null,
        'tấm',
        2,
        400,
        800,
        800,
        140,
        null,
        8963,
        803_085,
        'Lót tấm 2 đầu — ghế Thasos',
      ],
      [
        '+bbBalkon',
        '21617-217',
        'MR',
        1,
        50,
        50,
        900,
        600,
        230,
        12212,
        1_743_874,
        'Layout con dao',
      ],
      [
        'BAO0692',
        null,
        'tấm',
        2,
        50,
        100,
        800,
        220,
        null,
        8963,
        157_749,
        'Lót tấm 2 đầu — bàn Balkon',
      ],
      [
        '+bbNanNhom',
        '21650-217',
        'AD',
        1,
        50,
        50,
        1525,
        925,
        95,
        12212,
        2_370_013,
        'Layout bàn NK',
      ],
      ['BAO0081', null, 'MR', 1, 50, 50, 690, 255, 65, 10719, 329_609, 'Hộp chân 3L — bàn nan nhôm', 50], // prettier-ignore
      ['+bbElos', '21711-217', 'MR', 1, 100, 100, null, null, null, 12212, 0, 'Layout con dao · tờ chưa có KT lọt lòng — chưa có giá'], // prettier-ignore
      ['BAO0692', null, 'tấm', 2, 100, 200, null, null, null, 8963, 0, 'Lót tấm 2 đầu — bàn Elos · tờ chưa có KT — chưa có giá'], // prettier-ignore
      [
        'BAO0689',
        '2644127',
        'AD',
        1,
        380,
        380,
        675,
        675,
        125,
        12212,
        8_114_715,
        'Layout bàn NK',
        true,
      ],
      ['BAO0081', null, 'MR', 1, 380, 380, 665, 250, 35, 10719, 1_856_166, 'Hộp chân 3L — bàn NK 65', 380], // prettier-ignore
      ['BAO0690', '28840-277', 'MR', 1, 130, 130, 1170, 660, 210, 12212, 5_401_832, 'Layout con dao Khống chế KTPB =1190x680x220', true], // prettier-ignore
      [
        'BAO0691',
        '26904-910',
        'AD',
        1,
        100,
        100,
        1520,
        270,
        160,
        12212,
        2_711_308,
        null,
        true,
      ],
    ],
  },
  { sheet: 'VẢI PH', po: 'PO-2026-0046', date: '2026-08-20', lead: [45, true], doc: '1/2026- HG/PH', paper: 59_500_000, untouched: true }, // prettier-ignore
  { sheet: 'VẢI TDS', po: 'PO-2026-0047', cancel: true },
  {
    sheet: 'HVH',
    po: null,
    sup: SUP.KIMCUONG,
    date: '2026-09-08',
    lead: [10, true],
    doc: '1/2026- HG/HVH',
    foam: true, // prettier-ignore
    terms: { ...T_STD, terms_quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu trên đơn hàng.', terms_lead_time: LEAD_7_10 }, // prettier-ignore
    paper: 59_468_016,
    // [mat, tên tờ, L, W, T, đm/sp, tấm, ghi chú]
    rows: [
      ['MUT0035', 'Mouse mê ghế Ravena ( rập)', 440, 500, 40, 1, 250, '250 Ghế Ravena'],
      ['MUT0032', 'Mouse mê ghế Tilos', 430, 470, 35, 1, 1200, '1200 nệm 5 bậc Tilos'],
      ['MUT0054', 'Mouse Tựa ghế tilos', 780, 470, 35, 1, 1200, '1200 nệm 5 bậc Tilos'],
      [
        '+mut520',
        'Mouse mê ghế Tilos Có pen',
        520,
        470,
        35,
        1,
        120,
        '120 nệm 5 bậc Tilos có pen',
      ],
      [
        '+mut700',
        'Mouse Tựa ghế tilos có pen',
        700,
        470,
        35,
        1,
        120,
        '120 nệm 5 bậc Tilos có pen',
      ],
      ['MUT0047', 'Mouse mê Bộ Lindoset', 650, 615, 50, 2, 400, '200 bộ Lindosset'],
      ['MUT0049', 'Mouse đôn Lindoset', 660, 550, 90, 2, 400, '200 bộ Lindosset'],
    ],
  },
  {
    sheet: 'Sheet1',
    po: null,
    sup: SUP.KIMCUONG,
    date: '2026-09-15',
    lead: [10, true],
    doc: '2/2026- HG/HVH',
    foam: true, // prettier-ignore
    terms: { ...T_STD, terms_quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu trên đơn hàng.', terms_lead_time: LEAD_7_10 }, // prettier-ignore
    paper: 4_479_696,
    paperNote: 'Tờ 2/2026 có 2 dòng Tilos có pen (120 mê 520x470x35 + 120 tựa 700x470x35) TRÙNG số lượng với tờ 1/2026 — nạp đúng như file, Cung ứng xác nhận lại với NCC đây là đặt thêm hay tờ thay thế.', // prettier-ignore
    rows: [
      ['+mut480', 'Mouse Mê ghế XC Tilos', 480, 460, 30, 1, 200, '200 ghế XC Tilos'],
      [
        '+mut520',
        'Mouse mê ghế Tilos Có pen',
        520,
        470,
        35,
        1,
        120,
        '120 nệm 5 bậc Tilos có pen',
      ],
      [
        '+mut700',
        'Mouse Tựa ghế tilos có pen',
        700,
        470,
        35,
        1,
        120,
        '120 nệm 5 bậc Tilos có pen',
      ],
    ],
  },
  {
    sheet: 'gòn',
    po: null,
    sup: SUP.THAIDANH,
    date: '2026-09-08',
    lead: [10, true],
    doc: '1/2026- HG/TD',
    template: 'foam', // prettier-ignore
    terms: { ...T_STD, terms_quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu trên đơn hàng.', terms_lead_time: LEAD_7_10 }, // prettier-ignore
    paper: 35_707_800,
    lines: [
      L('MUT0509', 500, 25622, { u: 'Tấm', grade: 'DKF D20', spec: '590x590x80 mm', dims: [590, 590, 80], name: 'Gòn tấm mê sofa', note: '100 bộ sofa kufu' }), // prettier-ignore
      L('MUT0520', 130, 28520, { spec: '860x655x55 mm', dims: [860, 655, 55], name: 'Gòn ép tựa GTN Navarra', note: '130 GTN Navara' }), // prettier-ignore
      L('MUT0488', 130, 39100, { spec: '1180x655x55 mm', dims: [1180, 655, 55], name: 'Gòn ép mê GTN Navara' }), // prettier-ignore
      L('GON0070', 35, 39000, { u: 'Kg', grade: 'R110', spec: 'Khổ 655', name: 'Gòn cuộn - Khổ 655', note: 'SL mét 450' }), // prettier-ignore
      L('GON0070', 250.8, 39000, { u: 'Kg', grade: 'R110', spec: 'Khổ 500', name: 'Gòn cuộn - Khổ 500', note: 'SL mét 4.560 · 1200 nệm ghế 5 bậc Tilos 120 ghế tilos có pen 200 ghế XC Tilos' }), // prettier-ignore
      L('+dung25', 2000, 1480, { u: 'Mét', name: 'Dựng 25gr', note: 'Merxx · tờ ghi SL ở cột "SL mét", không ghi ĐVT' }), // prettier-ignore
    ],
  },
  {
    sheet: 'TEM',
    po: null,
    sup: SUP.PQ,
    date: '2026-09-08',
    lead: [7, true],
    doc: 'ĐH 6 -2026/ HG-PQ',
    extra07: true, // prettier-ignore
    terms: {
      terms_quality: 'Giao hàng đúng chủng loại, đúng kích thước như trên đơn hàng.',
      terms_delivery_place:
        'Xưởng SX Cty TNHH Hoàng Gia - Cụm CN Cát Nhơn, Xã Xuân An, Tỉnh Gia Lai',
      terms_payment: 'Công nợ cuối tháng.',
      terms_invoice: 'Hóa đơn GTGT',
      terms_lead_time:
        'Giao hàng từ 5 đến 7 ngày kể từ ngày nhận ĐH.( không tính ngày lễ và chủ nhật)',
    },
    paper: 6_248_600,
    paperNote: 'Tờ ghi "LSX 6+7/ 26-27 (HG-MX)". Dòng 37 (29520-311 Thẻ treo Tuần) tờ ghi ĐVT "Nhãn" giá 600 — nạp đúng như tờ.', // prettier-ignore
    tem: true,
  },
  {
    sheet: 'HLH',
    po: null,
    sup: SUP.HLH,
    date: '2026-09-21',
    lead: [7, true],
    doc: 'ĐH 1 -2026/ HG-PQ', // prettier-ignore
    terms: {
      terms_quality: 'Giao hàng đúng chủng loại, đúng kích thước như trên đơn hàng.',
      terms_delivery_place: 'Công ty TNHH SX & TM Hoàng Gia',
      terms_payment: 'Công nợ cuối tháng.',
      terms_invoice: 'Hóa đơn GTGT',
      terms_lead_time:
        'Giao hàng từ 5 đến 7 ngày kể từ ngày nhận ĐH.( không tính ngày lễ và chủ nhật)',
    },
    paper: 961_000,
    paperNote: 'Tờ ghi số "ĐH 1 -2026/ HG-PQ" (hậu tố PQ — có lẽ chép từ tờ TEM) và "MERXX", không ghi số lệnh — gắn lệnh 06 vì nằm trong file lệnh 06.', // prettier-ignore
    lines: [
      L('TEM0026', 2000, 100, { u: 'Tem', grade: 'Ruy băng 63% poly 37 % Nylon', spec: '50x35', name: 'Tem Merxx', note: 'Tem Thường' }), // prettier-ignore
      L('+temTextilent', 2000, 100, { u: 'Tem', spec: '50x35', name: 'Tem Textilent', note: 'Tem cho hệ Textilent' }), // prettier-ignore
      L('TEM0026', 2000, 170, { u: 'Tem', spec: '55x40', name: 'Tem Merxx', note: 'Tem thay đổi theo mùa mới' }), // prettier-ignore
      L('+temTextilent', 1300, 170, { u: 'Tem', spec: '55x40', name: 'Tem Textilent' }),
    ],
  },
]

// TEM: 45 dòng theo mã SP — đọc thẳng từ tờ (cột cố định, đã soát tay).
const wb = XLSX.read(fs.readFileSync(FILE))
const rowsOf = (n) =>
  XLSX.utils
    .sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true })
    .map((r) => r.map((x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : x)))
const temSpec = ORDERS.find((o) => o.tem)
temSpec.lines = rowsOf('TEM')
  .filter((r) => typeof r[0] === 'number' && r[2])
  .map((r) => {
    const name = String(r[2])
    const mat = /^Nhãn Hình/i.test(name)
      ? 'BAO0483'
      : /Thẻ treo Tuần/i.test(name)
        ? 'THE0020'
        : /2 mặt FSC/i.test(name)
          ? 'THE0022'
          : /Thẻ treo Sản phẩm/i.test(name)
            ? '+theTreoSp'
            : null
    if (!mat) throw new Error(`TEM: chưa có mã cho "${name}"`)
    return L(mat, Number(r[7]), Number(r[9]), {
      u: String(r[8]),
      grade: String(r[3]),
      spec: String(r[5]),
      dm: Number(r[6]),
      product_code: String(r[1]),
      name,
      note: `SL ĐH ${r[4]}`,
    })
  })

// BB → dòng carton; HVH/Sheet1 → dòng xốp m³ (giá 1.200.000 đ/m³)
for (const o of ORDERS) {
  if (o.carton) {
    o.lines = o.rows.map(
      ([mat, pc, open, pcs, sl, qty, l, w, h, ppm2, amt, note, keep]) => {
        const price = amt ? r2(amt / qty) : 0
        const flat = open === 'tấm'
        return L(mat, qty, price, {
          keep: keep === true ? true : typeof keep === 'number' ? keep : undefined,
          product_code: pc,
          carton: {
            open_style: flat ? null : open,
            pcs_per_ctn: pcs,
            qty_demand: sl,
            inner_l_mm: l,
            inner_w_mm: w,
            inner_h_mm: h,
            price_per_m2: ppm2,
            area_m2: price ? Math.round((price / ppm2) * 10000) / 10000 : null,
            carton_basis: 'ctn',
            spec: l ? (flat ? `${l}×${w} mm` : `${l}×${w}×${h} mm (lọt lòng)`) : null,
          },
          note,
          amountPaper: amt,
        })
      },
    )
  }
  if (o.foam) {
    o.lines = o.rows.map(([mat, name, l, w, t, dm, qty, note]) => {
      const m3 = round6(((l * w * t) / 1e9) * qty)
      return L(mat, qty, 1_200_000, {
        name,
        dm,
        note,
        grade: 'D15',
        foamRow: { inner_l_mm: l, inner_w_mm: w, inner_h_mm: t, carton_basis: 'm3', qty2: m3, unit2: 'm³', price_basis: 'unit2', spec: `${l}x${w}x${t} mm` }, // prettier-ignore
      })
    })
  }
}

const amountOf = (l) => (l.foamRow ? l.foamRow.qty2 * l.price : l.qty * l.price)

// ───────────────────────── đơn cũ trên DB ─────────────────────────
const oldCodes = ORDERS.filter((o) => o.po).map((o) => o.po)
const { data: oldPos, error: oe } = await sb.from('supply_purchase_orders').select('*').in('code', oldCodes) // prettier-ignore
if (oe) throw oe
const { data: oldLines, error: le0 } = await sb.from('supply_purchase_order_lines').select('*').in('po_id', oldPos.map((p) => p.id)) // prettier-ignore
if (le0) throw le0
const matById = new Map(mats.map((m) => [m.id, m]))

// ───────────────────────── in đối chiếu ─────────────────────────
const plan = []
let bad = 0
for (const o of ORDERS) {
  if (o.cancel) {
    console.log(
      `\n### ${o.sheet} → ${o.po}: HUỶ (tờ ghi SL cần đặt −284 m, tồn 548 m đủ dùng — không đặt)`,
    )
    continue
  }
  const po = o.po ? oldPos.find((p) => p.code === o.po) : null
  if (o.po && !po) throw new Error(`Không thấy ${o.po}`)
  if (!o.po) {
    const { data: dup } = await sb.from('supply_purchase_orders').select('code').eq('supplier_id', o.sup).eq('supplier_doc_no', o.doc) // prettier-ignore
    if (dup?.length) throw new Error(`${o.sheet}: đã có ${dup[0].code} cùng NCC + số ${o.doc} — không tạo lần hai`) // prettier-ignore
  }
  if (po && po.status !== 'received') throw new Error(`${o.po} đang "${po.status}" — script chỉ sửa đơn đang "received" (nạp nền)`) // prettier-ignore
  const pool = po ? oldLines.filter((l) => l.po_id === po.id) : []
  const used = new Set()
  const out = []
  if (!o.untouched) {
    for (const l of o.lines) {
      const m = matOf(l.mat)
      let old = null
      if (l.keep !== undefined && l.keep !== false) {
        old = pool.find(
          (x) =>
            !used.has(x.id) &&
            matById.get(x.material_id)?.code === m.code &&
            (l.keep === true || Math.abs(Number(x.qty_ordered) - l.keep) < 1e-6),
        )
        if (!old) throw new Error(`${o.sheet}: không thấy dòng cũ ${m.code} ${l.keep}`)
        used.add(old.id)
      }
      out.push({ l, m, old })
    }
  }
  const drop = o.untouched ? [] : pool.filter((x) => !used.has(x.id))
  const sum = o.untouched ? pool.reduce((s, x) => s + Number(x.qty_ordered) * Number(x.unit_price ?? 0), 0) : out.reduce((s, x) => s + amountOf(x.l), 0) // prettier-ignore
  // Lệch nhỏ do tờ tính tiền bằng SL LẺ (hao hụt 3%) mà in SL làm tròn — giữ SL in trên tờ, ghi rõ lệch.
  const ok = Math.abs(sum - o.paper) <= o.paper * 0.001 + 5
  if (!ok) bad++
  const expected = addDays(o.date, o.lead[0], o.lead[1])
  console.log(`\n### ${o.sheet} → ${o.po ?? '(TẠO MỚI)'} · tờ ${vn(o.date)} · số ${o.doc ?? po?.supplier_doc_no} · hẹn ${vn(expected)} · tiền hàng ${fmt(sum)} (tờ ${fmt(o.paper)})${ok ? '' : '  ⟵ LỆCH'}`) // prettier-ignore
  for (const { l, m, old } of out) {
    const tag = old ? (Number(old.qty_ordered) !== l.qty || Number(old.unit_price ?? 0) !== l.price ? `sửa (cũ ${old.qty_ordered} @${old.unit_price ?? 0})` : 'giữ') : 'THÊM' // prettier-ignore
    console.log(`   ${(l.name ?? m.name).slice(0, 34).padEnd(34)} → ${m.code.padEnd(9)} ${m.name.slice(0, 34).padEnd(34)}${m.isNew ? ' [MỚI]' : ''} · ${String(l.qty).padStart(6)} @${fmt(l.price)} = ${fmt(amountOf(l))} · ${tag}`) // prettier-ignore
  }
  for (const d of drop) console.log(`   BỎ dòng cũ: ${matById.get(d.material_id)?.code} ${matById.get(d.material_id)?.name} · ${d.qty_ordered} @${d.unit_price ?? 0}`) // prettier-ignore
  plan.push({ o, po, out, drop, expected, sum })
}
console.log('\nMã khai mới:')
for (const n of Object.values(NEW))
  console.log(`   ${n.code} ${n.name} (${n.unit})${n.exists ? ' — đã có' : ''}`)
if (bad) throw new Error(`${bad} đơn lệch tiền với tờ — dừng`)

// ───────────────────────── sổ kho: đối chiếu trước ─────────────────────────
const lineIdsOld = oldLines.map((l) => l.id)
const { data: recMv, error: me } = await sb.from('warehouse_movements').select('*').in('po_line_id', lineIdsOld) // prettier-ignore
if (me) throw me
const recDocIds = [...new Set(recMv.map((m) => m.doc_id))]
const { data: recDocs } = await sb
  .from('warehouse_docs')
  .select('*')
  .in('id', recDocIds)
  .order('code')
if (recDocs.some((d) => d.kind !== 'receipt' || !/NẠP NỀN/.test(d.note ?? ''))) throw new Error('Có phiếu không phải NẠP NỀN dính các đơn này — dừng') // prettier-ignore
for (const d of recDocs) {
  const { count } = await sb.from('warehouse_movements').select('id', { count: 'exact', head: true }).eq('doc_id', d.id) // prettier-ignore
  if (count !== recMv.filter((m) => m.doc_id === d.id).length) throw new Error(`${d.code} có dòng của đơn khác — dừng`) // prettier-ignore
  const { data: rv } = await sb
    .from('warehouse_docs')
    .select('code')
    .eq('reversal_of_doc_id', d.id)
  if (rv?.length) throw new Error(`${d.code} đã được đảo (${rv[0].code}) — dừng`)
}
const KK = await one(sb.from('warehouse_docs').select('id,code').eq('code', 'KK-2026-0004').single(), 'KK-0004') // prettier-ignore
const need = new Map()
for (const m of recMv)
  need.set(m.material_id, (need.get(m.material_id) ?? 0) + Number(m.qty))
const { data: kkMv } = await sb.from('warehouse_movements').select('material_id,qty,direction,warehouse_id').eq('doc_id', KK.id).in('material_id', [...need.keys()]) // prettier-ignore
const kkBy = new Map(kkMv.map((m) => [m.material_id, m]))
for (const [mid, q] of need) {
  const k = kkBy.get(mid)
  if (!k || k.direction !== 'out' || Number(k.qty) + 1e-6 < q) throw new Error(`KK-0004 không trừ đủ ${matById.get(mid)?.code} (${q}) — dừng`) // prettier-ignore
}
const stockOf = async (ids) => {
  const { data } = await sb
    .from('warehouse_stock')
    .select('material_id,on_hand')
    .in('material_id', ids)
  return new Map(data.map((r) => [r.material_id, Number(r.on_hand)]))
}
const before = await stockOf([...need.keys()])
console.log(`\nSổ kho: ${recDocs.length} phiếu NẠP NỀN (${recDocs.map((d) => d.code).join(', ')}) · ${recMv.length} dòng · ${need.size} mã · tồn hiện tại các mã: ${[...before.values()].every((v) => v === 0) ? 'đều 0' : 'CÓ MÃ KHÁC 0'}`) // prettier-ignore

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để sao lưu rồi ghi)')
  process.exit(0)
}

// ───────────────────────── SAO LƯU ─────────────────────────
const dump = async (t, col, ids) => {
  if (!ids.length) return []
  const { data, error } = await sb.from(t).select('*').in(col, ids)
  if (error) throw new Error(`${t}: ${error.message}`)
  return data
}
const backup = {
  at: new Date().toISOString(),
  pos: oldPos,
  lines: oldLines,
  receipt_docs: recDocs,
  receipt_movements: recMv,
  kk_movements: await dump('warehouse_movements', 'doc_id', [KK.id]),
  doc_notes: await dump(
    'doc_notes',
    'doc_id',
    oldPos.map((p) => p.id),
  ),
  approval_events: await dump(
    'approval_events',
    'entity_id',
    oldPos.map((p) => p.id),
  ),
  stock_before: Object.fromEntries(before),
}
fs.mkdirSync('backups', { recursive: true })
const BK = 'backups/po-sua-lsx0626-mx-1001.json'
fs.writeFileSync(BK, JSON.stringify(backup, null, 1))
console.log(`\n✓ sao lưu ${BK}`)

const must = async (q, what) => {
  const { data, error } = await q
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const nextDoc = async (k) => must(sb.rpc('next_doc_code', { p_kind: k }), `cấp số ${k}`)

// 1a. Phiếu điều chỉnh hoàn phần KK-0004
const WH = recMv[0].warehouse_id
const adj = await must(
  sb
    .from('warehouse_docs')
    .insert({
      code: await nextDoc('KK'),
      kind: 'stocktake',
      status: 'posted',
      doc_date: TODAY,
      reason: `Điều chỉnh lại KK-2026-0004 — cộng lại phần đã trừ cho ${recDocs.length} phiếu NẠP NỀN 11/09 để đảo các phiếu đó`,
      note: `KK-2026-0004 (15/09) đưa tồn về 0 bằng cách trừ cả lượng của các phiếu nạp nền ${recDocs.map((d) => d.code).join(', ')}. Các phiếu đó không phải hàng về thật và được đảo ngay sau phiếu này (01/10/2026, sửa đơn lệnh 06/26-27 - MX theo file); phiếu này cộng lại đúng phần đã trừ để tồn từng mã trước/sau vẫn như cũ. Sao lưu: ${BK}.`,
      created_by: VIET.id,
    })
    .select('id,code')
    .single(),
  'phiếu điều chỉnh',
)
await must(
  sb.from('warehouse_movements').insert(
    [...need].map(([mid, q]) => ({
      material_id: mid,
      direction: 'in',
      qty: q,
      ref_type: 'adjust',
      note: `Hoàn phần KK-2026-0004 đã trừ cho phiếu nạp nền`,
      created_by: VIET.id,
      doc_id: adj.id,
      warehouse_id: kkBy.get(mid).warehouse_id ?? WH,
    })),
  ),
  'dòng điều chỉnh',
)
console.log(`✓ ${adj.code} cộng lại ${need.size} mã`)

// 1b. Đảo 9 phiếu nạp nền
for (const d of recDocs) {
  const code = await nextDoc('PXK')
  const rev = await must(
    sb
      .from('warehouse_docs')
      .insert({
        code,
        kind: 'issue',
        status: 'posted',
        doc_date: TODAY,
        reason: `Đảo ${d.code}: phiếu NẠP NỀN 11/09 không phải hàng về thật — đơn sửa theo file lệnh 06/26-27 - MX (01/10/2026), Cung ứng lập phiếu nhập theo hàng về thật`,
        reversal_of_doc_id: d.id,
        created_by: VIET.id,
      })
      .select('id,code')
      .single(),
    `đảo ${d.code}`,
  )
  await must(
    sb.from('warehouse_movements').insert(
      recMv
        .filter((m) => m.doc_id === d.id)
        .map((m) => ({
          material_id: m.material_id,
          direction: 'out',
          qty: m.qty,
          ref_type: 'adjust',
          reason_code: m.reason_code ?? null,
          note: `Đảo ${d.code}`,
          created_by: VIET.id,
          doc_id: rev.id,
          warehouse_id: m.warehouse_id,
          po_line_id: m.po_line_id,
          production_order_id: m.production_order_id ?? null,
          unit_cost: m.unit_cost,
          stock_status: m.stock_status ?? 'ok',
        })),
    ),
    `dòng đảo ${d.code}`,
  )
  console.log(`✓ ${rev.code} đảo ${d.code}`)
}
const after = await stockOf([...need.keys()])
const moved = [...need.keys()].filter(
  (k) => Math.abs((after.get(k) ?? 0) - (before.get(k) ?? 0)) > 1e-6,
)
if (moved.length)
  throw new Error(`Tồn đổi ở ${moved.length} mã sau khi đảo — DỪNG, xem ${BK}`)
console.log('✓ tồn từng mã trước/sau như nhau')

// 2. Mã vật tư mới
for (const n of Object.values(NEW)) {
  if (n.exists) continue
  const row = await must(
    sb
      .from('warehouse_materials')
      .insert({
        code: n.code,
        name: n.name,
        unit: n.unit,
        group_name: n.group,
        po_template: n.t,
        spec: n.spec ?? null,
        material_grade: n.grade ?? null,
        needs_review: true,
        is_active: true,
      })
      .select('id,code,name,unit')
      .single(),
    `vật tư ${n.name}`,
  )
  mats.push(row)
  byCode.set(row.code, row)
  console.log(`✓ vật tư ${row.code} ${row.name}`)
}
const idOf = (code) => byCode.get(code).id
const fold = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()

// 3. Đơn
const at = (date, hm) => `${date}T${hm}:00+07:00`
const nextDay = (d) => addDays(d, 1, false)
const trackNote = (o) => {
  if (!o.track) return ''
  const rows = rowsOf(o.sheet).map((r) => r.map((x) => String(x ?? '')))
  const [cd, cq, cm] = o.track
  const ex = XLSX.utils.sheet_to_json(wb.Sheets[o.sheet], {
    header: 1,
    defval: '',
    raw: false,
  })
  const out = []
  ex.forEach((r, i) => {
    const stt = String(r[o.sheet === 'TN2' ? 1 : 0] ?? '').trim()
    if (!/^\d+$/.test(stt)) return
    const name = String(r[o.sheet === 'TN2' ? 2 : 1] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    const d = String(r[cd] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    const q = String(r[cq] ?? '').trim()
    const t = String(r[cm] ?? '').trim()
    if (!d && !q) return
    const dd = d.replace(
      /\b(\d{1,2})\/(\d{1,2})\/26\b/g,
      (_, m, day) => `${day.padStart(2, '0')}/${m.padStart(2, '0')}/2026`,
    )
    out.push(
      `• ${name}: ${dd || '(không ghi ngày)'}${q ? ` · SL ${q}` : ''}${t ? ` · thiếu ${t}` : ''}`,
    )
    void rows[i]
  })
  return out.length ? `\n\nCột theo dõi giao hàng trên file (nguyên văn, ngày đã đổi sang dd/mm/yyyy — dùng để lập phiếu nhập thật):\n${out.join('\n')}` : '' // prettier-ignore
}

for (const p of plan) {
  const { o, out, drop, expected } = p
  let po = p.po
  const header = {
    production_order_id: LSX06.id,
    vat_rate: o.vat ?? 8,
    ...(o.terms ?? {}),
    ...(o.doc ? { supplier_doc_no: o.doc } : {}),
    ...(o.contract ? { contract_no: o.contract } : {}),
    assigned_to: NGA.id,
  }
  if (!po) {
    po = await must(
      sb
        .from('supply_purchase_orders')
        .insert({
          ...header,
          code: await nextDoc('PO'),
          supplier_id: o.sup,
          template: o.template ?? (o.foam ? 'foam' : 'accessory'),
          currency: 'VND',
          price_includes_vat: false,
          signer_role: 'NGƯỜI LẬP',
          status: 'draft',
          created_by: NGA.id,
        })
        .select('*')
        .single(),
      `tạo đơn ${o.sheet}`,
    )
    console.log(`\n✓ tạo ${po.code} (${o.sheet})`)
  } else {
    await must(
      sb.from('supply_purchase_orders').update(header).eq('id', po.id),
      `đầu đơn ${po.code}`,
    )
    console.log(`\n✓ sửa ${po.code} (${o.sheet})`)
  }
  if (o.extra07) {
    await must(sb.from('supply_po_extra_lsx').upsert({ po_id: po.id, production_order_id: LSX07.id }), 'LSX 07') // prettier-ignore
  }

  if (!o.untouched) {
    for (const [i, { l, m, old }] of out.entries()) {
      const mid = idOf(m.code)
      const unitDiff = l.u && fold(l.u) !== fold(m.unit)
      const row = {
        material_id: mid,
        qty_ordered: l.qty,
        unit_price: l.price,
        sort_order: i,
        qty_basis: 'manual',
        price_basis: 'unit',
        ...(unitDiff ? { line_unit: l.u } : {}),
        ...(l.spec !== undefined ? { spec: l.spec } : {}),
        ...(l.grade !== undefined ? { material_grade: l.grade } : {}),
        ...(l.color !== undefined ? { color: l.color } : {}),
        ...(l.demand !== undefined ? { qty_demand: l.demand } : {}),
        ...(l.onhand !== undefined ? { qty_on_hand: l.onhand } : {}),
        ...(l.dm !== undefined ? { dm_per_sp: l.dm } : {}),
        ...(l.product_code !== undefined ? { product_code: l.product_code } : {}),
        ...(l.note !== undefined ? { note: l.note } : {}),
        ...(l.carton ?? {}),
        ...(l.dims ? { inner_l_mm: l.dims[0], inner_w_mm: l.dims[1], inner_h_mm: l.dims[2], carton_basis: 'ctn' } : {}), // prettier-ignore
        ...(l.foamRow ?? {}),
      }
      if (l.carton) row.spec = l.carton.spec
      if (old) await must(sb.from('supply_purchase_order_lines').update(row).eq('id', old.id), `dòng ${m.code}`) // prettier-ignore
      else await must(sb.from('supply_purchase_order_lines').insert({ ...row, po_id: po.id }), `dòng ${m.code}`) // prettier-ignore
    }
    for (const d of drop) await must(sb.from('supply_purchase_order_lines').delete().eq('id', d.id), 'bỏ dòng') // prettier-ignore
  }

  // Ghi hộ: gửi duyệt → duyệt → gửi NCC → NCC xác nhận
  const conf = nextDay(o.date)
  await must(
    sb.from('approval_events').insert([
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'submitted', actor_id: NGA.id, created_at: at(o.date, '07:55'), reason: 'Ghi hộ 01/10/2026 — đơn đã trình ký trên giấy.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'approved', actor_id: THAO.id, created_at: at(o.date, '08:00'), reason: `Ký duyệt TRÊN GIẤY ngày ${vn(o.date)} (ngày trên tờ đơn) — ghi hộ 01/10/2026 theo chỉ đạo chủ dự án; giờ là giờ quy ước.` }, // prettier-ignore
    ]),
    'nhật ký duyệt',
  )
  await must(
    sb.from('supply_po_commit_log').insert({
      po_id: po.id,
      kind: 'ncc_xac_nhan',
      date_after: expected,
      lines: [],
      reason: `Ghi hộ 01/10/2026: NCC đã xác nhận (chủ dự án báo). Hẹn giao = mốc cuối thời gian giao trên tờ, tính từ ngày ${vn(o.date)}.`,
      created_by: NGA.id,
      created_at: at(conf, '09:00'),
    }),
    'sổ hẹn giao',
  )
  await must(
    sb
      .from('supply_purchase_orders')
      .update({
        status: 'confirmed',
        approved_by: THAO.id,
        approved_at: at(o.date, '08:00'),
        ordered_at: at(o.date, '08:05'),
        confirmed_at: at(conf, '09:00'),
        confirmed_note:
          'NCC đã xác nhận — ghi hộ 01/10/2026 (ngày xác nhận thật không có trên tờ).',
        expected_at: expected,
      })
      .eq('id', po.id),
    `trạng thái ${po.code}`,
  )

  const changes = o.untouched
    ? `Đối chiếu file "LSX 06.26.27( 18023 HG-MX) (1).xls" (tờ ${o.sheet}) ngày 01/10/2026: dòng hàng KHỚP, không sửa. Phiếu nạp nền đã đảo — đơn chưa có hàng về trên sổ.`
    : p.po
      ? `Sửa theo file "LSX 06.26.27( 18023 HG-MX) (1).xls" (tờ ${o.sheet}) ngày 01/10/2026: ${out.filter((x) => !x.old).length} dòng thêm, ${out.filter((x) => x.old && (Number(x.old.qty_ordered) !== x.l.qty || Number(x.old.unit_price ?? 0) !== x.l.price)).length} dòng sửa SL/giá, ${drop.length} dòng bỏ (file không còn). Phiếu nạp nền đã đảo — đơn chưa có hàng về trên sổ.` // prettier-ignore
      : `Tạo từ file "LSX 06.26.27( 18023 HG-MX) (1).xls" (tờ ${o.sheet}) ngày 01/10/2026.`
  const body =
    [
      changes,
      `Trạng thái ghi hộ: ký ${vn(o.date)} (${THAO.name}), NCC xác nhận ${vn(conf)}, hẹn giao ${vn(expected)}.`,
      o.paperNote ?? '',
      Math.abs(p.sum - o.paper) >= 1
        ? `Tiền hàng theo SL in trên tờ (số nguyên) là ${fmt(p.sum)} đ; ô Cộng tiền hàng trên tờ ghi ${fmt(o.paper)} đ vì tờ nhân giá với SL LẺ (SL đơn hàng × 1,03 chưa làm tròn) — lệch ${fmt(p.sum - o.paper)} đ. Đối chiếu hoá đơn NCC theo SL thực giao.`
        : '',
    ]
      .filter(Boolean)
      .join(' ') + trackNote(o)
  await must(
    sb.from('doc_notes').insert({ doc_type: 'po', doc_id: po.id, author_id: VIET.id, audience: 'internal', kind: 'note', body }), // prettier-ignore
    'ghi chú',
  )
  console.log(`  ✓ ${out.length || '(giữ)'} dòng · NCC đã xác nhận · hẹn ${vn(expected)}`)
}

// 4. Huỷ PO-0047
const tds = oldPos.find((p) => p.code === 'PO-2026-0047')
await must(
  sb.from('supply_purchase_orders').update({ status: 'cancelled' }).eq('id', tds.id),
  'huỷ 0047',
)
await must(
  sb.from('doc_notes').insert({
    doc_type: 'po',
    doc_id: tds.id,
    author_id: VIET.id,
    audience: 'internal',
    kind: 'note',
    body: 'Huỷ: theo file "LSX 06.26.27( 18023 HG-MX) (1).xls" bản 01/10/2026, tờ VẢI TDS chỉ còn 1 dòng "code BR 34 — Poly CD 230 GR UKFR": 200 nệm XC Tilos 4cm × 0,42 = 84 m, tồn kho 548 m → SL cần đặt −284 m, thành tiền −15.620.000 — tồn đủ, không đặt Tiêu Điểm Sáng. 2 dòng Vải Spun M1278 (1.300 m + 1.320 m) của bản nạp 03/09 không còn trong file. Phiếu nạp nền PNK-2026-0037 đã đảo.',
  }),
  'lý do huỷ',
)
console.log('\n✓ PO-2026-0047 huỷ (kèm lý do)')
console.log(`\nXONG. Sao lưu: ${BK}`)

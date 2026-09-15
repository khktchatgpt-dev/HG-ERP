// NẠP 2 ĐƠN ĐẶT HÀNG chị Nga gửi ảnh (15/09/2026): Sơn Tín Phát + Vạn Vi Thành.
//
//   node scripts/don-nga-stp-vvt-0915.mjs           # DRY-RUN
//   node scripts/don-nga-stp-vvt-0915.mjs --apply   # ghi thật
//
// NGUỒN LÀ ẢNH CHỤP ĐƠN, KHÔNG PHẢI FILE EXCEL. Hai điều phải biết:
//
//   · Sheet "STP" trong file "LSX ROSCO CHELSEA - IBIZA.xls" mang CÙNG số đơn
//     2/2026-HG/STP nhưng là BẢN KHÁC HẲN: ghi LSX 1 CHELSEA, 4 dòng, tổng
//     29.068.200đ. Ảnh ghi LSX 2 IBIZA, 3 dòng, tổng 11.803.428đ. Lấy theo ẢNH
//     vì đó là bản chủ dự án gửi để nạp. Bản trong file coi như nháp cũ.
//   · Đơn Vạn Vi Thành KHÔNG có trong hai file Excel — chỉ có trên ảnh.
//
// KHÔNG BỊA NGÀY. Ảnh bị cắt mất ô ngày lập và khối điều khoản, nên ordered_at /
// expected_at / terms_* để TRỐNG chứ không suy từ bản cũ trong file.
//
// Trạng thái 'ordered' = đã phát hành đơn cho NCC, chưa có bằng chứng nhận hàng.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const LSX_ROSCO_02 = 'ade0b4a0-ad23-4302-b7f5-b95bcba2ee0c' // 02/26-27 - ROSCO
const NGUON = 'Nạp từ ảnh đơn đặt hàng chị Nga gửi 15/09/2026.'

/*
  VẬT TƯ MỚI. Ba thứ này chưa có trong danh mục 13.226 vật tư. Mã cấp nối tiếp
  đúng tiền tố mà họ hàng của chúng đang dùng: "Nút chân ..." nằm ở PKN (PKN0382,
  PKN0383 là nút chân 30x60), đồ liên kết nằm ở BUL.
*/
const VT_MOI = [
  {
    key: 'nut50',
    pre: 'PKN',
    name: 'Nút chân vuông 50 eru 8',
    unit: 'Cái',
    spec: '50x50',
    group_name: 'Phụ kiện nội thất',
    sub_group: null,
    note: 'Nhựa màu đen. ' + NGUON,
  },
  {
    key: 'nut40',
    pre: 'PKN',
    name: 'Nút chân vuông 40 có gân',
    unit: 'Cái',
    spec: '40x40x5',
    group_name: 'Phụ kiện nội thất',
    sub_group: null,
    note: 'Nhựa màu đen. ' + NGUON,
  },
  {
    key: 'socay',
    pre: 'BUL',
    name: 'Sò cấy 8x15',
    unit: 'Con',
    spec: '8x15',
    group_name: 'Bu lông - vít - đinh - liên kết',
    sub_group: 'Bu lông - tán',
    note: 'Sắt xi 7M, cấy vào tấm Cemboard. ' + NGUON,
  },
]

/*
  DÙNG LẠI, KHÔNG MỞ MÃ MỚI. PKN0289 "Tăng đơ răn phuy 35x8 ly bulong (8x25)
  STP10ĐH" khớp đúng quy cách của dòng 2 đơn STP — và tên nó còn mang sẵn chữ
  STP, tức chính hàng của nhà cung cấp này. Khác mỗi ĐVT: danh mục ghi "Đôi",
  đơn ghi "Cái"; giữ chữ của đơn ở line_unit + line_name, không sửa danh mục.
*/
const TANG_DO = 'PKN0289'

const DON = [
  {
    code: '2/2026-HG/STP',
    ncc: { tax_no: '4101435117', name: 'CÔNG TY TNHH SƠN TÍN PHÁT' },
    lsx_ghi: 'LSX 2.26.27 - ROSCO IBIZA',
    vat_rate: 8,
    tong_hang: 10929100,
    tong_thue: 874328,
    tong_tt: 11803428,
    lines: [
      {
        vt: 'nut50',
        ten: 'Nút Chân vuông 50 eru 8',
        spec: '50x50',
        dvt: 'Cái',
        sp: 1950,
        dm: 1,
        sl: 1950,
        gia: 1750,
        tt: 3412500,
        gc: '1/ 1950 ghế bank 3  2/ 5628 ghế bank 1',
      },
      {
        ma: TANG_DO,
        ten: 'Tăng đơ phi 35x8+ bulon 8x25 xi trắng.',
        spec: null,
        dvt: 'Cái',
        sp: 1950,
        dm: 1,
        sl: 1950,
        gia: 1020,
        tt: 1989000,
        gc: '1/ 1950 ghế bank 3 · Vật liệu: nhựa màu đen',
      },
      {
        vt: 'nut40',
        ten: 'Nút chân Vuông 40 có gân',
        spec: '40x40x5',
        dvt: 'Cái',
        sp: 2126,
        dm: 4,
        sl: 8504,
        gia: 650,
        tt: 5527600,
        gc: '1/ 2126 Bàn vuông',
      },
    ],
  },
  {
    code: '1/2026-HG/VVT',
    ncc: {
      tax_no: '3702493697',
      name: 'CÔNG TY TNHH VẠN VI THÀNH',
      moi: {
        address: 'Số 79/14, Đường Đông tác, KP Đông tác, P. Dĩ An, TP.HCM',
        contact_name: 'Anh Toàn',
        contact_phone: '0908702188',
      },
    },
    lsx_ghi: 'LSX 2 - ROSCO (IBIZA)',
    vat_rate: 8,
    tong_hang: 6841120,
    tong_thue: 547290,
    tong_tt: 7388410,
    lines: [
      {
        vt: 'socay',
        ten: 'Sò cấy 8x15',
        spec: '8x15',
        dvt: 'con',
        sp: 2240,
        dm: 6,
        sl: 13440,
        gia: 230,
        tt: 3091200,
        gc: '1/ 2240 bàn CN ( cấy vào tấm Cemboad) · Vật liệu: sắt xi 7M',
      },
      {
        vt: 'socay',
        ten: 'Sò cấy 8x15',
        spec: '8x15',
        dvt: 'con',
        sp: 1950,
        dm: 4,
        sl: 7800,
        gia: 230,
        tt: 1794000,
        gc: '1/ 1950 bàn tròn ibiza · Vật liệu: sắt xi 7M',
      },
      {
        vt: 'socay',
        ten: 'Sò cấy 8x15',
        spec: '8x15',
        dvt: 'con',
        sp: 2126,
        dm: 4,
        sl: 8504,
        gia: 230,
        tt: 1955920,
        gc: '1/ 2126 bàn vuông · Vật liệu: sắt xi 7M',
      },
    ],
  },
]

// ── kiểm số TRƯỚC khi đụng vào cơ sở dữ liệu ────────────────────────────────
// Đơn tự mang bằng chứng: sl × giá = thành tiền, cộng dồn ra đúng tổng đơn, và
// thuế đúng thuế suất. Lệch một đồng là đọc sai ảnh — dừng, không ghi gì.
let hong = 0
for (const d of DON) {
  let cong = 0
  for (const l of d.lines) {
    const tt = l.sl * l.gia
    if (tt !== l.tt) {
      console.error(`✗ ${d.code} "${l.ten}": ${l.sl} × ${l.gia} = ${tt} ≠ ${l.tt}`)
      hong++
    }
    cong += l.tt
  }
  if (cong !== d.tong_hang) {
    console.error(`✗ ${d.code}: cộng dòng ${cong} ≠ tiền hàng ${d.tong_hang}`)
    hong++
  }
  const thue = Math.round((d.tong_hang * d.vat_rate) / 100)
  if (Math.abs(thue - d.tong_thue) > 1) {
    console.error(`✗ ${d.code}: thuế tính ${thue} ≠ ${d.tong_thue}`)
    hong++
  }
  if (d.tong_hang + d.tong_thue !== d.tong_tt) {
    console.error(`✗ ${d.code}: tổng thanh toán lệch`)
    hong++
  }
}
if (hong) {
  console.error(`\nDừng: ${hong} chỗ số không khớp.`)
  process.exit(1)
}
console.log('✓ Phép kiểm số: 6 dòng và 2 tổng đơn đều khớp chứng từ.\n')

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

// ── nhà cung cấp ────────────────────────────────────────────────────────────
// Tra theo MÃ SỐ THUẾ, không theo tên: tra theo tên là cách chắc chắn đẻ bản trùng.
const { data: ncc } = await db.from('supply_suppliers').select('id, code, name, tax_no')
const mst = (s) => String(s ?? '').replace(/[^0-9]/g, '')
const codes = new Set(ncc.map((s) => s.code).filter(Boolean))
const nccId = new Map()
for (const d of DON) {
  const co = ncc.find((s) => mst(s.tax_no) && mst(s.tax_no) === mst(d.ncc.tax_no))
  if (co) {
    console.log(`  = NCC đã có: ${co.name}  (MST ${co.tax_no})`)
    if (co.name !== d.ncc.name)
      console.log(`      ▸ đơn ghi tên "${d.ncc.name}" — giữ tên danh mục, không đổi`)
    nccId.set(d.code, co.id)
    continue
  }
  let code = 'VVT'
  while (codes.has(code)) code = code + '2'
  codes.add(code)
  console.log(`  + NCC MỚI: ${code}  ${d.ncc.name}  MST ${d.ncc.tax_no}`)
  if (!APPLY) {
    nccId.set(d.code, null)
    continue
  }
  const { data, error } = await db
    .from('supply_suppliers')
    .insert({
      code,
      name: d.ncc.name,
      tax_no: d.ncc.tax_no,
      address: d.ncc.moi.address,
      contact_name: d.ncc.moi.contact_name,
      contact_phone: d.ncc.moi.contact_phone,
      phone: d.ncc.moi.contact_phone,
      type: 'Vật tư',
      status: 'active',
      country: 'Việt Nam',
      currency: 'VND',
      is_active: true,
      can_order: true,
      note: NGUON,
    })
    .select('id')
    .single()
  if (error) throw new Error('NCC: ' + error.message)
  nccId.set(d.code, data.id)
}

// ── vật tư ──────────────────────────────────────────────────────────────────
const mats = []
for (let f = 0; ; f += 1000) {
  const { data } = await db
    .from('warehouse_materials')
    .select('id, code, name')
    .range(f, f + 999)
  if (!data?.length) break
  mats.push(...data)
  if (data.length < 1000) break
}
const soCuoi = (pre) =>
  Math.max(
    0,
    ...mats
      .filter((m) => String(m.code ?? '').startsWith(pre))
      .map((m) => Number(String(m.code).slice(pre.length)))
      .filter(Number.isFinite),
  )
const vtId = new Map()
const dem = {}
console.log()
for (const v of VT_MOI) {
  const co = mats.find((m) => m.name.trim().toLowerCase() === v.name.toLowerCase())
  if (co) {
    console.log(`  = vật tư đã có: ${co.code}  ${co.name}`)
    vtId.set(v.key, co.id)
    continue
  }
  dem[v.pre] = (dem[v.pre] ?? soCuoi(v.pre)) + 1
  const code = v.pre + String(dem[v.pre]).padStart(4, '0')
  console.log(
    `  + vật tư MỚI: ${code}  ${v.name.padEnd(26)} [${v.unit}]  ${v.group_name}`,
  )
  if (!APPLY) {
    vtId.set(v.key, null)
    continue
  }
  const { data, error } = await db
    .from('warehouse_materials')
    .insert({
      code,
      name: v.name,
      unit: v.unit,
      spec: v.spec,
      group_name: v.group_name,
      sub_group: v.sub_group,
      po_template: 'accessory',
      min_stock: 0,
      is_active: true,
      note: v.note,
    })
    .select('id')
    .single()
  if (error) throw new Error('vật tư ' + code + ': ' + error.message)
  vtId.set(v.key, data.id)
}
const tangDo = mats.find((m) => m.code === TANG_DO)
if (!tangDo) throw new Error('không thấy ' + TANG_DO)
console.log(`  = dùng lại:     ${tangDo.code}  ${tangDo.name}`)

// ── đơn ─────────────────────────────────────────────────────────────────────
const { data: daCo } = await db.from('supply_purchase_orders').select('code')
console.log()
for (const d of DON) {
  if (daCo.some((p) => p.code === d.code)) {
    console.log(`  ! ${d.code} — ĐÃ CÓ trong hệ thống, bỏ qua`)
    continue
  }
  console.log(
    `  + ĐƠN ${d.code} · ${d.lsx_ghi} · VAT ${d.vat_rate}% · ${d.lines.length} dòng · ${d.tong_tt.toLocaleString('vi-VN')}đ`,
  )
  for (const l of d.lines)
    console.log(
      `        ${l.ten.slice(0, 40).padEnd(42)} ${String(l.sl).padStart(7)} ${l.dvt.padEnd(4)} × ${String(l.gia).padStart(6)} = ${l.tt.toLocaleString('vi-VN').padStart(12)}`,
    )
  if (!APPLY) continue

  const { data: po, error: e1 } = await db
    .from('supply_purchase_orders')
    .insert({
      code: d.code,
      production_order_id: LSX_ROSCO_02,
      supplier_id: nccId.get(d.code),
      status: 'ordered',
      currency: 'VND',
      vat_rate: d.vat_rate,
      price_includes_vat: false,
      template: 'accessory',
      note:
        NGUON +
        ' Lệnh ghi trên đơn: "' +
        d.lsx_ghi +
        '". Ảnh bị cắt ô ngày lập và khối điều khoản nên để trống. Chứng từ: tiền hàng ' +
        d.tong_hang.toLocaleString('vi-VN') +
        ' + thuế ' +
        d.tong_thue.toLocaleString('vi-VN') +
        ' = ' +
        d.tong_tt.toLocaleString('vi-VN') +
        'đ.' +
        (d.code.endsWith('STP')
          ? ' LƯU Ý: sheet "STP" trong file LSX ROSCO CHELSEA - IBIZA.xls mang cùng số đơn nhưng là bản khác (LSX 1 CHELSEA, 4 dòng, 29.068.200đ) — bản đó coi như nháp cũ.'
          : ' Đơn này không có trong file Excel nào, chỉ có ảnh.'),
    })
    .select('id, code')
    .single()
  if (e1) throw new Error(d.code + ': ' + e1.message)

  const rows = d.lines.map((l, i) => ({
    po_id: po.id,
    material_id: l.ma ? tangDo.id : vtId.get(l.vt),
    qty_ordered: l.sl,
    unit_price: l.gia,
    spec: l.spec,
    line_name: l.ten,
    line_unit: l.dvt,
    dm_per_sp: l.dm,
    qty_demand: l.sp,
    price_basis: 'unit',
    qty_basis: 'manual',
    sort_order: i,
    note: l.gc,
  }))
  const { error: e2 } = await db.from('supply_purchase_order_lines').insert(rows)
  if (e2) throw new Error(d.code + ' dòng: ' + e2.message)
  console.log(`        → ghi xong ${rows.length} dòng`)
}

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

// ── đối chiếu lại sau khi ghi ───────────────────────────────────────────────
console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
for (const d of DON) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, status, vat_rate')
    .eq('code', d.code)
    .maybeSingle()
  if (!po) {
    console.log(`  ✗ ${d.code}: không tìm thấy`)
    continue
  }
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('qty_ordered, unit_price')
    .eq('po_id', po.id)
  const cong = ln.reduce((a, b) => a + Number(b.qty_ordered) * Number(b.unit_price), 0)
  const thue = Math.round((cong * Number(po.vat_rate)) / 100)
  const ok = cong === d.tong_hang && Math.abs(thue - d.tong_thue) <= 1
  console.log(
    `  ${ok ? '✓' : '✗'} ${po.code} [${po.status}] ${ln.length} dòng · tiền hàng ${cong.toLocaleString('vi-VN')} · thuế ${thue.toLocaleString('vi-VN')} · tổng ${(cong + thue).toLocaleString('vi-VN')}đ`,
  )
  if (!ok)
    console.log(
      `      chứng từ: ${d.tong_hang.toLocaleString('vi-VN')} / ${d.tong_thue.toLocaleString('vi-VN')} / ${d.tong_tt.toLocaleString('vi-VN')}`,
    )
}
console.log('\n✓ Xong.\n')

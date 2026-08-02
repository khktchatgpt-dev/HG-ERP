// TÍNH BAREM kg/m CHO SẮT & INOX từ quy cách nằm trong TÊN vật tư.
//
//   node scripts/metal-weight.mjs            # dry-run, in bảng đối chiếu
//   node scripts/metal-weight.mjs --apply    # ghi kg_per_m
//
// Vì sao cần: mẫu đơn `metal_kg` tính tiền = (SL × kg/đơn-vị) × giá/kg. Kho có
// 174 mã sắt và 58 mã inox nhưng gần như không mã nào có `kg_per_m`, nên mỗi
// dòng đơn phải tra sổ tay rồi gõ lại.
//
// KHÔNG cần nguồn ngoài: khối lượng suy được từ hình học + tỷ trọng. Công thức và
// tỷ trọng lấy đúng của xưởng — sheet `WeightList` trong
// `Data/QC BÀN 150 NAN POLYWOOD.xlsx`: sắt 7850, inox 7930, nhôm 2750 kg/m³.
//
//   ống/hộp/vuông rỗng : (chu vi trung bình × dày) × tỷ trọng
//   la (thanh đặc)      : (rộng × dày) × tỷ trọng
//   tròn đặc            : (π r²) × tỷ trọng
//   tròn rỗng           : π × (R² − r²) × tỷ trọng
//
// CHỈ TÍNH KHI ĐỌC ĐƯỢC ĐỦ SỐ. Tên thiếu độ dày ("Sắt hộp 20x40") thì bỏ qua —
// đoán độ dày là ra sai số tiền, mà đây là số đi thẳng vào đơn đặt hàng.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')

/**
 * kg/m³ dùng để tính.
 *
 * SẮT = 7968 chứ KHÔNG phải 7850 như ô "tỷ trọng" ghi trong sheet WeightList:
 * suy ngược từ chính BAREM xưởng đang dùng trong file QC thì ra 7968, khớp tuyệt
 * đối cả ba mẫu thử —
 *   vuông 30×30×0.8 → 93,44 mm² → 0,7445 kg/m  (file ghi 0,7445)
 *   vuông 25×25×0.8 → 77,44 mm² → 0,6170       (file ghi 0,6170)
 *   la 40×1         → 40,00 mm² → 0,3187       (file ghi 0,3187)
 * Lấy 7850 thì mọi dòng thấp hơn xưởng 1,5% — đặt hàng theo kg là thiếu hàng.
 */
const RHO = { sat: 7968, inox: 7930, nhom: 2750 }

const nod = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    // DẤU PHẨY THẬP PHÂN trước đã: "50x100x1,8li" mà đổi phẩy thành khoảng trắng
    // thì độ dày đọc ra 8 thay vì 1,8 — sai gần 7 lần khối lượng.
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Hàng TẤM / CUỘN / LƯỚI bán theo tấm hoặc theo kg, KHÔNG theo mét dài — barem
 * kg/m vô nghĩa. Tên còn hay mang mã mác thép ("Tole 3li - Inox 304") mà 304 bị
 * đọc nhầm thành chiều rộng 304mm → 7,3 kg/m cho một tấm tole.
 */
const isSheet = (s) => /\btam\b|\bton\b|\btole\b|\bcuon\b|\bluoi\b|kho \d/.test(s)

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Đọc quy cách từ tên → kg/m.
 * Trả `null` khi không đủ dữ kiện; `reason` để in ra biết vì sao bỏ qua.
 */
export function kgPerM(name, rho) {
  const s = nod(name)
    .replace(/[x×*]/g, 'x')
    .replace(/\bphi\b|ø|\bf(?=\d)/g, 'phi')
  // Bỏ phần đuôi mô tả (màu, mạ kẽm, tên hàng) để số không lẫn.
  const nums = (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

  if (isSheet(s)) return { kg: null, reason: 'hàng tấm/cuộn — không tính theo mét' }

  const isTron = /\bphi\b|\btron\b|\bong\b/.test(s) && !/hop|vuong/.test(s)
  const isLa = /\bla\b/.test(s)
  const isHopVuong = /\bhop\b|\bvuong\b/.test(s)

  // Độ dày viết kiểu "dày 1.2", "1.2li", "x1.2" ở cuối, hoặc "T1.2".
  const dayHit =
    s.match(/day\s*(\d+(?:\.\d+)?)/) ??
    s.match(/(\d+(?:\.\d+)?)\s*(?:li|ly)\b/) ??
    s.match(/\bt\s*(\d+(?:\.\d+)?)\b/)
  const day = dayHit ? num(dayHit[1]) : null

  const mm2ToKgM = (mm2) => +((mm2 / 1e6) * rho).toFixed(4)

  if (isHopVuong) {
    // "hộp 20x40x1" · "vuông 25x25x0.8" · "hộp 20x40 dày 1li" · "vuông 60x1.2li"
    const dims = nums.filter((n) => n >= 5 && n <= 400)
    // "Vuông 60x1.2" = 60×60 dày 1.2 — vuông chỉ ghi MỘT cạnh là chuyện thường.
    if (dims.length === 1 && /vuong/.test(s)) dims.push(dims[0])
    if (dims.length < 2) return { kg: null, reason: 'thiếu tiết diện' }
    const [a, b] = dims
    // Độ dày = số nhỏ (<5mm) còn lại sau khi lấy hai cạnh — "Hộp 25x50x1" không
    // ghi "li" nhưng số 1 vẫn là độ dày, bỏ qua thì mất gần nửa danh mục.
    const rest = nums.filter((n) => n > 0 && n < 5)
    const t = day ?? rest[rest.length - 1] ?? null
    if (!t) return { kg: null, reason: 'thiếu độ dày' }
    // Chu vi trung bình của ống chữ nhật rỗng: 2(a+b) − 4t
    return { kg: mm2ToKgM((2 * (a + b) - 4 * t) * t) }
  }
  if (isTron) {
    const d = nums.find((n) => n >= 4 && n <= 300)
    if (!d) return { kg: null, reason: 'thiếu đường kính' }
    if (/dac\b/.test(s)) return { kg: mm2ToKgM(Math.PI * (d / 2) ** 2) }
    // "Phi 25x1" — số nhỏ đi sau đường kính là độ dày dù không ghi "li".
    const t = day ?? nums.filter((n) => n > 0 && n < 5).pop() ?? null
    if (!t) return { kg: null, reason: 'thiếu độ dày' }
    const r = d / 2
    return { kg: mm2ToKgM(Math.PI * (r ** 2 - (r - t) ** 2)) }
  }
  if (isLa) {
    // "la 40x3" · "sắt la 20x2li" · "tole 1.2x131"
    const dims = nums.filter((n) => n > 0 && n <= 400)
    if (dims.length < 2) return { kg: null, reason: 'thiếu tiết diện' }
    const t = day ?? Math.min(...dims.slice(0, 2))
    const w = Math.max(...dims.slice(0, 2))
    if (!t || !w || t >= w) return { kg: null, reason: 'không rõ dày/rộng' }
    return { kg: mm2ToKgM(w * t) }
  }
  return { kg: null, reason: 'không nhận ra hình dạng' }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const sb = await client(import.meta.url)
  const PAGE = 1000
  const mats = []
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb
      .from('warehouse_materials')
      .select('id, code, name, group_name, kg_per_m, updated_at')
      .in('group_name', ['Sắt', 'Inox'])
      .order('code')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    mats.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }

  const done = []
  const skip = []
  /** Dòng đang MANG kg/m sai do lần chạy trước (trước khi có luật tấm/cuộn). */
  const wrong = []
  /** Số người dùng tự nhập mà máy không tính lại được — chỉ báo, không đụng. */
  const canhBao = []
  /** Tên nói là nhôm nhưng nằm nhóm sắt/inox — không tính, để người rà nhóm lại. */
  const skipByName = []
  for (const m of mats) {
    // Danh mục có mã xếp sai nhóm (đã gặp "Sắt la 5x20" nằm nhóm Nhôm). Tên nói
    // vật liệu gì thì tin tên: tính nhôm bằng tỷ trọng sắt là sai gần 3 lần.
    if (/\bnhom\b|aluminium/.test(nod(m.name))) {
      if (m.kg_per_m == null) skipByName.push(m)
      continue
    }
    const rho = m.group_name === 'Inox' ? RHO.inox : RHO.sat
    const { kg, reason } = kgPerM(m.name, rho)
    /*
     * Đã có kg/m: chỉ đụng vào khi nay biết chắc là SAI (hàng tấm/cuộn) hoặc số
     * mới lệch hẳn số cũ — lần chạy trước ghi nhầm 17,08 kg/m cho "hộp 50x100x1,8"
     * vì đọc dấu phẩy thập phân thành dấu tách.
     */
    if (m.kg_per_m != null) {
      const cu = Number(m.kg_per_m)
      /*
       * CHỈ sửa số do CHÍNH SCRIPT NÀY ghi (updated_at trong 24h). Số người dùng
       * tự nhập thì không đụng: "Lưới cuộn B40 khổ 1m8 = 4 kg/m" là dữ liệu tay
       * hợp lệ cho hàng cuộn, xoá đi là mất thứ máy không tính lại được.
       */
      const cuaScript =
        Date.now() - new Date(m.updated_at).getTime() < 24 * 60 * 60 * 1000
      if (!cuaScript) {
        if (!kg) canhBao.push({ ...m, cu, reason: reason ?? 'máy không tính được' })
        continue
      }
      if (!kg) {
        if (isSheet(nod(m.name))) wrong.push({ ...m, kg: null, cu, reason })
      } else if (Math.abs(cu - kg) / Math.max(cu, kg) > 0.02) {
        wrong.push({ ...m, kg, cu, reason: 'số cũ lệch >2%' })
      }
      continue
    }
    if (kg && kg > 0.01 && kg < 100) done.push({ ...m, kg })
    else skip.push({ ...m, reason: reason ?? 'kết quả vô lý' })
  }

  console.log(
    `Sắt + Inox: ${mats.length} mã · đã có kg/m: ${mats.filter((m) => m.kg_per_m != null).length}`,
  )
  console.log(`  tính được : ${done.length}`)
  console.log(`  bỏ qua    : ${skip.length}\n`)
  console.log('── TÍNH ĐƯỢC (20 dòng đầu) ──')
  for (const d of done.slice(0, 20))
    console.log(`  ${d.code.padEnd(10)} ${d.name.padEnd(38)} → ${d.kg} kg/m`)
  if (skipByName.length) {
    console.log(
      `\n── TÊN LÀ NHÔM nhưng nằm nhóm sắt/inox (${skipByName.length}) — cần rà nhóm ──`,
    )
    for (const m of skipByName.slice(0, 10))
      console.log(`  ${m.code}  ${m.name}  [${m.group_name}]`)
  }
  if (wrong.length) {
    console.log(`\n── SỬA SỐ ĐANG SAI (${wrong.length}) ──`)
    for (const w of wrong)
      console.log(
        `  ${w.code.padEnd(10)} ${w.name.padEnd(38)} ${w.cu} → ${w.kg ?? 'null'}  (${w.reason})`,
      )
  }
  if (canhBao.length) {
    console.log(`\n── SỐ NHẬP TAY, GIỮ NGUYÊN (${canhBao.length}) ──`)
    for (const c of canhBao)
      console.log(
        `  ${c.code.padEnd(10)} ${c.name.padEnd(38)} ${c.cu} kg/m — ${c.reason}`,
      )
  }
  console.log('\n── BỎ QUA (10 dòng đầu) ──')
  for (const s of skip.slice(0, 10))
    console.log(`  ${s.code.padEnd(10)} ${s.name.padEnd(38)} — ${s.reason}`)

  if (!APPLY) {
    console.log('\n(dry-run — thêm --apply để ghi kg_per_m)')
  } else {
    let n = 0
    for (const d of [...done, ...wrong]) {
      const { error } = await sb
        .from('warehouse_materials')
        .update({ kg_per_m: d.kg })
        .eq('id', d.id)
      if (!error) n++
    }
    console.log(`\n✓ ghi/sửa kg/m cho ${n} mã`)
  }
}

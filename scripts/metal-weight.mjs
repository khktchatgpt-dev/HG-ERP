// TÍNH BAREM kg/m CHO SẮT & INOX từ quy cách nằm trong TÊN vật tư — chạy để lấp
// `kg_per_m` cho DANH MỤC CŨ. Vật tư khai mới thì app tự tính ngay trên form,
// không phải chạy lại script này.
//
//   node scripts/metal-weight.mjs            # dry-run, in bảng đối chiếu
//   node scripts/metal-weight.mjs --apply    # ghi kg_per_m
//
// CÔNG THỨC KHÔNG NẰM Ở ĐÂY NỮA. Bản gốc duy nhất là `src/lib/metal-weight.ts`
// (có test đối chiếu barem xưởng); file này chỉ lo phần đọc/ghi Supabase. Trước
// đây script giữ một bản chép riêng — hai bản lệch nhau nghĩa là barem tính trên
// đơn khác barem đã backfill vào danh mục, mà lệch kiểu đó thì không ai thấy.
//
// Node 24 chạy thẳng .ts nhờ type-stripping nên import được, không cần build.

import { client } from './products-lib.mjs'
import { kgPerM, isSheetLike, RHO } from '../src/lib/metal-weight.ts'

const APPLY = process.argv.includes('--apply')

/** Bỏ dấu — chỉ để nhận diện dòng khi in báo cáo bên dưới. */
const nod = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()

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
        if (isSheetLike(m.name)) wrong.push({ ...m, kg: null, cu, reason })
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

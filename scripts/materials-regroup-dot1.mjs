// PHÂN NHÓM LẠI VẬT TƯ — ĐỢT 1: CỤM KIM LOẠI + LIÊN KẾT (03/09/2026).
//
//   node scripts/materials-regroup-dot1.mjs            # dò khô: đếm + ví dụ, KHÔNG ghi
//   node scripts/materials-regroup-dot1.mjs --apply    # ghi (sao lưu trước, có sổ vết)
//
// User chốt 03/09/2026: "bulong ốc vít vân vân là 1 nhóm; các nhóm về sắt,
// nhôm, inox thành các nhóm [riêng] để dễ quản lý". Nhóm gộp cũ
// `Sắt thép - inox - nhôm - tôn` (2.854 mã) đang là thùng rác lớn nhất danh
// mục: nhôm định hình 705 mã, inox 104 mã, và 256 mã vít/bu lông/long đền —
// ba thứ mua ở ba loại NCC khác nhau, barem khác nhau — nằm chung một dropdown.
//
// BỐN NƯỚC ĐI, đúng thứ tự (một mã chỉ đi một nước, ưu tiên A → B → C → D):
//   A. Sắt thép → `Nhôm định hình - tấm`  : tên bắt đầu bằng "nhôm …"
//   B. Sắt thép → `Inox`                  : tên bắt đầu bằng "inox …" / "ống inox …"
//   C. mọi nhóm → `Bu lông - vít - đinh - liên kết`: tên bắt đầu bằng
//      vít / vis / bulon / long đền / tán / đinh / ty ren / eru (ê-cu) / ốc / rive
//      (gom cả 64 vít ren gỗ đang ở Gỗ-kính, 35 "Eru" đang ở Điện, 13 "tán keo"
//      ở Sơn…). "Eru" là ê-cu chứ không phải đồ điện — rà soát 03/09 bắt được.
//   D. mọi nhóm → `Bao bì - đóng gói - tem nhãn`: tên bắt đầu bằng "SM " — user
//      xác nhận 03/09: đây là THẺ TREO sản phẩm (156 mã rải ở Mút 88, Sắt thép
//      30, Sơn 20, Văn phòng 11, Vải 7), KHÔNG phải hàng mẫu như bản rà đoán.
//   rồi ĐỔI TÊN nhóm cũ → `Sắt thép - tôn - tấm` (cascade lên mã còn lại).
//
// CHỈ BẮT THEO ĐẦU TÊN. "Pát inox", "Ắc … inox 304", "Bulong liên kết inox" là
// phụ kiện / ắc / bu lông — vật liệu đứng sau không đổi bản chất món hàng. Vì
// vậy nhóm Inox sau đợt này còn nhỏ (≈100) và sẽ lớn dần khi Cung ứng sửa tay.
//
// Vì sao là script chứ không phải bấm trên màn "Đổi nhóm hàng loạt": 1.193 mã
// qua tích-chọn 50 dòng/trang là 24 lượt, và người bấm không có cách nào kiểm
// lại luật đã áp. Script in bảng đối chiếu trước, ghi sau, và mỗi mã đổi để
// lại một dòng trong `warehouse_material_changes` (source = import) y như đường
// UI — tab "Lịch sử" của vật tư kể được chuyện này.
//
// Đổi nhóm chính → `sub_group` về NULL (cùng luật với service `regroup`): nhóm
// phụ cũ ("Nhôm - thanh & tấm", "Sắt - thép - inox - tôn") là nhãn của nhóm cũ,
// mang sang nhóm mới chỉ làm bẩn danh sách gợi ý. Nhóm phụ mới gán ở Đợt 3.
//
// Bộ nhớ đệm taxonomy của dev server sống 5 phút — chạy xong mà dropdown chưa
// thấy nhóm mới thì chờ, hoặc restart `npm run dev`.

import { mkdirSync, writeFileSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const SOURCE_REF = 'materials-regroup-dot1.mjs'

const OLD_METAL = 'Sắt thép - inox - nhôm - tôn'
const NEW_METAL = 'Sắt thép - tôn - tấm'
const G_NHOM = 'Nhôm định hình - tấm'
const G_INOX = 'Inox'
const G_BULONG = 'Bu lông - vít - đinh - liên kết'
const G_BAOBI = 'Bao bì - đóng gói - tem nhãn'

const RE_NHOM = /^(nhôm|thanh nhôm|dây nhôm|la nhôm|lưới nhôm|ống nhôm|hộp nhôm|tấm nhôm)/
const RE_INOX =
  /^(inox|ống inox|hộp inox|tấm inox|dây inox|ống tròn inox|ống vuông inox|lưới inox|thanh inox)/
const RE_SM = /^sm /
const RE_BULONG =
  /^(vít|vis|viít|bulon|bu lông|bulong|long đền|lông đền|lđn|lđs|tán |đinh |ty ren|cây gai|eru|ê cu|ốc |rive|đinh tán)/

/** Cùng luật với bản SQL đã đối chiếu 03/09 (705 / 104 / 384). */
function decide(m) {
  const n = String(m.name ?? '')
    .normalize('NFC')
    .toLowerCase()
  if (m.group_name === OLD_METAL && RE_NHOM.test(n)) return { key: 'A', to: G_NHOM }
  if (m.group_name === OLD_METAL && RE_INOX.test(n)) return { key: 'B', to: G_INOX }
  if (m.group_name !== G_BULONG && RE_BULONG.test(n)) return { key: 'C', to: G_BULONG }
  if (m.group_name !== G_BAOBI && RE_SM.test(n)) return { key: 'D', to: G_BAOBI }
  return null
}

async function fetchAll(sb) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('warehouse_materials')
      .select('id, code, name, group_name, sub_group')
      .eq('is_active', true)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  const sb = await client(import.meta.url)

  // Nhóm đích phải có trong danh mục — service regroup cũng chặn y vậy.
  const { data: groups, error: ge } = await sb
    .from('catalog_items')
    .select('id, label, is_active')
    .eq('type', 'material_group')
  if (ge) throw new Error(ge.message)
  const byLabel = new Map((groups ?? []).map((g) => [g.label, g]))
  for (const g of [G_NHOM, G_INOX, G_BULONG, G_BAOBI]) {
    if (!byLabel.get(g)?.is_active) {
      console.error(
        `✗ Nhóm đích "${g}" chưa có trong danh mục — tạo ở /planning/materials/nhom trước.`,
      )
      process.exit(1)
    }
  }
  const oldMetal = byLabel.get(OLD_METAL)
  if (byLabel.has(NEW_METAL)) {
    console.error(`✗ Đã có nhóm "${NEW_METAL}" — có vẻ đợt này chạy rồi.`)
    process.exit(1)
  }

  const all = await fetchAll(sb)
  const moves = []
  for (const m of all) {
    const d = decide(m)
    if (d) moves.push({ ...m, key: d.key, to: d.to })
  }

  // ---- Bảng đối chiếu -------------------------------------------------------
  const label = {
    A: `Sắt thép → ${G_NHOM}`,
    B: `Sắt thép → ${G_INOX}`,
    C: `… → ${G_BULONG}`,
    D: `SM (thẻ treo) → ${G_BAOBI}`,
  }
  for (const key of ['A', 'B', 'C', 'D']) {
    const rows = moves.filter((r) => r.key === key)
    console.log(`\n${key}. ${label[key]}: ${rows.length} mã`)
    const bySrc = new Map()
    for (const r of rows) bySrc.set(r.group_name, (bySrc.get(r.group_name) ?? 0) + 1)
    for (const [g, n] of [...bySrc].sort((a, b) => b[1] - a[1]))
      console.log(`     ${n}\ttừ ${g}`)
    for (const r of rows.slice(0, 5)) console.log(`     vd  ${r.code}  ${r.name}`)
  }
  const stayMetal = all.filter(
    (m) => m.group_name === OLD_METAL && !moves.some((r) => r.id === m.id),
  )
  console.log(
    `\nĐổi tên nhóm: "${OLD_METAL}" → "${NEW_METAL}" (${stayMetal.length} mã còn lại đi theo)`,
  )
  console.log(`\nTổng: ${moves.length} mã đổi nhóm · ${all.length} mã active đã quét`)

  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  // ---- Sao lưu trước khi ghi ------------------------------------------------
  mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const bk = new URL(`../backups/materials-regroup-dot1-${stamp}.json`, import.meta.url)
  writeFileSync(
    bk,
    JSON.stringify(
      {
        moves,
        rename: { from: OLD_METAL, to: NEW_METAL, ids: stayMetal.map((m) => m.id) },
      },
      null,
      1,
    ),
  )
  console.log(`\nĐã sao lưu ${bk.pathname}`)

  // ---- Ghi: nhóm + sổ vết, theo lô ------------------------------------------
  let done = 0
  for (const key of ['A', 'B', 'C', 'D']) {
    const rows = moves.filter((r) => r.key === key)
    for (const part of chunk(rows, 200)) {
      const { error } = await sb
        .from('warehouse_materials')
        .update({ group_name: part[0].to, sub_group: null })
        .in(
          'id',
          part.map((r) => r.id),
        )
      if (error) throw new Error(`update ${key}: ${error.message}`)
      const audit = []
      for (const r of part) {
        audit.push({
          material_id: r.id,
          material_code: r.code,
          field: 'group_name',
          before_value: r.group_name,
          after_value: r.to,
          actor_id: null,
          source: 'import',
          source_ref: SOURCE_REF,
        })
        if (r.sub_group)
          audit.push({
            material_id: r.id,
            material_code: r.code,
            field: 'sub_group',
            before_value: r.sub_group,
            after_value: null,
            actor_id: null,
            source: 'import',
            source_ref: SOURCE_REF,
          })
      }
      const { error: ae } = await sb.from('warehouse_material_changes').insert(audit)
      if (ae) throw new Error(`audit ${key}: ${ae.message}`)
      done += part.length
      console.log(`  ${key}: ${done}/${moves.length}`)
    }
  }

  // ---- Đổi tên nhóm cũ + cascade (cùng cách service rename làm) ------------
  if (oldMetal) {
    const { error: re } = await sb
      .from('catalog_items')
      .update({ label: NEW_METAL })
      .eq('id', oldMetal.id)
    if (re) throw new Error(`rename catalog: ${re.message}`)
  }
  const { data: casc, error: ce } = await sb
    .from('warehouse_materials')
    .update({ group_name: NEW_METAL })
    .eq('group_name', OLD_METAL)
    .select('id')
  if (ce) throw new Error(`cascade rename: ${ce.message}`)
  console.log(`\nĐã đổi tên nhóm, ${casc?.length ?? 0} mã đi theo. Xong.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

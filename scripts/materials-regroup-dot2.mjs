// PHÂN NHÓM LẠI VẬT TƯ — ĐỢT 2: 5 NHÓM MỚI CÒN LẠI + GOM HÀNG LẠC NHÓM (03/09/2026).
//
//   node scripts/materials-regroup-dot2.mjs            # dò khô: ma trận cũ → mới + ví dụ
//   node scripts/materials-regroup-dot2.mjs --apply    # ghi (sao lưu, sổ vết, rồi đổi tên 4 nhóm)
//
// Tiếp Đợt 1 (`materials-regroup-dot1.mjs`: Nhôm / Inox / Bu lông / SM thẻ treo).
// Đợt này hoàn tất cấu trúc 21 nhóm chính của bản kế hoạch 03/09:
//   · 5 nhóm mới đã tạo qua app: Máy móc - thiết bị · Dây mây - vật liệu đan ·
//     Dầu - nhớt - mỡ bôi trơn · Kính - mica - nhựa tấm · Dịch vụ - gia công - vận chuyển
//   · 4 nhóm ĐỔI TÊN (làm cuối, sau khi đã chuyển hàng ra):
//       Dụng cụ - máy móc - mài     → Dụng cụ cầm tay - lưỡi mũi - nhám
//       Sơn - dầu - keo - hoá chất  → Sơn - keo - hoá chất
//       Vải - mây - chỉ - sợi       → Vải - da - chỉ - phụ liệu may
//       Gỗ - kính - nhựa tấm        → Gỗ - ván - chi tiết gỗ mua ngoài
//   · gom hàng lạc: bộ luật từ khoá mục 4 + 7d của kế hoạch, bắt theo ĐẦU TÊN,
//     luật đứng trước thắng. Mã không khớp luật nào thì ĐỨNG YÊN (đi theo tên
//     nhóm mới nếu nhóm đổi tên) — đó là 22% mã máy không đọc được, để Đợt 3
//     duyệt tay.
//
// Vài luật được đặt sớm CÓ CHỦ ĐÍCH vì từ khoá chung chung phía sau sẽ bắt nhầm
// (rà soát 7d): "nút nhấn" là đồ điện chứ không phải nút bịt chân; "máy tính",
// "laptop", "giấy A4" là văn phòng chứ không phải máy móc / bao bì; "mũ chụp đầu
// cos" là điện; "chụp khí hàn" là vật tư hàn; "thanh V giấy" là góc bảo vệ giấy
// (bao bì) chứ không phải thép; "dây đai" cố ý KHÔNG bắt (vừa là đai máy vừa là
// đai đóng gói — để tay).
//
// Ghi y như Đợt 1: sao lưu JSON vào backups/, mỗi mã đổi nhóm một dòng
// `warehouse_material_changes` (source = import), nhóm phụ về NULL khi đổi nhóm
// chính. Cascade đổi tên nhóm không ghi vết (đổi nhãn, không đổi phân loại).

import { mkdirSync, writeFileSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const SOURCE_REF = 'materials-regroup-dot2.mjs'
/**
 * Cặp (nhóm cũ → nhóm mới) dưới ngưỡng này thì CHỈ IN, không ghi (trừ khi
 * `--all`). Lý do: lỗi bắt nhầm của luật từ khoá dồn hết vào các cặp lẻ tẻ —
 * "Sứ (tấm gốm chịu nhiệt lò sấy)" rơi vào Vật tư hàn vì chữ "sứ", "Kính Fiber
 * súng hàn laser" rơi vào Kính. Cặp lớn thì tên lặp đi lặp lại, nhìn 3 ví dụ là
 * đủ tin; cặp 1–3 mã thì mỗi mã là một ca riêng, để tay sửa tại chỗ.
 */
const MIN_PAIR = process.argv.includes('--all') ? 1 : 4

/** Nhóm đổi tên: cũ → mới. So sánh "lạc hay không" theo tên MỚI. */
const RENAME = {
  'Dụng cụ - máy móc - mài': 'Dụng cụ cầm tay - lưỡi mũi - nhám',
  'Sơn - dầu - keo - hoá chất': 'Sơn - keo - hoá chất',
  'Vải - mây - chỉ - sợi': 'Vải - da - chỉ - phụ liệu may',
  'Gỗ - kính - nhựa tấm': 'Gỗ - ván - chi tiết gỗ mua ngoài',
}

const G = {
  NHOM: 'Nhôm định hình - tấm',
  INOX: 'Inox',
  SAT: 'Sắt thép - tôn - tấm',
  BULONG: 'Bu lông - vít - đinh - liên kết',
  PHUKIEN: 'Phụ kiện nội thất',
  COKHI: 'Cơ khí - vòng bi - khuôn',
  ONG: 'Ống - van - khí nén - thủy lực',
  DIEN: 'Điện - chiếu sáng - điều khiển',
  MAY: 'Máy móc - thiết bị',
  DUNGCU: 'Dụng cụ cầm tay - lưỡi mũi - nhám',
  HAN: 'Vật tư hàn - cắt',
  BAOBI: 'Bao bì - đóng gói - tem nhãn',
  MUT: 'Mút - xốp - nệm - gòn',
  VAI: 'Vải - da - chỉ - phụ liệu may',
  MAY_DAN: 'Dây mây - vật liệu đan',
  SON: 'Sơn - keo - hoá chất',
  DAU: 'Dầu - nhớt - mỡ bôi trơn',
  GO: 'Gỗ - ván - chi tiết gỗ mua ngoài',
  KINH: 'Kính - mica - nhựa tấm',
  VP: 'Văn phòng - nội bộ - bảo hộ',
  DICHVU: 'Dịch vụ - gia công - vận chuyển',
}

/** [regex trên tên đã hạ chữ, nhóm đích] — THỨ TỰ QUYẾT ĐỊNH. */
const RULES = [
  [/^sm /, G.BAOBI],
  [
    /^(nhân công|gia công|vận chuyển|phí |chi phí|dịch vụ|công (đoạn|thợ|cắt|sơn|mạ|uốn)|thuê |bốc xếp|cước |vc )/,
    G.DICHVU,
  ],
  [/^(máy tính|laptop|giấy a[34]\b|hộp mực)/, G.VP],
  [/^phần gỗ/, G.GO],
  [
    /^(khung |chân ghế|chân bàn|đầu giường|khung dọc|khung ngang|tay vịn|tay ghế)/,
    G.PHUKIEN,
  ],
  [/(nhựa giả gỗ|polywood|^thanh nhựa|nan nhựa|^tấm nhựa)/, G.KINH],
  [/^(thanh v giấy|tấm lót|góc |lót )/, G.BAOBI],
  [/^(nhôm|thanh nhôm|dây nhôm|la nhôm|lưới nhôm|ống nhôm|hộp nhôm|tấm nhôm)/, G.NHOM],
  [
    /^(inox|ống inox|hộp inox|tấm inox|dây inox|ống tròn inox|ống vuông inox|lưới inox|thanh inox)/,
    G.INOX,
  ],
  [
    /^(thép|sắt|ống tôn|ống thép|ống sắt|tôn |thanh v|thanh nẹp|la sắt|lưới sắt|dây kẽm|dây mạ kẽm|ty sắt|thép không|hộp kẽm)/,
    G.SAT,
  ],
  [
    /^(vít|vis|viít|bulon|bu lông|bulong|long đền|lông đền|lđn|lđs|tán |đinh |ty ren|cây gai|eru|ê cu|ốc |rive|chốt |ghim |khoen|mắc cáo)/,
    G.BULONG,
  ],
  [/^(nút nhấn|nút bấm|mũ chụp đầu cos|đầu cos|đầu cốt)/, G.DIEN],
  [/^(chụp khí|chụp hàn)/, G.HAN],
  [
    /^(pát|pat |nút |gót |bánh xe|khóa |khoá |tay nắm|ben hơi|nắp |chụp |ắc |tăng đơ)/,
    G.PHUKIEN,
  ],
  [
    /^(bi |bạc đạn|vòng bi|khuôn|phớt|nhông|xích|ron |lò xo|dây curoa|than |chổi than|khớp |trục |bánh răng|puly)/,
    G.COKHI,
  ],
  [
    /^(ống |van |co |tê |nối |ren |cùm |rắc co|lơi |xi lanh|giảm áp|đầu nối|dây hơi|dây thủy lực|ben )/,
    G.ONG,
  ],
  [
    // "dây dẹp" ở xưởng này là dây đan dẹp (wicker), KHÔNG phải dây điện dẹp;
    // "cáp inox 4mm" là cáp treo — chỉ bắt cáp điện/mạng/tín hiệu.
    /^(dây điện|dây cáp|dây đồng|dây cv|cáp (điện|mạng|tín hiệu|điều khiển|nguồn)|bóng |đèn |ổ cắm|cb |atm|mcb|rơ le|role|công tắc|tụ |biến tần|biến áp|phích|ắc quy|pin |bình ắc|bộ nguồn|cảm biến|áp tô mát|cầu dao|cầu chì)/,
    G.DIEN,
  ],
  [
    /^(máy |quạt |bơm |motor|mô tơ|động cơ|tủ |thiết bị|lọc (gió|nhớt|dầu|tách|khí|máy))/,
    G.MAY,
  ],
  [
    // "lục giác 4x80" là BU LÔNG lục giác — không bắt về dụng cụ.
    /^(nhám|giấy nhám|mũi |lưỡi |đĩa |taro|thước|cà lê|cờ lê|tua vít|búa |kìm |kéo |mảnh |đầu mài|đá mài|bàn chải|dụng cụ|típ |đồng hồ|đầu khoan|đầu kẹp)/,
    G.DUNGCU,
  ],
  [
    // "ruột bơm" là phụ tùng bơm — chỉ bắt ruột gà / ruột máy khò / ruột súng.
    /^(que hàn|dây hàn|béc|sứ |kẹp hàn|súng hàn|khí co2|khí argon|ruột gà|ruột máy|ruột súng|mỏ hàn|kính hàn|kim hàn|đầu đót|đầu súng)/,
    G.HAN,
  ],
  [
    /^(thùng|bì |túi |màng |băng keo|băng dán|tem |nhãn |thẻ |thẽ|giấy |logo|mạc|bao |pallet|palet|decal|barcode|dây rút|dây cột|bạt )/,
    G.BAOBI,
  ],
  [/^(xốp|mút|mousse|foam|gòn|xơ |nệm|bông|gối)/, G.MUT],
  [
    /^(dây mây|mây |nan |dây dù|dây pe|dây nhựa|dây đan|sợi đan|dây rỗng|dây cói|dây dẹp)/,
    G.MAY_DAN,
  ],
  [
    /^(vải|da |chỉ |nỉ |lưới|thun|cước|dây kéo|dây nhuộm|khoá kéo|khóa kéo|phụ liệu|nút áo|khuy)/,
    G.VAI,
  ],
  [/^(nhớt|dầu |mỡ |grease)/, G.DAU],
  [
    /^(sơn |bột sơn|keo |dung môi|hoá chất|hóa chất|chất |lăn |cọ |hạt |lọc sơn|băng che|xăng|tẩy)/,
    G.SON,
  ],
  [/^(gỗ|ván|mdf|plywood|okal|veneer)/, G.GO],
  [/^(kính|mica|pc |acrylic|nhựa )/, G.KINH],
  [
    /^(bút |sổ |bìa |kẹp giấy|khẩu trang|găng tay|bảo hộ|ủng |mũ |nón |chổi |xà phòng|nước rửa|bình chữa|chuột |bàn phím|tấm cách nhiệt|panel)/,
    G.VP,
  ],
]

function suggest(name) {
  const n = String(name ?? '')
    .normalize('NFC')
    .toLowerCase()
  for (const [re, to] of RULES) if (re.test(n)) return to
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

  const { data: groups, error: ge } = await sb
    .from('catalog_items')
    .select('id, label, is_active')
    .eq('type', 'material_group')
  if (ge) throw new Error(ge.message)
  const byLabel = new Map((groups ?? []).map((g) => [g.label, g]))
  const missing = Object.values(G).filter(
    (g) => !byLabel.get(g)?.is_active && !Object.values(RENAME).includes(g),
  )
  if (missing.length) {
    console.error(`✗ Thiếu nhóm đích trong danh mục: ${missing.join(' · ')}`)
    process.exit(1)
  }
  for (const [from, to] of Object.entries(RENAME)) {
    if (byLabel.has(to)) {
      console.error(`✗ Đã có nhóm "${to}" — có vẻ đợt này chạy rồi.`)
      process.exit(1)
    }
    if (!byLabel.has(from)) {
      console.error(`✗ Không thấy nhóm "${from}" để đổi tên.`)
      process.exit(1)
    }
  }

  const all = await fetchAll(sb)
  const moves = []
  let unread = 0
  for (const m of all) {
    const effective = RENAME[m.group_name] ?? m.group_name
    const to = suggest(m.name)
    if (!to) {
      unread++
      continue
    }
    if (to !== effective) moves.push({ ...m, effective, to })
  }

  // ---- Ma trận đối chiếu --------------------------------------------------
  const pairs = new Map()
  for (const r of moves) {
    const k = `${r.effective} → ${r.to}`
    if (!pairs.has(k)) pairs.set(k, [])
    pairs.get(k).push(r)
  }
  const sorted = [...pairs].sort((a, b) => b[1].length - a[1].length)
  for (const [k, rows] of sorted) {
    console.log(`\n${String(rows.length).padStart(5)}  ${k}`)
    for (const r of rows.slice(0, 3)) console.log(`         ${r.code}  ${r.name}`)
  }
  const small = sorted.filter(([, rows]) => rows.length < 4).length
  console.log(`\n${sorted.length} cặp (${small} cặp < 4 mã)`)
  const byTo = new Map()
  for (const r of moves) byTo.set(r.to, (byTo.get(r.to) ?? 0) + 1)
  console.log('\nNhận thêm theo nhóm đích:')
  for (const [g, n] of [...byTo].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(5)}  ${g}`)
  console.log('\nĐổi tên nhóm (mã còn lại đi theo):')
  for (const [from, to] of Object.entries(RENAME)) {
    const stay = all.filter(
      (m) => m.group_name === from && !moves.some((r) => r.id === m.id),
    ).length
    console.log(`  ${from} → ${to}  (${stay} mã)`)
  }
  console.log(
    `\nTổng: ${moves.length} mã đổi nhóm · ${unread} mã không khớp luật nào (đứng yên) · ${all.length} mã active`,
  )
  const applyMoves = moves.filter(
    (r) => pairs.get(`${r.effective} → ${r.to}`).length >= MIN_PAIR,
  )
  const skipped = moves.filter((r) => !applyMoves.includes(r))
  console.log(
    `Sẽ ghi ${applyMoves.length} mã; ${skipped.length} mã thuộc cặp < ${MIN_PAIR} mã chỉ in, không ghi (--all để ghi cả).`,
  )

  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const bk = new URL(`../backups/materials-regroup-dot2-${stamp}.json`, import.meta.url)
  writeFileSync(
    bk,
    JSON.stringify({ moves: applyMoves, skipped, rename: RENAME }, null, 1),
  )
  console.log(`\nĐã sao lưu ${bk.pathname}`)

  let done = 0
  for (const [to, rows] of Object.entries(Object.groupBy(applyMoves, (r) => r.to))) {
    for (const part of chunk(rows, 200)) {
      const { error } = await sb
        .from('warehouse_materials')
        .update({ group_name: to, sub_group: null })
        .in(
          'id',
          part.map((r) => r.id),
        )
      if (error) throw new Error(`update → ${to}: ${error.message}`)
      const audit = []
      for (const r of part) {
        audit.push({
          material_id: r.id,
          material_code: r.code,
          field: 'group_name',
          before_value: r.group_name,
          after_value: to,
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
      if (ae) throw new Error(`audit → ${to}: ${ae.message}`)
      done += part.length
      console.log(`  ${done}/${applyMoves.length}`)
    }
  }

  for (const [from, to] of Object.entries(RENAME)) {
    const item = byLabel.get(from)
    const { error: re } = await sb
      .from('catalog_items')
      .update({ label: to })
      .eq('id', item.id)
    if (re) throw new Error(`rename ${from}: ${re.message}`)
    const { data: casc, error: ce } = await sb
      .from('warehouse_materials')
      .update({ group_name: to })
      .eq('group_name', from)
      .select('id')
    if (ce) throw new Error(`cascade ${from}: ${ce.message}`)
    console.log(`  đổi tên ${from} → ${to}: ${casc?.length ?? 0} mã đi theo`)
  }
  console.log('\nXong.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

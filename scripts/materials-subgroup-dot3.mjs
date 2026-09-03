// PHÂN NHÓM LẠI VẬT TƯ — ĐỢT 3: NHÓM PHỤ THEO BẢNG MỤC 4 CỦA KẾ HOẠCH (03/09/2026).
//
//   node scripts/materials-subgroup-dot3.mjs            # dò khô: phân bố nhóm phụ sau khi gán
//   node scripts/materials-subgroup-dot3.mjs --apply    # ghi (sao lưu, sổ vết từng mã)
//
// Sau Đợt 1–2 danh mục đã đúng 21 nhóm chính, nhưng nhóm phụ thì: 5 nhóm mới
// trống hoàn toàn (Nhôm 705, Máy móc 329, Dây mây 254…), 2.009 mã trống, và
// nhiều nhãn cũ nay SAI NGHĨA vì hàng đã chuyển đi ("Máy móc - thiết bị" trong
// Dụng cụ sau khi máy đã tách ra; "Nhôm - thanh & tấm" trong Sắt thép) hoặc
// VÔ NGHĨA vì trùng tên nhóm chính ("Bao bì - đóng gói" 803 mã trong Bao bì,
// "Phụ kiện nội thất" 414 mã trong Phụ kiện).
//
// CÁCH GÁN — cho 18 nhóm có bảng ở mục 4 (Điện, Ống - van, Văn phòng giữ nguyên):
//   nhãn mới = luật đầu tiên khớp ĐẦU TÊN
//            ?? (nhãn cũ thuộc danh sách VÔ NGHĨA/SAI NGHĨA ? trống : nhãn cũ)
// Tức là luật thắng nhãn cũ (mục tiêu là MỘT bộ nhãn thống nhất), mã không
// khớp luật thì giữ nhãn cũ nếu nhãn đó còn nghĩa. Mọi mã đổi nhãn đều để
// lại một dòng `warehouse_material_changes` (field = sub_group, source = import).
//
// Từ khoá của bảng có vài chữ quá chung ("cây", "hộp", "bộ", "đầu", "thanh",
// "tấm") — ở đây chỉ dùng chúng khi đã đứng SAU các luật hẹp hơn trong cùng
// nhóm, và bỏ hẳn ở nhóm mà chúng bắt nhầm nhiều. Ba nhãn KHÔNG có trong bảng
// được thêm vì chạy khô thấy cần: "Nhôm khác", "Sơn khác (sắt, nhũ, dầu…)",
// "Đồng hồ - thiết bị đo" (7b) và "Lọc - phụ tùng máy nén" (7b).

import { mkdirSync, writeFileSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const SOURCE_REF = 'materials-subgroup-dot3.mjs'

/** Nhãn cũ bị xoá khi không có luật nào thay — vô nghĩa hoặc đã sai nghĩa. */
const STALE = new Set([
  'Bao bì - đóng gói',
  'Phụ kiện nội thất',
  'Phụ kiện nội thất - cơ khí',
  'Vật tư hàn - cắt',
  'Phụ kiện cơ khí',
  'Sắt - thép - inox - tôn',
  'Sắt - thép - inox - tôn - nhôm',
  'Nhôm - thanh & tấm',
  'Máy móc - thiết bị',
  'Bulon - tán - đinh - ốc vít',
  'Vít - ốc các loại',
  'Phụ kiện phụ - kẹp - chốt',
  'Mút - xốp - đệm',
  'Vải - chỉ - phụ kiện may',
  'Sơn - dầu - nhớt',
])

/**
 * Nhãn cũ CÙNG NGHĨA với một nhãn trong bảng → đổi thẳng sang nhãn bảng khi mã
 * không khớp luật nào (khớp luật thì luật quyết). Không có bảng này thì sau đợt
 * "Dụng cụ cầm tay" 112 mã đứng cạnh "Dụng cụ cầm tay (cờ lê…)" 180 mã.
 */
const ALIAS = {
  'Dụng cụ cầm tay': 'Dụng cụ cầm tay (cờ lê, kìm, thước, búa…)',
  'Lưỡi - mũi - đĩa máy': 'Lưỡi - đĩa cắt - mảnh dao',
  'Lọc - vật tư bảo trì': 'Lọc - vật tư bảo trì máy',
  'Bulon - tán - đinh tán': 'Bu lông - tán',
  'Đinh - ghim': 'Đinh - ghim - rive',
  'Lông đền - long đền': 'Long đền - lông đền',
  'Ty - thanh ren': 'Ty ren - chốt - kẹp - khoen',
  'Vòng - khoen liên kết': 'Ty ren - chốt - kẹp - khoen',
  'Mắc cáo - khoen liên kết': 'Ty ren - chốt - kẹp - khoen',
  'Móc - quai - khóa cài': 'Ty ren - chốt - kẹp - khoen',
  'LGC - long đền chỉnh': 'Long đền - lông đền',
  'Bánh xe - vận chuyển': 'Bánh xe - ray trượt',
  'Nút nhựa - bịt chân': 'Nút bịt chân',
  'Gót chân - chân ghế': 'Gót - chân ghế - đế',
  'Linh kiện thành phẩm - mặt bàn, nan': 'Linh kiện thành phẩm (mặt bàn, nan, khung)',
  'Linh kiện thành phẩm - tấm/nan/mặt': 'Linh kiện thành phẩm (mặt bàn, nan, khung)',
  'Linh kiện thành phẩm - khác': 'Linh kiện thành phẩm (mặt bàn, nan, khung)',
  'Lót ghế - lót chèn': 'Lót - chèn - đệm lót ghế',
  'Nắp - chụp bịt': 'Khoá - tay nắm - ben hơi - nắp chụp',
  'Tay nắm - tay quay': 'Khoá - tay nắm - ben hơi - nắp chụp',
  'Ben hơi - giảm chấn': 'Khoá - tay nắm - ben hơi - nắp chụp',
  'Vòng bi - bạc đạn': 'Vòng bi - bạc đạn - gối đỡ',
  'Phụ kiện cơ khí - truyền động': 'Dây đai - xích - curoa - truyền động',
  'Ron - gioăng - phớt': 'Ron - gioăng - phớt',
  'Lô - trục cao su': 'Than - chổi than - trục - khớp',
  'Gòn - bông nhồi': 'Gòn - bông - xơ nhồi',
  'Nệm - đệm ghế': 'Nệm - đệm - gối',
  'Gối - đệm trang trí': 'Nệm - đệm - gối',
  'Sơn - dầu hoàn thiện gỗ': 'Sơn hoàn thiện gỗ - PU - lót',
  'Dung môi - hoá chất': 'Dung môi - hoá chất xử lý',
  'Hóa chất - phụ trợ': 'Dung môi - hoá chất xử lý',
  'Gỗ - ván nguyên liệu': 'Ván - gỗ nguyên liệu',
  'Chỉ may - phụ liệu may': 'Chỉ - thun - khoá kéo - phụ liệu may',
  'Thun - dây chun': 'Chỉ - thun - khoá kéo - phụ liệu may',
  'Vải nhập - bọc ngoài': 'Vải - da bọc',
  'Thẻ - nhãn cảnh báo': 'Tem - nhãn - thẻ - decal',
  'Tem - nhãn dán sản phẩm': 'Tem - nhãn - thẻ - decal',
  'Logo - nhãn dán': 'Tem - nhãn - thẻ - decal',
  'Mạc - nhãn mác': 'Tem - nhãn - thẻ - decal',
  'Băng keo các loại': 'Băng keo - dây đai - dây rút - pallet',
  'Thùng - bao bì đóng gói': 'Thùng carton',
  'Túi - bao bì': 'Bì - túi - bao - màng',
  'Góc nhựa - góc giấy bảo vệ': 'Tấm lót - chèn - góc bảo vệ',
}

/** nhóm chính → [[regex đầu tên (đã hạ chữ), nhãn phụ], …] — THỨ TỰ QUYẾT ĐỊNH. */
const RULES = {
  'Nhôm định hình - tấm': [
    [/^(dây nhôm|lưới nhôm|nhôm (dây|lưới))/, 'Nhôm khác (dây, lưới, phụ kiện nhôm)'],
    [/^(nhôm (hộp|vuông|chữ nhật)|hộp nhôm)/, 'Nhôm hộp vuông - chữ nhật'],
    [/^(nhôm (phi|ø|ф|ống|tròn)|ống nhôm)/, 'Nhôm ống tròn - phi'],
    [/^(nhôm (tấm|la)|la nhôm|tấm nhôm)/, 'Nhôm tấm - la'],
    [
      /^(nhôm (thanh|định hình|hợp kim|td|yh|hg|oval|tb)|thanh nhôm|nhôm [a-z]{0,3}-?[a-z]*\d)/,
      'Nhôm thanh định hình (profile)',
    ],
    [/^nhôm/, 'Nhôm khác (dây, lưới, phụ kiện nhôm)'],
  ],
  Inox: [
    [/^(inox (hộp|vuông)|hộp inox|ống vuông inox)/, 'Inox hộp - vuông'],
    [/^(inox (ống|ổng|phi|ø|tròn)|ống (tròn )?inox)/, 'Inox ống - phi'],
    [
      /^(inox (tấm|cuộn|lá|304|201)|dây inox|tấm inox|lưới inox)/,
      'Inox tấm - cuộn - dây',
    ],
  ],
  'Sắt thép - tôn - tấm': [
    [
      /^((thép|sắt) (hộp|vuông|chữ nhật)|hộp (sắt|kẽm|thép))/,
      'Thép hộp vuông - chữ nhật',
    ],
    [/^((thép|sắt) ống|ống )/, 'Ống thép - ống tôn - ống tròn'],
    [/^((sắt|thép) (phi|đặc|la|tròn|ø)|ty sắt|la sắt|ty )/, 'Sắt phi - đặc - la - ty'],
    [/^(tôn|tole|(thép|sắt) (tấm|lá))/, 'Tôn - thép tấm - thép lá'],
    [
      /^(thanh v|thanh nẹp|ray|thanh trượt|(thép|sắt) [vlu]\b)/,
      'Thanh V sắt - nẹp - ray',
    ],
    [/^(lưới|dây kẽm|dây mạ kẽm|thép không)/, 'Lưới - dây kẽm - thép không gỉ'],
    [/^(khung|xuyệt|cây)/, 'Khung - chi tiết sắt gia công sẵn'],
  ],
  'Bu lông - vít - đinh - liên kết': [
    [/^(bulon|bu lông|bulong|bl\b|tán|măng sông|eru|ê cu|ốc)/, 'Bu lông - tán'],
    [/^(vít|vis|viít)/, 'Vít các loại'],
    [/^(đinh|ghim|rive)/, 'Đinh - ghim - rive'],
    [/^(long đền|lông đền|lđn|lđs|lg\b|lgc)/, 'Long đền - lông đền'],
    [/^(ty ren|cây gai|chốt|kẹp|khoen|mắc cáo|móc|quai)/, 'Ty ren - chốt - kẹp - khoen'],
  ],
  'Phụ kiện nội thất': [
    [/^(pát|pat |bản lề|bát )/, 'Pát - bản lề - bát liên kết'],
    [/^nút/, 'Nút bịt chân'],
    [/^(gót|chân|đế )/, 'Gót - chân ghế - đế'],
    [/^(bánh xe|bánh |ray trượt)/, 'Bánh xe - ray trượt'],
    [/^(khóa|khoá|tay nắm|ben hơi|nắp|chụp)/, 'Khoá - tay nắm - ben hơi - nắp chụp'],
    [/^(lót ghế|lót chèn|lót )/, 'Lót - chèn - đệm lót ghế'],
    [/^(ắc|tăng đơ|đầu nối)/, 'Ắc - tăng đơ - đầu nối lắp ráp'],
    [
      /^(mặt bàn|nan |thanh |tấm |khung|đầu giường|tay vịn|tay ghế)/,
      'Linh kiện thành phẩm (mặt bàn, nan, khung)',
    ],
  ],
  'Cơ khí - vòng bi - khuôn': [
    [
      /^(dây đai|dây curoa|xích|nhông|bánh răng|puly|pu-ly|pulley)/,
      'Dây đai - xích - curoa - truyền động',
    ],
    [/^(bi |bạc đạn|vòng bi|gối )/, 'Vòng bi - bạc đạn - gối đỡ'],
    [/^(khuôn|đồ gá|chân khuôn)/, 'Khuôn - đồ gá - chi tiết khuôn'],
    [/^(lò xo|ty |chốt)/, 'Lò xo - ty - chốt máy'],
    [/^(ron|gioăng|phớt|sin )/, 'Ron - gioăng - phớt'],
    [/^(than|chổi than|trục|khớp)/, 'Than - chổi than - trục - khớp'],
    [/^(móc|dọc|diềm|viền|hộp)/, 'Chi tiết cơ khí khác'],
  ],
  'Máy móc - thiết bị': [
    [/^(quạt|bơm|máy nén|máy bơm)/, 'Quạt - bơm - máy nén'],
    [
      /^máy (khoan|mài|bắn|cắt|chà|vặn|bào|phay|đục|rút|tán|khò|siết|thổi)/,
      'Máy cầm tay (khoan, mài, bắn vít…)',
    ],
    [/^(tủ|thiết bị|cân )/, 'Tủ - thiết bị nhà xưởng'],
    [/^lọc/, 'Lọc - phụ tùng máy nén'],
    [/^(máy|motor|mô tơ|động cơ)/, 'Máy công nghiệp - động cơ'],
  ],
  'Dụng cụ cầm tay - lưỡi mũi - nhám': [
    [/^(nhám|giấy nhám|đá mài|bàn chải)/, 'Giấy nhám - vật tư chà nhám'],
    [/^(mũi|taro|típ)/, 'Mũi khoan - mũi taro - típ'],
    [/^(lưỡi|đĩa|mảnh|dao )/, 'Lưỡi - đĩa cắt - mảnh dao'],
    [/^đồng hồ/, 'Đồng hồ - thiết bị đo'],
    [
      /^(cà lê|cờ lê|kìm|thước|búa|tua vít|lục giác|kéo|dụng cụ|đầu khoan|đầu kẹp|bộ )/,
      'Dụng cụ cầm tay (cờ lê, kìm, thước, búa…)',
    ],
    // "mỏ lếch" là cờ lê — bảng gốc ghi "mỏ" ở nhóm lọc là nhầm, sửa khi chạy khô.
    [/^mỏ/, 'Dụng cụ cầm tay (cờ lê, kìm, thước, búa…)'],
    [/^(lọc|mực|cán)/, 'Lọc - vật tư bảo trì máy'],
  ],
  'Vật tư hàn - cắt': [
    [/^(que hàn|dây hàn|que )/, 'Que hàn - dây hàn'],
    [/^(khí|co2|argon|bình khí)/, 'Khí hàn - bình khí'],
    [/^(kính hàn|mặt nạ|đá cắt|nón hàn|mũ)/, 'Kính - bảo hộ hàn - đá cắt'],
    [/^(mỏ hàn|kẹp|súng|cáp|kim)/, 'Mỏ hàn - kẹp mát - súng - cáp hàn'],
    [/^(béc|sứ|ruột|đầu|cổ|chụp)/, 'Béc - sứ - ruột - phụ kiện súng hàn'],
  ],
  'Bao bì - đóng gói - tem nhãn': [
    [/^(thùng|bb )/, 'Thùng carton'],
    [/^(bì|túi|bao|màng|pe )/, 'Bì - túi - bao - màng'],
    [/^(tấm lót|lót|góc|thanh v giấy|xốp)/, 'Tấm lót - chèn - góc bảo vệ'],
    [/^(tem|nhãn|thẻ|thẽ|decal|barcode|logo|mạc|sm )/, 'Tem - nhãn - thẻ - decal'],
    [
      /^(băng keo|băng dán|dây đai|dây rút|dây cột|pallet|palet|bạt)/,
      'Băng keo - dây đai - dây rút - pallet',
    ],
    [/^(giấy|hộp|in )/, 'Giấy - hộp - in ấn'],
  ],
  'Mút - xốp - nệm - gòn': [
    [/^(mút|mousse|pu )/, 'Mút - mousse tấm'],
    [/^(xốp|foam)/, 'Xốp - foam cách nhiệt'],
    [/^(gòn|bông|xơ)/, 'Gòn - bông - xơ nhồi'],
    [/^(nệm|đệm|gối)/, 'Nệm - đệm - gối'],
  ],
  'Vải - da - chỉ - phụ liệu may': [
    [/^(vải|da |nỉ|oshibo|simili)/, 'Vải - da bọc'],
    [
      /^(chỉ|thun|dây kéo|khuy|nút áo|khoá kéo|khóa kéo|dây nhuộm|phụ liệu)/,
      'Chỉ - thun - khoá kéo - phụ liệu may',
    ],
  ],
  'Dây mây - vật liệu đan': [
    [
      /^(dây mây|dây nhựa|dây đan|mây|sợi đan|dây rỗng|dây dẹp|dây cói)/,
      'Dây mây nhựa - dây đan',
    ],
    [/^(dây dù|dây pe|cước|lưới|nan)/, 'Dây dù - dây PE - cước - lưới'],
  ],
  'Sơn - keo - hoá chất': [
    [/^(bột sơn|sơn tĩnh điện|sơn bột)/, 'Sơn tĩnh điện - bột sơn'],
    [
      /^(sơn (pu|lót|bóng|gỗ|nc|dầu|durva|durlac)|lăn|cọ)/,
      'Sơn hoàn thiện gỗ - PU - lót',
    ],
    [/^(keo|silicon|băng che)/, 'Keo - chất kết dính'],
    [
      /^(dung môi|hoá chất|hóa chất|chất|tẩy|xăng|lọc sơn|axit|acid|soda|xút)/,
      'Dung môi - hoá chất xử lý',
    ],
    [/^sơn/, 'Sơn khác (sắt, nhũ, dầu…)'],
  ],
  'Dầu - nhớt - mỡ bôi trơn': [
    [/^(mỡ|grease)/, 'Mỡ bôi trơn'],
    [/^(nhớt|dầu)/, 'Nhớt - dầu công nghiệp'],
  ],
  'Gỗ - ván - chi tiết gỗ mua ngoài': [
    [/^phần/, 'Chi tiết gỗ mua ngoài theo SP'],
    [/^(ván|gỗ|mdf|plywood|okal|veneer)/, 'Ván - gỗ nguyên liệu'],
  ],
  'Kính - mica - nhựa tấm': [
    [/(nhựa giả gỗ|polywood|^thanh nhựa|nan nhựa)/, 'Nhựa giả gỗ - polywood'],
    [/^kính/, 'Kính'],
    [/^(mica|tấm nhựa|nhựa|pc |acrylic|composite)/, 'Mica - nhựa tấm - PC'],
  ],
  'Dịch vụ - gia công - vận chuyển': [
    [/^(gia công|công |thuê|nhân công)/, 'Gia công ngoài (sơn, mạ, uốn, cắt laser)'],
    [/^(vận chuyển|vc |bốc xếp|cước)/, 'Vận chuyển - bốc xếp - cước'],
    [/^(phí|chi phí|dịch vụ)/, 'Phí - chi phí khác'],
  ],
}

function decide(m) {
  const rules = RULES[m.group_name]
  if (!rules) return undefined // nhóm không trong phạm vi
  const n = String(m.name ?? '')
    .normalize('NFC')
    .toLowerCase()
  for (const [re, sub] of rules) if (re.test(n)) return sub
  if (m.sub_group && ALIAS[m.sub_group]) return ALIAS[m.sub_group]
  if (m.sub_group && STALE.has(m.sub_group)) return null
  return m.sub_group ?? null
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
  const all = await fetchAll(sb)

  const changes = []
  const after = new Map() // group → Map(sub → n)
  for (const m of all) {
    const next = decide(m)
    if (next === undefined) continue
    const g = after.get(m.group_name) ?? new Map()
    g.set(next ?? '(trống)', (g.get(next ?? '(trống)') ?? 0) + 1)
    after.set(m.group_name, g)
    if ((next ?? null) !== (m.sub_group ?? null)) changes.push({ ...m, to: next })
  }

  for (const [group, subs] of after) {
    const rows = changes.filter((c) => c.group_name === group)
    console.log(`\n${group} — ${rows.length} mã đổi nhãn`)
    for (const [sub, n] of [...subs].sort((a, b) => b[1] - a[1]))
      console.log(`   ${String(n).padStart(5)}  ${sub}`)
    // Các cặp cũ→mới lớn nhất để soi
    const pairs = new Map()
    for (const c of rows) {
      const k = `${c.sub_group ?? '(trống)'} → ${c.to ?? '(trống)'}`
      if (!pairs.has(k)) pairs.set(k, [])
      pairs.get(k).push(c)
    }
    for (const [k, list] of [...pairs]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6))
      console.log(`       ${String(list.length).padStart(4)}  ${k}   vd: ${list[0].name}`)
  }
  const cleared = changes.filter((c) => c.to === null).length
  console.log(
    `\nTổng: ${changes.length} mã đổi nhãn phụ (${cleared} mã về trống) · ${all.length} mã active`,
  )

  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const bk = new URL(`../backups/materials-subgroup-dot3-${stamp}.json`, import.meta.url)
  writeFileSync(bk, JSON.stringify({ changes }, null, 1))
  console.log(`\nĐã sao lưu ${bk.pathname}`)

  let done = 0
  for (const [to, rows] of Object.entries(Object.groupBy(changes, (c) => c.to ?? ''))) {
    for (const part of chunk(rows, 200)) {
      const { error } = await sb
        .from('warehouse_materials')
        .update({ sub_group: to || null })
        .in(
          'id',
          part.map((r) => r.id),
        )
      if (error) throw new Error(`update ${to}: ${error.message}`)
      const { error: ae } = await sb.from('warehouse_material_changes').insert(
        part.map((r) => ({
          material_id: r.id,
          material_code: r.code,
          field: 'sub_group',
          before_value: r.sub_group,
          after_value: to || null,
          actor_id: null,
          source: 'import',
          source_ref: SOURCE_REF,
        })),
      )
      if (ae) throw new Error(`audit ${to}: ${ae.message}`)
      done += part.length
      console.log(`  ${done}/${changes.length}`)
    }
  }
  console.log('\nXong.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

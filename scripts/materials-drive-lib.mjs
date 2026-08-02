// Chuẩn hoá dữ liệu bóc từ bộ sổ vật tư của phòng Cung ứng (Google Drive).
// Dùng chung cho bước BÓC và bước NHẬP — hai bên lệch nhau là ĐVT trong ảnh
// chụp khác ĐVT ghi vào DB, mà lệch kiểu đó chỉ lộ ra sau nhiều tháng.

/**
 * ĐVT chuẩn ← các cách viết đã gặp trong sổ. Bảng duyệt: docs/dvt-chuan-hoa.md
 * (131 cách viết → 55 nhãn).
 *
 * CHỈ gộp khi NGHĨA KHÔNG ĐỔI: hoa/thường, thiếu dấu, sai chính tả rõ ràng.
 * Không gộp hai đơn vị khác nghĩa dù gần giống — "vòng" (nhám vòng) khác
 * "cuộn", "mũi" (mũi khoan) khác "cái"; gộp là mất thông tin đặt hàng.
 */
export const UNIT_MAP = [
  ['Cái', ['cái', 'caí', 'cai']],
  ['Chiếc', ['chiếc']],
  ['Kg', ['kg', 'Ký']],
  ['Con', ['con']],
  ['Tấm', ['tấm', 'tam']],
  ['Bộ', ['bộ', 'bô', 'Set']],
  ['Mét', ['mét', 'm', 'met']],
  ['M²', ['m2']],
  ['M³', ['m3']],
  ['Thùng', ['thùng']],
  ['Cây', ['cây']],
  ['Cuộn', ['cuộn']],
  ['Dây', ['dây']],
  ['Vòng', ['vòng']],
  ['Lon', ['lon']],
  ['Mũi', ['mũi']],
  ['Hộp', ['hộp']],
  ['Ổ', ['ổ']],
  ['Tờ', ['tờ']],
  ['Nhãn', ['nhãn', 'Nhan']],
  ['Thanh', ['thanh']],
  ['Viên', ['viên', 'VIên']],
  ['Chai', ['chai']],
  ['Bì', ['bì', 'BÌ']],
  ['Sợi', ['sợi']],
  ['Lít', ['lít', 'lit']],
  ['Can', ['can']],
  ['PCS', ['pcs']],
  ['Vỉ', ['vỉ', 'vĩ', 'vi']],
  ['Lô', ['lô']],
  ['Cặp', ['cặp']],
  ['Đôi', ['đôi']],
  ['Ống', ['ống']],
  ['Bó', ['bó']],
  ['Xô', ['xô']],
  ['Phuy', ['phi']],
  ['Thẻ', ['thẻ']],
  ['Khúc', ['khúc']],
  ['Cục', ['cục']],
  ['Bình', ['bình']],
  ['Lưỡi', ['lưỡi']],
  ['Miếng', ['miếng']],
  ['Bịch', ['bịch']],
  ['Tem', ['tem']],
  ['Túi', ['túi']],
  ['Bánh', ['bánh']],
  ['Hột', ['hột']],
  ['Lá', ['lá']],
  ['Chụp', ['chụp']],
  ['Yard', ['YARD', 'YDS']],
  ['Inch', ['inch']],
  ['Quyển', ['quyển', 'sổ']],
  ['Bao', ['bao']],
  ['Lọ', ['lọ']],
  ['Lố', ['lố']],
]

const CANON = new Map()
for (const [c, vs] of UNIT_MAP)
  for (const v of [c, ...vs]) CANON.set(v.toLowerCase().normalize('NFC'), c)

/** Đơn vị viết kèm quy cách — tách phần dung tích sang `spec`. */
const SPEC_UNIT = {
  'Thùng 18 lit': ['Thùng', '18 lít'],
  'Thùng 9L': ['Thùng', '9 lít'],
  'lon/1kg': ['Lon', '1 kg'],
  '5KG/T': ['Thùng', '5 kg'],
}

/** → { unit, spec } hoặc null nếu không nhận ra (không đoán). */
export function normUnit(raw) {
  const u = String(raw ?? '').trim()
  const hit = CANON.get(u.toLowerCase().normalize('NFC'))
  if (hit) return { unit: hit, spec: null }
  if (SPEC_UNIT[u]) return { unit: SPEC_UNIT[u][0], spec: SPEC_UNIT[u][1] }
  return null
}

/**
 * Dòng DỊCH VỤ / PHÍ — sổ để lẫn cước vận chuyển, phí kiểm định, phí phát triển
 * khuôn, đại tu máy vào cùng danh mục vật tư. Nhập vào là sinh ra "mặt hàng tồn
 * kho" tên "Cước vận chuyển kính" mà Kho không bao giờ nhập/xuất được.
 */
export function isService(name, unit) {
  return (
    /^(phí|cước|vận chuyển|đại tu)\b/i.test(String(name).trim()) ||
    ['lần', 'chuyến', 'báo cáo', 'bill', "cont 20'", 'cont', 'CNT', 'Máy', 'bo'].includes(
      String(unit).trim(),
    )
  )
}

/**
 * MẪU ĐƠN GÁN THEO TÊN TỪNG MÓN; nhóm phụ chỉ là chỗ dựa cuối.
 *
 * Bản đầu gán theo nhóm phụ và sai nặng: cụm "Nhôm - thanh & tấm" của sổ có 548
 * dòng nhưng chỉ 180 là nhôm cây/tấm thật — 317 dòng chữ "nhôm" chỉ bổ nghĩa
 * (Cromate nhôm là hoá chất, Dây hàn mig nhôm là vật tư hàn, Cân treo nhôm
 * 150kg là cái cân), 51 dòng không phải nhôm (Đồng thanh, Thép hộp mạ kẽm). Gán
 * cả cụm thành `aluminium` là 2/3 mang bộ cột kg/m × dài cây mà chẳng liên quan.
 *
 * `derivedKg` = kg/m máy đọc được từ tên. Mẫu `aluminium` CHỈ gán khi có số này:
 * thiếu kg/m thì `lineReady` chặn không cho gửi dòng, người soạn đơn bị kẹt rồi
 * gõ đại. Không barem thì để `simple` — SL × giá vẫn đúng nghiệp vụ.
 */
export function templateFor(sub, name = '', derivedKg = null) {
  const n = String(name).toLowerCase()
  const s = String(sub ?? '').toLowerCase()

  // Hoá chất / sơn / dầu mỡ / keo — "nhôm" trong tên chỉ là đối tượng xử lý.
  if (/cromate|thụ động|hoá chất|hóa chất|dung môi|sơn |dầu |nhớt|mỡ |keo /.test(n))
    return 'simple'
  // Vật tư hàn: dây hàn nhôm vẫn là dây hàn, bán theo cuộn/kg.
  if (/dây hàn|que hàn|đá cắt|đá mài|béc |chụp khí/.test(n)) return 'simple'

  /*
   * NGŨ KIM XÉT TRƯỚC VẬT LIỆU. "Bu lông LGC 6x20x15 sắt xi 7 màu" có chữ "sắt"
   * và có tiết diện, nhưng "sắt xi" là lớp mạ chứ không phải mặt hàng sắt cây —
   * xét vật liệu trước thì 89 con bu lông mang mẫu metal_kg, tức bị đòi khai
   * kg/đơn-vị mới gửi được đơn, trong khi NCC chào theo con.
   */
  if (
    /vít|bu ?lon|bu ?lông|tán |đinh |lđn|lđs|long đền|lông đền|pát|pat |ty ren|ty sắt|\beru\b|chốt |ốc /.test(
      n,
    )
  )
    return 'accessory'
  if (/^thùng\b|carton/.test(n)) return 'carton'
  if (/\btem\b|nhãn|thẻ treo|logo|mạc |góc nhựa|góc giấy/.test(n)) return 'accessory'
  if (/nút nhựa|bánh xe|gót chân|bịt chân|nắp bịt|tay nắm|bản lề|khoá |khóa /.test(n))
    return 'accessory'

  const tietDien = /\d+\s*[x×]\s*\d+|phi\s*\d+|\bd\d+\b/.test(n)
  if (/^\s*nh[ôo]m\b/.test(n) && tietDien) return derivedKg ? 'aluminium' : 'simple'
  if (/\b(thép|sắt|inox|tôn|kẽm)\b/.test(n) && tietDien) return 'metal_kg'

  // Hết đường suy từ tên thì mới nhìn nhóm phụ.
  if (/bulon|vít|đinh|lông đền|kẹp|chốt/.test(s)) return 'accessory'
  if (/tem|nhãn|thẻ|logo|mạc/.test(s)) return 'accessory'
  if (/nút nhựa|bánh xe|gót chân|lót ghế|nắp|tay nắm/.test(s)) return 'accessory'
  return 'simple'
}

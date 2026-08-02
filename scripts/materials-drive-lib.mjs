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
 * MẪU ĐƠN GÁN THEO NHÓM PHỤ, không theo nhóm chính.
 * Nhóm "Sắt thép - inox - nhôm - tôn" chứa cả 542 mã nhôm lẫn 1.613 mã sắt —
 * gán chung một mẫu là sai bộ cột cho một nửa danh mục.
 */
export function templateFor(sub) {
  const s = String(sub ?? '').toLowerCase()
  if (s.includes('nhôm')) return 'aluminium'
  if (/sắt|inox|thép/.test(s)) return 'metal_kg'
  if (s.startsWith('thùng')) return 'carton'
  if (/tem|nhãn|thẻ|logo|mạc|góc nhựa/.test(s)) return 'accessory'
  if (/bulon|vít|đinh|lông đền|ty|móc|mắc cáo|vòng|kẹp|chốt|ốc/.test(s))
    return 'accessory'
  if (/nút nhựa|bánh xe|gót chân|lót|nắp|tay nắm|ben hơi|nẹp|phụ kiện nội thất/.test(s))
    return 'accessory'
  return 'simple'
}

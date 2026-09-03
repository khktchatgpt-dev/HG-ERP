import { normalizeSearch } from './search-text'

/**
 * TỰ CẤP MÃ NHÀ CUNG CẤP TỪ TÊN — thuần, không đụng DB (03/09/2026).
 *
 * Đo trên danh mục thật: 157 NCC thì 120 KHÔNG có mã, và 37 mã đang có đều theo
 * cùng một nếp do người dùng tự đặt — chữ cái đầu của phần TÊN RIÊNG, bỏ hết
 * phần pháp lý/ngành nghề:
 *
 *   CÔNG TY TNHH TM VÀ DỊCH VỤ ÂN HOÀN PHÁT      → AHP
 *   CÔNG TY TNHH SX TM TH AN THÀNH PHÁT          → ATP
 *   CÔNG TY TNHH XUẤT NHẬP KHẨU CÁT TƯỜNG        → CT
 *   Công ty TNHH thương mại sản xuất Hào Tư Hùng → HTH
 *   ALANMI                                        → ALA   (một từ: ba chữ đầu)
 *
 * Nên máy cấp mã theo ĐÚNG nếp đó chứ không đẻ ra khuôn thứ hai kiểu "NCC-0001":
 * mã NCC là thứ người mua đọc và gọi tên trong câu chuyện hằng ngày, một bảng mã
 * vô nghĩa sẽ bị bỏ qua y như 120 ô trống hiện giờ.
 *
 * Trùng thì nối số: ATP, ATP2, ATP3… — vẫn đọc được, vẫn ngắn.
 */

/**
 * CỤM TỪ pháp lý / ngành nghề — bỏ THEO CỤM chứ không theo từ lẻ.
 *
 * Bỏ từ lẻ là hỏng: "cổ phần" và "cơ khí" cùng bỏ dấu thành "co", nên một
 * danh sách từ lẻ sẽ nuốt luôn chữ đầu của "Cơ khí Xây dựng Đại Việt".
 */
const PHRASES = [
  'cong ty',
  'co phan',
  'trach nhiem huu han',
  'mot thanh vien',
  'san xuat',
  'thuong mai',
  'dich vu',
  'xuat nhap khau',
  'tong hop',
  'doanh nghiep tu nhan',
  'doanh nghiep',
  'tap doan',
  'nha may',
  'chi nhanh',
  'cua hang',
  'co so',
  'dau tu',
  'phat trien',
]

/** Từ viết tắt đứng lẻ — an toàn vì không trùng với tên riêng nào. */
const ABBR = new Set([
  'tnhh',
  'cty',
  'mtv',
  'cp',
  'ctcp',
  'dn',
  'sx',
  'tm',
  'dv',
  'tmdv',
  'xnk',
  'th',
  'va',
  'and',
  'ltd',
  'jsc',
  'corp',
  'company',
  'group',
  // KHÔNG có 'co': "cổ phần" đã bỏ theo cụm, còn "cơ khí" thì "cơ" là tên riêng.
])
/** Mã gợi ý cho tên này, CHƯA xét trùng. '' nếu tên không có chữ nào dùng được. */
export function supplierCodeFrom(name: string): string {
  const flat = normalizeSearch(name)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Bỏ CỤM trước, rồi mới tới từ viết tắt đứng lẻ.
  let rest = flat
  for (const ph of PHRASES) rest = rest.replaceAll(ph, ' ')
  const words = flat.split(/\s+/).filter(Boolean)
  const core = rest.split(/\s+/).filter((w) => w && !ABBR.has(w))
  // Toàn từ pháp lý (vd "Công ty TNHH") thì đành lấy nguyên tên — thà mã xấu
  // còn hơn không có mã.
  const use = core.length > 0 ? core : words
  if (use.length === 0) return ''
  if (use.length === 1) return use[0].slice(0, 3).toUpperCase()
  // Nhiều từ: chữ cái đầu, tối đa 4 — "Đức Toàn Phú Tài" → DTPT, dài hơn thì cắt.
  return use
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * Mã CHƯA AI DÙNG cho tên này. `taken` là các mã đang có (so không phân biệt
 * hoa/thường vì cột `code` unique theo đúng chuỗi, nhưng người đọc thì không).
 */
export function nextSupplierCode(name: string, taken: Iterable<string>): string {
  const base = supplierCodeFrom(name)
  if (!base) return ''
  const used = new Set([...taken].map((c) => c.trim().toUpperCase()).filter(Boolean))
  if (!used.has(base)) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}${i}`
    if (!used.has(candidate)) return candidate
  }
  return ''
}

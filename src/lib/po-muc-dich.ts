/**
 * MỤC ĐÍCH CỦA ĐƠN MUA NGOÀI LỆNH (0229, 11/10/2026) — logic thuần, client dùng được.
 *
 * Đơn không gắn lệnh từng chỉ có một nhãn "Ngoài lệnh (mua bù tồn)". Đo 11/10:
 * 7/147 đơn ngoài lệnh, KHÔNG đơn nào là bù tồn thuần — lý do thật nằm trong
 * ghi chú hoặc bị dán vào tên dòng hàng. Chủ dự án: "rất nhiều loại ngoài lsx"
 * → gõ tự do kèm gợi ý, không danh mục cố định (khớp luật "nhãn nội bộ dùng
 * text + gợi ý"). Gợi ý = loại đã dùng (nhiều trước) + vài loại mồi, nên chữ
 * của mọi người tự hội tụ về một cách viết và nhóm/đếm được.
 */

/** Loại mồi — có trước khi ai gõ gì. Hai loại đầu lấy từ chính 7 đơn đã có. */
export const MUC_DICH_MOI = [
  'Đơn khách chưa ra lệnh',
  'Lệnh cũ ngoài hệ thống',
  'Dự trữ kho',
  'Khuôn mẫu',
  'Hàng mẫu · chạy thử',
  'Bảo trì · sửa chữa máy',
  'Công cụ · dụng cụ',
  'Bảo hộ lao động',
  'Văn phòng phẩm',
  'Sửa chữa nhà xưởng',
] as const

/** Gọn khoảng trắng + viết hoa chữ đầu — "  khuôn   mẫu" và "Khuôn mẫu" là một. */
export function chuanMucDich(s: string | null | undefined): string | null {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.charAt(0).toLocaleUpperCase('vi') + t.slice(1)
}

/** Khoá so trùng: không phân biệt hoa thường, GIỮ dấu ("Mẫu" ≠ "Mau" là hai chữ khác). */
const khoa = (s: string) => s.normalize('NFC').toLocaleLowerCase('vi')

/**
 * Danh sách gợi ý: loại đã dùng (nhiều đơn trước, rồi theo chữ cái) rồi tới loại
 * mồi chưa ai dùng. Trùng khoá thì giữ cách viết của loại đã dùng nhiều nhất.
 */
export function goiYMucDich(daDung: readonly (string | null | undefined)[]): string[] {
  const dem = new Map<string, { nhan: string; n: number }>()
  for (const x of daDung) {
    const t = chuanMucDich(x)
    if (!t) continue
    const k = khoa(t)
    const cur = dem.get(k)
    if (cur) cur.n++
    else dem.set(k, { nhan: t, n: 1 })
  }
  const out = [...dem.values()]
    .sort((a, b) => b.n - a.n || a.nhan.localeCompare(b.nhan, 'vi'))
    .map((x) => x.nhan)
  for (const m of MUC_DICH_MOI) if (!dem.has(khoa(m))) out.push(m)
  return out
}

/** Đơn ngoài lệnh nhìn từ ngoài: hạng mục (0230), hoặc chữ mục đích cũ (0229). */
type DonNgoai = {
  project_code?: string | null
  project_name?: string | null
  standalone_purpose?: string | null
  standalone_ref?: string | null
}

/**
 * Nhãn ở mọi chỗ trước đây ghi "Ngoài lệnh": "HM-2026-0004 · Dự trữ kho".
 * Đơn cũ chưa gắn hạng mục rơi về chữ mục đích 0229, rồi "Ngoài lệnh" trần.
 */
export function nhanNgoaiLenh(p: DonNgoai): string {
  if (p.project_code) return `${p.project_code} · ${p.project_name ?? ''}`.trim()
  return ['Ngoài lệnh', p.standalone_purpose?.trim(), p.standalone_ref?.trim()]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Chia đơn ngoài lệnh theo HẠNG MỤC — mỗi hạng mục một nhóm ở danh sách Đơn mua,
 * nhiều đơn trước. Đơn chưa gắn hạng mục gom vào "chưa chọn hạng mục".
 */
export function nhomTheoHangMuc<T extends DonNgoai>(pos: readonly T[]): [string, T[]][] {
  const m = new Map<string, { nhan: string; pos: T[] }>()
  for (const p of pos) {
    const nhan = p.project_code ? nhanNgoaiLenh(p) : 'chưa chọn hạng mục'
    const cur = m.get(nhan) ?? { nhan, pos: [] }
    cur.pos.push(p)
    m.set(nhan, cur)
  }
  return [...m.values()]
    .sort((a, b) => b.pos.length - a.pos.length || a.nhan.localeCompare(b.nhan, 'vi'))
    .map((x) => [x.nhan, x.pos])
}

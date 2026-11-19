import { chuan } from './dan-so'

/**
 * FILE MẪU NHẬP LIỆU THEO LỆNH (bản vẽ v2, 19/11/2026) — phần thuần.
 * Mỗi tờ = một công đoạn; mỗi hàng = (mã SP × cụm × chi tiết đại diện) GỘP qua các đợt giao của
 * mã đó (như tờ Excel của chị Loan và Sổ công đoạn). Tải lên chia số vào các đợt theo thứ tự.
 */

export type MauDongRaw = {
  ma: string
  ten_sp: string | null
  cum: string | null
  ten: string
  ct_sp: number
  can: number
  da_lam: number
  /** ISO ngày → số đã ghi (trong khoảng ngày của file). */
  o: Record<string, number>
  thu_tu: number
}

export type MauDong = MauDongRaw

/** Gộp các hàng cùng (mã, cụm, tên) của nhiều đợt: cộng Cần / Đã làm / số từng ngày. */
export function gopDongMau(raw: MauDongRaw[]): MauDong[] {
  const g = new Map<string, MauDong>()
  for (const r of raw) {
    const k = `${chuan(r.ma)}|${chuan(r.cum ?? '')}|${chuan(r.ten)}`
    const c = g.get(k)
    if (!c) {
      g.set(k, { ...r, o: { ...r.o } })
      continue
    }
    c.can += r.can
    c.da_lam += r.da_lam
    c.thu_tu = Math.min(c.thu_tu, r.thu_tu)
    for (const [iso, q] of Object.entries(r.o)) c.o[iso] = (c.o[iso] ?? 0) + q
  }
  const vi = (a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true })
  return [...g.values()].sort(
    (a, b) => vi(a.ma, b.ma) || a.thu_tu - b.thu_tu || vi(a.ten, b.ten),
  )
}

const homNay = (iso: string, d: number) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

/** Các ngày từ `tu` tới `den` (gồm hai đầu), tối đa `toiDa` ngày — giữ phần gần `den`. */
export function ngayTuDen(tu: string, den: string, toiDa = 31): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den) || tu > den)
    return []
  const out: string[] = []
  for (let d = tu; d <= den; d = homNay(d, 1)) out.push(d)
  return out.slice(-toiDa)
}

/** Mặc định: 7 ngày tới hôm nay. */
export function khoangMacDinh(today: string, soNgay = 7): { tu: string; den: string } {
  return { tu: homNay(today, -(soNgay - 1)), den: today }
}

/** Tên tờ Excel: bỏ ký tự cấm, ≤ 31 ký tự, không trùng. */
export function tenTo(raw: string, dung: Set<string>): string {
  const base =
    raw
      .replace(/[\/?*[\]:]/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, 31) || 'TỜ'
  let n = base
  for (let i = 2; dung.has(n); i++) n = `${base.slice(0, 28)} ${i}`
  dung.add(n)
  return n
}

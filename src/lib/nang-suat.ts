/**
 * NĂNG SUẤT (bản vẽ 11/11/2026 https://claude.ai/artifact/LocfQfiJSjv6Sxc8a9KQ6N
 * tab 3, Q2 + Q5 duyệt) — "Công đoạn, tổ nào chậm so với định mức? Ngày nào tụt?"
 *
 * Năng suất = Σ kg ÷ Σ giờ công — KHÔNG lấy trung bình của các dòng / các ngày.
 * Giờ công thuộc PHIẾU (tổ × ngày × ca × công đoạn, 0296), kg thuộc DÒNG sổ: sổ
 * Excel chép giờ lên từng dòng nên một ngày Sơn ra 2.716 giờ — lỗi đó không
 * được lặp ở đây, mỗi phiếu cộng giờ ĐÚNG MỘT LẦN.
 *
 * Phiếu không có giờ công (ghi trước 0296) vẫn vào kg và số lượng, nhưng KHÔNG
 * vào năng suất: `kg_ns` là kg của riêng các phiếu có giờ, năng suất = kg_ns ÷
 * giờ. Màn nói ra có bao nhiêu phiếu như thế.
 *
 * Thuần, không chạm DB. Có test.
 */

export type NsPhieu = {
  id: string
  entry_date: string
  stage: string
  team_id: string | null
  /** Giờ công đầu phiếu = số CN × giờ / người; null = phiếu không ghi giờ. */
  labor_hours: number | null
}

/** Một dòng sổ của phiếu. `kg` = kg đã chốt lúc ghi (gõ tay hoặc ĐM × SL); null = thiếu ĐM. */
export type NsDong = { doc_id: string | null; qty: number; kg: number | null }

export type NsO = {
  kg: number
  /** Số lượng đạt — đơn vị theo công đoạn (chi tiết / cụm / bộ), không cộng dọc. */
  qty: number
  hours: number
  /** Kg của các phiếu CÓ giờ công — tử số của năng suất. */
  kg_ns: number
  docs: number
  /** kg ÷ giờ (1 số lẻ); null khi không có giờ hoặc không có kg. */
  ns: number | null
}

export type NsHang = NsO & {
  key: string
  by_day: NsO[]
  /** Dòng có số đạt mà không có kg (chi tiết chưa có ĐM kg) — năng suất kg chưa gồm chúng. */
  missing_kg: number
  /** Phiếu không ghi giờ công — vào kg, không vào năng suất. */
  no_hours: number
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

function rong(): NsO {
  return { kg: 0, qty: 0, hours: 0, kg_ns: 0, docs: 0, ns: null }
}

/** Năng suất kg / giờ-người; không giờ hoặc không kg → null (không bịa số 0). */
export function nangSuat(kgNs: number, hours: number): number | null {
  return hours > 0 && kgNs > 0 ? r1(kgNs / hours) : null
}

function chot(o: NsO): NsO {
  return {
    ...o,
    kg: r2(o.kg),
    kg_ns: r2(o.kg_ns),
    hours: r2(o.hours),
    ns: nangSuat(o.kg_ns, o.hours),
  }
}

/**
 * Gom phiếu + dòng theo khoá (`keyOf` — công đoạn, hoặc tổ) và theo ngày của kỳ.
 * Phiếu ngoài kỳ bị bỏ; dòng không thuộc phiếu nào trong danh sách bị bỏ.
 */
export function gomNangSuat(
  phieu: NsPhieu[],
  dong: NsDong[],
  days: string[],
  keyOf: (p: NsPhieu) => string,
): { rows: NsHang[]; total: NsHang } {
  const dayIdx = new Map(days.map((d, i) => [d, i]))
  const docById = new Map(
    phieu.filter((p) => dayIdx.has(p.entry_date)).map((p) => [p.id, p]),
  )
  const kgOfDoc = new Map<string, { kg: number; qty: number; missing: number }>()
  for (const l of dong) {
    if (!l.doc_id || !docById.has(l.doc_id)) continue
    const x = kgOfDoc.get(l.doc_id) ?? { kg: 0, qty: 0, missing: 0 }
    x.qty += l.qty
    if (l.kg != null) x.kg += l.kg
    else if (l.qty > 0) x.missing++
    kgOfDoc.set(l.doc_id, x)
  }

  const moi = (key: string): NsHang => ({
    ...rong(),
    key,
    by_day: days.map(() => rong()),
    missing_kg: 0,
    no_hours: 0,
  })
  const rows = new Map<string, NsHang>()
  const total = moi('*')
  const cong = (
    h: NsHang,
    i: number,
    p: NsPhieu,
    x: { kg: number; qty: number; missing: number },
  ) => {
    const hours = p.labor_hours != null && p.labor_hours > 0 ? p.labor_hours : 0
    for (const o of [h, h.by_day[i]]) {
      o.kg += x.kg
      o.qty += x.qty
      o.docs += 1
      if (hours > 0) {
        o.hours += hours
        o.kg_ns += x.kg
      }
    }
    h.missing_kg += x.missing
    if (hours === 0) h.no_hours += 1
  }
  for (const p of docById.values()) {
    const x = kgOfDoc.get(p.id) ?? { kg: 0, qty: 0, missing: 0 }
    const i = dayIdx.get(p.entry_date)!
    const k = keyOf(p)
    let h = rows.get(k)
    if (!h) rows.set(k, (h = moi(k)))
    cong(h, i, p, x)
    cong(total, i, p, x)
  }
  const xong = (h: NsHang): NsHang => ({ ...h, ...chot(h), by_day: h.by_day.map(chot) })
  return { rows: [...rows.values()].map(xong), total: xong(total) }
}

/** Tỉ lệ so định mức; null khi chưa đặt ĐM hoặc chưa có năng suất. */
export function soDinhMuc(ns: number | null, dm: number | null): number | null {
  return ns != null && dm != null && dm > 0 ? ns / dm : null
}

/** Ngưỡng tô "dưới định mức" (bản vẽ: cam = dưới 80% ĐM). */
export const NGUONG_THAP = 0.8

/** Kỳ cho phép trên màn (ngày, tính lùi từ hôm nay). */
export const KY_NGAY = [7, 14, 30] as const
export type KyNgay = (typeof KY_NGAY)[number]

export function parseKy(raw: string | null | undefined): KyNgay {
  const n = Number(raw)
  return (KY_NGAY as readonly number[]).includes(n) ? (n as KyNgay) : 14
}

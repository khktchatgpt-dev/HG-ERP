/**
 * LỌC + CHIA TRANG cho Theo dõi đơn hàng (Đang về · Đã về) — 02/10/2026, bản vẽ
 * I1–I4 canvas "Cung ứng · Hàng về" › Bản 6 (chủ dự án duyệt, thêm: vừa một màn
 * không cuộn + phân trang + đơn nào cũng hiện người phụ trách).
 *
 * Logic thuần, không chạm DB — hai màn dùng chung, có test.
 */

/** Giá trị "mọi …" của các ô lọc. */
export const MOI = 'all'
/** Lệnh = đơn không gắn lệnh sản xuất. */
export const NGOAI_LENH = '@ngoai'

/** Đếm theo một trục, nhiều trước — cho nhãn "06/26-27 - MX · 15 đơn". */
export function demTheo<R>(
  rows: R[],
  keyOf: (r: R) => string | null,
): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = keyOf(r)
    if (k == null) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
}

/** Khớp ô Lệnh: MOI · NGOAI_LENH · đúng mã lệnh. */
export function khopLenh(lsx: string | null, loc: string): boolean {
  if (loc === MOI) return true
  if (loc === NGOAI_LENH) return lsx == null
  return lsx === loc
}

/**
 * Bỏ tiền tố pháp nhân để tên NCC vừa cột: "CÔNG TY TNHH SX & TM TƯỜNG NGUYÊN"
 * → "SX & TM TƯỜNG NGUYÊN". Tên đầy đủ vẫn ở tooltip.
 */
export function tenNccGon(name: string): string {
  const gon = name.replace(/^\s*(công\s*ty|cty)\s+(tnhh|cổ\s*phần|cp)?\s*/i, '').trim()
  return gon || name
}

/* ── CHIA TRANG CÓ NHÓM ─────────────────────────────────────────────────── */

export type Nhom<R> = { key: string; ten: string; meta?: string; rows: R[] }
export type Muc<R> =
  | { kind: 'nhom'; key: string; ten: string; meta?: string; n: number; tiep: boolean }
  | { kind: 'dong'; row: R }

/**
 * Chia các nhóm (tiêu đề nhóm + dòng) thành trang, mỗi trang ≤ `cap` mục —
 * `cap` = số dòng vừa vùng bảng đo được, nên không trang nào phải cuộn.
 *
 * Tiêu đề nhóm cũng là một dòng trên màn nên tính vào `cap`. Trang mở đầu
 * GIỮA một nhóm thì lặp lại tiêu đề nhóm (`tiep: true` — "Quá hẹn (tiếp)"):
 * không có nó, người đọc trang 2 không biết các dòng đầu thuộc mốc nào.
 * Không để tiêu đề nhóm nằm trơ ở CUỐI trang (dòng của nó sang trang sau).
 */
export function chiaTrang<R>(nhom: Nhom<R>[], cap: number): Muc<R>[][] {
  const c = Math.max(2, Math.floor(cap))
  const trang: Muc<R>[][] = []
  let cur: Muc<R>[] = []
  const day = () => {
    if (cur.length) trang.push(cur)
    cur = []
  }
  for (const g of nhom) {
    const tieuDe = (tiep: boolean): Muc<R> => ({ kind: 'nhom', key: g.key, ten: g.ten, meta: g.meta, n: g.rows.length, tiep }) // prettier-ignore
    // Chỉ còn chỗ cho tiêu đề mà không kèm nổi một dòng → sang trang mới.
    if (cur.length + 2 > c) day()
    cur.push(tieuDe(false))
    for (const row of g.rows) {
      if (cur.length >= c) {
        day()
        cur.push(tieuDe(true))
      }
      cur.push({ kind: 'dong', row })
    }
  }
  day()
  return trang
}

/** "dòng 25–34" của một trang — đếm DÒNG ĐƠN, không đếm tiêu đề nhóm. */
export function khoangDong<R>(trang: Muc<R>[][], i: number): { tu: number; den: number } {
  let truoc = 0
  for (let k = 0; k < i && k < trang.length; k++)
    truoc += trang[k].filter((m) => m.kind === 'dong').length
  const n = (trang[i] ?? []).filter((m) => m.kind === 'dong').length
  return { tu: n ? truoc + 1 : truoc, den: truoc + n }
}

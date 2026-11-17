/**
 * SỔ CÔNG ĐOẠN — gom số cho "tờ công đoạn" (bản vẽ 14/11/2026
 * https://claude.ai/artifact/CpB5jKcS9Swtx6cHqKUyXx, duyệt Q1–Q6). Thuần, client và
 * server dùng chung, có test.
 *
 * Chép tờ PHÔI / HÀN / NGUỘI / SƠN của sổ Excel thống kê: mỗi CHI TIẾT một hàng
 * (lệnh → mã hàng → chi tiết), mỗi NGÀY một cột. Một chi tiết lặp ở nhiều đợt của
 * cùng lệnh (mỗi đợt một production_component) gộp thành MỘT hàng — sổ Excel không
 * chia đợt, và bày năm hàng "Chân" giống hệt nhau là đọc sai.
 *
 * Cần · Đã làm lấy NGUYÊN ô Hồ sơ lệnh (một ô một số); ô ngày chỉ cộng dòng sổ
 * CHÍNH THỨC — nháp chưa vào số.
 */

/** Một dòng Hồ sơ lệnh có ô ở công đoạn đang xem. */
export type ScdNguon = {
  lsx_id: string
  lsx_code: string
  ma: string | null
  ten_sp: string | null
  row_id: string
  cum: string | null
  ten: string
  thu_tu: number
  can: number
  da_lam: number
}

/** Một dòng sổ chính thức của công đoạn đang xem, trong tháng. */
export type ScdGhi = {
  lsx_id: string
  lsx_code: string
  component_id: string
  ten: string
  cum: string | null
  thu_tu: number
  /** ISO yyyy-mm-dd */
  ngay: string
  qty: number
  team_id: string | null
}

export type ScdDong = {
  key: string
  cum: string | null
  ten: string
  thu_tu: number
  /** null = chi tiết không còn trên Hồ sơ lệnh (dòng sổ cũ) — không có số để so. */
  can: number | null
  da_lam: number | null
  /** ISO ngày → Σ đạt chính thức. */
  ngay: Record<string, number>
  /** ISO ngày → tổ đã ghi (null = từ hai tổ trở lên) — để ô ngày mở Sổ theo ngày đúng tổ. */
  to: Record<string, string | null>
  thang: number
}

export type ScdMa = {
  code: string | null
  ten: string | null
  dong: ScdDong[]
  xong: number
}
export type ScdLenh = { lsx_id: string; lsx_code: string; ma: ScdMa[] }

const vi = (a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true })

/**
 * `ca` = "Cả chi tiết của lệnh đang chạy" (Q3): giữ cả hàng chưa có số trong tháng.
 * Mặc định chỉ hàng CÓ ghi.
 */
export function gomSoCongDoan(
  nguon: ScdNguon[],
  ghi: ScdGhi[],
  o: { ca: boolean },
): ScdLenh[] {
  type G = ScdDong & {
    lsx_id: string
    lsx_code: string
    ma: string | null
    ten_sp: string | null
    coNguon: boolean
  }
  const dong = new Map<string, G>()
  const keyOf = (lsx: string, ma: string | null, cum: string | null, ten: string) =>
    `${lsx}|${ma ?? ''}|${cum ?? ''}|${ten}`
  const lay = (
    k: string,
    base: Omit<G, 'key' | 'can' | 'da_lam' | 'ngay' | 'to' | 'thang' | 'coNguon'>,
  ) => {
    let g = dong.get(k)
    if (!g) {
      g = {
        ...base,
        key: k,
        can: null,
        da_lam: null,
        ngay: {},
        to: {},
        thang: 0,
        coNguon: false,
      }
      dong.set(k, g)
    }
    return g
  }

  const theoRow = new Map<string, ScdNguon>()
  for (const n of nguon) {
    theoRow.set(n.row_id, n)
    const g = lay(keyOf(n.lsx_id, n.ma, n.cum, n.ten), {
      lsx_id: n.lsx_id,
      lsx_code: n.lsx_code,
      ma: n.ma,
      ten_sp: n.ten_sp,
      cum: n.cum,
      ten: n.ten,
      thu_tu: n.thu_tu,
    })
    g.can = (g.can ?? 0) + n.can
    g.da_lam = (g.da_lam ?? 0) + n.da_lam
    g.thu_tu = Math.min(g.thu_tu, n.thu_tu)
    g.coNguon = true
  }

  for (const e of ghi) {
    const n = theoRow.get(e.component_id)
    const g = n
      ? dong.get(keyOf(n.lsx_id, n.ma, n.cum, n.ten))!
      : lay(keyOf(e.lsx_id, null, e.cum, e.ten), {
          lsx_id: e.lsx_id,
          lsx_code: e.lsx_code,
          ma: null,
          ten_sp: null,
          cum: e.cum,
          ten: e.ten,
          thu_tu: e.thu_tu,
        })
    g.ngay[e.ngay] = (g.ngay[e.ngay] ?? 0) + e.qty
    const truoc = g.to[e.ngay]
    g.to[e.ngay] = truoc === undefined || truoc === e.team_id ? e.team_id : null
    g.thang += e.qty
  }

  const lenh = new Map<
    string,
    { lsx_id: string; lsx_code: string; ma: Map<string, ScdMa> }
  >()
  for (const g of dong.values()) {
    if (!o.ca && Object.keys(g.ngay).length === 0) continue
    const L = lenh.get(g.lsx_id) ?? {
      lsx_id: g.lsx_id,
      lsx_code: g.lsx_code,
      ma: new Map(),
    }
    const m = L.ma.get(g.ma ?? '') ?? { code: g.ma, ten: g.ten_sp, dong: [], xong: 0 }
    m.dong.push({
      key: g.key,
      cum: g.cum,
      ten: g.ten,
      thu_tu: g.thu_tu,
      can: g.can,
      da_lam: g.da_lam,
      ngay: g.ngay,
      to: g.to,
      thang: g.thang,
    })
    if (g.can != null && g.can > 0 && (g.da_lam ?? 0) >= g.can) m.xong++
    L.ma.set(g.ma ?? '', m)
    lenh.set(g.lsx_id, L)
  }

  return [...lenh.values()]
    .map((L) => ({
      lsx_id: L.lsx_id,
      lsx_code: L.lsx_code,
      ma: [...L.ma.values()]
        .map((m) => ({
          ...m,
          dong: m.dong.sort((a, b) => a.thu_tu - b.thu_tu || vi(a.ten, b.ten)),
        }))
        .sort((a, b) => vi(a.code ?? '~', b.code ?? '~')),
    }))
    .sort((a, b) => vi(a.lsx_code, b.lsx_code))
}

/** Mọi ngày của tháng `yyyy-mm` (ISO), đúng số ngày của tháng. */
export function ngayTrongThang(thang: string): string[] {
  const [y, m] = thang.split('-').map(Number)
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${thang}-${String(i + 1).padStart(2, '0')}`)
}

/** Tháng trước / sau của `yyyy-mm`. */
export function doiThang(thang: string, buoc: number): string {
  const [y, m] = thang.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + buoc, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Một hàng của bảng TỔNG THEO MÃ SP (Sổ công đoạn). */
export type ScdTongMa = {
  lsx_id: string
  lsx_code: string
  code: string | null
  ten: string | null
  /** Số chi tiết (hàng) của mã trong tờ này. */
  so_ct: number
  /** Cộng Cần / Đã làm của các hàng có số (hàng sổ cũ không còn trên Hồ sơ lệnh bỏ ra). */
  can: number
  da_lam: number
  con: number
  /** Σ đạt chính thức trong tháng. */
  thang: number
  xong: number
  /** Số hàng sổ cũ không có số Cần để so — nói rõ ở màn thay vì lẳng lặng bỏ. */
  khong_so: number
}

/**
 * Tổng theo mã SP: mỗi (lệnh × mã) một hàng. Cộng được vì một tờ công đoạn chỉ có các
 * hàng cùng bậc đếm; số Cần/Đã làm lấy từ ô Hồ sơ lệnh y như lưới chi tiết.
 */
export function tongTheoMa(lenh: ScdLenh[]): ScdTongMa[] {
  return lenh.flatMap((L) =>
    L.ma.map((m) => {
      const co = m.dong.filter((d) => d.can != null)
      const can = co.reduce((a, d) => a + (d.can ?? 0), 0)
      const da = co.reduce((a, d) => a + (d.da_lam ?? 0), 0)
      return {
        lsx_id: L.lsx_id,
        lsx_code: L.lsx_code,
        code: m.code,
        ten: m.ten,
        so_ct: m.dong.length,
        can,
        da_lam: da,
        con: can - da,
        thang: m.dong.reduce((a, d) => a + d.thang, 0),
        xong: m.xong,
        khong_so: m.dong.length - co.length,
      }
    }),
  )
}

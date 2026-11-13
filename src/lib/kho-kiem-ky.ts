import {
  chieuDong,
  COT_NHAP,
  COT_XUAT,
  dungNxt,
  kyThang,
  type CotNhap,
  type CotXuat,
  type DongNxt,
  type DongSo,
} from './kho-nxt'

/**
 * KIỂM TRƯỚC KHI CHỐT KỲ KHO (B1) + BẢN CHỐT (B2). Thuần, có test.
 *
 * Bản vẽ duyệt 13/11/2026 (https://claude.ai/artifact/6mgaRUw38AvLwCS1199P73,
 * Q1–Q6 theo đề xuất). B1 chưa khoá gì: chỉ trả lời "nếu chốt sổ đến hết tháng M
 * hôm nay thì đang khoá lại những gì". Dòng lưu ý trên Báo cáo tháng và hộp danh
 * sách kiểm đếm bằng CHÍNH hàm này — hai chỗ không được ra hai số.
 *
 * Sổ chưa chốt tháng nào, nên chốt tháng M là chốt luôn mọi tháng trước còn mở
 * (Q6): mỗi tháng từ `thangDau` tới M một bộ kiểm riêng.
 *
 *  · CHẶN (Q3): mã tồn âm cuối tháng · đợt kiểm kê chưa xong có mốc chốt sổ
 *    trong kỳ (số thừa/thiếu của đợt phải vào sổ trước khi khoá).
 *  · LƯU Ý (không chặn, người chốt phải tích từng mục khi có nút Chốt ở B2):
 *    lệnh nhận hàng mua trong tháng mà trong tháng không có dòng xuất nào cho
 *    lệnh · mã có phát sinh mà chưa lần nhập nào có giá · dòng USD thiếu tỷ giá.
 *  · TÓM TẮT bản chốt: dòng xuất / dòng KK thừa không giá sẽ nhận đơn giá bình
 *    quân của tháng, giá trị xuất, giá trị tồn cuối cả kho — cùng `dungNxt` của
 *    Báo cáo tháng.
 */

/** Đợt kiểm kê CHƯA xong (open · counting · review). */
export type DotKiemKeMo = {
  id: string
  code: string
  status: string
  /** Ngày VN của mốc chốt sổ; null = đợt chưa bắt đầu đếm. */
  freeze_ngay: string | null
}

export type KiemThang = {
  /** `YYYY-MM`. */
  thang: string
  /** Ngày cuối tháng `YYYY-MM-DD`. */
  den: string
  /** Mã tồn âm cuối tháng — CHẶN. */
  tonAm: string[]
  /** Lệnh có hàng mua về (dòng đơn của lệnh) trong tháng. */
  lenhNhan: string[]
  /** Phần của `lenhNhan` trong tháng không có dòng xuất nào cho lệnh. */
  lenhChuaXuat: string[]
  /** Mã có phát sinh trong tháng mà chưa lần nhập nào có giá. */
  maThieuGia: string[]
  /** Dòng nhập ngoại tệ thiếu tỷ giá trong tháng. */
  dongThieuTyGia: number
  /** Dòng xuất (không phải phiếu đảo) — sẽ nhận đơn giá bình quân tháng. */
  dongXuat: number
  dongXuatTheoCot: Record<CotXuat, number>
  /** Dòng nhập thừa sau kiểm kê chưa có giá — nhận cùng đơn giá. */
  dongKkThua: number
  gtXuat: number
  /** Giá trị tồn cuối CẢ KHO (mọi mã, không chỉ mã phát sinh). */
  gtTonCuoi: number
}

export type KiemKy = {
  /** Ngày khoá nếu chốt: cuối tháng M. */
  den: string
  thangs: KiemThang[]
  /** Đợt kiểm kê chưa xong có mốc chốt sổ ≤ `den` — CHẶN. */
  dotMo: DotKiemKeMo[]
  /** Số điều kiện chặn còn trượt (mỗi tháng có mã âm tính 1, mỗi đợt mở tính 1). */
  soChan: number
  /** Đếm KHÔNG trùng qua mọi tháng — cho dòng lưu ý trên Báo cáo tháng. */
  tong: { lenhChuaXuat: number; maThieuGia: number; dongThieuTyGia: number }
}

/** Tháng `YYYY-MM` liền sau. */
export function thangSau(thang: string): string {
  const [y, m] = thang.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Các tháng `YYYY-MM` từ `dau` tới `cuoi`, gồm hai đầu. */
export function dsThangKiem(dau: string, cuoi: string): string[] {
  const out: string[] = []
  let [y, m] = dau.split('-').map(Number)
  const [yc, mc] = cuoi.split('-').map(Number)
  while (y < yc || (y === yc && m <= mc)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Kỳ `{tu, den}` là ĐÚNG một tháng trọn vẹn đã qua hết (`den` < hôm nay). */
export function thangDaQua(
  ky: { tu: string; den: string },
  homNay: string,
): string | null {
  const t = kyThang(ky.tu)
  if (t.tu !== ky.tu || t.den !== ky.den) return null
  return ky.den < homNay ? ky.tu.slice(0, 7) : null
}

const LA_XUAT = new Set<string>(COT_XUAT)

function kiemMotThang(
  dong: readonly DongSo[],
  thang: string,
  lenhCuaDong: ReadonlyMap<string, readonly string[]>,
): KiemThang {
  const { tu, den } = kyThang(`${thang}-01`)
  const rows = dungNxt(dong, tu, den)
  const theoCot: Record<CotXuat, number> = { choLenh: 0, kkThieu: 0, xuatKhac: 0 }
  let dongXuat = 0
  let dongKkThua = 0
  const nhan = new Set<string>()
  const xuat = new Set<string>()
  for (const d of dong) {
    if (d.ngay < tu || d.ngay > den || d.la_dao) continue
    const c = chieuDong(d)
    if (!c.cot || c.sl <= 0) continue
    if (LA_XUAT.has(c.cot)) {
      dongXuat++
      theoCot[c.cot as CotXuat]++
      if (d.production_order_id) xuat.add(d.production_order_id)
    } else if (c.cot === 'kkThua' && d.unit_cost == null) {
      dongKkThua++
    } else if (c.cot === 'mua') {
      if (d.po_line_id) for (const l of lenhCuaDong.get(d.po_line_id) ?? []) nhan.add(l)
      if (d.production_order_id) nhan.add(d.production_order_id)
    }
  }
  let gtXuat = 0
  let gtTonCuoi = 0
  let dongThieuTyGia = 0
  const tonAm: string[] = []
  const maThieuGia: string[] = []
  for (const r of rows) {
    gtXuat += r.gt_xuat ?? 0
    gtTonCuoi += r.gt_cuoi ?? 0
    dongThieuTyGia += r.thieu_ty_gia
    if (r.ton_cuoi < -1e-9) tonAm.push(r.material_id)
    if (r.phat_sinh && r.don_gia == null) maThieuGia.push(r.material_id)
  }
  const lenhNhan = [...nhan].sort()
  return {
    thang,
    den,
    tonAm,
    lenhNhan,
    lenhChuaXuat: lenhNhan.filter((id) => !xuat.has(id)),
    maThieuGia,
    dongThieuTyGia,
    dongXuat,
    dongXuatTheoCot: theoCot,
    dongKkThua,
    gtXuat,
    gtTonCuoi,
  }
}

/**
 * Kiểm mọi tháng từ `thangDau` tới `thang` (gồm hai đầu). `dong` phải là MỌI
 * dòng sổ tới hết tháng `thang` (đúng đầu vào của `dungNxt`).
 * `lenhCuaDong`: dòng đơn mua → các lệnh có phần trên dòng đó.
 */
export function kiemKy(o: {
  dong: readonly DongSo[]
  thangDau: string
  thang: string
  lenhCuaDong: ReadonlyMap<string, readonly string[]>
  dotKiemKe: readonly DotKiemKeMo[]
}): KiemKy {
  const den = kyThang(`${o.thang}-01`).den
  const dau = o.thangDau < o.thang ? o.thangDau : o.thang
  const thangs = dsThangKiem(dau, o.thang).map((t) =>
    kiemMotThang(o.dong, t, o.lenhCuaDong),
  )
  const dotMo = o.dotKiemKe.filter((t) => t.freeze_ngay != null && t.freeze_ngay <= den)
  const lenh = new Set(thangs.flatMap((t) => t.lenhChuaXuat))
  const ma = new Set(thangs.flatMap((t) => t.maThieuGia))
  return {
    den,
    thangs,
    dotMo,
    soChan: thangs.filter((t) => t.tonAm.length > 0).length + dotMo.length,
    tong: {
      lenhChuaXuat: lenh.size,
      maThieuGia: ma.size,
      dongThieuTyGia: thangs.reduce((s, t) => s + t.dongThieuTyGia, 0),
    },
  }
}

// ── B2: lưu ý phải tích + bản chốt ──────────────────────────────────────────

/**
 * Một lưu ý người chốt phải tích (Q3: không chặn, nhưng phải tích từng mục).
 * `key` là thứ máy chủ kiểm và hộp gửi lên — cùng hàm này ở hai đầu.
 */
export type LuuY = { key: string; text: string }

/** Số đếm của một tháng — nhận cả `KiemThang` (máy chủ) lẫn bản đã gắn tên (màn). */
export type DemLuuY = {
  thang: string
  lenhChuaXuat: number
  lenhNhan: number
  maThieuGia: number
  dongThieuTyGia: number
}

const nhanThang = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`

/** Lưu ý của MỘT tháng, đúng thứ tự hộp bày: lệnh chưa xuất · mã thiếu giá · tỷ giá. */
export function luuYThang(t: DemLuuY): LuuY[] {
  const out: LuuY[] = []
  const th = `Tháng ${nhanThang(t.thang)}`
  if (t.lenhChuaXuat > 0)
    out.push({
      key: `lenh:${t.thang}`,
      text: `${th}: ${t.lenhChuaXuat} / ${t.lenhNhan} lệnh nhận hàng chưa có phiếu xuất`,
    })
  if (t.maThieuGia > 0)
    out.push({
      key: `gia:${t.thang}`,
      text: `${th}: ${t.maThieuGia} mã chưa lần nhập nào có giá`,
    })
  if (t.dongThieuTyGia > 0)
    out.push({
      key: `tygia:${t.thang}`,
      text: `${th}: ${t.dongThieuTyGia} dòng nhập ngoại tệ thiếu tỷ giá`,
    })
  return out
}

/** Mọi lưu ý của một lượt chốt (máy chủ). */
export function luuYPhaiTich(kk: KiemKy): LuuY[] {
  return kk.thangs.flatMap((t) =>
    luuYThang({
      thang: t.thang,
      lenhChuaXuat: t.lenhChuaXuat.length,
      lenhNhan: t.lenhNhan.length,
      maThieuGia: t.maThieuGia.length,
      dongThieuTyGia: t.dongThieuTyGia,
    }),
  )
}

/** Một tháng gửi xuống hàm ghi `warehouse_close_periods` (0297). */
export type ThangChot = {
  /** Ngày đầu tháng `YYYY-MM-01`. */
  thang: string
  den: string
  dong_xuat: number
  dong_kk_thua: number
  gt_xuat: number
  gt_ton_cuoi: number
  luu_y: LuuY[]
  rows: DongNxt[]
}

/**
 * Bản chốt của cả lượt (Q6: mỗi tháng một bản). Hàng theo mã là ĐÚNG `dungNxt`
 * của tháng đó — Báo cáo tháng đọc lại bản này sau khi chốt, nên số chốt và số
 * đang bày trước lúc bấm là một.
 */
export function banChot(
  dong: readonly DongSo[],
  kk: KiemKy,
  tich: readonly LuuY[],
): ThangChot[] {
  return kk.thangs.map((t) => {
    const { tu, den } = kyThang(`${t.thang}-01`)
    return {
      thang: tu,
      den,
      dong_xuat: t.dongXuat,
      dong_kk_thua: t.dongKkThua,
      gt_xuat: t.gtXuat,
      gt_ton_cuoi: t.gtTonCuoi,
      luu_y: tich.filter((l) => l.key.endsWith(`:${t.thang}`)),
      rows: dungNxt(dong, tu, den),
    }
  })
}

/** Một hàng `warehouse_period_costs` như PostgREST trả (numeric có thể là chuỗi). */
export type HangBanChot = {
  material_id: string
  ton_dau: number | string
  nhap: Partial<Record<CotNhap, number>> | null
  xuat: Partial<Record<CotXuat, number>> | null
  ton_cuoi: number | string
  don_gia: number | string | null
  gt_dau: number | string | null
  gt_nhap: number | string | null
  gt_xuat: number | string | null
  gt_cuoi: number | string | null
  bq: DongNxt['bq']
  thieu_gia: number
  lan_mua: number
  thieu_ty_gia: number
  phat_sinh: boolean
}

const so = (v: number | string | null | undefined) => (v == null ? null : Number(v))

/** Hàng bản chốt → hàng Báo cáo tháng (cộng nhập / xuất suy lại từ các cột). */
export function tuBanChot(h: HangBanChot): DongNxt {
  const nhap = Object.fromEntries(COT_NHAP.map((c) => [c, Number(h.nhap?.[c] ?? 0)])) as Record<CotNhap, number> // prettier-ignore
  const xuat = Object.fromEntries(COT_XUAT.map((c) => [c, Number(h.xuat?.[c] ?? 0)])) as Record<CotXuat, number> // prettier-ignore
  const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0
  return {
    material_id: h.material_id,
    ton_dau: Number(h.ton_dau),
    nhap,
    xuat,
    cong_nhap: r3(COT_NHAP.reduce((s, c) => s + nhap[c], 0)),
    cong_xuat: r3(COT_XUAT.reduce((s, c) => s + xuat[c], 0)),
    ton_cuoi: Number(h.ton_cuoi),
    don_gia: so(h.don_gia),
    gt_dau: so(h.gt_dau),
    gt_nhap: so(h.gt_nhap),
    gt_xuat: so(h.gt_xuat),
    gt_cuoi: so(h.gt_cuoi),
    bq: h.bq ?? null,
    thieu_gia: h.thieu_gia,
    lan_mua: h.lan_mua,
    thieu_ty_gia: h.thieu_ty_gia,
    phat_sinh: h.phat_sinh,
  }
}

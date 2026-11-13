import {
  chieuDong,
  COT_XUAT,
  dungNxt,
  kyThang,
  type CotXuat,
  type DongSo,
} from './kho-nxt'

/**
 * KIỂM TRƯỚC KHI CHỐT KỲ KHO (B1 — chỉ đọc). Thuần, có test.
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

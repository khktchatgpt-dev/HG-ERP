import { suyMaTuLichSu, timMaLyDo } from './kho-ma-ly-do'

/**
 * BÁO CÁO NHẬP–XUẤT–TỒN THEO KỲ (Kho đợt 2 · B6). Thuần, có test.
 *
 * Bản vẽ duyệt 19/10/2026 (https://claude.ai/artifact/XCqeNa92MkBZ5oGGwcGrjS,
 * Q1–Q6 theo đề xuất):
 *
 *  · Q1 — ĐƠN GIÁ XUẤT = BÌNH QUÂN GIA QUYỀN CẢ KỲ (tháng), cách mặc định của
 *    MISA: đơn giá kỳ = (giá trị tồn đầu + giá trị nhập có giá) ÷ (SL tồn đầu +
 *    SL nhập có giá). Mọi lượng xuất trong kỳ tính theo một đơn giá đó. Tháng
 *    trước kỳ đang xem tính nối tiếp từng tháng một để ra giá trị tồn đầu; kỳ
 *    đang xem (có thể lệch tháng) tính như MỘT kỳ. Đổi cách tính thì đổi hàm
 *    `tinhGia`, màn không đổi.
 *  · Q2 — phiếu thuộc kỳ theo NGÀY CHỨNG TỪ (`doc_date`), không theo giờ bấm.
 *  · Q3 — ĐẢO PHIẾU TRỪ VÀO CỘT CỦA PHIẾU GỐC. Dòng đảo mang cùng mã lý do với
 *    dòng gốc nhưng ngược chiều (đo 19/10: 15 dòng "xuất N1", 12 dòng "nhập X1"
 *    trong tháng 10) — đếm thẳng theo chiều sẽ ra "xuất N1" vô nghĩa.
 *
 * Không ghi gì vào sổ: báo cáo tính lúc đọc. Ghi giá vốn vào phiếu xuất và khoá
 * kỳ là bước sau.
 *
 * CHƯA BIẾT GIÁ KHÁC GIÁ 0 (cùng luật `ton-kho-gia-tri.ts`): lần nhập không giá
 * không kéo bình quân xuống; mã chưa lần nhập nào có giá thì giá trị `null`.
 */

/** Cột của báo cáo — đúng thứ tự bày. */
export const COT_NHAP = ['mua', 'hoan', 'kkThua', 'nhapKhac'] as const
export const COT_XUAT = ['choLenh', 'kkThieu', 'xuatKhac'] as const
export type CotNhap = (typeof COT_NHAP)[number]
export type CotXuat = (typeof COT_XUAT)[number]
export type Cot = CotNhap | CotXuat

export const NHAN_COT: Record<Cot, string> = {
  mua: 'Mua',
  hoan: 'Hoàn SX',
  kkThua: 'KK thừa',
  nhapKhac: 'Nhập khác',
  choLenh: 'Cho lệnh',
  kkThieu: 'KK thiếu',
  xuatKhac: 'Khác',
}

/** Một dòng sổ đã đọc sẵn (repo gắn phiếu + đơn mua). */
export type DongSo = {
  id: string
  material_id: string
  direction: 'in' | 'out'
  qty: number
  /** Đơn giá theo tiền của đơn (dòng đơn USD là USD). Null = chưa có giá. */
  unit_cost: number | null
  /** Tiền của đơn mua dòng này nhập theo; null = không theo đơn (coi như VND). */
  currency: string | null
  /** Tỷ giá chốt trên đơn (0219): 1 ngoại tệ = ? VND. */
  fx_rate: number | null
  reason_code: string | null
  ref_type: string | null
  po_line_id: string | null
  production_order_id: string | null
  /** Ngày chứng từ `YYYY-MM-DD` (đã quy ngày VN khi dòng không có phiếu). */
  ngay: string
  doc_id: string | null
  doc_code: string | null
  doc_kind: string | null
  /** Phiếu này là phiếu ĐẢO một phiếu khác. */
  la_dao: boolean
  dien_giai: string | null
}

export type ChieuDong = {
  /** Cột nhận dòng này; null = không đổi tồn theo mã (chuyển kệ, khoá…). */
  cot: Cot | null
  /** Có dấu: dòng đảo là số ÂM trong cột của phiếu gốc. */
  sl: number
  /** Mã lý do đã dùng (kể cả mã suy ra). */
  ma: string | null
  /** Mã không ghi trên dòng mà suy ra (dòng cũ trước 0197). */
  suy: boolean
}

const VAO_COT: Record<string, Cot> = {
  N1: 'mua',
  N2: 'mua',
  N3: 'hoan',
  N4: 'kkThua',
  X1: 'choLenh',
  X2: 'choLenh',
  X3: 'xuatKhac',
  X4: 'xuatKhac',
  X5: 'kkThieu',
  X6: 'xuatKhac',
  X7: 'xuatKhac',
}

export const laCotNhap = (c: Cot): c is CotNhap =>
  (COT_NHAP as readonly string[]).includes(c)

/**
 * Dòng sổ rơi vào cột nào, với dấu gì.
 *
 * Mã trên dòng thắng. Dòng cũ không mã: suy từ `ref_type` (luật chung
 * `suyMaTuLichSu`); dòng kiểm kê không mã → N4/X5; dòng đảo không mã → mã của
 * phiếu gốc theo LOẠI phiếu (phiếu đảo giữ loại của phiếu gốc) + đối ứng trên
 * dòng. Không suy được thì về "Nhập khác" / "Khác" — không bịa mã.
 */
export function chieuDong(d: DongSo): ChieuDong {
  let ma = d.reason_code
  let suy = false
  if (!ma) {
    suy = true
    if (d.la_dao) {
      /*
       * Dòng đảo đi NGƯỢC chiều dòng gốc — và phiếu đảo mang LOẠI NGƯỢC phiếu
       * gốc (đo 19/10: PXK-2026-0012 là phiếu xuất đảo PNK-2026-0038). Nên suy
       * theo CHIỀU của dòng, không theo loại phiếu.
       */
      const gocVao = d.direction === 'out'
      if (d.doc_kind === 'stocktake') ma = gocVao ? 'N4' : 'X5'
      else if (gocVao) ma = d.production_order_id ? 'N3' : d.po_line_id ? 'N1' : 'N2'
      else ma = d.production_order_id ? 'X1' : d.po_line_id ? 'X3' : 'X7'
    } else if (d.doc_kind === 'stocktake') {
      ma = d.direction === 'in' ? 'N4' : 'X5'
    } else {
      ma = suyMaTuLichSu(d.ref_type, d.direction)
    }
  }
  const khai = timMaLyDo(ma)
  if (khai?.huong === 'move') return { cot: null, sl: 0, ma, suy }
  const cot = ma ? VAO_COT[ma] : undefined
  if (!cot) {
    return { cot: d.direction === 'in' ? 'nhapKhac' : 'xuatKhac', sl: d.qty, ma, suy }
  }
  // Chiều chuẩn của cột; dòng đi ngược chiều cột là dòng ĐẢO → số âm.
  const chieuCot = laCotNhap(cot) ? 'in' : 'out'
  return { cot, sl: d.direction === chieuCot ? d.qty : -d.qty, ma, suy }
}

/** Đơn giá quy VND. Dòng ngoại tệ thiếu tỷ giá → null (không đoán tỷ giá). */
export function giaVnd(d: DongSo): number | null {
  if (d.unit_cost == null) return null
  if (!d.currency || d.currency === 'VND') return d.unit_cost
  return d.fx_rate && d.fx_rate > 0 ? d.unit_cost * d.fx_rate : null
}

const EPS = 1e-9
/** Làm tròn 3 lẻ cho SỐ LƯỢNG bày ra — cộng số thực để lại đuôi kiểu 2142,4 − 2142,4 = −4e-13. */
const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0
const r3Ban = <T extends string>(o: Record<T, number>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v as number)])) as Record<
    T,
    number
  >
const thangCua = (ngay: string) => ngay.slice(0, 7)

/** Dòng mua (N1/N2, kể cả dòng đảo của chúng) — dòng duy nhất mang giá vào bình quân. */
const laMua = (c: ChieuDong) => c.cot === 'mua'

type KyTinh = {
  qOpen: number
  vOpen: number | null
  /** Bình quân kỳ trước — dùng lại khi kỳ này không có gì để tính. */
  avgTruoc: number | null
  dong: { c: ChieuDong; gia: number | null }[]
}

type KetQuaKy = {
  avg: number | null
  qClose: number
  vClose: number | null
  vIn: number | null
  vOut: number | null
  vOpen: number | null
  /** Phép tính bình quân nguyên văn; null = kỳ này không có gì để tính (dùng lại kỳ trước). */
  bq: { tu: number; mau: number; kieu: 'rong' | 'duong' } | null
}

/**
 * Bình quân gia quyền cả kỳ cho MỘT mã trong MỘT kỳ.
 *
 * Tồn đầu chỉ vào mẫu số khi biết cả lượng (> 0) lẫn tiền; không thì tồn đầu
 * được định giá lại theo bình quân kỳ này. Nhờ vậy luôn giữ đẳng thức kế toán
 * tồn đầu + nhập − xuất = tồn cuối ở cả cột tiền.
 */
export function tinhGia(k: KyTinh): KetQuaKy {
  let qGia = 0
  let vGia = 0
  // Chỉ các lần nhập mua DƯƠNG có giá — đường lùi khi phần ròng không dùng được.
  let qDuong = 0
  let vDuong = 0
  let qIn = 0
  let qOut = 0
  for (const { c, gia } of k.dong) {
    if (!c.cot) continue
    if (laCotNhap(c.cot)) {
      qIn += c.sl
      if (laMua(c) && gia != null) {
        qGia += c.sl
        vGia += c.sl * gia
        if (c.sl > 0) {
          qDuong += c.sl
          vDuong += c.sl * gia
        }
      }
    } else qOut += c.sl
  }
  const biet = k.qOpen > EPS && k.vOpen != null
  const mau = (biet ? k.qOpen : 0) + qGia
  const tu = (biet ? (k.vOpen as number) : 0) + vGia
  /*
   * Ba bậc, dừng ở bậc đầu dùng được:
   *  1. RÒNG (chuẩn): tồn đầu + mọi dòng mua có giá kể cả dòng đảo — khi cả tử
   *     lẫn mẫu dương.
   *  2. CHỈ LẦN NHẬP DƯƠNG: kỳ có đảo phiếu nhập của kỳ trước làm SL ròng ≤ 0
   *     hoặc tiền ròng âm (đo 19/10: NK-0093 tháng 10 nhập 2.142 cái giá 160 +
   *     đảo phiếu nạp nền 2.142,4 → ròng −0,4; bậc 1 cho mẫu âm, hoặc dương rất
   *     nhỏ thì ra đơn giá âm / vô lý).
   *  3. Bình quân KỲ TRƯỚC.
   */
  const bq: KetQuaKy['bq'] =
    mau > EPS && tu >= 0
      ? { tu, mau, kieu: 'rong' }
      : qDuong > EPS
        ? { tu: vDuong, mau: qDuong, kieu: 'duong' }
        : null
  const avg = bq ? bq.tu / bq.mau : k.avgTruoc
  const qClose = k.qOpen + qIn - qOut
  if (avg == null) {
    return {
      avg: null,
      qClose,
      vClose: Math.abs(qClose) < EPS ? 0 : null,
      vIn: null,
      vOut: null,
      vOpen: k.vOpen,
      bq: null,
    }
  }
  const vOpen = biet ? (k.vOpen as number) : k.qOpen * avg
  // Nhập có giá theo giá thật; nhập không giá (hoàn SX, kiểm kê thừa) theo bình quân.
  const vIn = vGia + (qIn - qGia) * avg
  const vOut = qOut * avg
  return { avg, qClose, vClose: vOpen + vIn - vOut, vIn, vOut, vOpen, bq }
}

export type DongNxt = {
  material_id: string
  ton_dau: number
  nhap: Record<CotNhap, number>
  xuat: Record<CotXuat, number>
  cong_nhap: number
  cong_xuat: number
  ton_cuoi: number
  /** Bình quân kỳ; null = chưa lần nhập nào có giá. */
  don_gia: number | null
  gt_dau: number | null
  gt_nhap: number | null
  gt_xuat: number | null
  /** Null khi chưa có giá HOẶC tồn cuối âm (không định giá hàng âm). */
  gt_cuoi: number | null
  /**
   * Phép tính đơn giá nguyên văn: tử = giá trị tồn đầu (nếu biết) + giá trị nhập có
   * giá; mẫu = SL tương ứng. Null khi đơn giá lấy lại từ kỳ trước.
   */
  bq: { tu: number; mau: number; kieu: 'rong' | 'duong' } | null
  /** Lần nhập mua trong kỳ chưa có giá / tổng lần nhập mua trong kỳ. */
  thieu_gia: number
  lan_mua: number
  /** Dòng ngoại tệ thiếu tỷ giá trong kỳ. */
  thieu_ty_gia: number
  /** Kỳ có ít nhất một dòng sổ. */
  phat_sinh: boolean
}

const rongNhap = (): Record<CotNhap, number> => ({
  mua: 0,
  hoan: 0,
  kkThua: 0,
  nhapKhac: 0,
})
const rongXuat = (): Record<CotXuat, number> => ({ choLenh: 0, kkThieu: 0, xuatKhac: 0 })

/**
 * Dựng báo cáo cho kỳ [tu, den] (ngày `YYYY-MM-DD`, gồm hai đầu). `dong` là MỌI
 * dòng sổ tới hết `den` (cần cả lịch sử để ra tồn đầu và giá trị tồn đầu).
 */
export function dungNxt(dong: readonly DongSo[], tu: string, den: string): DongNxt[] {
  const theoMa = new Map<string, DongSo[]>()
  for (const d of dong) {
    if (d.ngay > den) continue
    const ds = theoMa.get(d.material_id)
    if (ds) ds.push(d)
    else theoMa.set(d.material_id, [d])
  }
  const out: DongNxt[] = []
  for (const [material_id, ds] of theoMa) {
    // Trước kỳ: nối tiếp từng THÁNG để ra tồn đầu + giá trị tồn đầu.
    const truoc = new Map<string, DongSo[]>()
    const trong: DongSo[] = []
    for (const d of ds) {
      if (d.ngay < tu) {
        const k = thangCua(d.ngay)
        const x = truoc.get(k)
        if (x) x.push(d)
        else truoc.set(k, [d])
      } else trong.push(d)
    }
    let qOpen = 0
    let vOpen: number | null = 0
    let avgTruoc: number | null = null
    for (const k of [...truoc.keys()].sort()) {
      const kq = tinhGia({
        qOpen,
        vOpen,
        avgTruoc,
        dong: truoc.get(k)!.map((d) => ({ c: chieuDong(d), gia: giaVnd(d) })),
      })
      qOpen = kq.qClose
      vOpen = kq.vClose
      if (kq.avg != null) avgTruoc = kq.avg
    }

    const nhap = rongNhap()
    const xuat = rongXuat()
    let thieu_gia = 0
    let lan_mua = 0
    let thieu_ty_gia = 0
    const tinh = trong.map((d) => {
      const c = chieuDong(d)
      const gia = giaVnd(d)
      if (c.cot) {
        if (laCotNhap(c.cot)) nhap[c.cot] += c.sl
        else xuat[c.cot] += c.sl
      }
      if (laMua(c) && c.sl > 0) {
        lan_mua++
        if (gia == null) thieu_gia++
      }
      if (d.unit_cost != null && gia == null) thieu_ty_gia++
      return { c, gia }
    })
    const kq = tinhGia({ qOpen, vOpen, avgTruoc, dong: tinh })
    const cong_nhap = COT_NHAP.reduce((s, c) => s + nhap[c], 0)
    const cong_xuat = COT_XUAT.reduce((s, c) => s + xuat[c], 0)
    out.push({
      material_id,
      ton_dau: r3(qOpen),
      nhap: r3Ban(nhap),
      xuat: r3Ban(xuat),
      cong_nhap: r3(cong_nhap),
      cong_xuat: r3(cong_xuat),
      ton_cuoi: r3(kq.qClose),
      don_gia: kq.avg,
      gt_dau: kq.vOpen,
      gt_nhap: kq.vIn,
      gt_xuat: kq.vOut,
      gt_cuoi: kq.qClose < -EPS ? null : kq.vClose,
      bq: kq.bq,
      thieu_gia,
      lan_mua,
      thieu_ty_gia,
      phat_sinh: trong.length > 0,
    })
  }
  return out
}

/**
 * Đối chiếu với sổ: Σ(tồn cuối − tồn đầu) của báo cáo phải bằng Σ có dấu mọi
 * dòng sổ trong kỳ. Lệch nghĩa là có dòng rơi khỏi cột nào đó.
 */
export function doiChieuSo(
  rows: readonly DongNxt[],
  dong: readonly DongSo[],
  tu: string,
  den: string,
): { bao_cao: number; so: number; khop: boolean } {
  const bao_cao = rows.reduce((s, r) => s + (r.ton_cuoi - r.ton_dau), 0)
  let so = 0
  for (const d of dong) {
    if (d.ngay < tu || d.ngay > den) continue
    if (chieuDong(d).cot == null) continue // chuyển kệ: cặp vào/ra, không đổi tồn theo mã
    so += d.direction === 'in' ? d.qty : -d.qty
  }
  return { bao_cao, so, khop: Math.abs(bao_cao - so) < 1e-6 }
}

/** Kỳ mặc định: tháng chứa `homNay`. */
export function kyThang(homNay: string): { tu: string; den: string } {
  const [y, m] = homNay.split('-').map(Number)
  const cuoi = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { tu: `${y}-${mm}-01`, den: `${y}-${mm}-${String(cuoi).padStart(2, '0')}` }
}

const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` và là ngày CÓ THẬT (2026-13-45, 2026-02-30 bị loại). */
function laNgay(v: string | undefined): v is string {
  if (!v || !NGAY_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Đọc kỳ từ URL; sai hoặc thiếu → tháng hiện tại. Đảo hai đầu nếu ngược. */
export function docKy(
  tu: string | undefined,
  den: string | undefined,
  homNay: string,
): { tu: string; den: string } {
  const mac = kyThang(homNay)
  const a = laNgay(tu) ? tu : mac.tu
  const b = laNgay(den) ? den : mac.den
  return a <= b ? { tu: a, den: b } : { tu: b, den: a }
}

/**
 * HỘP "CHỜ TÔI XEM" CỦA TRƯỞNG PHÒNG CUNG ỨNG (05/11/2026, bản vẽ
 * https://claude.ai/artifact/RcqWLU7F1z33btAR97gZBo — bản 2 = khung 6 + 7,
 * duyệt 06/11 cùng Q7–Q11: lưới gom theo TRẠNG THÁI + khung chi tiết dưới lưới,
 * số đỏ chỉ đếm việc làm được ngay, bỏ ổ khoá).
 *
 * Hình dữ liệu server → màn + các phép thuần màn dùng. Thuần, client import được.
 * Dấu "đã xem" suy ở lib/po-review; file này chỉ chia hộp, so giá, gom nhóm.
 */
import type { DauDaXem } from './po-review'

/** Một dòng hàng trong ô xem nhanh dưới dòng đơn. */
export type XemDong = {
  id: string
  ma: string | null
  ten: string
  quy_cach: string | null
  sl: number
  dvt: string | null
  /** Số theo đơn vị tính giá (m³, kg…) khi đơn giá tính trên đơn vị đó. */
  qd: number | null
  dvt_gia: string | null
  don_gia: number | null
  thanh_tien: number
  /** Giá lần mua gần nhất cùng NCC (Q6) — null: chưa từng mua món này ở NCC này. */
  truoc: GiaTruoc | null
}

export type GiaTruoc = { gia: number; po_code: string; at: string }

/** Một đơn chờ duyệt trong hộp của trưởng phòng. */
export type XemDon = {
  id: string
  code: string
  href: string
  ncc: string
  ncc_day_du: string
  loai: string | null
  materials: string[]
  lsx: string | null
  /** Ngày xuất của lệnh (YYYY-MM-DD) — "lệnh xuất 17/03/2027 · còn 131 ngày". */
  lenh_xuat: string | null
  /** Đơn ngoài lệnh: "HM-2026-0007 · Sửa lại văn phòng" (`nhanNgoaiLenh`). */
  ngoai_lenh: string | null
  expected_at: string | null
  owner_id: string | null
  owner_name: string | null
  /** Lập lúc / sửa lần cuối (ISO) — "lập 05/11 09:35", "im 25 ngày". */
  lap_at: string
  sua_at: string
  hop_dong: string | null
  /** Ghi chú trên đơn (in lên phiếu) — người nhận, điều kiện đổi hàng… */
  ghi_chu: string | null
  /** Số đơn ĐÃ ĐẶT (đã gửi NCC trở đi) với NCC này, trừ đơn đang xem. 0 = NCC mới. */
  ncc_da_dat: number
  currency: string
  tien_hang: number
  vat_rate: number
  vat: number
  value: number
  /** Vượt ngưỡng giá trị lớn (cùng luật hộp ký GĐ) → không tích hàng loạt (Q2). */
  big: boolean
  /** Nháp = lần sửa cuối; chờ duyệt = lần gửi duyệt cuối. */
  submitted_at: string
  thanh_toan: string | null
  /** null = trưởng phòng CHƯA xem. */
  mark: DauDaXem | null
  /**
   * true = NHÁP (đường thường: anh bấm "Đã xem — trình GĐ" là đơn lên bàn GĐ).
   * false = đơn NV đã GỬI THẲNG GĐ, anh xem bổ sung.
   */
  nhap: boolean
  /** Nháp chưa trình được vì sao (`lyDoChuaTrinh`) — khoá nút trình. null = trình được. */
  chan: string | null
  /**
   * Lần trả lại còn ảnh hưởng nháp (lib/po-review `traLaiNhap`). `da_sua` false =
   * nhóm "Bị trả lại — chờ người lập sửa" (Q11); true = nhãn "đã sửa sau khi trả lại".
   */
  tra_lai: {
    at: string
    by_name: string | null
    reason: string | null
    da_sua: boolean
  } | null
  dong: XemDong[]
}

/** Đơn Giám đốc đã duyệt khi trưởng phòng chưa xem — tab chỉ xem, giữ 7 ngày (Q4). */
export type DuyetThay = {
  id: string
  code: string
  href: string
  ncc: string
  loai: string | null
  materials: string[]
  lsx: string | null
  by_name: string | null
  at: string
  /** Phút từ lần gửi duyệt cuối tới lúc duyệt — null khi sổ thiếu mốc gửi. */
  sau_phut: number | null
  currency: string
  value: number
}

export type HopXem = {
  items: XemDon[]
  duyet_thay: DuyetThay[]
  /**
   * Ngưỡng "giá trị lớn" theo mã tiền (settings `approval_thresholds`, cùng ngưỡng
   * hộp ký GĐ) — để màn nói ra con số khi đơn lớn không có ô tích (`trinhRieng`).
   */
  nguong: Record<string, number>
  /** Mốc dựng dữ liệu — "cập nhật 09:12" ở thanh trạng thái. */
  at: string
}

/** Số ngày giữ đơn trong tab "GĐ duyệt khi tôi chưa xem" (Q4). */
export const GIU_DUYET_THAY_NGAY = 7

/**
 * TRẠNG THÁI MỘT DÒNG trong hộp (bản 2): nháp trình được · NV gửi thẳng GĐ mà anh
 * chưa xem · nháp còn thiếu · nháp bị trả lại chưa sửa · đã trình (chờ GĐ).
 */
export type TrangThaiXem = 'trinh_duoc' | 'gui_thang' | 'thieu' | 'tra_lai' | 'da_xem'

/** Đủ trường để phân loại — server (số trên menu) và màn dùng CHUNG hàm này. */
export type PhanLoaiXem = {
  nhap: boolean
  mark: unknown | null
  chan: string | null
  tra_lai: { da_sua: boolean } | null
}

export function trangThaiXem(d: PhanLoaiXem): TrangThaiXem {
  if (!d.nhap) return d.mark ? 'da_xem' : 'gui_thang'
  if (d.tra_lai && !d.tra_lai.da_sua) return 'tra_lai'
  return d.chan ? 'thieu' : 'trinh_duoc'
}

/**
 * Q7 — VIỆC ANH LÀM ĐƯỢC NGAY: nháp trình được + đơn NV gửi thẳng GĐ mà anh chưa
 * xem. Số đỏ trên menu và số trên tab "Chờ tôi xem" đếm ĐÚNG hàm này.
 */
export const lamDuocNgay = <T extends PhanLoaiXem>(items: readonly T[]): T[] =>
  items.filter((d) => {
    const t = trangThaiXem(d)
    return t === 'trinh_duoc' || t === 'gui_thang'
  })

/** Tab 1: mọi dòng chưa trình (gồm cả nháp còn thiếu, bị trả lại — bày, không đếm). */
export const choXem = (items: XemDon[]) =>
  items.filter((d) => trangThaiXem(d) !== 'da_xem')
/** Tab 2: đã trình (đã xem), đang chờ Giám đốc. */
export const daXemChoGd = (items: XemDon[]) =>
  items.filter((d) => trangThaiXem(d) === 'da_xem')

/**
 * Tích hàng loạt được không: chỉ việc làm được ngay, và DƯỚI ngưỡng giá trị lớn
 * (Q2 — đơn lớn mở ra đọc rồi trình riêng; Q10 bỏ ổ khoá, cột trạng thái nói thay).
 */
export const tichDuoc = (d: PhanLoaiXem & { big: boolean }) => {
  const t = trangThaiXem(d)
  return (t === 'trinh_duoc' || t === 'gui_thang') && !d.big
}

/**
 * Làm được ngay nhưng TỪ NGƯỠNG giá trị lớn trở lên — không có ô tích (Q2), trình
 * riêng từng đơn: bấm dòng rồi "Đã xem — trình GĐ". Trước 10/11/2026 ô tích của
 * những đơn này để trống không một chữ, người dùng tưởng màn lỗi (PO-2026-0254).
 */
export const trinhRieng = (d: PhanLoaiXem & { big: boolean }) => {
  const t = trangThaiXem(d)
  return (t === 'trinh_duoc' || t === 'gui_thang') && d.big
}

/**
 * Ngưỡng giá trị lớn đọc được: 50.000.000 VND → "50 triệu". Không có ngưỡng cho
 * mã tiền đó thì null — `isBigApprovalWith` coi MỌI đơn tiền ấy là lớn, không có
 * con số nào để nói.
 */
export function nguongChu(
  nguong: Record<string, number>,
  currency: string,
): string | null {
  const n = nguong[currency]
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (currency === 'VND' && n >= 1_000_000 && n % 1_000_000 === 0)
    return `${soVn(n / 1_000_000, 0)} triệu`
  return tienVn(n, currency)
}

/** Câu ngắn cho cột Trạng thái từ lý do chưa trình được (`lyDoChuaTrinh`). */
export function chanNgan(chan: string): string {
  if (chan === 'Chưa có hẹn giao') return 'Thiếu hẹn giao'
  if (chan === 'Chưa có dòng hàng') return 'Chưa có dòng hàng'
  if (chan.startsWith('Đơn ngoài lệnh chưa chọn hạng mục')) return 'Chưa chọn hạng mục'
  if (chan.startsWith('NCC đã ngừng')) return 'NCC ngừng giao dịch'
  if (chan.startsWith('NCC đang bị khoá')) return 'NCC đang khoá'
  return chan.split(' — ')[0].split('. ')[0]
}

/** Thứ tự + nhãn nhóm khi gom theo trạng thái (Q9). `tinhSo` = có ăn số đỏ (Q7). */
export const NHOM_TRANG_THAI: {
  key: Exclude<TrangThaiXem, 'da_xem'>
  ten: string
  tinhSo: boolean
  /** Thu gọn sẵn (Q11 — nhóm bị trả lại). */
  gon: boolean
}[] = [
  { key: 'trinh_duoc', ten: 'Trình được ngay', tinhSo: true, gon: false },
  { key: 'gui_thang', ten: 'NV gửi thẳng GĐ — anh chưa xem', tinhSo: true, gon: false },
  { key: 'thieu', ten: 'Còn thiếu — người lập đang soạn', tinhSo: false, gon: false },
  { key: 'tra_lai', ten: 'Bị trả lại — chờ người lập sửa', tinhSo: false, gon: true },
]

/** Số ngày từ `iso` tới `now` (làm tròn xuống) — "im 25 ngày". */
export function soNgayTu(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000))
}

/** Hẹn về so với hôm nay (YYYY-MM-DD): "hôm nay" · "còn 3 ngày" · "đã qua 2 ngày". */
export function henVe(
  expected: string | null,
  today: string,
): { chu: string; gap: boolean } | null {
  if (!expected) return null
  const n = Math.round(
    (Date.parse(expected.slice(0, 10)) - Date.parse(today)) / 86_400_000,
  )
  if (n === 0) return { chu: 'hôm nay', gap: true }
  if (n < 0) return { chu: `đã qua ${-n} ngày`, gap: true }
  return { chu: `còn ${n} ngày`, gap: n <= 2 }
}

/** Một dòng của mục "Kiểm trước khi trình" ở khung chi tiết. */
export type DongKiem = { kieu: 'ok' | 'wn' | 'st'; chu: string }

/**
 * KIỂM TRƯỚC KHI TRÌNH (bản vẽ khung 6, 7·A) — đủ để anh quyết trình hay trả lại
 * mà không phải mở đơn: thiếu gì (chặn), giá so đơn trước, NCC mới, nằm im lâu.
 * Thứ tự: chặn trước, rồi lưu ý, rồi điều đã ổn.
 */
export function kiemTruocTrinh(d: XemDon, now: Date, today: string): DongKiem[] {
  const out: DongKiem[] = []
  if (d.chan) out.push({ kieu: 'st', chu: d.chan })
  const thieuGia = d.dong.filter((l) => l.don_gia == null).length
  if (thieuGia > 0) out.push({ kieu: 'wn', chu: `${thieuGia} dòng chưa có đơn giá` })
  else if (d.dong.length > 0)
    out.push({ kieu: 'ok', chu: `${d.dong.length} dòng, đủ đơn giá` })
  const so = d.dong.map((l) => ({ l, s: soGia(l.don_gia, l.truoc) }))
  const giu = so.filter((x) => x.s?.kieu === 'bang')
  const tang = so.filter((x) => x.s?.kieu === 'tang')
  const moi = d.dong.filter((l) => !l.truoc).length
  if (tang.length > 0) {
    const cao = Math.max(...tang.map((x) => x.s!.pct))
    out.push({
      kieu: 'wn',
      chu: `${tang.length} dòng tăng giá (cao nhất +${soVn(cao, 1)}%)`,
    })
  }
  if (giu.length > 0)
    out.push({
      kieu: 'ok',
      chu: `${giu.length}/${d.dong.length} dòng giữ giá ${giu[0].l.truoc!.po_code}`,
    })
  if (moi > 0 && moi < d.dong.length)
    out.push({ kieu: 'wn', chu: `${moi} dòng mua lần đầu ở NCC này` })
  const hen = henVe(d.expected_at, today)
  if (hen && hen.chu.startsWith('đã qua'))
    out.push({ kieu: 'wn', chu: `Hẹn về ${hen.chu}` })
  if (!d.thanh_toan) out.push({ kieu: 'wn', chu: 'Chưa ghi điều khoản thanh toán' })
  else if (d.expected_at) out.push({ kieu: 'ok', chu: 'Có hẹn về, có thanh toán' })
  if (d.big) out.push({ kieu: 'wn', chu: 'Giá trị lớn — GĐ đọc từng dòng' })
  if (d.ncc_da_dat === 0) out.push({ kieu: 'wn', chu: 'NCC mới — chưa đơn nào đã đặt' })
  else out.push({ kieu: 'ok', chu: `Đã đặt NCC này ${d.ncc_da_dat} đơn` })
  const im = soNgayTu(d.sua_at, now)
  if (d.nhap && im > 7)
    out.push({
      kieu: 'wn',
      chu: `Nằm im ${im} ngày (sửa lần cuối ${d.sua_at.slice(8, 10)}/${d.sua_at.slice(5, 7)})`,
    })
  const thu = { st: 0, wn: 1, ok: 2 } as const
  return out.sort((a, b) => thu[a.kieu] - thu[b.kieu])
}

/**
 * Giá lần mua GẦN NHẤT cùng NCC của một vật tư, bỏ chính đơn đang xem.
 * `prices` là mọi lần mua đã gửi NCC (pos.repo `pricesForSuppliers`).
 */
export function giaTruocCungNcc(
  prices: {
    supplier_id: string
    material_id: string
    po_id: string
    po_code: string
    unit_price: number
    at: string
  }[],
  supplierId: string,
  materialId: string | null,
  boPoId: string,
): GiaTruoc | null {
  if (!materialId) return null
  let best: (typeof prices)[number] | null = null
  for (const p of prices) {
    if (
      p.supplier_id !== supplierId ||
      p.material_id !== materialId ||
      p.po_id === boPoId
    )
      continue
    if (!best || p.at > best.at) best = p
  }
  return best ? { gia: best.unit_price, po_code: best.po_code, at: best.at } : null
}

/** So đơn giá với lần trước: bằng / tăng / giảm + % lệch (làm tròn 0,1). */
export function soGia(
  gia: number | null,
  truoc: GiaTruoc | null,
): { kieu: 'bang' | 'tang' | 'giam'; pct: number } | null {
  if (gia == null || !truoc || !(truoc.gia > 0)) return null
  const lech = gia - truoc.gia
  if (Math.abs(lech) < 0.005) return { kieu: 'bang', pct: 0 }
  const pct = Math.round((Math.abs(lech) / truoc.gia) * 1000) / 10
  return { kieu: lech > 0 ? 'tang' : 'giam', pct }
}

/**
 * Gom: theo TRẠNG THÁI (mặc định — Q9, thứ tự `NHOM_TRANG_THAI`, nhóm rỗng bỏ),
 * theo người lập, theo lệnh (khối nhiều đơn nhất lên trước).
 */
export function gomDon(
  items: XemDon[],
  theo: 'trang_thai' | 'nguoi' | 'lenh',
): { key: string; ten: string; rows: XemDon[]; tinhSo: boolean; gon: boolean }[] {
  if (theo === 'trang_thai')
    return NHOM_TRANG_THAI.map((n) => ({
      key: n.key,
      ten: n.ten,
      tinhSo: n.tinhSo,
      gon: n.gon,
      rows: items.filter((d) => trangThaiXem(d) === n.key),
    })).filter((g) => g.rows.length > 0)
  const m = new Map<string, { ten: string; rows: XemDon[] }>()
  for (const d of items) {
    const key = theo === 'nguoi' ? (d.owner_id ?? '@') : (d.lsx ?? d.ngoai_lenh ?? '@')
    const ten =
      theo === 'nguoi'
        ? (d.owner_name ?? 'Chưa rõ người lập')
        : (d.lsx ?? d.ngoai_lenh ?? 'Ngoài lệnh')
    const g = m.get(key)
    if (g) g.rows.push(d)
    else m.set(key, { ten, rows: [d] })
  }
  return [...m.entries()]
    .map(([key, g]) => ({ key, ...g, tinhSo: true, gon: false }))
    .sort((a, b) => b.rows.length - a.rows.length || a.ten.localeCompare(b.ten, 'vi'))
}

/** Số lượng kiểu VN ("1.040.000", "2,0395") — tối đa `le` chữ số lẻ. */
export function soVn(n: number, le = 4): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: le }).format(n)
}

/** Tiền kèm mã tiền — VND không lẻ, ngoại tệ 2 số lẻ (như hộp ký). */
export function tienVn(n: number, currency: string): string {
  return `${soVn(n, currency === 'VND' ? 0 : 2)} ${currency}`
}

/** "Đã gửi bao lâu" gọn một ô: 25 phút · 18 giờ · 3 ngày. */
export function daGui(iso: string, now: Date): string {
  const phut = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000))
  if (phut < 60) return `${phut} phút`
  const gio = Math.round(phut / 60)
  if (gio < 24) return `${gio} giờ`
  return `${Math.floor(gio / 24)} ngày`
}

/** Cộng tiền theo từng loại tiền — không quy đổi (như chân bảng hộp ký). */
export function congTheoTien(items: { currency: string; value: number }[]) {
  const m = new Map<string, number>()
  for (const d of items) m.set(d.currency, (m.get(d.currency) ?? 0) + d.value)
  return [...m.entries()].map(([currency, value]) => ({ currency, value }))
}

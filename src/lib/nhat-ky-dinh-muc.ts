import { chuanTen, khoaChuaMa } from './bom-chua-ma'

/**
 * NHẬT KÝ DÒNG ĐỊNH MỨC → THAY ĐỔI RÒNG (T2, 02/11/2026) — lõi thuần.
 *
 * Bảng 0284 ghi MỌI lần thêm / sửa / xoá một dòng định mức (trigger trong DB,
 * script cũng bị ghi). Người soát không cần từng lần bấm: họ cần định mức LÚC
 * MỐC SOÁT khác định mức BÂY GIỜ ở đâu (bản vẽ N1 Q2, duyệt 02/11):
 *  - sửa 3 lần chỉ còn một dòng "2 → 3"; sửa rồi sửa lại như cũ thì không hiện;
 *  - thêm rồi xoá trong cùng khoảng thì không hiện;
 *  - "xoá hết rồi nạp lại" (đọc BOM bằng AI chế độ thay thế, chép SP): dòng nạp
 *    lại GIỐNG HỆT dòng đã xoá thì triệt tiêu; giống CHI TIẾT mà khác số thì ghép
 *    thành một dòng "Sửa" thay vì một Bỏ + một Thêm.
 */

/** Ngày bắt đầu có nhật ký — lúc áp 0284 (version 20261102070641). Sửa trước đó không có số cũ. */
export const NHAT_KY_DINH_MUC_TU = '2026-11-02T07:06:41Z'

/** Các trường trigger 0284 theo dõi — đúng thứ tự cột của nó. */
export const TRUONG_DM = [
  'material_code',
  'part_name',
  'qty',
  'unit',
  'dim_a_mm',
  'dim_b_mm',
  'wall_thickness_mm',
  'cut_length_mm',
  'material_note',
  'weight_kg',
  'waste_pct',
] as const
export type TruongDm = (typeof TRUONG_DM)[number]

const TRUONG_SO = new Set<TruongDm>([
  'qty',
  'dim_a_mm',
  'dim_b_mm',
  'wall_thickness_mm',
  'cut_length_mm',
  'weight_kg',
  'waste_pct',
])

/** Ảnh chụp một dòng định mức trong nhật ký (`before` / `after` của 0284). */
export type AnhDong = {
  material_code: string | null
  part_name: string | null
  qty: number | null
  unit: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  material_note: string | null
  weight_kg: number | null
  waste_pct: number | null
  group_code: string | null
}

export type BanGhiNhatKy = {
  product_id: string
  part_id: string
  action: 'insert' | 'update' | 'delete'
  before: AnhDong | null
  after: AnhDong | null
  /** user id — null khi xoá bằng script / không ghi người. */
  changed_by: string | null
  changed_at: string
}

/** Đọc một ảnh chụp jsonb từ DB: số có thể về dạng chuỗi (numeric), chữ rỗng = null. */
export function docAnh(j: unknown): AnhDong | null {
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  const so = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const chu = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return {
    material_code: chu(o.material_code),
    part_name: chu(o.part_name),
    qty: so(o.qty),
    unit: chu(o.unit),
    dim_a_mm: so(o.dim_a_mm),
    dim_b_mm: so(o.dim_b_mm),
    wall_thickness_mm: so(o.wall_thickness_mm),
    cut_length_mm: so(o.cut_length_mm),
    material_note: chu(o.material_note),
    weight_kg: so(o.weight_kg),
    waste_pct: so(o.waste_pct),
    group_code: chu(o.group_code),
  }
}

const maChuan = (s: string | null | undefined) => s?.trim().toUpperCase() || null

function bang(f: TruongDm, a: AnhDong, b: AnhDong): boolean {
  const x = a[f]
  const y = b[f]
  if (x === null || y === null) return x === y
  if (TRUONG_SO.has(f)) {
    const p = x as number
    const q = y as number
    return Math.abs(p - q) <= 1e-6 * Math.max(1, Math.abs(p), Math.abs(q))
  }
  return f === 'material_code' ? maChuan(x as string) === maChuan(y as string) : x === y
}

/** Các trường khác nhau giữa hai ảnh chụp, theo thứ tự `TRUONG_DM`. */
export function truongKhac(a: AnhDong, b: AnhDong): TruongDm[] {
  return TRUONG_DM.filter((f) => !bang(f, a, b))
}

export type LoaiDongDm = 'them' | 'sua' | 'bo'

/** Một dòng định mức đổi RÒNG từ mốc tới nay. */
export type DongDmDoi = {
  /** part_id; ghép "xoá rồi nạp lại" thì là `id-xoá>id-thêm`. */
  key: string
  product_id: string
  loai: LoaiDongDm
  /** Dòng lúc mốc — null với dòng thêm. */
  truoc: AnhDong | null
  /** Dòng bây giờ — null với dòng bỏ. */
  sau: AnhDong | null
  /** Trường đổi (chỉ dòng sửa). */
  truong: TruongDm[]
  /** Ghép từ một lần xoá + một lần thêm lại (nạp lại BOM). */
  napLai: boolean
  /** Lần ghi cuối cùng chạm dòng này. */
  luc: string
  /** user id của lần ghi cuối — null = không ghi người. */
  boi: string | null
}

const THU_TU_HD = { insert: 0, update: 1, delete: 2 } as const

/** Danh tính dùng để ghép "xoá rồi nạp lại": loại + tên + mã + quy cách. */
function danhTinh(a: AnhDong): string | null {
  const ten = a.part_name ? chuanTen(a.part_name) : ''
  const ma = maChuan(a.material_code) ?? ''
  if (!ten && !ma) return null
  const qc = [a.dim_a_mm, a.dim_b_mm, a.wall_thickness_mm, a.cut_length_mm].map((v) => v ?? '').join('×') // prettier-ignore
  return `${a.group_code?.trim().toUpperCase() ?? ''}|${ten}|${ma}|${qc}`
}

/** Toàn bộ nội dung (mọi trường theo dõi + nhóm) — để biết hai dòng giống hệt. */
function noiDung(a: AnhDong): string {
  return JSON.stringify([
    a.group_code?.trim().toUpperCase() ?? null,
    ...TRUONG_DM.map((f) =>
      f === 'material_code'
        ? maChuan(a[f])
        : TRUONG_SO.has(f) && a[f] !== null
          ? Math.round((a[f] as number) * 1e6) / 1e6
          : a[f],
    ),
  ])
}

/**
 * GỘP NHẬT KÝ thành thay đổi ròng. Đầu vào: các bản ghi SAU mốc (thứ tự bất
 * kỳ). Lấy `before` của lần ghi ĐẦU (= dòng lúc mốc) và `after` của lần ghi CUỐI
 * (= dòng bây giờ) cho từng dòng, rồi ghép cặp xoá / thêm trong cùng một SP.
 * `napLaiGiong` = số cặp xoá + thêm giống hệt đã triệt tiêu (để màn nói ra).
 */
export function gopNhatKy(rows: BanGhiNhatKy[]): {
  dong: DongDmDoi[]
  napLaiGiong: number
} {
  // changed_at mặc định là now() = giờ BẮT ĐẦU giao dịch, nên các lần ghi cùng
  // một lượt lưu trùng giờ — khi trùng thì thêm → sửa → xoá là thứ tự có thể có.
  const sap = [...rows].sort(
    (a, b) =>
      a.changed_at.localeCompare(b.changed_at) ||
      THU_TU_HD[a.action] - THU_TU_HD[b.action],
  )
  const theoDong = new Map<string, BanGhiNhatKy[]>()
  for (const r of sap) theoDong.set(r.part_id, [...(theoDong.get(r.part_id) ?? []), r])

  const thanh: DongDmDoi[] = []
  for (const [partId, ds] of theoDong) {
    const dau = ds[0]
    const cuoi = ds[ds.length - 1]
    const truoc = dau.action === 'insert' ? null : dau.before
    const sau = cuoi.action === 'delete' ? null : cuoi.after
    if (!truoc && !sau) continue
    const truong = truoc && sau ? truongKhac(truoc, sau) : []
    if (truoc && sau && truong.length === 0) continue
    thanh.push({
      key: partId,
      product_id: dau.product_id,
      loai: !truoc ? 'them' : !sau ? 'bo' : 'sua',
      truoc,
      sau,
      truong,
      napLai: false,
      luc: cuoi.changed_at,
      boi: cuoi.changed_by,
    })
  }

  // Ghép xoá ↔ thêm trong từng SP: lượt 1 giống hệt → bỏ cả hai; lượt 2 cùng
  // danh tính (tên + mã + quy cách) → một dòng sửa.
  let napLaiGiong = 0
  const bo = new Set<DongDmDoi>()
  const sp = new Set(thanh.map((d) => d.product_id))
  const ghep: DongDmDoi[] = []
  for (const p of sp) {
    const xoa = thanh.filter((d) => d.product_id === p && d.loai === 'bo')
    const them = thanh.filter((d) => d.product_id === p && d.loai === 'them')
    for (const khoa of [noiDung, danhTinh] as const) {
      for (const x of xoa) {
        if (bo.has(x)) continue
        const kx = khoa(x.truoc!)
        if (kx === null) continue
        const t = them.find((y) => !bo.has(y) && khoa(y.sau!) === kx)
        if (!t) continue
        bo.add(x)
        bo.add(t)
        if (khoa === noiDung) {
          napLaiGiong++
          continue
        }
        const truong = truongKhac(x.truoc!, t.sau!)
        if (truong.length === 0) {
          napLaiGiong++
          continue
        }
        const moi = t.luc >= x.luc ? t : x
        ghep.push({
          key: `${x.key}>${t.key}`,
          product_id: p,
          loai: 'sua',
          truoc: x.truoc,
          sau: t.sau,
          truong,
          napLai: true,
          luc: moi.luc,
          boi: moi.boi,
        })
      }
    }
  }
  return { dong: [...thanh.filter((d) => !bo.has(d)), ...ghep], napLaiGiong }
}

/** Một mã chịu ảnh hưởng của một dòng định mức đổi — số theo ĐVT định mức. */
export type AnhHuong = {
  /** Mã vật tư (chuẩn hoá); null = dòng chưa gắn mã. */
  code: string | null
  unit: string | null
  /** SL/SP lúc mốc và bây giờ (0 nếu dòng / mã không có ở phía đó). */
  perTruoc: number | null
  perSau: number | null
  /** SL sản phẩm trong lệnh. */
  slSp: number
  /** (perSau − perTruoc) × slSp; null khi một phía không ghi số. */
  delta: number | null
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * ẢNH HƯỞNG SỐ MUA của một dòng đổi = chênh SL/SP × SL sản phẩm trong lệnh — số
 * GỐC theo ĐVT định mức, chưa quy đổi đơn vị mua (số đã quy đổi nằm ở tab Vật
 * tư). Đổi mã thì là hai mục: mã mới cộng, mã cũ trừ. Chênh 0 thì không có mục.
 */
export function anhHuongMua(d: DongDmDoi, slSp: number): AnhHuong[] {
  const ca = maChuan(d.truoc?.material_code)
  const cb = maChuan(d.sau?.material_code)
  const muc = (
    code: string | null,
    unit: string | null,
    perTruoc: number | null,
    perSau: number | null,
  ): AnhHuong | null => {
    const delta =
      perTruoc === null || perSau === null ? null : r4((perSau - perTruoc) * slSp)
    if (delta === 0) return null
    return { code, unit, perTruoc, perSau, slSp, delta }
  }
  const out =
    d.truoc && d.sau && ca === cb
      ? [muc(cb, d.sau.unit ?? d.truoc.unit, d.truoc.qty, d.sau.qty)]
      : [
          d.sau ? muc(cb, d.sau.unit, 0, d.sau.qty) : null,
          d.truoc ? muc(ca, d.truoc.unit, d.truoc.qty, 0) : null,
        ]
  return out.filter((x): x is AnhHuong => x !== null)
}

const KHOA_CHUA_MA = '~'

/**
 * Dòng định mức này có góp vào thay đổi của vật tư (dòng tab Vật tư) không —
 * cho nút ▸. Vật tư có mã: mã trước hoặc sau trùng. Vật tư chưa mã (`~` + khoá
 * gom của bảng kê): khoá gom của ảnh chụp trước hoặc sau trùng.
 */
export function gopVaoVatTu(
  d: DongDmDoi,
  vt: { key: string; code: string | null },
): boolean {
  const anh = [d.truoc, d.sau].filter((a): a is AnhDong => a !== null)
  if (vt.key.startsWith(KHOA_CHUA_MA)) {
    const k = vt.key.slice(KHOA_CHUA_MA.length)
    return anh.some(
      (a) =>
        khoaChuaMa({
          kind: a.group_code,
          part_name: a.part_name,
          dims: [a.dim_a_mm, a.dim_b_mm, a.cut_length_mm],
          material_code: a.material_code,
        }) === k,
    )
  }
  const c = maChuan(vt.code)
  return !!c && anh.some((a) => maChuan(a.material_code) === c)
}

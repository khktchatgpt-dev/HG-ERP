import type { DoiThongTin } from './lenh-doi'
import { SPEC_FIELDS } from './lsx-spec-summary'

/**
 * NHẬT KÝ LỆNH SẢN XUẤT → THAY ĐỔI RÒNG (T3, 02/11/2026) — lõi thuần.
 *
 * Bảng 0285 ghi mọi lần đổi đầu lệnh (ngày xuất, mốc vật tư, ưu tiên, huỷ) và
 * dòng lệnh (SP, SL, quy cách) khi lệnh đang chạy — trigger trong DB, script
 * cũng bị ghi. Như nhật ký định mức (`nhat-ky-dinh-muc`), người soát cần thay
 * đổi RÒNG từ mốc soát: đầu lệnh mỗi trường một dòng (cũ lúc mốc → mới bây
 * giờ), dòng lệnh mỗi dòng một dòng; "xoá hết rồi nạp lại" giống hệt thì triệt
 * tiêu, cùng SP khác số thì ghép thành một dòng Sửa.
 */

/** Ngày bắt đầu có nhật ký lệnh — lúc áp 0285 (version 20261102085517). */
export const NHAT_KY_LENH_TU = '2026-11-02T08:55:17Z'

export type BanGhiLenh = {
  /** null = đầu lệnh. */
  line_id: string | null
  action: 'insert' | 'update' | 'delete'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  changed_at: string
}

/** Ảnh chụp một dòng lệnh (trường trigger 0285 theo dõi). */
export type AnhDongLenh = {
  product_id: string | null
  product_code: string | null
  qty: number | null
  unit: string | null
  /** Quy cách: sơn, gỗ, kính, nệm, mây — giá trị rỗng coi như không khai. */
  specs: Record<string, string>
  ship_date: string | null
}

export type TruongDau = 'ship_date' | 'materials_due_at' | 'priority' | 'status'
export type TruongDong = 'sp' | 'qty' | 'unit' | 'specs' | 'ship_date'

/** Một trường đầu lệnh đổi ròng. `luc` null = biết từ mốc soát, nhật ký không có. */
export type DoiDauLenh = {
  key: string
  phan: 'dau'
  truong: TruongDau
  truoc: string | number | null
  sau: string | number | null
  luc: string | null
}

/** Một dòng lệnh đổi ròng. */
export type DoiDongLenh = {
  key: string
  phan: 'dong'
  loai: 'them' | 'sua' | 'bo'
  truoc: AnhDongLenh | null
  sau: AnhDongLenh | null
  truong: TruongDong[]
  /** Ghép từ một lần xoá + một lần thêm lại (nạp lại lệnh). */
  napLai: boolean
  luc: string | null
}

export type DoiLenh = DoiDauLenh | DoiDongLenh

const chu = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const so = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Đọc ảnh chụp dòng lệnh từ jsonb của 0285. */
export function docDongLenh(j: Record<string, unknown> | null): AnhDongLenh | null {
  if (!j) return null
  const specs: Record<string, string> = {}
  if (j.specs && typeof j.specs === 'object')
    for (const [k, v] of Object.entries(j.specs as Record<string, unknown>)) {
      const t = chu(v)
      if (t) specs[k] = t
    }
  return {
    product_id: chu(j.product_id),
    product_code: chu(j.product_code),
    qty: so(j.qty),
    unit: chu(j.unit),
    specs,
    ship_date: chu(j.ship_date),
  }
}

const sapSpecs = (s: Record<string, string>) =>
  JSON.stringify(
    Object.keys(s)
      .sort()
      .map((k) => [k, s[k]]),
  )

function bangSo(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

/** Các trường dòng lệnh khác nhau giữa hai ảnh chụp. */
export function truongDongKhac(a: AnhDongLenh, b: AnhDongLenh): TruongDong[] {
  const out: TruongDong[] = []
  if (a.product_id !== b.product_id || a.product_code !== b.product_code) out.push('sp')
  if (!bangSo(a.qty, b.qty)) out.push('qty')
  if (a.unit !== b.unit) out.push('unit')
  if (sapSpecs(a.specs) !== sapSpecs(b.specs)) out.push('specs')
  if (a.ship_date !== b.ship_date) out.push('ship_date')
  return out
}

/** Quy cách đổi từng mục: "Sơn: Sơn đen → Sơn nâu". Khoá lạ giữ nguyên tên khoá. */
export function doiQuyCach(
  a: Record<string, string>,
  b: Record<string, string>,
): { key: string; nhan: string; truoc: string | null; sau: string | null }[] {
  const nhan = new Map<string, string>(SPEC_FIELDS.map((f) => [f.key, f.label]))
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => (a[k] ?? null) !== (b[k] ?? null))
    .map((k) => ({
      key: k,
      nhan: nhan.get(k) ?? k,
      truoc: a[k] ?? null,
      sau: b[k] ?? null,
    }))
}

const THU_TU_HD = { insert: 0, update: 1, delete: 2 } as const
const sapGio = (a: BanGhiLenh, b: BanGhiLenh) =>
  a.changed_at.localeCompare(b.changed_at) || THU_TU_HD[a.action] - THU_TU_HD[b.action]

const TRUONG_DAU: Exclude<TruongDau, 'status'>[] = [
  'ship_date',
  'materials_due_at',
  'priority',
]

/**
 * GỘP NHẬT KÝ LỆNH thành thay đổi ròng. Đầu vào: bản ghi SAU mốc của MỘT lệnh.
 * `napLaiGiong` = số cặp xoá + thêm dòng giống hệt đã triệt tiêu.
 */
export function gopNhatKyLenh(rows: BanGhiLenh[]): {
  doi: DoiLenh[]
  napLaiGiong: number
} {
  const sap = [...rows].sort(sapGio)
  const doi: DoiLenh[] = []

  // ── Đầu lệnh: so lần đầu (trước) với lần cuối (sau), từng trường.
  const dau = sap.filter((r) => r.line_id === null)
  if (dau.length > 0) {
    const truoc = dau[0].before ?? {}
    const sau = dau[dau.length - 1].after ?? {}
    // Giờ của lần ghi CUỐI chạm đúng trường đó.
    const lucCua = (
      f: string,
      khac: (b: Record<string, unknown>, a: Record<string, unknown>) => boolean,
    ) =>
      // prettier-ignore
      [...dau].reverse().find((r) => khac(r.before ?? {}, r.after ?? {}))?.changed_at ?? null
    for (const f of TRUONG_DAU) {
      const a = f === 'priority' ? so(truoc[f]) : chu(truoc[f])
      const b = f === 'priority' ? so(sau[f]) : chu(sau[f])
      if (a === b) continue
      doi.push({ key: `dau:${f}`, phan: 'dau', truong: f, truoc: a, sau: b, luc: lucCua(f, (x, y) => x[f] !== y[f]) }) // prettier-ignore
    }
    const huy = (o: Record<string, unknown>) => o.status === 'cancelled'
    if (huy(truoc) !== huy(sau))
      doi.push({
        key: 'dau:status',
        phan: 'dau',
        truong: 'status',
        truoc: chu(truoc.status),
        sau: chu(sau.status),
        luc: lucCua('status', (x, y) => huy(x) !== huy(y)),
      })
  }

  // ── Dòng lệnh: ròng theo từng dòng.
  const theoDong = new Map<string, BanGhiLenh[]>()
  for (const r of sap)
    if (r.line_id) theoDong.set(r.line_id, [...(theoDong.get(r.line_id) ?? []), r])
  const dong: DoiDongLenh[] = []
  for (const [id, ds] of theoDong) {
    const d0 = ds[0]
    const d1 = ds[ds.length - 1]
    const truoc = d0.action === 'insert' ? null : docDongLenh(d0.before)
    const sau = d1.action === 'delete' ? null : docDongLenh(d1.after)
    if (!truoc && !sau) continue
    const truong = truoc && sau ? truongDongKhac(truoc, sau) : []
    if (truoc && sau && truong.length === 0) continue
    dong.push({
      key: id,
      phan: 'dong',
      loai: !truoc ? 'them' : !sau ? 'bo' : 'sua',
      truoc,
      sau,
      truong,
      napLai: false,
      luc: d1.changed_at,
    })
  }

  // ── Ghép xoá ↔ thêm: giống hệt → bỏ cả hai; cùng SP → một dòng sửa.
  let napLaiGiong = 0
  const bo = new Set<DoiDongLenh>()
  const ghep: DoiDongLenh[] = []
  const noiDung = (a: AnhDongLenh) => JSON.stringify([a.product_id, a.product_code, a.qty, a.unit, sapSpecs(a.specs), a.ship_date]) // prettier-ignore
  const sp = (a: AnhDongLenh) => a.product_id ?? a.product_code
  const xoa = dong.filter((d) => d.loai === 'bo')
  const them = dong.filter((d) => d.loai === 'them')
  for (const khoa of [noiDung, sp] as const) {
    for (const x of xoa) {
      if (bo.has(x)) continue
      const kx = khoa(x.truoc!)
      if (kx === null) continue
      const t = them.find((y) => !bo.has(y) && khoa(y.sau!) === kx)
      if (!t) continue
      bo.add(x)
      bo.add(t)
      const truong = truongDongKhac(x.truoc!, t.sau!)
      if (khoa === noiDung || truong.length === 0) {
        napLaiGiong++
        continue
      }
      ghep.push({
        key: `${x.key}>${t.key}`,
        phan: 'dong',
        loai: 'sua',
        truoc: x.truoc,
        sau: t.sau,
        truong,
        napLai: true,
        luc: (t.luc ?? '') >= (x.luc ?? '') ? t.luc : x.luc,
      })
    }
  }
  doi.push(...dong.filter((d) => !bo.has(d)), ...ghep)
  return { doi, napLaiGiong }
}

/**
 * Thêm các thay đổi MỐC SOÁT thấy (so ảnh chụp lúc soát với bây giờ) mà nhật ký
 * không nói — lệnh soát trước khi có nhật ký, hoặc trigger lỡ một lần ghi. Không
 * bỏ sót thứ màn cũ (T1) đã nói, cũng không nói hai lần một thay đổi.
 */
export function boSungTuMoc(doi: DoiLenh[], thongTin: DoiThongTin[]): DoiLenh[] {
  const out = [...doi]
  const coDau = (f: TruongDau) => doi.some((d) => d.phan === 'dau' && d.truong === f)
  const coSp = (code: string) =>
    doi.some(
      (d) =>
        d.phan === 'dong' &&
        (d.truoc?.product_code === code || d.sau?.product_code === code),
    )
  for (const t of thongTin) {
    if (t.k === 'ship_date' || t.k === 'materials_due_at') {
      if (!coDau(t.k))
        out.push({ key: `moc:${t.k}`, phan: 'dau', truong: t.k, truoc: t.truoc, sau: t.nay, luc: null }) // prettier-ignore
      continue
    }
    if (coSp(t.nhan)) continue
    const anh = (qty: string | number | null): AnhDongLenh | null =>
      qty === null ? null : { product_id: null, product_code: t.nhan, qty: Number(qty), unit: null, specs: {}, ship_date: null } // prettier-ignore
    out.push({
      key: `moc:${t.nhan}`,
      phan: 'dong',
      loai: t.k === 'sp_them' ? 'them' : t.k === 'sp_bo' ? 'bo' : 'sua',
      truoc: anh(t.truoc),
      sau: anh(t.nay),
      truong: t.k === 'sp_sl' ? ['qty'] : [],
      napLai: false,
      luc: null,
    })
  }
  return out
}

/**
 * SL SẢN PHẨM LÚC MỐC = SL bây giờ − phần dòng lệnh đổi ròng sau mốc. Để tab Vật
 * tư so ảnh chụp định mức lúc duyệt với ĐÚNG SL lúc đó — đổi SL SP chảy sang số
 * cần vật tư. Dòng không biết product_id thì bỏ qua.
 */
export function slLucMoc(
  slNay: Map<string, number>,
  doi: DoiLenh[],
): Map<string, number> {
  const out = new Map(slNay)
  for (const d of doi) {
    if (d.phan !== 'dong') continue
    if (d.sau?.product_id)
      out.set(d.sau.product_id, (out.get(d.sau.product_id) ?? 0) - (d.sau.qty ?? 0))
    if (d.truoc?.product_id)
      out.set(d.truoc.product_id, (out.get(d.truoc.product_id) ?? 0) + (d.truoc.qty ?? 0))
  }
  for (const [k, v] of out) out.set(k, Math.max(0, Math.round(v * 10_000) / 10_000))
  return out
}

/**
 * Ai sửa: nhật ký lệnh không có cột người (lệnh / dòng lệnh không có
 * `updated_by`). Gán theo SỰ KIỆN app ghi gần nhất trong `cuaSoMs` (đổi đầu
 * lệnh, phát lại bản, đồng bộ theo đơn, huỷ — kèm người làm). Không có sự kiện
 * nào gần → null = "không ghi người" (thường là script nạp file).
 */
export function ganNguoi(
  luc: string | null,
  suKien: { luc: string; boi: string | null }[],
  cuaSoMs = 120_000,
): string | null {
  if (!luc) return null
  const t = Date.parse(luc)
  let best: { d: number; boi: string | null } | null = null
  for (const s of suKien) {
    const d = Math.abs(Date.parse(s.luc) - t)
    if (d <= cuaSoMs && (!best || d < best.d)) best = { d, boi: s.boi }
  }
  return best?.boi ?? null
}

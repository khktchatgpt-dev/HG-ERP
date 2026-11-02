/**
 * LỆNH ĐỔI — CHỜ SOÁT (02/11/2026) — lõi thuần.
 *
 * Bản vẽ https://claude.ai/artifact/RL9ToGvjouLFkhNVeruAbS (user duyệt 02/11).
 * Kỹ thuật sửa định mức, lệnh đổi SL / SP / ngày xuất thì phòng Cung ứng không
 * được báo: sửa định mức không phát sự kiện nào, còn 5 lần sửa lệnh thật đều nạp
 * bằng script nên đi tắt đường báo. Lõi này KHÔNG dựa vào sự kiện — nó so số Cần
 * hiện tại (đúng số bảng kê tính) với MỐC lần soát trước (0282), nên mọi đường
 * sửa đều lộ ra, kể cả script.
 *
 * Ba nguồn mốc, theo thứ tự tin cậy:
 *  1. Lần bấm "Đã soát" gần nhất — mốc đầy đủ (số đã quy đổi, cả vật tư chưa có
 *     mã kho, ngày xuất, SL từng SP) → `soVoiMoc`.
 *  2. Chưa soát lần nào: ẢNH CHỤP định mức lúc duyệt (0142) — chỉ có số GỐC theo
 *     mã → `soVoiAnhChup`.
 *  3. Phần ảnh chụp không phủ (dòng chưa gắn mã, dòng lệnh) thì không còn số cũ:
 *     service chỉ nói được "sửa sau duyệt N dòng, ai, lúc nào" (`SuaSauMoc`).
 */

import type { AnhHuong, DongDmDoi } from './nhat-ky-dinh-muc'
import type { DoiLenh } from './nhat-ky-lenh'

/** Một vật tư trong mốc: số Cần (null = dòng định mức không ghi số) + để bày lại. */
export type MucMoc = {
  qty: number | null
  unit: string | null
  name: string
  code: string | null
}

export type MocSoat = {
  /** Khoá = material_id; vật tư chưa có mã kho = `~` + khoá gom (lib/bom-chua-ma). */
  needs: Record<string, MucMoc>
  ship_date: string | null
  materials_due_at: string | null
  /** SL từng SP của lệnh, khoá product_id. */
  products: Record<string, { code: string; qty: number }>
}

/** Đầu vào để chụp mốc — trích từ bảng kê, không phụ thuộc kiểu của server. */
export type NguonMoc = {
  rows: {
    material_id: string
    material_code: string
    material_name: string
    unit: string
    qty_needed: number
    /** 'none' = mã chỉ có trên đơn (ngoài định mức) — không phải nhu cầu. */
    source: string
  }[]
  chuaMa: { key: string; name: string; unit: string | null; qty_total: number | null }[]
  ship_date: string | null
  materials_due_at: string | null
  products: { id: string; code: string; qty: number }[]
}

export const KHOA_CHUA_MA = '~'
/** Khoá của mã bỏ khỏi định mức mà bảng kê không còn dòng nào (chỉ biết mã). */
const KHOA_MA_RONG = '#'
/** Đơn đặt dư quá ngưỡng này (so với Cần) thì tô cam — cùng ngưỡng lệch số tay. */
export const NGUONG_DU = 0.1

const r4 = (n: number) => Math.round(n * 10_000) / 10_000
const maChuan = (s: string) => s.trim().toUpperCase()

/** Hai số Cần có khác nhau không — null (dòng không ghi số) chỉ bằng null. */
function khac(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a !== b
  return Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

/** Chụp mốc từ bảng kê đang bày — đúng thứ ghi vào `supply_lsx_reviews.snapshot`. */
export function chupMoc(n: NguonMoc): MocSoat {
  const needs: Record<string, MucMoc> = {}
  for (const r of n.rows) {
    if (r.source === 'none' || !(r.qty_needed > 0)) continue
    needs[r.material_id] = {
      qty: r4(r.qty_needed),
      unit: r.unit || null,
      name: r.material_name,
      code: r.material_code || null,
    }
  }
  for (const c of n.chuaMa) {
    needs[KHOA_CHUA_MA + c.key] = {
      qty: c.qty_total == null ? null : r4(c.qty_total),
      unit: c.unit,
      name: c.name,
      code: null,
    }
  }
  const products: MocSoat['products'] = {}
  for (const p of n.products) {
    const cur = products[p.id]
    products[p.id] = { code: p.code, qty: r4((cur?.qty ?? 0) + p.qty) }
  }
  return {
    needs,
    ship_date: n.ship_date,
    materials_due_at: n.materials_due_at,
    products,
  }
}

export type LoaiDoi = 'moi' | 'doi_sl' | 'bo'

/** Một vật tư đổi số Cần. `truoc`/`nay` cùng đơn vị mua của bảng kê. */
export type DoiSo = {
  key: string
  material_id: string | null
  code: string | null
  name: string
  unit: string | null
  loai: LoaiDoi
  truoc: number | null
  nay: number | null
  /** Số trước là ước theo tỉ lệ / số gốc định mức (mốc ảnh chụp), không phải số đã quy đổi. */
  uoc?: boolean
}

/** Thông tin lệnh đổi (không phải số vật tư): ngày xuất, mốc vật tư, SL từng SP. */
export type DoiThongTin = {
  k: 'ship_date' | 'materials_due_at' | 'sp_sl' | 'sp_them' | 'sp_bo'
  /** "Ngày xuất", "Mốc vật tư" hoặc mã SP. */
  nhan: string
  truoc: string | number | null
  nay: string | number | null
}

const laKhoaMa = (k: string) => !k.startsWith(KHOA_CHUA_MA) && !k.startsWith(KHOA_MA_RONG)

/** So mốc lần soát trước với số hiện tại. */
export function soVoiMoc(
  moc: MocSoat,
  nay: MocSoat,
): { so: DoiSo[]; thongTin: DoiThongTin[] } {
  const so: DoiSo[] = []
  const keys = new Set([...Object.keys(moc.needs), ...Object.keys(nay.needs)])
  for (const k of keys) {
    const a = moc.needs[k]
    const b = nay.needs[k]
    const truoc = a ? a.qty : 0
    const sau = b ? b.qty : 0
    if (!khac(truoc, sau)) continue
    const ref = b ?? a!
    so.push({
      key: k,
      material_id: laKhoaMa(k) ? k : null,
      code: ref.code,
      name: ref.name,
      unit: ref.unit,
      loai: !a ? 'moi' : !b ? 'bo' : 'doi_sl',
      truoc,
      nay: sau,
    })
  }

  const thongTin: DoiThongTin[] = []
  if ((moc.ship_date ?? null) !== (nay.ship_date ?? null))
    thongTin.push({ k: 'ship_date', nhan: 'Ngày xuất', truoc: moc.ship_date, nay: nay.ship_date }) // prettier-ignore
  if ((moc.materials_due_at ?? null) !== (nay.materials_due_at ?? null))
    thongTin.push({ k: 'materials_due_at', nhan: 'Mốc vật tư', truoc: moc.materials_due_at, nay: nay.materials_due_at }) // prettier-ignore
  const sps = new Set([...Object.keys(moc.products), ...Object.keys(nay.products)])
  for (const id of sps) {
    const a = moc.products[id]
    const b = nay.products[id]
    if (a && b && !khac(a.qty, b.qty)) continue
    thongTin.push({
      k: !a ? 'sp_them' : !b ? 'sp_bo' : 'sp_sl',
      nhan: (b ?? a!).code,
      truoc: a ? a.qty : null,
      nay: b ? b.qty : null,
    })
  }
  return { so, thongTin }
}

/**
 * Chưa có lần soát nào: so với ẢNH CHỤP định mức lúc duyệt (0142).
 *
 * Ảnh chụp chỉ giữ số định mức GỐC theo mã (chưa quy đổi sang đơn vị mua), và
 * hai bên đều nhân với SL SP HIỆN TẠI — để chỉ thay đổi của ĐỊNH MỨC lộ ra:
 *  - mã có trong định mức nay mà ảnh chụp không có → mới, trước = 0 (chính xác);
 *  - mã đổi số gốc → trước = Cần nay × gốc lúc chụp ÷ gốc nay (cùng phép quy
 *    đổi nên tỉ lệ giữ nguyên) — đánh dấu `uoc`;
 *  - mã bỏ khỏi định mức → không còn phép quy đổi, trước = số gốc lúc chụp (`uoc`).
 * Mã có trong định mức nhưng không lên bảng kê (chưa quy đổi được / không có
 * trong danh mục) bị bỏ qua: chúng đã có khối riêng trên màn.
 */
export function soVoiAnhChup(input: {
  /** Mã → Σ định mức gốc × SL SP, lúc chụp. */
  chup: Map<string, number>
  /** Mã → Σ định mức gốc × SL SP, định mức sống hôm nay. */
  song: Map<string, number>
  /** Số hiện tại đã quy đổi (mốc chụp từ bảng kê đang bày). */
  nay: MocSoat
  /** Mọi mã bảng kê đang có dòng (kể cả chỉ có trên đơn) — tra id/tên/ĐVT. */
  ma: Map<string, { material_id: string; name: string; unit: string | null }>
}): DoiSo[] {
  const chup = new Map([...input.chup].map(([k, v]) => [maChuan(k), v]))
  const song = new Map([...input.song].map(([k, v]) => [maChuan(k), v]))
  const ma = new Map([...input.ma].map(([k, v]) => [maChuan(k), v]))
  const out: DoiSo[] = []
  for (const code of new Set([...chup.keys(), ...song.keys()])) {
    const c = chup.get(code) ?? 0
    const s = song.get(code) ?? 0
    if (!khac(c, s)) continue
    const m = ma.get(code)
    const nayQty = m ? (input.nay.needs[m.material_id]?.qty ?? 0) : 0
    if (s > 0 && !(nayQty > 0)) continue
    const base = {
      key: m ? m.material_id : KHOA_MA_RONG + code,
      material_id: m?.material_id ?? null,
      code,
      name: m?.name ?? code,
      unit: m?.unit ?? null,
    }
    if (c === 0) out.push({ ...base, loai: 'moi', truoc: 0, nay: nayQty })
    else if (s === 0) out.push({ ...base, loai: 'bo', truoc: r4(c), nay: 0, uoc: true })
    else out.push({ ...base, loai: 'doi_sl', truoc: r4((nayQty * c) / s), nay: nayQty, uoc: true }) // prettier-ignore
  }
  return out
}

/** Số mua của một mã — lấy từ `tinhDongMua`, cùng hàm bước 1 Nhu cầu. */
export type SoMua = {
  /** Cần đã làm tròn theo đơn vị mua. */
  can: number
  conPhaiDat: number
  /** Đã gửi + chờ ký + nháp — mọi SL đang nằm trên đơn của lệnh. */
  daCoDon: number
}

export type Viec =
  | { k: 'dat'; qty: number }
  | { k: 'thua'; qty: number }
  | { k: 'du_vuot'; qty: number; pct: number }
  | { k: 'du'; pct: number; tuTon: boolean }
  | { k: 'khong_can' }
  | { k: 'chua_ma'; tang: number | null }

export type NhomDoi = 'dat_them' | 'thua' | 'chua_ma' | 'du'

export const NHOM_DOI: Record<NhomDoi, { nhan: string; thuTu: number }> = {
  dat_them: { nhan: 'Phải đặt thêm', thuTu: 0 },
  thua: { nhan: 'Thừa / dư nhiều', thuTu: 1 },
  chua_ma: { nhan: 'Chưa có mã kho', thuTu: 2 },
  du: { nhan: 'Đã đủ', thuTu: 3 },
}

/**
 * Việc Cung ứng phải làm với một thay đổi. Số "Đặt" là CÒN PHẢI ĐẶT của bước 1
 * (Cần − Tồn − Đã đặt − Nháp) — hai nơi không được nói hai số.
 */
export function viecCua(
  doi: Pick<DoiSo, 'key' | 'truoc' | 'nay'>,
  mua: SoMua | undefined,
): { viec: Viec; nhom: NhomDoi } {
  if (doi.key.startsWith(KHOA_CHUA_MA)) {
    const tang = doi.truoc === null || doi.nay === null ? null : r4(doi.nay - doi.truoc)
    return { viec: { k: 'chua_ma', tang }, nhom: 'chua_ma' }
  }
  if (!mua) return { viec: { k: 'khong_can' }, nhom: 'du' }
  if (mua.conPhaiDat > 0) return { viec: { k: 'dat', qty: mua.conPhaiDat }, nhom: 'dat_them' } // prettier-ignore
  if (!(mua.can > 0))
    return mua.daCoDon > 0
      ? { viec: { k: 'thua', qty: r4(mua.daCoDon) }, nhom: 'thua' }
      : { viec: { k: 'khong_can' }, nhom: 'du' }
  if (mua.daCoDon > mua.can) {
    const qty = r4(mua.daCoDon - mua.can)
    const pct = qty / mua.can
    return pct > NGUONG_DU
      ? { viec: { k: 'du_vuot', qty, pct }, nhom: 'thua' }
      : { viec: { k: 'du', pct, tuTon: false }, nhom: 'du' }
  }
  return { viec: { k: 'du', pct: 0, tuTon: mua.daCoDon < mua.can }, nhom: 'du' }
}

/** Một dòng của tab "Thay đổi chờ soát". */
export type DongDoi = DoiSo & {
  viec: Viec
  nhom: NhomDoi
  /** Null với vật tư chưa có mã kho — không biết đơn nào đã đặt nó. */
  daCoDon: number | null
  pos: { id: string; code: string }[]
  /** Mã SP của lệnh dùng vật tư này. */
  sps: string[]
  /** Lần sửa định mức gần nhất của vật tư này trên các SP đó. */
  suaLuc: string | null
  suaBoi: string | null
  /** Khoá các dòng định mức (nhật ký 0284) đã gây ra thay đổi này — nút ▸. */
  nguonDm: string[]
  /** Khoá các dòng lệnh đổi (SL / thêm / bỏ SP dùng vật tư này) — nút ▸. */
  nguonLenh: string[]
}

/** Một thay đổi của lệnh (T3) — đầu lệnh hoặc dòng lệnh — kèm TÊN người sửa. */
export type DongLenh = DoiLenh & { boi: string | null }

/**
 * Một dòng định mức đổi ròng từ mốc (T2) — kèm thứ màn cần: mã SP, SL SP trong
 * lệnh, ảnh hưởng số mua, TÊN người sửa (thay cho user id).
 */
export type DongDinhMuc = Omit<DongDmDoi, 'boi'> & {
  boi: string | null
  sp: string
  slSp: number
  anhHuong: AnhHuong[]
}

/** Nhóm việc trước (đặt thêm → thừa → chưa mã → đủ); trong nhóm số lớn trước. */
export function sapXepDoi(rows: DongDoi[]): DongDoi[] {
  const ts = (r: DongDoi) =>
    r.viec.k === 'dat' || r.viec.k === 'thua' || r.viec.k === 'du_vuot'
      ? r.viec.qty
      : (r.nay ?? 0)
  return [...rows].sort(
    (a, b) =>
      NHOM_DOI[a.nhom].thuTu - NHOM_DOI[b.nhom].thuTu ||
      ts(b) - ts(a) ||
      (a.code ?? a.name).localeCompare(b.code ?? b.name, 'vi'),
  )
}

export function demNhom(rows: DongDoi[]): Record<NhomDoi, number> {
  const out: Record<NhomDoi, number> = { dat_them: 0, thua: 0, chua_ma: 0, du: 0 }
  for (const r of rows) out[r.nhom]++
  return out
}

/**
 * Chưa soát lần nào mà định mức bị sửa SAU lúc duyệt, TRƯỚC ngày bật nhật ký 0284
 * — không còn số cũ để so từng dòng; chỉ nói được ai sửa, bao nhiêu. Sửa từ ngày
 * có nhật ký thì nằm ở `ThayDoiLenh.dinhMuc` với đủ cũ → mới.
 */
export type SuaSauMoc = {
  /** Mốc tính "sau": lúc duyệt lệnh (không có thì lúc phát / lúc tạo). */
  tu: string
  dongDinhMuc: number
  /** Trong số đó, dòng chưa gắn mã kho. */
  dongChuaMa: number
  dongLenh: number
  lanCuoi: string | null
  nguoi: string[]
  /** Dòng không ghi người sửa — thường là nạp bằng script. */
  khongTen: number
  sps: { code: string; dong: number; lanCuoi: string; nguoi: string | null }[]
}

export type ThayDoiLenh = {
  moc:
    | { k: 'soat'; luc: string; boi: string | null }
    /** Chưa soát lần nào: mốc là lúc duyệt (lệnh nạp từ file không có ngày duyệt → lúc phát / lúc tạo). */
    | { k: 'duyet'; luc: string; laDuyet: boolean; coAnhChup: boolean }
  dong: DongDoi[]
  /** So ảnh chụp lúc soát với bây giờ (chỉ có khi mốc là lần soát) — để tính dấu. */
  thongTin: DoiThongTin[]
  /**
   * Thay đổi của lệnh để BÀY (T3): nhật ký 0285 + phần mốc soát thấy mà nhật ký
   * không có. Tab Lệnh SX đọc cái này, không đọc `thongTin`.
   */
  lenh: DongLenh[]
  /** Số cặp dòng lệnh xoá + nạp lại giống hệt đã triệt tiêu. */
  napLaiLenh: number
  /** Dòng định mức đổi ròng từ mốc, đọc từ nhật ký 0284 (T2). */
  dinhMuc: DongDinhMuc[]
  /** Số cặp xoá + nạp lại giống hệt đã triệt tiêu — để màn nói ra. */
  napLaiGiong: number
  suaSauMoc: SuaSauMoc | null
  choSoat: boolean
  /** Dấu của tập thay đổi — server so lại lúc ghi "Đã soát" để không soát nhầm bản cũ. */
  dau: string
}

/**
 * Dấu ngắn của tập thay đổi (djb2). Người bấm "Đã soát" gửi dấu của thứ họ đang
 * nhìn; có ai sửa thêm trong lúc đó thì dấu lệch và server từ chối.
 */
export function dauThayDoi(t: {
  /** Chỉ cần khoá + số trước/nay — dùng được cả `DoiSo` thô lẫn `DongDoi`. */
  dong: Pick<DoiSo, 'key' | 'truoc' | 'nay'>[]
  thongTin: DoiThongTin[]
  /** Dòng định mức đổi — so theo khoá + số bây giờ (sửa đi sửa lại ra cùng số thì cùng dấu). */
  dinhMuc?: Pick<DongDmDoi, 'key' | 'loai' | 'sau'>[]
  /** Thay đổi của lệnh (nhật ký 0285) — cũng theo khoá + giá trị bây giờ. */
  lenh?: Pick<DoiLenh, 'key' | 'sau'>[]
  suaSauMoc: Pick<SuaSauMoc, 'dongDinhMuc' | 'dongLenh' | 'lanCuoi'> | null
}): string {
  const s = JSON.stringify([
    t.dong.map((d) => [d.key, d.truoc, d.nay]).sort(),
    t.thongTin.map((x) => [x.k, x.nhan, x.truoc, x.nay]).sort(),
    (t.dinhMuc ?? []).map((d) => [d.key, d.loai, JSON.stringify(d.sau)]).sort(),
    (t.lenh ?? []).map((d) => [d.key, JSON.stringify(d.sau)]).sort(),
    t.suaSauMoc
      ? [t.suaSauMoc.dongDinhMuc, t.suaSauMoc.dongLenh, t.suaSauMoc.lanCuoi]
      : null,
  ])
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Số thay đổi người soát nhìn thấy — đếm lên nút và ghi vào `changes`: mã vật
 * tư đổi + thay đổi của lệnh + dòng định mức đổi (mỗi tab một phần). Có `lenh`
 * (T3) thì đếm nó thay `thongTin` — hai thứ nói cùng một thay đổi.
 */
export function soThayDoi(
  t: Pick<ThayDoiLenh, 'dong' | 'thongTin'> & { dinhMuc?: unknown[]; lenh?: unknown[] },
): number {
  return t.dong.length + (t.lenh ?? t.thongTin).length + (t.dinhMuc?.length ?? 0)
}

/* ── B3 · Chuông (02/11/2026) ─────────────────────────────────────────── */

/** Đủ để viết một tin chuông cho một lệnh chờ soát. */
export type TomTatChoSoat = {
  code: string
  soMa: number
  soThongTin: number
  /** Dòng định mức đổi ròng (nhật ký 0284). */
  soDongDm?: number
  suaSau: { dongDinhMuc: number } | null
  moc: ThayDoiLenh['moc']
}

/**
 * Tiêu đề tin: mã lệnh + VIỆC — số mã đổi, hoặc phần sửa chưa có số cũ. Không
 * kể từng mã: tin bấm vào là mở thẳng tab Thay đổi, ở đó mới đủ chỗ.
 */
export function tieuDeTin(t: TomTatChoSoat): string {
  const phan: string[] = []
  if (t.soMa > 0) phan.push(`${t.soMa} mã đổi số cần`)
  if (t.soThongTin > 0) phan.push(`${t.soThongTin} thông tin lệnh đổi`)
  if (t.soDongDm) phan.push(`${t.soDongDm} dòng định mức sửa`)
  if (phan.length === 0 && t.suaSau) {
    const sau = t.moc.k === 'duyet' && !t.moc.laDuyet ? 'phát lệnh' : 'duyệt'
    phan.push(`định mức sửa ${t.suaSau.dongDinhMuc} dòng sau ${sau}`)
  }
  return `${t.code} — ${phan.join(' · ') || 'có thay đổi'}`
}

export type QuyetDinhTin = 'bo_qua' | 'cap_nhat' | 'them'

/**
 * MỖI NGƯỜI MỖI LỆNH MỘT TIN CHƯA ĐỌC. So với tin gần nhất của người đó cho
 * lệnh đó:
 *  - cùng dấu thay đổi → đã báo đúng thứ này rồi, bỏ qua (kể cả đã đọc);
 *  - khác dấu mà tin cũ CHƯA ĐỌC → sửa tin cũ (đưa lên đầu), không chèn thêm —
 *    Kỹ thuật lưu 20 ô liền thì người mua vẫn chỉ thấy một tin;
 *  - khác dấu mà tin cũ đã đọc (hoặc chưa có tin) → tin mới.
 */
export function quyetDinhTin(
  cu: { dau: string | null; daDoc: boolean } | null,
  dau: string,
): QuyetDinhTin {
  if (cu && cu.dau === dau) return 'bo_qua'
  if (cu && !cu.daDoc) return 'cap_nhat'
  return 'them'
}

/**
 * Người nhận tin của một lệnh: trưởng phòng Cung ứng + người đang cầm các đơn
 * mua của lệnh, bỏ người vừa sửa (không tự báo mình) và người đã nghỉ.
 */
export function nguoiNhanTin(v: {
  truongPhong: string[]
  phuTrach: string[]
  dangLam: Set<string>
  nguoiSua: string | null
}): string[] {
  return [...new Set([...v.truongPhong, ...v.phuTrach])].filter(
    (id) => v.dangLam.has(id) && id !== v.nguoiSua,
  )
}

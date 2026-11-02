import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { after } from 'next/server'
import { emit } from '@/events/bus'
import { Conflict, Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { bomSnapshotRepo } from '@/modules/dept/production/bom-snapshot.repo'
import { todayVn } from '@/lib/date-vn'
import { tinhDongMua } from '@/lib/lsx-bang-ke-mua'
import {
  chupMoc,
  dauThayDoi,
  KHOA_CHUA_MA,
  nguoiNhanTin,
  tieuDeTin,
  sapXepDoi,
  soThayDoi,
  soVoiAnhChup,
  soVoiMoc,
  viecCua,
  type DoiSo,
  type DongDoi,
  type MocSoat,
  type SuaSauMoc,
  type ThayDoiLenh,
} from '@/lib/lenh-doi'
import { buildBangKe } from '@/lib/lsx-bang-ke'
import {
  gopNhuCau,
  loadLsxBangKe,
  loadNhuCauLenh,
  type LsxBangKe,
} from './lsx-bang-ke.service'
import { isSupplyStaff } from './suppliers.service'
import { lenhDoiRepo, type DongDinhMucSong } from './lenh-doi.repo'
import type { SoatInput } from './lenh-doi.schema'

/**
 * LỆNH ĐỔI — CHỜ SOÁT (02/11/2026, bản vẽ RL9ToGvjouLFkhNVeruAbS).
 *
 * Màn Kế hoạch mua của lệnh hỏi: TỪ LẦN SOÁT TRƯỚC, số cần vật tư đổi gì, và
 * phải làm gì với từng thay đổi. Số "nay" là ĐÚNG bảng kê đang bày (cùng
 * `loadLsxBangKe`, bật định mức chưa kiểm như mặc định của màn) — mốc ghi bằng
 * chính số đó, nên lần sau so đúng thứ người mua đã nhìn.
 */

/** Một lần soát trong lịch sử (⋯ › Lịch sử soát). */
export type LanSoat = {
  id: string
  luc: string
  boi: string | null
  so_doi: number
  ghi_chu: string | null
}

export type LenhDoiCuaLenh = {
  thayDoi: ThayDoiLenh
  lichSu: LanSoat[]
  /** Lúc duyệt lệnh — mốc đầu tiên trong lịch sử soát. */
  duyetLuc: string | null
  /** Chưa đọc được bảng mốc soát (chưa áp 0282) — màn nói thẳng, nút soát khoá. */
  loi: string | null
}

async function assertCanEdit(user: User): Promise<void> {
  if (user.role === 'admin') return
  if (await isSupplyStaff(user)) return
  throw Forbidden('Chỉ nhân viên phòng Cung ứng ghi mốc soát')
}

/** Số hiện tại của lệnh dưới dạng mốc — trích từ bảng kê đang bày. */
export function mocHienTai(bk: LsxBangKe): MocSoat {
  return chupMoc({
    rows: bk.rows,
    chuaMa: bk.chua_ma.items.map((i) => ({
      key: i.key,
      name: i.name,
      unit: i.unit,
      qty_total: i.qty_total,
    })),
    ship_date: bk.lsx.ship_date,
    materials_due_at: bk.lsx.materials_due_at,
    products: bk.products.map((p) => ({ id: p.id, code: p.code, qty: p.qty })),
  })
}

const maChuan = (s: string) => s.trim().toUpperCase()

/** Mã → Σ (định mức gốc × SL SP) của một tập dòng. */
function tongGoc(
  rows: { product_id: string; material_code: string | null; qty: number }[],
  slSp: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.material_code) continue
    const k = maChuan(r.material_code)
    out.set(k, (out.get(k) ?? 0) + r.qty * (slSp.get(r.product_id) ?? 0))
  }
  return out
}

/** Lần sửa định mức gần nhất trong một tập dòng: lúc + tên người (null = không ghi). */
function suaCuoi(
  rows: DongDinhMucSong[],
  names: Map<string, string>,
): { suaLuc: string | null; suaBoi: string | null } {
  let best: DongDinhMucSong | null = null
  for (const r of rows) if (!best || r.updated_at > best.updated_at) best = r
  return {
    suaLuc: best?.updated_at ?? null,
    suaBoi: best?.updated_by ? (names.get(best.updated_by) ?? null) : null,
  }
}

/**
 * Định mức / dòng lệnh sửa SAU mốc duyệt mà ảnh chụp không phủ — chỉ đếm, vì
 * không còn số cũ. Null khi không có gì bị sửa.
 */
function tomSuaSau(
  tu: string,
  parts: DongDinhMucSong[],
  names: Map<string, string>,
  dongLenh: number,
  maSp: Map<string, string>,
): SuaSauMoc | null {
  const sau = parts.filter((p) => p.updated_at > tu)
  // Chỉ ĐỊNH MỨC sửa mới đẩy lệnh vào "chờ soát". Dòng lệnh thì không: chính
  // lượt duyệt và mọi lượt nạp script đều chạm `updated_at` của dòng lệnh (đo
  // 02/11: 7 lệnh không sửa gì định mức vẫn có 2–87 dòng lệnh "sửa sau duyệt") —
  // đếm nó là báo động giả. Số dòng lệnh chỉ đi kèm để người soát biết.
  if (sau.length === 0) return null
  const theoSp = new Map<string, DongDinhMucSong[]>()
  for (const p of sau) theoSp.set(p.product_id, [...(theoSp.get(p.product_id) ?? []), p])
  const sps = [...theoSp].map(([id, rows]) => {
    const c = suaCuoi(rows, names)
    return { code: maSp.get(id) ?? id, dong: rows.length, lanCuoi: c.suaLuc!, nguoi: c.suaBoi } // prettier-ignore
  })
  sps.sort((a, b) => b.lanCuoi.localeCompare(a.lanCuoi))
  const nguoi = [
    ...new Set(
      sau.map((p) => (p.updated_by ? names.get(p.updated_by) : null)).filter(Boolean),
    ),
  ] as string[]
  return {
    tu,
    dongDinhMuc: sau.length,
    dongChuaMa: sau.filter((p) => !p.material_code).length,
    dongLenh,
    lanCuoi: suaCuoi(sau, names).suaLuc,
    nguoi,
    khongTen: sau.filter((p) => !p.updated_by).length,
    sps,
  }
}

type LenhGoc = { id: string; approved_at: string | null; issued_at: string | null; created_at: string } // prettier-ignore

/** Đầu vào chung của phép so — màn chi tiết lấy từ bảng kê đầy đủ, số đếm lấy từ đường nhẹ. */
type DauVaoSo = {
  lsx: LenhGoc
  nay: MocSoat
  products: { id: string; code: string; qty: number }[]
  /** Mã → id/tên/ĐVT, tra từ các dòng bảng kê. */
  ma: Map<string, { material_id: string; name: string; unit: string | null }>
}

/**
 * LÕI SO MỐC — dùng chung cho màn chi tiết (`lenhDoiCua`) và số đếm chờ soát
 * (`trangThaiChoSoat`). Hai nơi phải ra CÙNG danh sách thay đổi: menu báo 8 mà
 * mở ra 7 là hỏng niềm tin vào cả con số.
 */
async function soLenh(v: DauVaoSo) {
  const { lsx, nay } = v
  const [reviewsRes, song] = await Promise.all([
    lenhDoiRepo.listByLsx(lsx.id).then(
      (rows) => ({ rows, loi: null as string | null }),
      (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        // PostgREST báo bảng chưa có bằng tiếng Anh — nói lại cho người đọc.
        return {
          rows: [],
          loi: /supply_lsx_reviews/.test(msg) ? 'bảng mốc soát chưa có (chưa áp migration 0282)' : msg, // prettier-ignore
        }
      },
    ),
    lenhDoiRepo.dinhMucSong(v.products.map((p) => p.id)),
  ])
  const slSp = new Map<string, number>()
  for (const p of v.products) slSp.set(p.id, (slSp.get(p.id) ?? 0) + p.qty)
  const maSp = new Map(v.products.map((p) => [p.id, p.code]))
  const moiNhat = reviewsRes.rows[0]

  let so: DoiSo[]
  let thongTin: ThayDoiLenh['thongTin'] = []
  let suaSauMoc: SuaSauMoc | null = null
  let moc: ThayDoiLenh['moc']
  if (moiNhat) {
    ;({ so, thongTin } = soVoiMoc(moiNhat.snapshot, nay))
    moc = {
      k: 'soat',
      luc: moiNhat.reviewed_at,
      boi: moiNhat.reviewed_by_name,
    }
  } else {
    // Chưa soát lần nào: mốc là lúc duyệt. SP có ảnh chụp (0142) lấy số trong
    // ảnh; SP không có ảnh thì dòng định mức CHƯA sửa từ lúc đó coi như số lúc
    // duyệt — tránh báo "mã mới" cho lệnh duyệt trước khi có ảnh chụp.
    const tu = lsx.approved_at ?? lsx.issued_at ?? lsx.created_at
    const [chup, dongLenh] = await Promise.all([
      bomSnapshotRepo.listByOrder(lsx.id),
      lenhDoiRepo.dongLenhSuaSau(lsx.id, tu),
    ])
    const coAnh = new Set(chup.map((c) => c.product_id))
    const goc = tongGoc(
      [
        ...chup.map((c) => ({ product_id: c.product_id, material_code: c.material_code, qty: Number(c.qty_per_unit) })), // prettier-ignore
        ...song.rows.filter((p) => !coAnh.has(p.product_id) && p.updated_at <= tu),
      ],
      slSp,
    )
    so = soVoiAnhChup({
      chup: goc,
      song: tongGoc(song.rows, slSp),
      nay,
      ma: v.ma,
    })
    suaSauMoc = tomSuaSau(tu, song.rows, song.names, dongLenh, maSp)
    moc = {
      k: 'duyet',
      luc: tu,
      laDuyet: !!lsx.approved_at,
      coAnhChup: chup.length > 0,
    }
  }
  return {
    so,
    thongTin,
    suaSauMoc,
    moc,
    song,
    reviews: reviewsRes.rows,
    loi: reviewsRes.loi,
  }
}

/** Mã → id/tên/ĐVT từ các dòng bảng kê (kể cả mã chỉ có trên đơn). */
function maTuDong(
  rows: {
    material_id: string
    material_code: string
    material_name: string
    unit: string
  }[],
): DauVaoSo['ma'] {
  return new Map(
    rows
      .filter((r) => r.material_code)
      .map((r) => [r.material_code, { material_id: r.material_id, name: r.material_name, unit: r.unit || null }]), // prettier-ignore
  )
}

/**
 * THAY ĐỔI CỦA LỆNH so với mốc — dựng từ bảng kê đã nạp. Bảng kê phải là bản
 * TÍNH CẢ định mức chưa kiểm (mặc định của màn), vì mốc được ghi bằng số đó.
 */
export async function lenhDoiCua(bk: LsxBangKe): Promise<LenhDoiCuaLenh> {
  const lsx = await productionRepo.findById(bk.lsx.id)
  if (!lsx) throw NotFound('Không tìm thấy lệnh sản xuất')
  const { so, thongTin, suaSauMoc, moc, song, reviews, loi } = await soLenh({
    lsx,
    nay: mocHienTai(bk),
    products: bk.products,
    ma: maTuDong(bk.rows),
  })

  const rowById = new Map(bk.rows.map((r) => [r.material_id, r]))
  const chuaMaByKey = new Map(bk.chua_ma.items.map((i) => [KHOA_CHUA_MA + i.key, i]))
  const dong: DongDoi[] = so.map((s) => {
    const r = s.material_id ? rowById.get(s.material_id) : undefined
    const m = r ? tinhDongMua(r) : undefined
    const mua = m ? { can: m.can, conPhaiDat: m.conPhaiDat, daCoDon: m.daGui + m.nhap } : undefined // prettier-ignore
    const { viec, nhom } = viecCua(s, mua)
    const laChuaMa = s.key.startsWith(KHOA_CHUA_MA)
    const cm = laChuaMa ? chuaMaByKey.get(s.key) : undefined
    const sps = cm ? cm.products.map((p) => p.code) : [...new Set((r?.from_products ?? []).map((p) => p.code))] // prettier-ignore
    // Lần sửa gần nhất: dòng định mức mang mã này; vật tư chưa mã thì mọi dòng
    // chưa mã của các SP dùng nó (không có khoá nào khác để lần).
    const spIds = new Set(cm?.products.map((p) => p.product_id) ?? [])
    const lienQuan = s.code
      ? song.rows.filter((p) => p.material_code && maChuan(p.material_code) === maChuan(s.code!)) // prettier-ignore
      : song.rows.filter((p) => !p.material_code && spIds.has(p.product_id))
    return {
      ...s,
      viec,
      nhom,
      daCoDon: laChuaMa ? null : (mua?.daCoDon ?? 0),
      pos: (r?.pos ?? []).map((p) => ({ id: p.id, code: p.code })),
      sps,
      ...suaCuoi(lienQuan, song.names),
    }
  })

  const base = { dong: sapXepDoi(dong), thongTin, suaSauMoc }
  return {
    thayDoi: {
      moc,
      ...base,
      choSoat: dong.length > 0 || thongTin.length > 0 || suaSauMoc !== null,
      dau: dauThayDoi(base),
    },
    lichSu: reviews.map((r) => ({
      id: r.id,
      luc: r.reviewed_at,
      boi: r.reviewed_by_name,
      so_doi: r.changes,
      ghi_chu: r.note,
    })),
    duyetLuc: lsx.approved_at,
    loi,
  }
}

/** Tình trạng "chờ soát" của một lệnh — đủ cho chip, cột danh sách và số trên menu. */
export type TrangThaiLenhDoi = {
  lsx_id: string
  code: string
  /** Dấu tập thay đổi — CÙNG `dauThayDoi` với tab Thay đổi; chuông dùng để khỏi báo lại. */
  dau: string
  choSoat: boolean
  /** Số vật tư đổi số Cần. */
  soMa: number
  /** Thông tin lệnh đổi (ngày xuất, mốc vật tư, SL từng SP). */
  soThongTin: number
  suaSau: Pick<SuaSauMoc, 'dongDinhMuc' | 'dongChuaMa' | 'lanCuoi' | 'nguoi' | 'khongTen'> | null // prettier-ignore
  moc: ThayDoiLenh['moc']
}

/**
 * Tình trạng của MỘT lệnh qua đường NHẸ: chỉ nạp nguồn số cần (định mức, định
 * hình, số tay) rồi dựng dòng bằng chính `buildBangKe` — không nạp đơn mua /
 * tồn / giá. Số Cần không phụ thuộc mấy thứ đó, nên mốc chụp ra TRÙNG KHÍT mốc
 * của màn chi tiết (cùng `chupMoc`), và danh sách thay đổi cũng vậy.
 */
async function trangThaiMotLenh(lsxId: string): Promise<TrangThaiLenhDoi | null> {
  const [lsx, nc] = await Promise.all([
    productionRepo.findById(lsxId),
    loadNhuCauLenh(lsxId),
  ])
  if (!lsx) return null
  const rows = buildBangKe({
    needs: gopNhuCau(nc.bom.lines, nc.comp),
    manual: nc.manual,
    facts: new Map(),
    includeDraft: true,
  })
  const nay = chupMoc({
    rows,
    chuaMa: nc.bom.chua_ma.items.map((i) => ({ key: i.key, name: i.name, unit: i.unit, qty_total: i.qty_total })), // prettier-ignore
    ship_date: lsx.ship_date,
    materials_due_at: lsx.materials_due_at,
    products: nc.bom.products,
  })
  const { so, thongTin, suaSauMoc: s, moc, loi } = await soLenh({ lsx, nay, products: nc.bom.products, ma: maTuDong(rows) }) // prettier-ignore
  if (loi) throw new Error(loi)
  return {
    lsx_id: lsxId,
    code: lsx.code,
    dau: dauThayDoi({ dong: so, thongTin, suaSauMoc: s }),
    choSoat: so.length > 0 || thongTin.length > 0 || s !== null,
    soMa: so.length,
    soThongTin: thongTin.length,
    suaSau: s && { dongDinhMuc: s.dongDinhMuc, dongChuaMa: s.dongChuaMa, lanCuoi: s.lanCuoi, nguoi: s.nguoi, khongTen: s.khongTen }, // prettier-ignore
    moc,
  }
}

/** Giữ kết quả 2 phút: số trên menu chạy ở MỌI lần mở trang của khu Cung ứng. */
const GIU_MS = 120_000
/**
 * Số lệnh tính cùng lúc (mỗi lệnh ~10 truy vấn). Đo 02/11/2026 trên 17 lệnh:
 * nhóm 4 → 6,9 s · nhóm 8 → 3,8–4,4 s · cả 17 → 2,2 s; Supabase chịu được.
 */
const SONG_SONG = 20
/**
 * Bộ nhớ tạm đặt trên `globalThis`: Next nạp module của route API và của trang
 * thành HAI bản (đo 02/11: soát xong ở route, danh sách vẫn nói 8). Đặt ở đây
 * thì mọi bản trong cùng tiến trình dùng chung; còn giữa các tiến trình thì
 * `phienBan` của bảng mốc soát lo — vừa có ai soát là tính lại ngay.
 */
type Kho = {
  boNho: { luc: number; ban: string; data: Map<string, TrangThaiLenhDoi> } | null
  dangTinh: Promise<Map<string, TrangThaiLenhDoi>> | null
}
const kho: Kho = ((globalThis as { __hgLenhDoi?: Kho }).__hgLenhDoi ??= {
  boNho: null,
  dangTinh: null,
})

async function tinhTatCa(ban: string): Promise<Map<string, TrangThaiLenhDoi>> {
  const lenh = await productionRepo.listActive()
  const out = new Map<string, TrangThaiLenhDoi>()
  // Chia nhóm để lệnh có tăng lên vài chục cũng không bắn hàng trăm truy vấn một lúc.
  for (let i = 0; i < lenh.length; i += SONG_SONG) {
    const nhom = await Promise.all(
      lenh.slice(i, i + SONG_SONG).map((l) =>
        trangThaiMotLenh(l.id).catch((e: unknown) => {
          console.error('[lenh-doi] tính trạng thái lỗi', l.code, e)
          return null
        }),
      ),
    )
    for (const t of nhom) if (t) out.set(t.lsx_id, t)
  }
  kho.boNho = { luc: Date.now(), ban, data: out }
  // Lần tính nào cũng báo — kể cả lần tính định kỳ, nên sửa bằng script cũng có
  // tin. Luật "một tin chưa đọc / lệnh" ở handler lo việc không báo lặp.
  chayNen(() => baoChoSoat([...out.values()], null))
  return out
}

function tinhLai(ban: string): Promise<Map<string, TrangThaiLenhDoi>> {
  kho.dangTinh ??= tinhTatCa(ban).finally(() => (kho.dangTinh = null))
  return kho.dangTinh
}

/**
 * Tình trạng chờ soát của MỌI lệnh đang chạy — nguồn DUY NHẤT cho số trên menu
 * "Kế hoạch mua" và chip / cột của danh sách lệnh.
 *  - Vừa có ai soát / xoá mốc (phiên bản đổi) hoặc chưa có bản nào → chờ tính.
 *  - Quá 2 phút (định mức / lệnh có thể đã đổi) → trả bản cũ, tính lại phía sau.
 */
export async function trangThaiChoSoat(): Promise<Map<string, TrangThaiLenhDoi>> {
  const ban = await lenhDoiRepo.phienBan()
  const b = kho.boNho
  if (!b || b.ban !== ban) return tinhLai(ban)
  if (Date.now() - b.luc >= GIU_MS) chayNen(() => tinhLai(ban))
  return b.data
}

const demCho = (m: Map<string, TrangThaiLenhDoi>) =>
  [...m.values()].filter((t) => t.choSoat).length

/** Số lệnh đang chờ soát — đếm từ cùng nguồn với chip "Chờ soát" của danh sách. */
export async function demLenhChoSoat(): Promise<number> {
  return demCho(await trangThaiChoSoat())
}

/**
 * Số trên MENU — KHÔNG BAO GIỜ bắt trang chờ phép tính (~2 s cho 17 lệnh), chỉ
 * chờ truy vấn phiên bản (một dòng). Chưa có bản khớp phiên bản thì trả null
 * (menu chưa hiện số lần này) và tính phía sau; lần mở trang kế tiếp là có.
 */
export async function demLenhChoSoatKhongCho(): Promise<number | null> {
  const ban = await lenhDoiRepo.phienBan()
  const b = kho.boNho
  if (!b || b.ban !== ban) {
    chayNen(() => tinhLai(ban))
    return null
  }
  if (Date.now() - b.luc >= GIU_MS) chayNen(() => tinhLai(ban))
  return demCho(b.data)
}

/**
 * Việc chạy SAU khi trả response (`after` của Next — Vercel giữ hàm sống tới
 * khi xong). Ngoài phạm vi một request (test, script) thì chạy thẳng, không chờ.
 */
function chayNen(viec: () => Promise<unknown>): void {
  const an = () =>
    viec().catch((e: unknown) => console.error('[lenh-doi] việc nền lỗi', e))
  try {
    after(an)
  } catch {
    void an()
  }
}

/**
 * Phát tin chờ soát cho các lệnh đang chờ: người nhận = trưởng phòng Cung ứng
 * + người cầm các đơn mua của lệnh, bỏ người vừa sửa. Handler giữ mỗi người
 * mỗi lệnh một tin chưa đọc.
 */
async function baoChoSoat(
  tts: TrangThaiLenhDoi[],
  nguoiSua: string | null,
): Promise<void> {
  const cho = tts.filter((t) => t.choSoat)
  if (cho.length === 0) return
  const nn = await lenhDoiRepo.nguoiNhan(cho.map((t) => t.lsx_id))
  await emit({
    name: 'supply.lsx.cho_soat',
    actor_id: nguoiSua,
    items: cho.map((t) => ({
      lsx_id: t.lsx_id,
      title: tieuDeTin(t),
      dau: t.dau,
      recipient_ids: nguoiNhanTin({
        truongPhong: nn.truongPhong,
        phuTrach: nn.phuTrach.get(t.lsx_id) ?? [],
        dangLam: nn.dangLam,
        nguoiSua,
      }),
    })),
  })
}

/**
 * Định mức của một SP / một lệnh vừa đổi trên màn → tính lại NGAY các lệnh
 * đang chạy liên quan (chạy nền, không làm chậm lượt lưu), vá bộ nhớ của số
 * trên menu, rồi báo nếu lệnh đang chờ soát.
 */
export function capNhatLenhDoi(
  nguon: { product_id: string } | { lsx_id: string },
  nguoiSua: string,
): void {
  chayNen(async () => {
    const ids =
      'lsx_id' in nguon
        ? [nguon.lsx_id]
        : await lenhDoiRepo.lenhDangChayCuaSp(nguon.product_id)
    if (ids.length === 0) return
    const tts = (await Promise.all(ids.map((id) => trangThaiMotLenh(id)))).filter(
      (t): t is TrangThaiLenhDoi => t !== null,
    )
    for (const t of tts) kho.boNho?.data.set(t.lsx_id, t)
    await baoChoSoat(tts, nguoiSua)
  })
}

export const lenhDoiService = {
  /**
   * "ĐÃ SOÁT" — ghi mốc mới bằng đúng số hiện tại. Từ chối khi tập thay đổi đã
   * khác thứ người bấm đang nhìn (có người sửa định mức / lệnh trong lúc đó):
   * soát nhầm bản cũ là nuốt mất một thay đổi chưa ai thấy.
   */
  async soat(user: User, input: SoatInput): Promise<{ id: string; reviewed_at: string }> {
    await assertCanEdit(user)
    const bk = await loadLsxBangKe(user, input.production_order_id, todayVn(), true)
    if (!bk) throw NotFound('Không tìm thấy lệnh sản xuất')
    const { thayDoi, loi } = await lenhDoiCua(bk)
    if (loi) throw new Error(`Chưa đọc được bảng mốc soát (0282): ${loi}`)
    if (thayDoi.dau !== input.dau) {
      throw Conflict(
        'Lệnh vừa có thay đổi mới từ lúc bạn mở màn — tải lại trang, xem rồi soát lại',
        'STALE',
      )
    }
    const moc = await lenhDoiRepo.insert({
      production_order_id: input.production_order_id,
      reviewed_by: user.id,
      changes: soThayDoi(thayDoi),
      note: input.note?.trim() || null,
      snapshot: mocHienTai(bk),
    })
    // Cùng tiến trình thì bỏ bộ nhớ luôn; tiến trình khác tự thấy qua `phienBan`.
    kho.boNho = null
    await emit({ name: 'supply.lsx.da_soat', lsx_id: input.production_order_id, reviewed_by: user.id }) // prettier-ignore
    return moc
  },
}

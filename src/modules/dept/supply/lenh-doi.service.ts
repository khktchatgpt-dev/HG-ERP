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
import { loadLsxBangKe, type LsxBangKe } from './lsx-bang-ke.service'
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

/**
 * THAY ĐỔI CỦA LỆNH so với mốc — dựng từ bảng kê đã nạp. Bảng kê phải là bản
 * TÍNH CẢ định mức chưa kiểm (mặc định của màn), vì mốc được ghi bằng số đó.
 */
export async function lenhDoiCua(bk: LsxBangKe): Promise<LenhDoiCuaLenh> {
  const lsxId = bk.lsx.id
  const productIds = bk.products.map((p) => p.id)
  const [lsx, reviewsRes, song] = await Promise.all([
    productionRepo.findById(lsxId),
    lenhDoiRepo.listByLsx(lsxId).then(
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
    lenhDoiRepo.dinhMucSong(productIds),
  ])
  if (!lsx) throw NotFound('Không tìm thấy lệnh sản xuất')

  const nay = mocHienTai(bk)
  const slSp = new Map(bk.products.map((p) => [p.id, p.qty]))
  const maSp = new Map(bk.products.map((p) => [p.id, p.code]))
  const moiNhat = reviewsRes.rows[0]

  let so: DoiSo[]
  let thongTin: ThayDoiLenh['thongTin'] = []
  let suaSauMoc: SuaSauMoc | null = null
  let moc: ThayDoiLenh['moc']
  if (moiNhat) {
    ;({ so, thongTin } = soVoiMoc(moiNhat.snapshot, nay))
    moc = { k: 'soat', luc: moiNhat.reviewed_at, boi: moiNhat.reviewed_by_name }
  } else {
    // Chưa soát lần nào: mốc là lúc duyệt. SP có ảnh chụp (0142) lấy số trong
    // ảnh; SP không có ảnh thì dòng định mức CHƯA sửa từ lúc đó coi như số lúc
    // duyệt — tránh báo "mã mới" cho lệnh duyệt trước khi có ảnh chụp.
    const tu = lsx.approved_at ?? lsx.issued_at ?? lsx.created_at
    const [chup, dongLenh] = await Promise.all([
      bomSnapshotRepo.listByOrder(lsxId),
      lenhDoiRepo.dongLenhSuaSau(lsxId, tu),
    ])
    const coAnh = new Set(chup.map((c) => c.product_id))
    const goc = tongGoc(
      [
        ...chup.map((c) => ({ product_id: c.product_id, material_code: c.material_code, qty: Number(c.qty_per_unit) })), // prettier-ignore
        ...song.rows.filter((p) => !coAnh.has(p.product_id) && p.updated_at <= tu),
      ],
      slSp,
    )
    const ma = new Map(
      bk.rows
        .filter((r) => r.material_code)
        .map((r) => [r.material_code, { material_id: r.material_id, name: r.material_name, unit: r.unit || null }]), // prettier-ignore
    )
    so = soVoiAnhChup({ chup: goc, song: tongGoc(song.rows, slSp), nay, ma })
    suaSauMoc = tomSuaSau(tu, song.rows, song.names, dongLenh, maSp)
    moc = { k: 'duyet', luc: tu, laDuyet: !!lsx.approved_at, coAnhChup: chup.length > 0 }
  }

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
    lichSu: reviewsRes.rows.map((r) => ({
      id: r.id,
      luc: r.reviewed_at,
      boi: r.reviewed_by_name,
      so_doi: r.changes,
      ghi_chu: r.note,
    })),
    duyetLuc: lsx.approved_at,
    loi: reviewsRes.loi,
  }
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
    return lenhDoiRepo.insert({
      production_order_id: input.production_order_id,
      reviewed_by: user.id,
      changes: soThayDoi(thayDoi),
      note: input.note?.trim() || null,
      snapshot: mocHienTai(bk),
    })
  },
}

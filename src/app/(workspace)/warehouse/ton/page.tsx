import { authService } from '@/modules/core/auth/auth.service'
import { hangLenhService } from '@/modules/dept/warehouse/hang-lenh.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { todayVn } from '@/lib/date-vn'
import {
  RO_LENH,
  cuaLenhTheoMa,
  giuChoLenhKhac,
  lenhXong,
  roCuaLenh,
  tomTatLenh,
  type RoLenh,
} from '@/lib/kho-ton-lenh'
import { TonKhoScreen } from './TonKhoScreen'
import { TonLenhScreen } from './TonLenhScreen'
import { RO_TON, type RoTon } from './ro-ton'
import type { CuaLenh, LenhDong, MaChiTiet } from './ton-lenh.shared'

export const metadata = { title: 'Kho · Tồn kho' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const EPS = 1e-6

/**
 * TỒN KHO — `/warehouse/ton` (Bước 3 Kho, `docs/kho-buoc-3-ton-kho.md`), thêm
 * chế độ THEO LỆNH ở Kho đợt 2 · B5 (`?xem=lenh`, bản vẽ
 * https://claude.ai/artifact/L2FFuzCdLzMPzQJ7ULUprF).
 *
 * Theo mã: `stockService.listStockPage` lọc và phân trang Ở SERVER, tìm không
 * dấu, đếm các rổ cùng bộ lọc, `available` = dùng được − giữ cho lệnh đã duyệt.
 * B5 thêm cột "Của lệnh" + rổ "Tồn chung" — cùng nguồn chia tồn với Theo lệnh.
 *
 * Theo lệnh: `hangLenhService.tatCa` (một lượt mọi lệnh, ~2 s đo 12/10) — cùng
 * hàm với hộp "Lấy hàng của lệnh" ở phiếu xuất, nên hai màn ra cùng một số.
 *
 * MỌI BỘ LỌC NẰM TRÊN URL (chế độ · rổ · tìm · nhóm · trang · lệnh đang mở).
 */
export default async function TonKhoPage({
  searchParams,
}: {
  searchParams: Promise<{
    ro?: string
    q?: string
    nhom?: string
    trang?: string
    xem?: string
    lenh?: string
  }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams

  if (sp.xem === 'lenh') {
    const t = await hangLenhService.tatCa(user)
    const today = todayVn()
    const byId = new Map(t.lenh.map((l) => [l.id, l]))
    const giu = giuChoLenhKhac(t.rows, byId)
    const tt = tomTatLenh(t.rows, t.lenh)
    const coDong = new Set(tt.map((x) => x.lenh.id))
    const lenh: LenhDong[] = tt.map((x) => ({
      id: x.lenh.id,
      code: x.lenh.code,
      khach: x.lenh.khach,
      xong: lenhXong(x.lenh),
      ship_date: x.lenh.ship_date,
      // Mốc UTC → ngày VN (bẫy: cắt chuỗi ISO là lùi một ngày sau 17 giờ).
      xuat_cuoi: x.lenh.xuat_cuoi ? todayVn(new Date(x.lenh.xuat_cuoi)) : null,
      ma_ve: x.ma_ve,
      xuat_du: x.xuat_du,
      con_kho: x.con_kho,
      thieu: x.thieu,
      het: x.het,
      ro: roCuaLenh(x, today),
    }))
    const chiTiet: MaChiTiet[] = t.rows
      .filter((r) => r.ve > EPS && coDong.has(r.lsx_id))
      .map((r) => {
        const vt = t.vatTu.get(r.material_id)
        return {
          ...r,
          code: vt?.code ?? '?',
          name: vt?.name ?? '(vật tư không còn trong danh mục)',
          unit: vt?.unit ?? '',
          ton: Math.max(0, t.ton.get(r.material_id) ?? 0),
          chung: giu.get(r.lsx_id)?.get(r.material_id) ?? [],
        }
      })
    const ro: RoLenh = (RO_LENH as readonly string[]).includes(sp.ro ?? '')
      ? (sp.ro as RoLenh)
      : 'con'
    const mo = sp.lenh && coDong.has(sp.lenh) ? sp.lenh : null
    return <TonLenhScreen lenh={lenh} chiTiet={chiTiet} ro={ro} mo={mo} today={today} />
  }

  const ro: RoTon = (RO_TON as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as RoTon)
    : 'has'
  const q = sp.q?.trim() || undefined
  const nhom = sp.nhom?.trim() || undefined
  const trang = Math.max(1, Number(sp.trang) || 1)

  // Chia tồn cho lệnh chạy SONG SONG với trang tồn; rổ "Tồn chung" chờ nó.
  const tatCa = hangLenhService.tatCa(user)
  const [res, taxonomy, t] = await Promise.all([
    stockService.listStockPage(user, {
      q,
      group_name: nhom,
      bucket: ro,
      page: trang,
      page_size: PAGE_SIZE,
      cuaLenh: tatCa.then(
        (x) => new Set(x.rows.filter((r) => r.chia > EPS).map((r) => r.material_id)),
      ),
    }),
    materialTaxonomy(),
    tatCa,
  ])
  const theoMa = cuaLenhTheoMa(t.rows, new Map(t.lenh.map((l) => [l.id, l])))
  const cuaLenh: Record<string, CuaLenh> = {}
  for (const r of res.rows) {
    const c = theoMa.get(r.material_id)
    if (c) cuaLenh[r.material_id] = c
  }

  return (
    <TonKhoScreen
      rows={res.rows.map((r) => ({
        material_id: r.material_id,
        code: r.code,
        name: r.name,
        unit: r.unit,
        qty_ok: r.qty_ok,
        qty_qc: r.qty_qc,
        qty_blocked: r.qty_blocked,
        reserved: r.reserved,
        available: r.available,
        shelf_location: r.shelf_location,
        is_low: r.is_low,
        min_stock: r.min_stock,
      }))}
      cuaLenh={cuaLenh}
      counts={res.counts}
      total={res.total}
      trang={trang}
      soTrang={Math.max(1, Math.ceil(res.total / PAGE_SIZE))}
      ro={ro}
      q={sp.q ?? ''}
      nhom={nhom ?? ''}
      nhomOptions={taxonomy.groups.map((g) => g.name)}
    />
  )
}

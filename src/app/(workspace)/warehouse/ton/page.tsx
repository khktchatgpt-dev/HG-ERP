import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { TonKhoScreen } from './TonKhoScreen'
import { RO_TON, type RoTon } from './ro-ton'

export const metadata = { title: 'Kho · Tồn kho' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * TỒN KHO — `/warehouse/ton` (Bước 3 Kho, `docs/kho-buoc-3-ton-kho.md`).
 *
 * KHÔNG VIẾT SERVICE MỚI: `stockService.listStockPage` đã lọc và phân trang Ở
 * SERVER, tìm không dấu, đếm bảy rổ cùng bộ lọc, và trả `available` = dùng
 * được − giữ cho lệnh đã duyệt. Bước 3 chỉ dựng giao diện.
 *
 * MỌI BỘ LỌC NẰM TRÊN URL (rổ · tìm · nhóm · trang): F5 không mất, gửi link
 * ra là người kia thấy đúng danh sách đó. Rổ mặc định là "đang có tồn" —
 * 13.229 dòng gần như toàn số 0 là bức tường vô nghĩa.
 */
export default async function TonKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string; q?: string; nhom?: string; trang?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const ro: RoTon = (RO_TON as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as RoTon)
    : 'has'
  const q = sp.q?.trim() || undefined
  const nhom = sp.nhom?.trim() || undefined
  const trang = Math.max(1, Number(sp.trang) || 1)

  const [res, taxonomy] = await Promise.all([
    stockService.listStockPage(user, {
      q,
      group_name: nhom,
      bucket: ro,
      page: trang,
      page_size: PAGE_SIZE,
    }),
    materialTaxonomy(),
  ])

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

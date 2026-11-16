import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { binsService, stockService } from '@/modules/dept/warehouse/stock.service'
import { VatTuKhoScreen } from './VatTuKhoScreen'
import { RO_VT, type RoVatTu } from './ro-vat-tu'

export const metadata = { title: 'Kho · Danh mục vật tư' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * DANH MỤC VẬT TƯ — BẢN CỦA KHO (`docs/kho-buoc-4-danh-muc.md`).
 *
 * Chủ dự án chốt 16/09/2026: dựng lại trong khu Kho, KHÔNG mượn màn Cung ứng.
 * Hai phòng hỏi hai câu khác nhau về cùng một bảng — Cung ứng hỏi "mua của
 * ai, bao nhiêu tiền", Kho hỏi "đơn vị gì, để kệ nào, dưới bao nhiêu thì
 * báo". Ranh giới quyền sửa đã có sẵn: `PURCHASING_EDITABLE_FIELDS` trong
 * `warehouse.service`; mọi trường ngoài danh sách đó là của Kho.
 *
 * TRANG NÀY LÀ MỘT Ô TÌM, không phải bảng để lướt: 13.229 mã là 265 trang.
 * Lọc và phân trang Ở SERVER, mọi bộ lọc nằm trên URL.
 */
export default async function VatTuKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string; q?: string; nhom?: string; trang?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const ro: RoVatTu = (RO_VT as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as RoVatTu)
    : 'no_shelf'
  const q = sp.q?.trim() || undefined
  const nhom = sp.nhom?.trim() || undefined
  const trang = Math.max(1, Number(sp.trang) || 1)

  const loc = {
    q,
    group_name: nhom,
    no_min_stock: ro === 'no_min' || undefined,
    no_shelf: ro === 'no_shelf' || undefined,
    // Ba rổ việc chỉ mã ĐANG DÙNG; rổ "Ngừng dùng" chỉ mã đã ngừng (B7c).
    active_only: ro !== 'off',
    inactive_only: ro === 'off' || undefined,
  }

  const [res, counts, taxonomy, canEdit, canCreate, canRetire, bins] = await Promise.all([
    materialsService.list(user, { ...loc, page: trang, page_size: PAGE_SIZE }),
    // Đếm rổ trên bộ lọc tìm/nhóm ĐANG ÁP, không đếm cả danh mục — chip nói 52
    // mà mở ra 7 là hỏng nguyên tắc "con số là một lời hứa".
    // Đếm trên mã đang dùng; `inactive` tự bỏ qua cờ này (số trên tab Ngừng dùng).
    materialsService.counts(user, { q, group_name: nhom, active_only: true }),
    materialTaxonomy(),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.material.update'),
    // Thêm mã (B7b) — đúng quyền service kiểm khi tạo.
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.material.create'),
    // Ngừng dùng / dùng lại / xoá mã chưa dùng (B7c).
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.material.retire'),
    // Gợi ý cho ô Kệ (K4: ô gõ có gợi ý thay hộp chọn). Hỏng thì ô vẫn gõ tự do.
    binsService.list(user).catch(() => []),
  ])

  const ids = res.rows.map((m) => m.id)
  const [ngungBy, tonRows] = await Promise.all([
    // Ngày · người · lý do ngừng — chỉ cần khi đang xem rổ Ngừng dùng.
    ro === 'off' ? materialsService.lastRetire(user, ids) : null,
    // Tồn của trang này (≤ 50 mã) — cùng view với màn Tồn kho. Hỏng thì cột để
    // trống, danh mục vẫn sửa được.
    stockService.tonCuaMa(user, ids).catch(() => null),
  ])
  const ton = tonRows ? new Map(tonRows.map((t) => [t.material_id, t])) : null

  return (
    <VatTuKhoScreen
      rows={res.rows.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        group_name: m.group_name,
        sub_group: m.sub_group,
        shelf_location: m.shelf_location,
        min_stock: m.min_stock,
        is_active: m.is_active,
        ngung: ngungBy?.get(m.id) ?? null,
        // View có đủ mọi mã (chưa có dòng sổ = 0); thiếu nghĩa là đọc hỏng → null.
        ton: ton ? { ok: ton.get(m.id)?.qty_ok ?? 0, on_hand: ton.get(m.id)?.on_hand ?? 0 } : null, // prettier-ignore
      }))}
      counts={{
        no_min: counts.noMinStock,
        no_shelf: counts.noShelf,
        all: counts.total,
        off: counts.inactive,
      }}
      total={res.total}
      trang={trang}
      soTrang={Math.max(1, Math.ceil(res.total / PAGE_SIZE))}
      ro={ro}
      q={sp.q ?? ''}
      nhom={nhom ?? ''}
      nhomOptions={taxonomy.groups.map((g) => g.name)}
      dvtOptions={taxonomy.units}
      keOptions={bins.filter((b) => b.is_active !== false).map((b) => b.code)}
      canEdit={canEdit}
      canCreate={canCreate}
      canRetire={canRetire}
    />
  )
}

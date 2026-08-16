import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { StocktakeScreen } from './StocktakeScreen'

/**
 * Kiểm kê — LỌC Ở SERVER (`?q=` + `?group=`): danh mục 13k mã mà bản cũ nạp
 * đúng 1.000 dòng đầu theo alphabet rồi lọc client — vật tư ngoài trang đầu
 * tìm kiểu gì cũng "Không khớp bộ lọc", không kiểm kê nổi. Số đếm đã nhập giữ
 * theo material_id ở client nên đổi bộ lọc giữa chừng không mất.
 * Nhóm lấy từ taxonomy (đủ 14 nhóm) — lấy từ trang kết quả thì lọc xong chỉ
 * còn 1 nhóm trong dropdown, hết đường chuyển.
 */
export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const [stock, taxonomy] = await Promise.all([
    stockService.listStock(user, {
      q: sp.q?.trim() || undefined,
      group_name: sp.group || undefined,
    }),
    materialTaxonomy(),
  ])
  return (
    <StocktakeScreen
      stock={stock}
      groups={taxonomy.groups.map((g) => g.name)}
      initialQ={sp.q ?? ''}
      initialGroup={sp.group ?? 'all'}
    />
  )
}

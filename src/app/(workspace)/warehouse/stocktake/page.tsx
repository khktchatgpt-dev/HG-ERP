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
 *
 * BẮT CHỌN PHẠM VI TRƯỚC (Đợt 1 — `docs/thiet-ke-kho.md` §6).
 *
 * Không có `?q=` và không có `?group=` thì màn KHÔNG nạp dòng nào. Trước đây
 * vào thẳng là nhận cả 13.229 mã vào một biểu mẫu giữ state đếm cho từng dòng
 * — và hệ quả đo được không phải giả thuyết: biên bản DUY NHẤT từng lập bằng
 * màn này là `KK-2026-0004` ngày 15/09/2026, xoá sạch 116 mã về 0.
 *
 * Kiểm kê là chứng từ nặng nhất trong kho. Một đợt kiểm kê thật luôn có phạm
 * vi — một khu kệ, một nhóm hàng — vì người đếm phải đi tới chỗ hàng nằm.
 * Đợt 3 thay chỗ này bằng đợt kiểm kê có phạm vi lưu được và sổ đóng băng;
 * chặn ở đây là hàng rào rẻ nhất dựng được ngay, không cần migration.
 */
export default async function StocktakePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const group = sp.group?.trim() || undefined
  const scoped = !!(q || group)

  const [stock, taxonomy] = await Promise.all([
    // Chưa chọn phạm vi thì KHÔNG hỏi DB. Nạp trước "cho sẵn" là vừa tốn 3,3 MB
    // vừa mời người dùng đếm cả kho trong một lượt.
    scoped ? stockService.listStock(user, { q, group_name: group }) : Promise.resolve([]),
    materialTaxonomy(),
  ])
  return (
    <StocktakeScreen
      stock={stock}
      scoped={scoped}
      groups={taxonomy.groups.map((g) => g.name)}
      initialQ={sp.q ?? ''}
      initialGroup={sp.group ?? 'all'}
    />
  )
}

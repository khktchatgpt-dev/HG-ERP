import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import {
  canEditBom,
  canEditProducts,
  canLockProducts,
  canSetLifecycle,
} from '@/modules/dept/technical/technical.service'
import { profileService } from '@/modules/dept/technical/profile.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { HttpError } from '@/server/http'
import { HoSoScreen } from './HoSoScreen'
import { isHoSoTab } from '@/lib/thu-vien-chuyen'
import { toHoSoView } from './ho-so.shared'

/**
 * HỒ SƠ SẢN PHẨM — khuôn E · Hồ sơ danh mục (dựng 08/10/2026 theo artboard
 * "Màn 2 · Hồ sơ SP" trên canvas https://claude.ai/artifact/GbzsoXgkJiayGMz8iZVdJ3).
 *
 * Câu hỏi của màn: "SP này là gì, hồ sơ đủ chưa, đang dùng ở đâu?" — KHÔNG có
 * vòng đời duyệt; chỗ của ba trục trạng thái là dải hiệu suất.
 *
 * Chạy song song với `/products/[id]` cũ; các tab chưa dựng lại (Đóng gói,
 * Tài liệu, Lịch sử) dẫn sang trang cũ để không có nút chết.
 */
export default async function HoSoSanPhamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sua?: string; tab?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [canEdit, canBom, canPrice, canRemove, canLock, canStatus] = await Promise.all([
    canEditProducts(user),
    canEditBom(user),
    canAction(user, 'technical.plan_cost.view'),
    canAction(user, 'technical.product.remove'),
    canLockProducts(user),
    canSetLifecycle(user),
  ])
  let data
  // Nhân sự đang làm (ô Người phụ trách, chỉ cần khi sửa được) — chép cách trang
  // /products cũ nạp, B2 20/11/2026. "Danh mục SP" KHÔNG đưa sang: danh mục
  // product_category rỗng, 0/167 SP dùng (đo 20/11).
  let owners: { id: string; name: string }[] = []
  try {
    const [hoSo, staff] = await Promise.all([
      profileService.hoSo(user, id, canPrice),
      canEdit ? usersRepo.list({ active_only: true }) : Promise.resolve([]),
    ])
    data = hoSo
    owners = staff.map((u) => ({ id: u.id, name: u.name || u.email }))
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  return (
    <HoSoScreen
      d={toHoSoView(data, { owners })}
      canEdit={canEdit}
      canPrice={canPrice}
      canBom={canBom}
      canRemove={canRemove}
      canLock={canLock}
      canStatus={canStatus}
      // Vừa tạo xong (form gọn) → mở thẳng ở chế độ sửa để điền tiếp.
      batDauSua={sp.sua === '1'}
      // Link cũ /products/<id>/<tab> đổi hướng sang ?tab= (proxy, 20/11/2026).
      tabDau={isHoSoTab(sp.tab) ? sp.tab : undefined}
    />
  )
}

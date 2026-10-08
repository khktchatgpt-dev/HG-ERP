import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { canEditBom, canEditProducts } from '@/modules/dept/technical/technical.service'
import { profileService } from '@/modules/dept/technical/profile.service'
import { HttpError } from '@/server/http'
import { HoSoScreen } from './HoSoScreen'
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
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [canEdit, canBom, canPrice] = await Promise.all([
    canEditProducts(user),
    canEditBom(user),
    canAction(user, 'technical.plan_cost.view'),
  ])
  let data
  try {
    data = await profileService.hoSo(user, id, canPrice)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  return <HoSoScreen d={toHoSoView(data)} canEdit={canEdit} canPrice={canPrice} canBom={canBom} />
}

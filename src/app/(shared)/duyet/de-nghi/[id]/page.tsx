import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { HttpError } from '@/server/http'
import { DuyetDeNghiScreen } from './DuyetDeNghiScreen'

export const metadata = { title: 'Duyệt đề nghị mua' }
export const dynamic = 'force-dynamic'

/**
 * DUYỆT ĐỀ NGHỊ MUA VẬT TƯ — `/duyet/de-nghi/[id]` (0236 · Đ2, bản vẽ DN-2
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g).
 *
 * Ở KHU DÙNG CHUNG chứ không trong /exec hay /warehouse: người duyệt là ban giám
 * đốc (có người không vào được khu /exec — chỉ có quyền duyệt đơn mua), và họ
 * mở từ THÔNG BÁO trên điện thoại. Quyền xem / quyết do service kiểm.
 */
export default async function DuyetDeNghiPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const kq = await deNghiService.get(user, id).catch((e: unknown) => {
    if (e instanceof HttpError && e.status === 404) return null
    throw e
  })
  if (!kq) notFound()
  return (
    <DuyetDeNghiScreen
      phieu={kq.phieu}
      canApprove={kq.canApprove}
      laNguoiDeNghi={kq.phieu.requested_by === user.id}
    />
  )
}

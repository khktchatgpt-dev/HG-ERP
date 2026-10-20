import { notFound } from 'next/navigation'
import { fileImageSrcMap } from '@/server/file-image'
import { authService } from '@/modules/core/auth/auth.service'
import { buildLsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { todayVn } from '@/lib/date-vn'
import { HoSoLenhScreen } from './HoSoLenhScreen'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const d = await buildLsxSupplyDetail(user, id, todayVn()).catch(() => null)
  return { title: d ? `Mua hàng · Hồ sơ ${d.code}` : 'Mua hàng · Hồ sơ lệnh' }
}

/**
 * HỒ SƠ LỆNH trong khu Mua hàng (16/09/2026 — chủ dự án: "cung ứng chưa có
 * trang để xem thông tin lệnh sản xuất, không dùng trang của sales").
 *
 * 05/10/2026 — "trước hết cần cho xem đủ thông tin của lsx": màn bày ĐÚNG PHIẾU
 * LỆNH (cột theo mẫu của khách, nhóm theo PO, màu như phiếu in) chứ không còn
 * bảng tóm tắt mã·tên·SL. Ba thứ tải SONG SONG, không cái nào chờ cái nào:
 *   · `buildLsxSupplyDetail` — cùng màn vật tư của lệnh (đơn mua, thông số gom);
 *   · `productionRepo.findById` — đầu lệnh đủ: phát hành, bản chỉnh sửa + lý do,
 *     ghi chú — thứ bản tóm tắt của Cung ứng không mang;
 *   · `lsxLinesService.sheet` — mẫu phiếu + nhóm + dòng, CÙNG nguồn với phiếu
 *     in `/print/lsx/[id]` và file Excel, nên ba chỗ không thể nói khác nhau.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const today = todayVn()
  const [detail, lsx, sheet] = await Promise.all([
    buildLsxSupplyDetail(user, id, today),
    productionRepo.findById(id),
    lsxLinesService.sheet(user, id),
  ])
  if (!detail || !lsx) notFound()
  // Đường dẫn ảnh CỐ ĐỊNH theo id (HMAC), không phải URL ký đổi mỗi lượt
  // render — xem ghi chú ở màn vật tư của lệnh.
  const imageUrls = fileImageSrcMap(
    sheet.groups.flatMap((g) => g.lines.map((l) => l.image_file_id)),
  )
  return (
    <HoSoLenhScreen
      lsx={detail}
      dau={{
        issued_at: lsx.issued_at,
        revision: lsx.revision,
        revised_at: lsx.revised_at,
        revision_note: lsx.revision_note,
        note: lsx.note,
      }}
      template={sheet.template}
      groups={sheet.groups}
      today={today}
      imageUrls={imageUrls}
    />
  )
}

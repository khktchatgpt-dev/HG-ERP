import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { LsxSheetEditor } from '@/components/production/LsxSheetEditor'

/**
 * Sales SOẠN DÒNG LỆNH (0114) — màn thay file Excel: nhóm theo PO/bộ sưu tập,
 * tách đợt xuất, spec theo mẫu cột của khách. Lệnh đã duyệt mà lưu ở đây =
 * phát bản chỉnh sửa (revision +1, phiếu in đánh dấu dòng đổi).
 */
export default async function LsxLinesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params

  const lsx = await productionRepo.findById(id)
  if (!lsx) notFound()

  const [sheet, dept] = await Promise.all([
    lsxLinesService.sheet(user, id),
    user.department_id ? departmentsRepo.findById(user.department_id) : null,
  ])
  const canEdit =
    (user.role === 'admin' || dept?.name === 'Bán Hàng') &&
    lsx.status !== 'completed' &&
    lsx.status !== 'cancelled'

  // Ảnh chụp hồ sơ SP của các dòng — editor dùng để chỉ ra ô nào lấy từ hồ sơ,
  // ô nào Sales tự nhập, và hồ sơ còn thiếu gì. ĐVT lấy theo dòng để chuỗi đóng
  // gói dựng ra khớp đúng bản đã nạp.
  const lines = sheet.groups.flatMap((g) => g.lines)
  const unitByProduct: Record<string, string> = {}
  for (const l of lines) {
    if (l.product_id && !unitByProduct[l.product_id]) unitByProduct[l.product_id] = l.unit
  }
  const profiles = await lsxLinesService.lineProfiles(
    lines.map((l) => l.product_id).filter((x): x is string => !!x),
    unitByProduct,
  )

  return (
    <LsxSheetEditor
      lsxId={lsx.id}
      lsxCode={lsx.code}
      customerName={lsx.customer_name}
      revision={lsx.revision}
      canEdit={canEdit}
      isDraft={lsx.status === 'draft'}
      template={sheet.template}
      groups={sheet.groups}
      profiles={profiles}
      backHref={`/sales/lsx/${lsx.id}`}
    />
  )
}

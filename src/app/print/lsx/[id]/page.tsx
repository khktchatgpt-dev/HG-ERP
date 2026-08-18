import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { filesService } from '@/modules/core/files/files.service'
import { LsxPrintSheet } from '../LsxPrintSheet'

/**
 * In phiếu LỆNH SẢN XUẤT chính thức — nhóm + dòng lệnh (0114), bộ cột theo mẫu
 * của khách. Bản xem trước khi CHƯA phát: /print/lsx/preview/[orderId].
 */
export default async function LsxPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const lsx = await productionRepo.findById(id)
  if (!lsx) redirect('/sales/lsx')

  const [sheet, company] = await Promise.all([
    lsxLinesService.sheet(user, id),
    settingsService.getAll(),
  ])

  // Ảnh SP (cột Hình ảnh) — signed URL ngắn hạn, lỗi thì bỏ ảnh, không chặn in.
  const fileIds = [
    ...new Set(
      sheet.groups.flatMap((g) => g.lines.map((l) => l.image_file_id).filter(Boolean)),
    ),
  ] as string[]
  const imageUrls = new Map<string, string>()
  await Promise.all(
    fileIds.map(async (fid) => {
      try {
        imageUrls.set(fid, await filesService.getDownloadUrl(user, fid))
      } catch {
        /* thiếu ảnh không chặn in */
      }
    }),
  )

  return (
    <LsxPrintSheet
      company={company}
      header={{
        customer_name: lsx.customer_name,
        code: lsx.code,
        issued_at: lsx.issued_at,
        received_date: lsx.received_date,
        completed_at: lsx.completed_at,
        container_summary: lsx.container_summary,
        note: lsx.note,
        revision: lsx.revision,
        revised_at: lsx.revised_at,
      }}
      template={sheet.template}
      groups={sheet.groups}
      imageUrls={imageUrls}
    />
  )
}

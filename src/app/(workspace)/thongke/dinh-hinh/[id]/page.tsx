import Link from 'next/link'
import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { canEditComponents } from '@/modules/dept/production/perms'
import { HttpError } from '@/server/http'
import { PageHeader } from '@/components/erp/PageHeader'
import { LsxComponentsPanel } from '@/components/production/LsxComponentsPanel'

export const dynamic = 'force-dynamic'

/** Định hình 1 lệnh: bảng chi tiết & định mức (kéo BOM Kỹ thuật + sửa → chốt). */
export default async function ShapingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await authService.requirePageUser()

  let data
  try {
    data = await componentsService.list(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  // Vật tư KHÔNG nạp sẵn: danh mục 13k dòng, nạp 1.000 dòng đầu thì danh sách
  // dừng ở mã "BUL…" — không có mã nhôm/inox nào để gắn. Ô gắn vật tư tự tìm
  // qua API theo từ khoá (MaterialCombo).
  const [lsx, stages, canEdit] = await Promise.all([
    productionRepo.findById(id),
    productionRepo.listStages(),
    canEditComponents(user),
  ])
  if (!lsx) notFound()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Định hình chi tiết', href: '/thongke/dinh-hinh' },
          { label: lsx.code },
        ]}
        title={`Định hình ${lsx.code}`}
        description={`${lsx.customer_name} · ${lsx.order_codes.length > 1 ? `${lsx.order_codes.length} đơn: ` : 'Đơn '}${lsx.order_codes.join(', ')}${
          data.locked_by_entries
            ? ' — LSX đã có sổ số liệu, bảng chi tiết khoá (xoá sổ trước nếu thật sự cần sửa).'
            : ''
        }`}
        actions={
          <Link
            href={`/thongke/lsx/${lsx.id}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Hồ sơ lệnh →
          </Link>
        }
      />
      <LsxComponentsPanel
        lsxId={lsx.id}
        orderLines={data.order_lines.map((l) => ({
          id: l.id,
          product_code: l.product_code,
          product_name: l.product_name,
          qty: l.qty,
        }))}
        stages={stages}
        canEdit={canEdit && !data.locked_by_entries}
        locked={data.lsx_status === 'completed' || data.lsx_status === 'cancelled'}
        title="Bảng chi tiết & định mức"
      />
    </div>
  )
}

import { authService } from '@/modules/core/auth/auth.service'
import { samplesService } from '@/modules/dept/technical/samples.service'
import { isTechnicalStaff } from '@/modules/dept/technical/technical.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { SamplesManager } from './SamplesManager'

const PAGE_SIZE = 24

export default async function ShowroomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = (await authService.currentUser())!
  // Xem mở cho mọi NV (Sales tra mẫu rảnh để dẫn khách); ghi sổ thì chỉ Kỹ thuật.
  const canEdit = await isTechnicalStaff(user)

  const spRaw = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const q = str(spRaw.q).trim() || undefined
  const status = str(spRaw.status) || 'all'
  const kind = str(spRaw.kind) || 'all'
  const overdue = str(spRaw.overdue) === '1'
  const page = Math.max(1, Number(str(spRaw.page)) || 1)

  const [{ rows, total }, stats] = await Promise.all([
    samplesService.list(user, {
      q,
      status: status === 'all' ? undefined : (status as never),
      kind: kind === 'all' ? undefined : (kind as never),
      overdue,
      page,
      page_size: PAGE_SIZE,
    }),
    samplesService.stats(),
  ])

  // Ảnh mẫu dùng luôn ảnh của SP — mẫu chưa có ảnh riêng thì vẫn nhận ra được
  // đó là cái gì. Ảnh 4 góc riêng của mẫu nằm ở trang chi tiết.
  const imageUrls: Record<string, string> = {}
  await Promise.all(
    rows
      .filter((s) => s.product_image_file_id)
      .map(async (s) => {
        try {
          imageUrls[s.id] = await filesService.getDownloadUrl(
            user,
            s.product_image_file_id!,
          )
        } catch {
          /* bỏ ảnh */
        }
      }),
  )

  const { rows: products } = await productsService.listLite(user, {
    is_active: true,
    page: 1,
    page_size: 1000,
  })

  return (
    <SamplesManager
      samples={rows}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      stats={stats}
      filters={{ q: q ?? '', status, kind, overdue }}
      imageUrls={imageUrls}
      products={products.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
      canEdit={canEdit}
    />
  )
}

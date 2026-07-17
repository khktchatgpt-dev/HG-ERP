import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'

export default async function TechnicalHome() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'

  // Đếm bằng HEAD count + chỉ nạp 6 SP gần đây (không kéo cả thư viện về nữa).
  // Cờ "thiếu bản vẽ / BOM" suy từ FILE đã upload (doc_type), không phải link cũ.
  const [stats, { rows: recent }, docFlags] = await Promise.all([
    productsService.stats(),
    productsService.listLite(user, { page: 1, page_size: 6 }),
    filesService.productDocFlags(),
  ])

  const total = stats.total
  const active = stats.active
  const withDrawing = Object.values(docFlags).filter((f) => f.drawing).length
  const withBom = Object.values(docFlags).filter((f) => f.bom).length
  const noDrawing = Math.max(0, total - withDrawing)
  const noBom = Math.max(0, total - withBom)
  const hasDoc = (id: string) => docFlags[id] ?? { drawing: false, bom: false }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kỹ thuật' }]}
        title="Trang chủ Kỹ thuật"
        description="Thư viện sản phẩm, bản vẽ và định mức vật tư (BOM)."
        actions={
          <span className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            Ctrl+K để tìm nhanh
          </span>
        }
      />

      <StatsBar
        stats={[
          { label: 'Sản phẩm', value: total, tone: 'default' },
          { label: 'Đang dùng', value: active, tone: 'green' },
          { label: 'BOM đã vẽ', value: stats.bom_done, tone: 'blue' },
          { label: 'Thiếu bản vẽ', value: noDrawing, tone: noDrawing ? 'amber' : 'gray' },
          { label: 'Thiếu BOM', value: noBom, tone: noBom ? 'amber' : 'gray' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent products */}
        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Sản phẩm gần đây
            </h2>
            <Link
              href="/technical/products"
              className="text-xs text-zinc-500 hover:underline"
            >
              Xem thư viện →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
              Thư viện sản phẩm đang trống.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
                  <tr>
                    <th className="px-3 py-2">Mã / Tên</th>
                    <th className="px-3 py-2">Danh mục</th>
                    <th className="px-3 py-2">Tài liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {recent.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs text-zinc-400">{p.code}</div>
                        <div className="font-medium">{p.name}</div>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{p.category ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {hasDoc(p.id).drawing ? (
                          <span className="mr-2 text-sky-600">Bản vẽ ✓</span>
                        ) : (
                          <span className="mr-2 text-amber-600">Thiếu BV</span>
                        )}
                        {hasDoc(p.id).bom ? (
                          <span className="text-sky-600">BOM ✓</span>
                        ) : (
                          <span className="text-amber-600">Thiếu BOM</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Thao tác nhanh
          </h2>
          <div className="flex flex-col gap-2">
            <QuickAction href="/technical/products" title="Mở thư viện sản phẩm" />
            <QuickAction href="/technical/load-cont" title="Tính load cont" />
            {canEdit && (
              <QuickAction href="/technical/products?new=1" title="+ Thêm sản phẩm mới" />
            )}
            <QuickAction href="/tasks" title="Công việc của tôi" />
          </div>

          {(noDrawing > 0 || noBom > 0) && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40">
              <div className="font-semibold text-amber-800 dark:text-amber-200">
                Cần bổ sung tài liệu
              </div>
              <div className="mt-1 text-amber-700 dark:text-amber-300">
                {noDrawing > 0 && <div>{noDrawing} SP thiếu bản vẽ</div>}
                {noBom > 0 && <div>{noBom} SP thiếu BOM</div>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function QuickAction({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-sky-600 dark:hover:bg-sky-950/30"
    >
      {title}
    </Link>
  )
}

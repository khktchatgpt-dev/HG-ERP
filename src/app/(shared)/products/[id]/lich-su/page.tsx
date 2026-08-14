import { ArrowRight, Lock, LockOpen } from 'lucide-react'
import { LIFECYCLE_LABEL, isLifecycle } from '@/lib/product-lifecycle'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { Badge } from '@/components/shadcn/badge'
import { EmptyState } from '@/components/erp/EmptyState'
import { FIELD_LABELS } from '@/components/technical/revision-labels'

/**
 * Tab LỊCH SỬ PHIÊN BẢN (0143).
 *
 * Không có "tạo phiên bản" — mỗi lần KHOÁ hồ sơ là chốt một bản, mỗi lần mở
 * khoá là một dòng ghi vết kèm lý do. Trang này chỉ đọc: bản nào, ai, khi nào,
 * đổi những gì, và định mức lúc đó có bao nhiêu dòng.
 */
/** "Nháp → Đang rà soát" từ ảnh chụp {from,to} của dòng chuyển trạng thái. */
function statusText(snap: Record<string, unknown>): string {
  const label = (v: unknown) => (isLifecycle(v) ? LIFECYCLE_LABEL[v] : '—')
  return `${label(snap.from)} → ${label(snap.to)}`
}

export default async function ProductHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const revisions = await productsService.revisions(user, id)

  // Tên người thao tác — một lượt tra cho cả trang.
  const byId = new Map<string, string>()
  await Promise.all(
    [...new Set(revisions.map((r) => r.created_by))]
      .filter((uid): uid is string => uid != null)
      .map(async (uid) => {
        const u = await usersRepo.findById(uid)
        if (u) byId.set(u.id, u.name ?? u.email)
      }),
  )

  if (!revisions.length) {
    return (
      <div className="pb-6">
        <EmptyState
          title="Hồ sơ chưa có bản chốt nào"
          description="Mỗi lần khoá hồ sơ là chốt một bản: hệ thống chụp lại thuộc tính + toàn bộ định mức tại thời điểm đó, và ghi rõ so với bản trước đã đổi những gì."
        />
      </div>
    )
  }

  const fmt = (s: string) => new Date(s).toLocaleString('vi-VN')

  return (
    <div className="flex flex-col gap-3 pb-6">
      <p className="text-muted-foreground text-sm">
        Sổ này ghi hai loại việc: <strong>chuyển trạng thái</strong> hồ sơ, và{' '}
        <strong>chốt bản</strong> — mỗi lần khoá hồ sơ là một bản, kèm ảnh chụp thuộc tính
        + định mức lúc đó. Số bản (#) chỉ tăng khi khoá; mở khoá và chuyển trạng thái là
        vết đi kèm. Số &ldquo;Rev.&rdquo; in trên biểu mẫu ISO là ô gõ tay ở tab Thông số,
        khác số này.
      </p>

      <ol className="flex flex-col gap-2">
        {revisions.map((r) => {
          const parts = Array.isArray(r.parts_snapshot) ? r.parts_snapshot.length : 0
          return (
            <li
              key={r.id}
              className="bg-card flex flex-col gap-1.5 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                {r.action === 'status' ? (
                  /* Chuyển trạng thái (0145) — đọc từ ảnh chụp {from,to}. */
                  <Badge variant="outline" className="text-sky-700 dark:text-sky-300">
                    <ArrowRight />
                    {statusText(r.fields_snapshot)}
                  </Badge>
                ) : r.action === 'lock' ? (
                  <Badge className="border-transparent bg-emerald-600 text-white">
                    <Lock /> Chốt bản #{r.rev}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                    <LockOpen /> Mở bản #{r.rev} để sửa
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  {fmt(r.created_at)}
                  {r.created_by && ` · ${byId.get(r.created_by) ?? '—'}`}
                  {r.action === 'lock' && ` · định mức ${parts} dòng`}
                </span>
              </div>

              {r.reason && (
                <p className="text-muted-foreground">
                  <span className="font-medium">
                    {r.action === 'unlock'
                      ? 'Lý do mở: '
                      : r.action === 'status'
                        ? 'Lý do: '
                        : 'Ghi chú: '}
                  </span>
                  {r.reason}
                </p>
              )}

              {r.action === 'lock' && r.changed_fields.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground text-xs">So với bản trước:</span>
                  {r.changed_fields.map((f) => (
                    <Badge key={f} variant="secondary" className="font-normal">
                      {FIELD_LABELS[f] ?? f}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

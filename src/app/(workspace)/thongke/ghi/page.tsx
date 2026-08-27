import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  loadEntrySheet,
  worklistService,
  type WorklistRow,
} from '@/modules/dept/production/worklist.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { EntrySheetForm } from './EntrySheetForm'

export const dynamic = 'force-dynamic'

/**
 * GHI SẢN LƯỢNG — màn riêng (tách 27/08 theo góp ý UX): trái là HÀNG ĐỢI việc
 * (lệnh × công đoạn còn thiếu, đúng thứ tự thống kê chép sổ giấy), phải là
 * PHIẾU NHẬP. Chọn việc bên trái là phiếu bên phải đổi theo — không phải đi
 * vòng qua màn tiến độ từng lệnh nữa.
 */
export default async function GhiSanLuongPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string; stage?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  if (!canRecord) redirect('/thongke/lenh')

  const data = await worklistService.list(user, {})
  const cards = data.lsx_cards
  const lsxId =
    cards.find((c) => c.lsx_id === sp.lsx)?.lsx_id ??
    cards.find((c) => c.open_count > 0)?.lsx_id ??
    cards[0]?.lsx_id ??
    null
  const sheet = lsxId ? await loadEntrySheet(lsxId, sp.stage ?? null) : null

  // Hàng đợi: per (lệnh × công đoạn) — còn bao nhiêu BỘ, đúng thứ tự danh mục.
  const stageOrder = new Map(data.stages.map((s, i) => [s.code, i]))
  const rowsByLsx = new Map<string, WorklistRow[]>()
  for (const r of data.rows) {
    const arr = rowsByLsx.get(r.lsx_id) ?? []
    arr.push(r)
    rowsByLsx.set(r.lsx_id, arr)
  }
  const queue = cards.map((c) => {
    const perStage = new Map<string, { planned: number; done: number }>()
    for (const r of rowsByLsx.get(c.lsx_id) ?? []) {
      const cur = perStage.get(r.stage) ?? { planned: 0, done: 0 }
      cur.planned += r.planned
      cur.done += r.done
      perStage.set(r.stage, cur)
    }
    return {
      ...c,
      stages: [...perStage.entries()]
        .sort((a, b) => (stageOrder.get(a[0]) ?? 99) - (stageOrder.get(b[0]) ?? 99))
        .map(([code, v]) => ({
          code,
          label: data.stages.find((s) => s.code === code)?.label ?? code,
          remaining: Math.max(0, v.planned - v.done),
        })),
    }
  })

  const fmt = (n: number) => n.toLocaleString('vi-VN')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Ghi sản lượng' },
        ]}
        title="Ghi sản lượng"
        description="Chọn việc ở hàng đợi bên trái — phiếu nhập hiện bên phải. Số gửi là chính thức."
      />

      {queue.length === 0 ? (
        <EmptyState
          icon="▦"
          title="Chưa có lệnh nào để ghi"
          description="Lệnh phải được duyệt và ĐỊNH HÌNH chi tiết thì mới có việc ghi nhận."
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
          {/* ── Hàng đợi việc ─────────────────────────────────────────────── */}
          <nav
            aria-label="Hàng đợi việc theo lệnh"
            className="flex gap-2 overflow-x-auto lg:sticky lg:top-4 lg:flex-col lg:overflow-visible"
          >
            {queue.map((c) => {
              const selected = c.lsx_id === lsxId
              return (
                <div
                  key={c.lsx_id}
                  className={`w-64 shrink-0 rounded-lg border p-3 lg:w-auto ${
                    selected
                      ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--accent)_60%,transparent)]'
                      : 'bg-card'
                  }`}
                >
                  <Link
                    href={`/thongke/ghi?lsx=${c.lsx_id}`}
                    className="block outline-none focus-visible:underline"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <DocChip>{c.lsx_code}</DocChip>
                      {c.open_count === 0 && (
                        <span className="text-[10px] font-semibold text-[var(--done)]">
                          đủ số
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                      {c.customer_name}
                    </span>
                    <span className="t-data text-muted-foreground block text-[11px]">
                      xong {fmt(c.done_sets)}/{fmt(c.total_sets)} bộ
                    </span>
                  </Link>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {c.stages.map((s) => (
                      <Link
                        key={s.code}
                        href={`/thongke/ghi?lsx=${c.lsx_id}&stage=${s.code}`}
                        className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                          selected && sheet?.stage === s.code
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : s.remaining > 0
                              ? 'border-input hover:bg-[var(--accent)]'
                              : 'border-input text-muted-foreground'
                        }`}
                      >
                        {s.label}
                        {s.remaining > 0 && (
                          <span className="t-data font-semibold">
                            {' '}
                            {fmt(s.remaining)}
                          </span>
                        )}
                        {s.remaining <= 0 && ' ✓'}
                      </Link>
                    ))}
                  </span>
                </div>
              )
            })}
          </nav>

          {/* ── Phiếu nhập ────────────────────────────────────────────────── */}
          {sheet ? (
            <EntrySheetForm
              key={`${sheet.lsx.id}|${sheet.stage}`}
              sheet={sheet}
              userTeamId={user.department_id ?? null}
            />
          ) : (
            <EmptyState
              icon="▦"
              title="Lệnh này chưa định hình chi tiết"
              description="Nạp từ BOM kỹ thuật hoặc gõ tay ở màn Định hình — xong là ghi được ngay."
            />
          )}
        </div>
      )}
    </div>
  )
}

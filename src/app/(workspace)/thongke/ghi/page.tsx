import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
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
import { LsxSwitcher } from './LsxSwitcher'

export const dynamic = 'force-dynamic'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('vi-VN')

/**
 * GHI SẢN LƯỢNG — màn riêng, HAI BƯỚC (user chốt 27/08: đừng gộp mọi lệnh vào
 * một màn):
 *   1. Chưa chọn lệnh → màn CHỌN LỆNH: mỗi lệnh một thẻ to, bấm là vào ghi.
 *   2. Đã chọn      → TOÀN MÀN cho phiếu nhập, kèm ô đổi lệnh nhanh —
 *      UX dồn hết vào việc gõ số.
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
  const chosen = cards.find((c) => c.lsx_id === sp.lsx) ?? null

  // ── Bước 1: CHỌN LỆNH ──────────────────────────────────────────────────────
  if (!chosen) {
    const stageOrder = new Map(data.stages.map((s, i) => [s.code, i]))
    const rowsByLsx = new Map<string, WorklistRow[]>()
    for (const r of data.rows) {
      const arr = rowsByLsx.get(r.lsx_id) ?? []
      arr.push(r)
      rowsByLsx.set(r.lsx_id, arr)
    }
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          breadcrumbs={[
            { label: 'Thống kê xưởng', href: '/thongke' },
            { label: 'Ghi sản lượng' },
          ]}
          title="Ghi sản lượng — chọn lệnh"
          description="Chọn lệnh đang cầm sổ để vào phiếu nhập. Lệnh còn nhiều việc nằm trên đầu."
        />
        {cards.length === 0 ? (
          <EmptyState
            icon="▦"
            title="Chưa có lệnh nào để ghi"
            description="Lệnh phải được duyệt và ĐỊNH HÌNH chi tiết thì mới có việc ghi nhận."
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => {
              // Công đoạn còn thiếu nhiều nhất — mở thẳng vào đúng chỗ phải gõ.
              const perStage = new Map<string, number>()
              for (const r of rowsByLsx.get(c.lsx_id) ?? []) {
                perStage.set(
                  r.stage,
                  (perStage.get(r.stage) ?? 0) + Math.max(0, r.planned - r.done),
                )
              }
              const stagesLeft = [...perStage.entries()]
                .filter(([, left]) => left > 0)
                .sort(
                  (a, b) => (stageOrder.get(a[0]) ?? 99) - (stageOrder.get(b[0]) ?? 99),
                )
              return (
                <Link
                  key={c.lsx_id}
                  href={`/thongke/ghi?lsx=${c.lsx_id}`}
                  className="bg-card focus-visible:ring-ring/50 group block rounded-lg border p-3.5 outline-none hover:bg-[color-mix(in_srgb,var(--accent)_55%,transparent)] focus-visible:ring-[3px]"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <DocChip>{c.lsx_code}</DocChip>
                        {c.open_count === 0 && (
                          <span className="text-[10px] font-semibold text-[var(--done)]">
                            đủ số
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium">
                        {c.customer_name}
                      </span>
                      <span className="text-muted-foreground t-data block text-xs">
                        xong {fmt(c.done_sets)}/{fmt(c.total_sets)} bộ
                        {c.ship_date && ` · xuất ${fmtDate(c.ship_date)}`}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        {stagesLeft.slice(0, 5).map(([code, left]) => (
                          <span
                            key={code}
                            className="border-input rounded border px-1.5 py-0.5 text-[10px]"
                          >
                            {data.stages.find((s) => s.code === code)?.label ?? code}{' '}
                            <b className="t-data">{fmt(left)}</b>
                          </span>
                        ))}
                        {stagesLeft.length === 0 && (
                          <span className="text-[10px] text-[var(--done)]">
                            mọi công đoạn đã đủ số ✓
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronRight
                      size={20}
                      strokeWidth={1.8}
                      className="text-muted-foreground mt-0.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Bước 2: PHIẾU NHẬP toàn màn ────────────────────────────────────────────
  const sheet = await loadEntrySheet(chosen.lsx_id, sp.stage ?? null)

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Ghi sản lượng', href: '/thongke/ghi' },
          { label: chosen.lsx_code },
        ]}
        title="Ghi sản lượng"
        description={chosen.customer_name}
      />
      {sheet ? (
        <EntrySheetForm
          key={`${sheet.lsx.id}|${sheet.stage}`}
          sheet={sheet}
          userTeamId={user.department_id ?? null}
          lsxSwitcher={
            <LsxSwitcher
              options={cards.map((c) => ({
                id: c.lsx_id,
                code: c.lsx_code,
                customer_name: c.customer_name,
                open_count: c.open_count,
              }))}
              current={chosen.lsx_id}
            />
          }
        />
      ) : (
        <EmptyState
          icon="▦"
          title="Lệnh này chưa định hình chi tiết"
          description="Nạp từ BOM kỹ thuật hoặc gõ tay ở màn Định hình — xong là ghi được ngay."
        />
      )}
    </div>
  )
}

import Link from 'next/link'
import { AlertTriangle, Gavel } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { buildAgenda, type AgendaItem } from '@/lib/supply-meeting'
import type { LsxSupplyRow } from '@/modules/dept/supply/lsx-supply.service'
import { loadMeeting } from '../_data/meeting'
import { LEVEL_BADGE, dmy } from '../_components/IssueRow'

export const dynamic = 'force-dynamic'

/** Thứ tự đọc trong họp: người quyết trước, người làm sau. */
const DEPT_ORDER = ['Sản xuất', 'Giám đốc', 'Cung ứng', 'Nhà cung cấp', 'Kho']

/**
 * VIỆC CẦN QUYẾT ĐỊNH — trang cuối của bảng họp: "Cung ứng phải làm gì, Sản
 * xuất và Giám đốc phải quyết gì". Tự sinh từ tình trạng lệnh (user chốt
 * 05/09/2026: họp thử 2 tuần rồi mới quyết có cần ghi tay người xử lý / hạn).
 *
 * Gom theo BỘ PHẬN rồi theo VIỆC — không lặp lại danh sách vấn đề: biên bản họp
 * chép được thẳng từ đây.
 */
export default async function HopPage() {
  const user = await authService.requirePageUser()
  const { today, rows } = await loadMeeting(user)
  const agenda = buildAgenda(rows)

  const byDept = new Map<string, AgendaItem<LsxSupplyRow>[]>()
  for (const it of agenda) byDept.set(it.dept, [...(byDept.get(it.dept) ?? []), it])
  const depts = [...byDept.keys()].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b, 'vi'),
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Việc cần quyết định' },
        ]}
        title="Việc cần quyết định trong họp"
        description="Gom theo bộ phận và việc, tự sinh từ tình trạng vật tư của từng lệnh. Chưa ghi tay người xử lý và hạn."
        meta={
          <span className="text-muted-foreground text-[12px]">
            Hôm nay{' '}
            <span className="t-data">
              {dmy(today)}/{today.slice(0, 4)}
            </span>{' '}
            · <span className="t-data">{agenda.length}</span> việc ·{' '}
            <span className="t-data">{rows.length}</span> lệnh đang chạy
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/planning/van-de">
                <AlertTriangle />
                Vấn đề cần xử lý
              </Link>
            </Button>
          </>
        }
      />

      {agenda.length === 0 ? (
        <section className="bg-card rounded-lg border">
          <EmptyState
            icon={<Gavel className="size-5" />}
            title="Không có việc gì cần quyết"
            description="Mọi lệnh đang chạy đều đã đủ vật tư hoặc đang về đúng hẹn."
          />
        </section>
      ) : (
        depts.map((dept) => {
          const items = byDept.get(dept) ?? []
          const total = items.reduce((s, it) => s + it.rows.length, 0)
          return (
            <section key={dept} className="bg-card overflow-hidden rounded-lg border">
              <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                <h2 className="t-title">
                  {dept}
                  <span className="t-data text-muted-foreground ml-2 font-normal">
                    {items.length} việc · {total} lệnh
                  </span>
                </h2>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32%]">Việc</TableHead>
                    <TableHead>Lệnh liên quan</TableHead>
                    <TableHead className="w-[120px]">Mốc gần nhất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={`${it.dept}|${it.action}`}>
                      <TableCell className="align-top font-medium">
                        {it.action}
                        <span className="t-data text-muted-foreground ml-2 font-normal">
                          {it.rows.length} lệnh
                        </span>
                      </TableCell>
                      <TableCell>
                        <ul className="flex flex-col gap-1">
                          {it.rows.map(({ row, risk }) => (
                            <li
                              key={row.id}
                              className="flex flex-wrap items-center gap-2 text-[12.5px]"
                            >
                              <Link
                                href={`/planning/lsx/${row.id}`}
                                className="hover:opacity-80"
                              >
                                <DocChip>{row.code}</DocChip>
                              </Link>
                              <span className="text-muted-foreground truncate">
                                {row.customer_name}
                              </span>
                              <Badge tone={LEVEL_BADGE[risk.level]}>{risk.label}</Badge>
                              {risk.due && (
                                <span className="t-data text-muted-foreground">
                                  {dmy(risk.due.date)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="t-data align-top whitespace-nowrap">
                        {dmy(it.due)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )
        })
      )}
    </div>
  )
}

function rank(dept: string): number {
  const i = DEPT_ORDER.indexOf(dept)
  return i === -1 ? DEPT_ORDER.length : i
}

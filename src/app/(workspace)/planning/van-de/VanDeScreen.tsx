'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronLeft, ChevronRight, Factory, Search } from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { FilterChip } from '@/components/erp/FilterChip'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { Button } from '@/components/shadcn/button'
import {
  MEETING_LEVEL,
  type MeetingRiskLevel,
  type MeetingRow,
} from '@/lib/supply-meeting'
import type { LsxSupplyRow } from '@/modules/dept/supply/lsx-supply.service'
import { IssueRow } from '../_components/IssueRow'

type Row = MeetingRow<LsxSupplyRow>

const ISSUE_LEVELS: MeetingRiskLevel[] = ['stop', 'warn', 'watch']
const PAGE_SIZE = 20

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function VanDeScreen({
  today,
  issues,
  counts,
  initialLevel,
}: {
  today: string
  issues: Row[]
  counts: Record<MeetingRiskLevel, number>
  initialLevel: MeetingRiskLevel | null
}) {
  const [level, setLevel] = useState<MeetingRiskLevel | null>(initialLevel)
  const [customer, setCustomer] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const customers = useMemo(
    () =>
      [...new Set(issues.map((m) => m.row.customer_name))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    [issues],
  )

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return issues.filter((m) => {
      if (level !== null && m.risk.level !== level) return false
      if (customer && m.row.customer_name !== customer) return false
      if (nq) {
        const hay = norm(
          [
            m.row.code,
            m.row.customer_name,
            m.risk.reason,
            ...m.row.products.map((p) => p.name),
          ].join(' '),
        )
        if (!hay.includes(nq)) return false
      }
      return true
    })
  }, [issues, level, customer, q])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const pick = (k: MeetingRiskLevel | null) => {
    setLevel(k)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vấn đề cần xử lý' },
        ]}
        title="Vấn đề cần xử lý"
        description="Lệnh nào có nguy cơ vì vật tư, vì sao, và ai đang cầm bóng. Lệnh đang về hoặc đã đủ không nằm ở đây."
        meta={
          <span className="text-muted-foreground text-[12px]">
            Hôm nay <span className="t-data">{today.split('-').reverse().join('/')}</span>{' '}
            · <span className="t-data">{issues.length}</span> lệnh có việc
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/planning/lsx">
              <Factory />
              Vật tư theo lệnh
            </Link>
          </Button>
        }
      />

      <Toolbar
        left={
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="Tất cả"
              count={issues.length}
              active={level === null}
              onClick={() => pick(null)}
            />
            {ISSUE_LEVELS.map((k) => (
              <FilterChip
                key={k}
                label={MEETING_LEVEL[k].label}
                count={counts[k]}
                active={level === k}
                onClick={() => pick(level === k ? null : k)}
              />
            ))}
          </div>
        }
        right={
          <>
            <ToolbarSelect
              value={customer}
              onChange={(v) => {
                setCustomer(v)
                setPage(1)
              }}
              options={[
                { value: '', label: 'Mọi khách hàng' },
                ...customers.map((c) => ({ value: c, label: c })),
              ]}
            />
            <ToolbarInput
              value={q}
              onChange={(v) => {
                setQ(v)
                setPage(1)
              }}
              placeholder="Tìm lệnh, sản phẩm, lý do…"
              icon={<Search className="size-4" />}
            />
          </>
        }
      />

      <section className="bg-card overflow-hidden rounded-lg border">
        {pageRows.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title={
              issues.length === 0
                ? 'Không có vấn đề nào'
                : 'Không có lệnh nào khớp bộ lọc'
            }
            description={
              issues.length === 0
                ? 'Mọi lệnh đang chạy đều đã đủ vật tư hoặc nhà cung cấp đang giao đúng hẹn.'
                : undefined
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {pageRows.map(({ row, risk }) => (
              <IssueRow key={row.id} row={row} risk={risk} />
            ))}
          </ul>
        )}
        {pageCount > 1 && (
          <footer className="flex items-center justify-between gap-2 border-t px-4 py-2 text-[12px]">
            <span className="text-muted-foreground">
              Trang <span className="t-data">{safePage}</span>/
              <span className="t-data">{pageCount}</span> ·{' '}
              <span className="t-data">{filtered.length}</span> lệnh
            </span>
            <span className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft />
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                Sau
                <ChevronRight />
              </Button>
            </span>
          </footer>
        )}
      </section>
    </div>
  )
}

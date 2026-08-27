'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, PenLine, Table2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarSelect } from '@/components/erp/Toolbar'
import { DocChip } from '@/components/erp/DocChip'
import type { WorklistRow } from '@/modules/dept/production/worklist.service'

/**
 * Tầng 2 — MỘT LỆNH. Bảng gom theo SẢN PHẨM: mỗi sản phẩm một khối, trong khối
 * là các công đoạn của chính nó. Đọc theo chiều dọc là thấy sản phẩm đó đang
 * nằm ở khâu nào, thay vì trộn lẫn mọi sản phẩm như bản phẳng cũ.
 */

type Stage = { code: string; label: string }
type Lsx = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  status: string
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('vi-VN')

const STATUS_TONE = {
  not_started: { tone: 'gray' as const, label: 'Chưa bắt đầu' },
  in_progress: { tone: 'blue' as const, label: 'Đang sản xuất' },
  done: { tone: 'green' as const, label: 'Hoàn thành' },
}

export function LsxWorkScreen({
  lsx,
  stages,
  rows,
  canRecord,
}: {
  lsx: Lsx
  stages: Stage[]
  rows: WorklistRow[]
  canRecord: boolean
}) {
  const [stage, setStage] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)

  const shown = useMemo(
    () =>
      rows.filter(
        (r) => (!stage || r.stage === stage) && (!onlyOpen || r.status !== 'done'),
      ),
    [rows, stage, onlyOpen],
  )

  /** Gom theo SẢN PHẨM — đây là điểm khác bản phẳng cũ. */
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { code: string; name: string; qty: number; items: WorklistRow[] }
    >()
    for (const r of shown) {
      const g = m.get(r.order_line_id) ?? {
        code: r.product_code,
        name: r.product_name,
        qty: r.planned,
        items: [],
      }
      g.items.push(r)
      m.set(r.order_line_id, g)
    }
    return [...m.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code))
  }, [shown])

  const openCount = rows.filter((r) => r.status !== 'done').length
  const pendingSets = rows.reduce((a, r) => a + r.pending, 0)
  const productCount = new Set(rows.map((r) => r.order_line_id)).size
  const stagesInLsx = useMemo(
    () => stages.filter((s) => rows.some((r) => r.stage === s.code)),
    [stages, rows],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Tiến độ theo lệnh', href: '/thongke/lenh' },
          { label: lsx.code },
        ]}
        title={`Lệnh ${lsx.code}`}
        description={lsx.customer_name}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/thongke/lenh">
                <ArrowLeft aria-hidden />
                Danh sách lệnh
              </Link>
            </Button>
            {canRecord && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/thongke/lsx/${lsx.id}/dinh-hinh`}>
                    <Table2 aria-hidden />
                    Định hình
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/thongke/lsx/${lsx.id}/ghi`}>
                    <PenLine aria-hidden />
                    Ghi sổ
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Thông tin lệnh — người ghi phải biết mình đang đứng ở lệnh nào. */}
      <section className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Lệnh</span>
          <DocChip>{lsx.code}</DocChip>
        </span>
        {lsx.order_codes.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Đơn hàng</span>
            <span className="t-data">{lsx.order_codes.join(' · ')}</span>
          </span>
        )}
        {lsx.ship_date && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Hạn xuất</span>
            <span className="t-data">{fmtDate(lsx.ship_date)}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Công đoạn của lệnh</span>
          {stagesInLsx.map((s) => (
            <Badge key={s.code}>{s.label}</Badge>
          ))}
        </span>
      </section>

      <StatsBar
        stats={[
          { label: 'Sản phẩm', value: productCount, tone: 'blue' },
          {
            label: 'Việc còn / tổng',
            value: `${openCount}/${rows.length}`,
            tone: 'gray',
          },
          {
            label: 'Chờ duyệt (bộ)',
            value: fmt(pendingSets),
            tone: pendingSets > 0 ? 'amber' : 'gray',
          },
        ]}
      />

      <Toolbar
        left={
          <>
            <ToolbarSelect
              value={stage}
              onChange={setStage}
              options={[
                { value: '', label: 'Mọi công đoạn' },
                ...stagesInLsx.map((s) => ({ value: s.code, label: s.label })),
              ]}
              className="min-w-40"
            />
            <button
              onClick={() => setOnlyOpen((v) => !v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                onlyOpen
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-input text-foreground border hover:bg-[var(--accent)]'
              }`}
            >
              Chỉ việc chưa xong
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        {groups.map(([lineId, g]) => (
          <section key={lineId} className="bg-card overflow-hidden rounded-lg border">
            <div className="bg-muted/60 flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <span className="t-data text-sm font-semibold">{g.code}</span>
              <span className="text-muted-foreground text-xs">{g.name}</span>
              <span className="t-data text-muted-foreground ml-auto text-xs">
                × {fmt(g.qty)} bộ
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-[10px] uppercase">
                    <th className="px-4 py-1.5">Công đoạn</th>
                    <th className="w-20 py-1.5 pr-2 text-right">Kế hoạch</th>
                    <th className="w-16 py-1.5 pr-2 text-right">Đạt</th>
                    <th className="w-20 py-1.5 pr-2 text-right">Chờ duyệt</th>
                    <th className="w-16 py-1.5 pr-2 text-right">Còn</th>
                    <th className="w-32 py-1.5 pr-2">Tiến độ</th>
                    <th className="py-1.5 pr-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((r) => {
                    const cells = (
                      <>
                        <td className="t-data py-1.5 pr-2 text-right">
                          {fmt(r.planned)}
                        </td>
                        <td className="t-data py-1.5 pr-2 text-right font-semibold">
                          {fmt(r.done)}
                        </td>
                        <td className="t-data py-1.5 pr-2 text-right">
                          {r.pending > 0 ? (
                            <span className="text-[var(--warn)]">+{fmt(r.pending)}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="t-data py-1.5 pr-2 text-right">
                          {r.remaining > 0 ? (
                            <span className="text-[var(--warn)]">{fmt(r.remaining)}</span>
                          ) : (
                            <Check
                              size={14}
                              strokeWidth={2}
                              className="inline text-[var(--done)]"
                              aria-label="Đã đủ"
                            />
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-2">
                            <span className="bg-muted block h-1.5 w-16 overflow-hidden rounded">
                              <span
                                className={`block h-1.5 rounded ${
                                  r.status === 'done'
                                    ? 'bg-[var(--done)]'
                                    : 'bg-[var(--primary)]'
                                }`}
                                style={{ width: `${Math.round(r.pct * 100)}%` }}
                              />
                            </span>
                            <span className="t-data text-muted-foreground text-[11px]">
                              {Math.round(r.pct * 100)}%
                            </span>
                          </span>
                        </td>
                        <td className="py-1.5 pr-4">
                          <span className="flex items-center gap-2">
                            <Badge tone={STATUS_TONE[r.status].tone}>
                              {STATUS_TONE[r.status].label}
                            </Badge>
                            {canRecord && (
                              <Link
                                href={`/thongke/lsx/${lsx.id}/ghi?stage=${r.stage}`}
                                className="text-xs font-medium text-[var(--primary)] hover:underline"
                              >
                                Ghi
                              </Link>
                            )}
                          </span>
                        </td>
                      </>
                    )
                    return (
                      <tr
                        key={r.stage}
                        className="border-b last:border-b-0 hover:bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
                      >
                        <td className="px-4 py-1.5 font-medium">{r.stage_label}</td>
                        {cells}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {canRecord && (
        <p className="text-muted-foreground text-xs">
          Bấm “Ghi” trên dòng công đoạn (hoặc nút Ghi sổ) để lập phiếu báo sản lượng.
        </p>
      )}
    </div>
  )
}

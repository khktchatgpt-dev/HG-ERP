'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, FileWarning, Ruler, Scale, ListX } from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar, type Stat } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { DocChip } from '@/components/erp/DocChip'
import { FilterChip } from '@/components/erp/FilterChip'
import { api, ApiError } from '@/lib/api'
import {
  BOM_ISSUES,
  BOM_ISSUE_LABEL,
  BOM_ISSUE_WHY,
  type BomIssue,
} from '@/lib/bom-health'
import type {
  BomHealthReport,
  BomHealthRow,
} from '@/modules/dept/technical/bom-health.service'

/**
 * SỨC KHOẺ ĐỊNH MỨC — hàng đợi việc của Kỹ thuật, không phải bảng tra cứu.
 *
 * Thứ tự mặc định là NỢ NẶNG TRƯỚC (service sắp), nên mở màn ra là thấy ngay
 * việc cần làm đầu tiên. Ba lựa chọn thiết kế đáng ghi:
 *
 *  · Rổ "Chưa có BOM" tách khỏi "Còn lỗi". Gộp chung thì 471 hồ sơ trắng sẽ
 *    nhấn chìm vài chục hồ sơ chỉ thiếu một ô — mà hai việc đó khác hẳn nhau:
 *    một bên là nhập mới, một bên là sửa vặt.
 *  · Chip lọc theo TỪNG loại lỗi, kèm số. Kỹ thuật hay làm theo lô ("hôm nay
 *    đi điền δ hết một lượt") chứ không đi từng hồ sơ.
 *  · Không có nút sửa tại chỗ. Sửa định mức phải thấy cả hồ sơ mới an toàn —
 *    mã SP dẫn thẳng sang hồ sơ, nơi quyền sửa và khoá hồ sơ đã có sẵn.
 */

/** Rổ lớn — trả lời "loại việc nào", trước khi lọc tiếp theo loại lỗi. */
type Bucket = 'all' | 'no_bom' | 'dirty' | 'clean'

const BUCKETS: readonly { value: Bucket; label: string }[] = [
  { value: 'all', label: 'Tất cả hồ sơ' },
  { value: 'no_bom', label: 'Chưa có BOM' },
  { value: 'dirty', label: 'Có dòng lỗi' },
  { value: 'clean', label: 'Đã sạch' },
]

const ISSUE_ICON: Record<BomIssue, typeof Ruler> = {
  thieu_sl: ListX,
  thieu_delta: Ruler,
  thieu_dan_xuat: FileWarning,
  lech_kg: Scale,
}

/** Vạch điểm — mã hoá mức nợ bằng 3 màu vòng đời, không phải bằng nút bấm. */
function ScoreBar({ row }: { row: BomHealthRow }) {
  if (row.parts === 0) {
    return <span className="text-muted-foreground text-xs">chưa nhập</span>
  }
  const tone =
    row.score === 100 ? 'var(--done)' : row.score >= 60 ? 'var(--warn)' : 'var(--stop)'
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${row.score}%`, background: tone }}
        />
      </div>
      <span className="t-data w-9 text-right text-xs" style={{ color: tone }}>
        {row.score}
      </span>
    </div>
  )
}

export function BomHealthScreen() {
  const [report, setReport] = useState<BomHealthReport | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [bucket, setBucket] = useState<Bucket>('all')
  const [issue, setIssue] = useState<BomIssue | null>(null)

  useEffect(() => {
    let alive = true
    api<BomHealthReport>('/api/dept/technical/bom-health')
      .then((r) => alive && setReport(r))
      .catch(
        (e) => alive && setError(e instanceof ApiError ? e.message : 'Không tải được'),
      )
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [])

  const rows = useMemo(() => {
    if (!report) return []
    const needle = q.trim().toLowerCase()
    return report.rows.filter((r) => {
      if (bucket === 'no_bom' && r.parts !== 0) return false
      if (bucket === 'dirty' && (r.parts === 0 || r.dirtyParts === 0)) return false
      if (bucket === 'clean' && (r.parts === 0 || r.dirtyParts > 0)) return false
      if (issue && r.counts[issue] === 0) return false
      if (!needle) return true
      return (
        r.code.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        (r.customer_name ?? '').toLowerCase().includes(needle)
      )
    })
  }, [report, q, bucket, issue])

  const stats: Stat[] = report
    ? [
        { label: 'Hồ sơ SP', value: report.summary.products },
        {
          label: 'Chưa có BOM',
          value: report.summary.noBom,
          tone: 'red',
          hint: 'Không có dòng định mức nào — chưa mua hàng theo được',
        },
        {
          label: 'Còn dòng lỗi',
          value: report.summary.dirty,
          tone: 'amber',
          hint: 'Đã có BOM nhưng còn ô thiếu hoặc số lệch',
        },
        { label: 'Đã sạch', value: report.summary.clean, tone: 'green' },
        {
          label: 'Dòng định mức',
          value: report.summary.totalParts,
          hint: 'Tổng số dòng trên toàn bộ hồ sơ',
        },
      ]
    : []

  const columns: Column<BomHealthRow>[] = [
    {
      key: 'code',
      header: 'Mã SP',
      width: '150px',
      cell: (r) => (
        <Link href={`/products/${r.id}/dinh-muc`} className="hover:underline">
          <DocChip>{r.code}</DocChip>
        </Link>
      ),
      sortValue: (r) => r.code,
    },
    {
      key: 'name',
      header: 'Tên sản phẩm',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate">{r.name}</div>
          {r.customer_name && (
            <div className="text-muted-foreground truncate text-xs">
              {r.customer_name}
            </div>
          )}
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: 'parts',
      header: 'Dòng',
      width: '80px',
      align: 'right',
      cell: (r) =>
        r.parts === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="t-data">{r.parts}</span>
        ),
      sortValue: (r) => r.parts,
    },
    // Một cột cho mỗi loại lỗi: người làm theo lô cần đọc được "hồ sơ này nợ
    // đúng thứ tôi đang đi điền", không phải mở ra mới biết.
    ...BOM_ISSUES.map<Column<BomHealthRow>>((k) => {
      const Icon = ISSUE_ICON[k]
      return {
        key: k,
        header: BOM_ISSUE_LABEL[k],
        width: '120px',
        align: 'right',
        cell: (r) =>
          r.counts[k] === 0 ? (
            <span className="text-muted-foreground">·</span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-[var(--warn)]"
              title={BOM_ISSUE_WHY[k]}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span className="t-data">{r.counts[k]}</span>
            </span>
          ),
        sortValue: (r) => r.counts[k],
      }
    }),
    {
      key: 'score',
      header: 'Sức khoẻ',
      width: '130px',
      align: 'right',
      cell: (r) => <ScoreBar row={r} />,
      sortValue: (r) => r.score,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { href: '/technical', label: 'Kỹ thuật' },
          { label: 'Sức khoẻ định mức' },
        ]}
        title="Sức khoẻ định mức"
        description="Hồ sơ nào chưa đủ số để đi mua hàng. Xếp nợ nặng lên trước."
      />

      {error && (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--stop)_30%,transparent)] bg-[color-mix(in_srgb,var(--stop)_8%,transparent)] px-3.5 py-2 text-xs text-[var(--stop)]">
          {error}
        </p>
      )}

      {report && <StatsBar stats={stats} />}

      <Toolbar
        left={
          <>
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã SP, tên, khách…"
              className="w-64"
            />
            <ToolbarSelect
              value={bucket}
              onChange={setBucket}
              options={BUCKETS}
              className="w-40"
            />
          </>
        }
        right={
          report && (
            <span className="text-muted-foreground text-xs">
              <span className="t-data">{rows.length}</span> / {report.summary.products} hồ
              sơ
            </span>
          )
        }
      />

      {/* Chip lọc theo loại lỗi — Kỹ thuật đi theo lô, không đi từng hồ sơ. */}
      {report && (
        <div className="flex flex-wrap items-center gap-2">
          {BOM_ISSUES.map((k) => (
            <FilterChip
              key={k}
              label={BOM_ISSUE_LABEL[k]}
              count={report.summary.counts[k]}
              active={issue === k}
              onClick={() => setIssue(issue === k ? null : k)}
              icon={ISSUE_ICON[k]}
              title={BOM_ISSUE_WHY[k]}
            />
          ))}
        </div>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        storageKey="bom-health"
        emptyState={
          busy ? undefined : (
            <EmptyState
              icon={<AlertTriangle size={20} strokeWidth={1.8} />}
              title={report ? 'Không có hồ sơ nào khớp' : 'Chưa tải được dữ liệu'}
              description={
                report ? 'Nới bộ lọc hoặc bỏ chip loại lỗi để xem rộng hơn.' : undefined
              }
            />
          )
        }
      />
    </div>
  )
}

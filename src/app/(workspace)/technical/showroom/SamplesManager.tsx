'use client'

import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isSvgUrl } from '@/lib/image'
import { Badge } from '@/components/Badge'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar, type Stat } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { TopProgressBar } from '@/components/erp/Spinner'
import {
  SAMPLE_CONDITION_LABEL,
  SAMPLE_STATUS_LABEL,
  type SampleCondition,
  type SampleStatus,
} from '@/modules/dept/technical/samples.schema'
import { SampleCreateModal } from './SampleCreateModal'
import { LoanModal } from './LoanModal'
import { ReturnModal } from './ReturnModal'

export type SampleRow = {
  id: string
  code: string
  product_id: string
  product_code: string
  product_name: string
  status: SampleStatus
  condition: SampleCondition
  location: string | null
  open_loan: {
    id: string
    code: string
    borrower_name: string
    due_at: string | null
    borrowed_at: string
  } | null
}

const STATUS_TONE: Record<SampleStatus, 'green' | 'blue' | 'amber' | 'red' | 'gray'> = {
  in_showroom: 'green',
  on_loan: 'blue',
  maintenance: 'amber',
  lost: 'red',
  disposed: 'gray',
}

const CONDITION_TONE: Record<SampleCondition, 'green' | 'blue' | 'amber' | 'red'> = {
  new: 'blue',
  good: 'green',
  scratched: 'amber',
  damaged: 'red',
}

const today = () => new Date().toISOString().slice(0, 10)

/** Số ngày quá hạn, 0 nếu chưa tới hạn. */
export function overdueDays(dueAt: string | null, now = today()): number {
  if (!dueAt || dueAt >= now) return 0
  const ms = new Date(now).getTime() - new Date(dueAt).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

export function SamplesManager({
  samples,
  total,
  page,
  pageSize,
  stats,
  filters,
  imageUrls,
  products,
  canEdit,
}: {
  samples: SampleRow[]
  total: number
  page: number
  pageSize: number
  stats: Record<string, number>
  filters: { q: string; status: string; overdue: boolean }
  imageUrls: Record<string, string>
  products: { id: string; code: string; name: string }[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loaning, setLoaning] = useState<SampleRow | null>(null)
  const [returning, setReturning] = useState<SampleRow | null>(null)

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') sp.delete(k)
        else sp.set(k, v)
      }
      sp.delete('page') // đổi bộ lọc thì về trang 1
      router.push(`/technical/showroom?${sp.toString()}`)
    },
    [router, searchParams],
  )

  async function changeStatus(s: SampleRow, status: SampleStatus, label: string) {
    setBusy(true)
    try {
      await api(`/api/dept/technical/samples/${s.id}/status`, {
        method: 'POST',
        body: { status },
      })
      toast.success(label, s.code)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const statList: Stat[] = [
    { label: 'Tổng mẫu', value: stats.total ?? 0 },
    { label: 'Ở showroom', value: stats.in_showroom ?? 0, tone: 'green' },
    { label: 'Đang cho mượn', value: stats.on_loan ?? 0, tone: 'blue' },
    { label: 'Quá hạn trả', value: stats.overdue ?? 0, tone: 'red' },
    { label: 'Đang sửa', value: stats.maintenance ?? 0, tone: 'amber' },
    {
      label: 'Mất / thanh lý',
      value: (stats.lost ?? 0) + (stats.disposed ?? 0),
      tone: 'gray',
    },
  ]

  const columns: Column<SampleRow>[] = [
    {
      key: 'code',
      header: 'Mã mẫu',
      width: '120px',
      cell: (s) => (
        <Link
          href={`/technical/showroom/${s.id}`}
          className="font-mono text-sky-600 hover:underline dark:text-sky-400"
        >
          {s.code}
        </Link>
      ),
    },
    {
      key: 'product',
      header: 'Sản phẩm',
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-2">
          {imageUrls[s.id] ? (
            <Image
              src={imageUrls[s.id]}
              alt={s.product_name}
              width={40}
              height={32}
              unoptimized={isSvgUrl(imageUrls[s.id])}
              className="h-8 w-10 shrink-0 rounded border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ) : (
            <span className="h-8 w-10 shrink-0 rounded border border-dashed border-zinc-300 dark:border-zinc-700" />
          )}
          <div className="min-w-0">
            <div className="truncate">{s.product_name}</div>
            <div className="truncate font-mono text-[11px] text-zinc-400">
              {s.product_code}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      cell: (s) => (
        <Badge tone={STATUS_TONE[s.status]}>{SAMPLE_STATUS_LABEL[s.status]}</Badge>
      ),
    },
    {
      key: 'condition',
      header: 'Tình trạng',
      width: '110px',
      cell: (s) => (
        <Badge tone={CONDITION_TONE[s.condition]}>
          {SAMPLE_CONDITION_LABEL[s.condition]}
        </Badge>
      ),
    },
    {
      // Cột đáng giá nhất: câu hỏi thật khi mở màn hình này là "cái mẫu đó đang ở đâu".
      key: 'where',
      header: 'Đang ở đâu',
      cell: (s) => {
        if (s.open_loan) {
          const late = overdueDays(s.open_loan.due_at)
          return (
            <div className="min-w-0">
              <div className="truncate">{s.open_loan.borrower_name}</div>
              <div className="text-[11px] text-zinc-400">
                {s.open_loan.due_at
                  ? `hẹn trả ${s.open_loan.due_at}`
                  : 'không hẹn ngày trả'}
                {late > 0 && (
                  <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                    · quá {late} ngày
                  </span>
                )}
              </div>
            </div>
          )
        }
        return <span className="text-zinc-400">{s.location || 'showroom'}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      align: 'right',
      cell: (s) => {
        if (!canEdit) return null
        return (
          <RowMenu
            items={[
              {
                label: 'Ghi mượn',
                onClick: () => setLoaning(s),
                disabled: s.status !== 'in_showroom',
                disabledReason: `Mẫu đang "${SAMPLE_STATUS_LABEL[s.status]}"`,
              },
              {
                label: 'Ghi trả',
                onClick: () => setReturning(s),
                disabled: !s.open_loan,
                disabledReason: 'Mẫu không có ai đang mượn',
              },
              {
                label: 'Mang đi sửa',
                onClick: () =>
                  void changeStatus(s, 'maintenance', 'Đã chuyển sang đang sửa'),
                disabled: s.status !== 'in_showroom',
              },
              {
                label: 'Sửa xong — về showroom',
                onClick: () => void changeStatus(s, 'in_showroom', 'Mẫu đã về showroom'),
                disabled: s.status !== 'maintenance' && s.status !== 'lost',
              },
              {
                label: 'Báo mất',
                onClick: () => void changeStatus(s, 'lost', 'Đã ghi nhận mất mẫu'),
                disabled: s.status !== 'in_showroom' && s.status !== 'on_loan',
                danger: true,
              },
              {
                label: 'Thanh lý',
                onClick: () => void changeStatus(s, 'disposed', 'Đã thanh lý mẫu'),
                disabled: s.status !== 'in_showroom' && s.status !== 'maintenance',
                danger: true,
              },
            ]}
          />
        )
      },
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Mẫu showroom' },
        ]}
        title="Mẫu showroom"
        description={`${total} mẫu · theo dõi người mượn và tình trạng từng hiện vật.`}
        actions={
          canEdit ? (
            <button
              onClick={() => setCreating(true)}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700"
            >
              + Thêm mẫu
            </button>
          ) : null
        }
      />

      <StatsBar stats={statList} />

      <Toolbar
        left={
          <>
            <ToolbarInput
              value={filters.q}
              onChange={(v) => setParam({ q: v || null })}
              placeholder="Tìm mã mẫu…"
            />
            <ToolbarSelect
              value={filters.status}
              onChange={(v) => setParam({ status: v === 'all' ? null : v })}
              options={[
                { value: 'all', label: 'Mọi trạng thái' },
                ...Object.entries(SAMPLE_STATUS_LABEL).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
            />
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={(e) =>
                  setParam({ overdue: e.currentTarget.checked ? '1' : null })
                }
              />
              Chỉ mẫu quá hạn trả
            </label>
          </>
        }
      />

      <DataTable
        rows={samples}
        columns={columns}
        pagination={false}
        emptyState={
          <EmptyState
            icon="▦"
            title="Chưa có mẫu nào"
            description={
              canEdit
                ? 'Bấm “+ Thêm mẫu” để đưa hiện vật đầu tiên vào showroom.'
                : 'Phòng Kỹ thuật chưa đưa mẫu nào vào showroom.'
            }
          />
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700"
          >
            ‹ Trước
          </button>
          <span className="text-zinc-500">
            Trang {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
            className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40 dark:border-zinc-700"
          >
            Sau ›
          </button>
        </div>
      )}

      {creating && (
        <SampleCreateModal products={products} onClose={() => setCreating(false)} />
      )}
      {loaning && <LoanModal sample={loaning} onClose={() => setLoaning(null)} />}
      {returning?.open_loan && (
        <ReturnModal
          loanId={returning.open_loan.id}
          sampleCode={returning.code}
          onClose={() => setReturning(null)}
        />
      )}
    </div>
  )
}

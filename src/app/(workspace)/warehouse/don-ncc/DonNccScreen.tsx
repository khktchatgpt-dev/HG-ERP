'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner } from '@/components/erp/Spinner'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { poStatusLabel, poStatusTone } from '@/lib/po-status'

type PoRow = {
  id: string
  code: string
  status: string
  supplier_name: string
  lsx_code: string | null
  /** Lệnh chính + lệnh PHỤ mua chung (0125) — nhóm theo LSX hiện đủ mọi lệnh. */
  lsx_codes: string[]
  expected_at: string | null
  /** "Về kho x/y dòng" — dòng chốt thiếu đếm là xong (qty_open, 0154). */
  lines_done: number
  lines_total: number
  next_shipment: { date: string; seq: number; id: string; arrived: boolean } | null
}

/** Dòng đơn từ /api/dept/warehouse/po-open?po_id= (view BR-08). */
type PoLine = {
  id: string
  material_id: string | null
  qty_ordered: number
  qty_received: number
  qty_missing: number
  qty_open: number
  closed_short_at: string | null
  material_code: string
  material_name: string
  material_unit: string
}

type Shipment = {
  id: string
  seq: number
  expected_date: string
  status: string
  lines: { po_line_id: string; qty: number }[]
}

type Detail = { lines: PoLine[]; shipments: Shipment[] }

const num = (n: number) => n.toLocaleString('vi-VN')
const dmy = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

/**
 * Danh sách ĐƠN ĐẶT NCC cho Kho: tra tiến độ về hàng theo đơn hoặc NHÓM THEO
 * LSX (đơn mua chung hiện ở mọi lệnh nó phục vụ), bung chi tiết dòng + đợt,
 * lập phiếu nhập nhanh đúng đơn/đợt. Mã đơn bấm được → trang chi tiết Kho.
 */
export function DonNccScreen({
  pos,
  initialQ = '',
  canEdit,
}: {
  pos: PoRow[]
  /** Deep-link ?lsx= (từ màn Cấp vật tư SX) — prefill ô tìm. */
  initialQ?: string
  canEdit: boolean
}) {
  const toast = useToast()
  const [q, setQ] = useState(initialQ)
  const [statusFilter, setStatusFilter] = useState('all')
  const [byLsx, setByLsx] = useState(Boolean(initialQ))
  const [openId, setOpenId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return pos.filter((p) => {
      if (statusFilter === 'late') {
        if (!(p.expected_at && p.expected_at.slice(0, 10) < today)) return false
      } else if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (
        ql &&
        !`${p.code} ${p.supplier_name} ${p.lsx_codes.join(' ')}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
  }, [pos, q, statusFilter, today])

  /** Nhóm theo LSX: đơn nhiều lệnh xuất hiện ở TỪNG lệnh — đúng câu hỏi "lệnh này có những đơn nào". */
  const groups = useMemo(() => {
    if (!byLsx) return null
    const m = new Map<string, PoRow[]>()
    for (const p of filtered) {
      const keys = p.lsx_codes.length > 0 ? p.lsx_codes : ['Ngoài LSX']
      for (const k of keys) m.set(k, [...(m.get(k) ?? []), p])
    }
    return [...m.entries()].sort(([a], [b]) =>
      a === 'Ngoài LSX' ? 1 : b === 'Ngoài LSX' ? -1 : a.localeCompare(b, 'vi'),
    )
  }, [byLsx, filtered])

  const stats = useMemo(() => {
    const late = pos.filter(
      (p) => p.expected_at && p.expected_at.slice(0, 10) < today,
    ).length
    const arrived = pos.filter((p) => p.next_shipment?.arrived).length
    const partial = pos.filter((p) => p.status === 'partial').length
    return { late, arrived, partial }
  }, [pos, today])

  /** Bung chi tiết — nạp dòng + đợt đúng một lần, cache theo đơn. */
  async function toggle(poId: string) {
    if (openId === poId) {
      setOpenId(null)
      return
    }
    setOpenId(poId)
    if (details[poId]) return
    setLoadingId(poId)
    try {
      const [{ lines }, ships] = await Promise.all([
        api<{ lines: PoLine[] }>(`/api/dept/warehouse/po-open?po_id=${poId}`),
        api<{ shipments: Shipment[] }>(`/api/dept/supply/pos/${poId}/shipments`)
          .then((r) => r.shipments)
          .catch(() => [] as Shipment[]),
      ])
      setDetails((d) => ({ ...d, [poId]: { lines, shipments: ships } }))
    } catch (e) {
      toast.error(
        'Không tải được chi tiết đơn',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
      setOpenId(null)
    } finally {
      setLoadingId(null)
    }
  }

  const btnReceipt =
    'border-input hover:bg-accent inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors'

  const rowOf = (p: PoRow, keyPrefix = '') => {
    const late = p.expected_at && p.expected_at.slice(0, 10) < today
    const open = openId === p.id
    const d = details[p.id]
    return (
      <div key={`${keyPrefix}${p.id}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
          <button
            type="button"
            onClick={() => void toggle(p.id)}
            aria-label={open ? 'Thu gọn' : 'Xem nhanh'}
            className="text-muted-foreground hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center"
          >
            {open ? (
              <ChevronDown className="size-4" strokeWidth={1.8} />
            ) : (
              <ChevronRight className="size-4" strokeWidth={1.8} />
            )}
          </button>
          {/* Mã đơn = LINK trang chi tiết Kho (16/08) — bung tại chỗ chỉ là xem nhanh. */}
          <Link href={`/warehouse/don-ncc/${p.id}`} className="hover:opacity-80">
            <DocChip className="text-[11px]">{p.code}</DocChip>
          </Link>
          <span className="t-body min-w-0 flex-1 truncate font-medium">
            {p.supplier_name}
          </span>
          {p.lsx_codes.length > 0 && (
            <span className="t-data text-muted-foreground text-[11px]">
              LSX {p.lsx_codes.join(' + ')}
            </span>
          )}
          <Badge tone={poStatusTone(p.status)}>{poStatusLabel(p.status)}</Badge>
          {p.lines_total > 0 && (
            <span className="text-muted-foreground shrink-0 text-[11.5px]">
              về{' '}
              <span className="t-data">
                {p.lines_done}/{p.lines_total}
              </span>{' '}
              dòng
            </span>
          )}
          {p.next_shipment ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 text-[11.5px] ${
                p.next_shipment.arrived
                  ? 'text-sky-600'
                  : p.next_shipment.date < today
                    ? 'text-red-600'
                    : 'text-muted-foreground'
              }`}
            >
              <Truck className="size-3.5" strokeWidth={1.8} />
              đợt {p.next_shipment.seq} · {dmy(p.next_shipment.date)}
              {p.next_shipment.arrived && ' · xe đã tới'}
            </span>
          ) : (
            p.expected_at && (
              <span
                className={`shrink-0 text-[11.5px] ${late ? 'font-medium text-red-600' : 'text-muted-foreground'}`}
              >
                hẹn {dmy(p.expected_at)}
                {late && ' · quá hẹn'}
              </span>
            )
          )}
          <Link
            href={`/warehouse/don-ncc/${p.id}`}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs underline-offset-2 hover:underline"
          >
            <ExternalLink className="size-3" strokeWidth={1.8} /> Chi tiết
          </Link>
          {canEdit && (
            <Link
              href={`/warehouse/docs?new=receipt&po=${p.id}${
                p.next_shipment ? `&shipment=${p.next_shipment.id}` : ''
              }`}
              className={btnReceipt}
            >
              <ArrowDownToLine className="size-3.5" strokeWidth={1.8} /> Lập phiếu nhập
            </Link>
          )}
        </div>

        {open && (
          <div className="border-border/60 bg-muted/30 border-t px-4 py-3">
            {loadingId === p.id && !d ? (
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                <Spinner size={14} /> Đang tải chi tiết…
              </span>
            ) : d ? (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-muted-foreground border-border/60 border-b text-left text-[10px] uppercase">
                        <th className="py-1.5 pr-2">Vật tư</th>
                        <th className="w-24 py-1.5 pr-2 text-right">SL đặt</th>
                        <th className="w-24 py-1.5 pr-2 text-right">Đã về</th>
                        <th className="w-28 py-1.5 pr-2 text-right">Còn chờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.lines.map((l) => (
                        <tr key={l.id} className="border-border/40 border-b">
                          <td className="py-1.5 pr-2">
                            <span className="t-data text-muted-foreground text-[11px]">
                              {l.material_code}
                            </span>{' '}
                            {l.material_name}
                          </td>
                          <td className="t-data py-1.5 pr-2 text-right">
                            {num(l.qty_ordered)} {l.material_unit}
                          </td>
                          <td className="t-data py-1.5 pr-2 text-right">
                            {num(l.qty_received)}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            {l.closed_short_at ? (
                              <Badge tone="gray">Chốt thiếu {num(l.qty_missing)}</Badge>
                            ) : l.qty_open > 0 ? (
                              <span className="t-data font-medium text-amber-600">
                                {num(l.qty_open)}
                              </span>
                            ) : (
                              <Badge tone="green">Đủ</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {d.shipments.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <b className="text-muted-foreground text-[10px] uppercase">
                      Kế hoạch giao
                    </b>
                    {d.shipments.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                      >
                        <span className="t-data w-12">{dmy(s.expected_date)}</span>
                        <span>
                          Đợt {s.seq} · {s.lines.length} dòng
                        </span>
                        {s.status === 'arrived' && <Badge tone="blue">Xe tới</Badge>}
                        {s.status === 'received' && <Badge tone="green">Đã nhận</Badge>}
                        {s.status === 'cancelled' && <Badge tone="gray">Đã huỷ</Badge>}
                        {s.status === 'planned' && s.expected_date < today && (
                          <Badge tone="red">Quá hẹn</Badge>
                        )}
                        {canEdit &&
                          (s.status === 'planned' || s.status === 'arrived') && (
                            <Link
                              href={`/warehouse/docs?new=receipt&po=${p.id}&shipment=${s.id}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              Nhập đợt này
                            </Link>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Đơn đặt NCC' }]}
        title="Đơn đặt nhà cung cấp"
        description="Mọi đơn đang mở — Kho tra tiến độ về hàng, chuẩn bị mặt bằng và lập phiếu nhập đúng đơn/đợt. Gõ mã LSX hoặc bật nhóm theo LSX để gom đơn của một lệnh."
      />

      <StatsBar
        stats={[
          { label: 'Đơn đang mở', value: pos.length, tone: 'default' },
          { label: 'Quá hẹn giao', value: stats.late, tone: stats.late ? 'red' : 'gray' },
          {
            label: 'Xe đã tới',
            value: stats.arrived,
            tone: stats.arrived ? 'blue' : 'gray',
          },
          { label: 'Về một phần', value: stats.partial, tone: 'amber' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm mã đơn, NCC, mã LSX…"
                icon="⌕"
                className="w-72"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Mọi trạng thái' },
                  { value: 'late', label: '⚠ Quá hẹn giao' },
                  { value: 'approved', label: poStatusLabel('approved') },
                  { value: 'ordered', label: poStatusLabel('ordered') },
                  { value: 'confirmed', label: poStatusLabel('confirmed') },
                  { value: 'in_transit', label: poStatusLabel('in_transit') },
                  { value: 'partial', label: poStatusLabel('partial') },
                ]}
              />
              {/* "LSX này có những đơn nào?" — đơn mua chung hiện ở mọi lệnh nó phục vụ. */}
              <button
                onClick={() => setByLsx((v) => !v)}
                aria-pressed={byLsx}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  byLsx
                    ? 'border-sky-400 bg-sky-50 font-medium text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
                    : 'border-input text-muted-foreground hover:border-sky-400 hover:text-sky-700'
                }`}
              >
                Nhóm theo LSX
              </button>
            </>
          }
        />

        <div className="bg-card overflow-hidden rounded-b-xl border border-t-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon="▥"
              title={pos.length === 0 ? 'Không có đơn nào đang mở' : 'Không khớp bộ lọc'}
              description={
                pos.length === 0
                  ? 'Cung ứng lập đơn và được duyệt thì đơn hiện ở đây.'
                  : 'Thử điều chỉnh từ khoá / trạng thái.'
              }
            />
          ) : groups ? (
            groups.map(([lsx, rows]) => (
              <section key={lsx}>
                <header className="bg-muted/40 border-border/60 flex items-center gap-2 border-b px-4 py-2">
                  <b className="t-data text-[12.5px]">{lsx}</b>
                  <span className="text-muted-foreground text-xs">{rows.length} đơn</span>
                  {lsx !== 'Ngoài LSX' && (
                    <Link
                      href="/warehouse/xuat"
                      className="text-muted-foreground hover:text-foreground ml-auto text-xs underline-offset-2 hover:underline"
                    >
                      Cấp vật tư lệnh này →
                    </Link>
                  )}
                </header>
                <div className="divide-border/60 divide-y">
                  {rows.map((p) => rowOf(p, `${lsx}-`))}
                </div>
              </section>
            ))
          ) : (
            <div className="divide-border/60 divide-y">
              {filtered.map((p) => rowOf(p))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

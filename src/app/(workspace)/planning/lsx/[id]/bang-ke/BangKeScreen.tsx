'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ClipboardList,
  ClipboardPaste,
  Download,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Undo2,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { FilterChip } from '@/components/erp/FilterChip'
import { NumberField } from '@/components/erp/NumberField'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { TopProgressBar } from '@/components/erp/Spinner'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { MaterialPickDialog, type PoMaterial } from '@/components/supply/MaterialPicker'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import {
  BANG_KE_STATUS,
  BANG_KE_STATUSES,
  type BangKeRow,
  type BangKeStatus,
} from '@/lib/lsx-bang-ke'
import { cn } from '@/lib/utils'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { PasteLinesDialog, type PasteConfirm } from '../../../pos/new/PasteLinesDialog'

const STATUS_BADGE: Record<BangKeStatus, BadgeTone> = {
  none: 'red',
  short: 'amber',
  pending: 'amber',
  inflight: 'blue',
  done: 'green',
  extra: 'gray',
  blank: 'gray',
}

const SOURCE_LABEL: Record<BangKeRow['source'], string> = {
  manual: 'nhập tay',
  components: 'định hình',
  bom: 'định mức',
  none: 'ngoài định mức',
}

/** Tối đa mã đưa vào một lượt "Soạn đơn cho dòng thiếu" — đơn dài hơn là đơn khó đọc. */
const MAX_PREFILL = 40

const fmt = (n: number) =>
  n === 0 ? '0' : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const dmy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

type NeedRow = { material_id: string; qty_needed: number; note?: string | null }

/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — B1 đọc, B2 sửa (05/09/2026). Số CẦN của dòng nhập
 * tay sửa ngay trong ô; dòng định mức muốn sửa thì "Ghi đè" — mã đó thành dòng
 * tay, mã khác vẫn theo định mức. "Thêm mã" và "Dán từ Excel" dùng lại đúng hai
 * hộp thoại của form soạn đơn để người mua không phải học thêm gì.
 */
export function BangKeScreen({
  data,
  today,
  canEdit,
}: {
  data: LsxBangKe
  today: string
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const { lsx, rows, summary, groups } = data
  const [status, setStatus] = useState<BangKeStatus | null>(null)
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return rows.filter((r) => {
      if (status !== null && r.status !== status) return false
      if (group && r.group_name !== group) return false
      if (nq && !norm(`${r.material_code} ${r.material_name}`).includes(nq)) return false
      return true
    })
  }, [rows, status, group, q])

  // "Soạn đơn cho dòng thiếu": mọi mã còn phải đặt, theo thứ tự thiếu nhiều trước.
  const shortRows = useMemo(() => rows.filter((r) => r.suggest > 0), [rows])
  const prefillHref = useMemo(() => {
    const pick = shortRows.slice(0, MAX_PREFILL)
    if (pick.length === 0) return null
    const p = new URLSearchParams({
      lsx: lsx.id,
      material: pick.map((r) => r.material_code).join(','),
      qty: pick.map((r) => String(r.suggest)).join(','),
    })
    return `/planning/pos/new?${p.toString()}`
  }, [shortRows, lsx.id])

  const usedIds = useMemo(() => new Set(rows.map((r) => r.material_id)), [rows])
  const suggestById = useMemo(
    () =>
      new Map(rows.filter((r) => r.suggest > 0).map((r) => [r.material_id, r.suggest])),
    [rows],
  )

  const manualDisabled = !canEdit || data.manual_error !== null

  async function saveRows(list: NeedRow[], done: string) {
    if (list.length === 0) return
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-needs', {
        method: 'PUT',
        body: { production_order_id: lsx.id, rows: list },
      })
      toast.success(done)
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được bảng kê', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeManual(r: BangKeRow) {
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-needs', {
        method: 'DELETE',
        body: { production_order_id: lsx.id, material_ids: [r.material_id] },
      })
      toast.success(
        r.auto_needed != null
          ? `${r.material_code} quay về số định mức ${fmt(r.auto_needed)}`
          : `Đã bỏ dòng ${r.material_code}`,
      )
      router.refresh()
    } catch (e) {
      toast.error('Không bỏ được dòng', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** Dòng tự động → dòng tay với đúng số hiện tại, để sửa ngay sau đó. */
  function override(r: BangKeRow) {
    const start =
      r.source === 'none' ? r.pos.reduce((s, p) => s + p.qty_ordered, 0) : r.qty_needed
    void saveRows(
      [{ material_id: r.material_id, qty_needed: start, note: r.note }],
      `${r.material_code} đã thành dòng nhập tay — sửa số Cần ngay trong ô`,
    )
  }

  function onPicked(list: PoMaterial[]) {
    setPickOpen(false)
    void saveRows(
      list.map((m) => ({ material_id: m.id, qty_needed: 0 })),
      `Đã thêm ${list.length} mã — điền số Cần cho từng dòng`,
    )
  }

  function onPasted(p: PasteConfirm) {
    setPasteOpen(false)
    const list = p.matched.map((m) => ({
      material_id: m.material.id,
      qty_needed: m.qty ?? 0,
      note: m.note,
    }))
    if (list.length === 0) {
      toast.warning('Không có dòng nào khớp mã vật tư để đưa vào bảng kê')
      return
    }
    void saveRows(list, `Đã nhập ${list.length} dòng từ Excel`)
  }

  const dueLabel = lsx.materials_due_at
    ? `hạn vật tư ${dmy(lsx.materials_due_at)}`
    : 'chưa đặt hạn vật tư'
  const sourceLabel =
    data.need_source === 'none'
      ? data.manual_count > 0
        ? `nguồn cần: nhập tay · ${data.manual_count} mã`
        : 'lệnh chưa có định mức lẫn định hình — chỉ thấy mã đã lên đơn'
      : `${data.need_source === 'components' ? 'bảng định hình' : 'định mức × số lượng'} · ${summary.needed} mã${
          data.manual_count > 0 ? ` · ${data.manual_count} mã nhập tay` : ''
        }`

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh', href: '/planning/lsx' },
          { label: `LSX ${lsx.code}`, href: `/planning/lsx/${lsx.id}` },
          { label: 'Bảng kê vật tư' },
        ]}
        title={`Bảng kê vật tư · LSX ${lsx.code}`}
        description={`${lsx.customer_name}${lsx.order_codes.length > 0 ? ` · ĐH ${lsx.order_codes.join(', ')}` : ''}`}
        meta={
          <span className="text-muted-foreground text-[12px]">
            {lsx.ship_date ? (
              <>
                xuất <span className="t-data">{dmy(lsx.ship_date)}</span> ·{' '}
              </>
            ) : null}
            {dueLabel} · {sourceLabel} · hôm nay{' '}
            <span className="t-data">{dmy(today)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/planning/lsx/${lsx.id}`}>
                <ShoppingCart />
                Đơn mua của lệnh
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/dept/supply/lsx-report?lsx=${lsx.id}`} download>
                <Download />
                Tải Excel lệnh này
              </a>
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={manualDisabled}
                  onClick={() => setPasteOpen(true)}
                >
                  <ClipboardPaste />
                  Dán từ Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={manualDisabled}
                  onClick={() => setPickOpen(true)}
                >
                  <Plus />
                  Thêm mã
                </Button>
              </>
            )}
            {canEdit && prefillHref && (
              <Button size="sm" asChild>
                <Link href={prefillHref}>
                  <ShoppingCart />
                  Soạn đơn cho {Math.min(shortRows.length, MAX_PREFILL)} dòng thiếu
                </Link>
              </Button>
            )}
          </>
        }
      />

      {data.manual_error && (
        <p className="rounded-md border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-2 text-[12.5px]">
          Chưa đọc được bảng kê nhập tay: migration{' '}
          <span className="t-data">0184_supply_lsx_needs</span> chưa áp lên cơ sở dữ liệu.
          Phần định mức vẫn hiện bình thường.
        </p>
      )}

      <StatTiles>
        <StatTile
          label="Mã cần"
          value={summary.needed}
          hint={
            summary.extra > 0
              ? `+${summary.extra} mã ngoài định mức`
              : 'theo nguồn cần của lệnh'
          }
          icon={ClipboardList}
          active={status === null}
          onClick={() => setStatus(null)}
        />
        <StatTile
          label="Chưa đặt"
          value={summary.none}
          hint="mã · chưa có đơn nào"
          tone="stop"
          icon={AlertTriangle}
          active={status === 'none'}
          onClick={() => setStatus(status === 'none' ? null : 'none')}
        />
        <StatTile
          label="Đặt chưa đủ / chưa duyệt"
          value={summary.short + summary.pending}
          hint="mã · còn phải đặt thêm hoặc đơn còn nháp"
          tone="warn"
          icon={PackageSearch}
          active={status === 'short' || status === 'pending'}
          onClick={() => setStatus(status === 'short' ? null : 'short')}
        />
        <StatTile
          label="Đủ / đang về"
          value={summary.done + summary.inflight}
          hint="mã · tồn, đã về hoặc đã đặt đủ"
          tone="done"
          active={status === 'done' || status === 'inflight'}
          onClick={() => setStatus(status === 'done' ? null : 'done')}
        />
      </StatTiles>

      <Toolbar
        left={
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="Tất cả"
              count={rows.length}
              active={status === null}
              onClick={() => setStatus(null)}
            />
            {BANG_KE_STATUSES.map((k) => (
              <FilterChip
                key={k}
                label={BANG_KE_STATUS[k].label}
                count={summary[k]}
                active={status === k}
                onClick={() => setStatus(status === k ? null : k)}
              />
            ))}
          </div>
        }
        right={
          <>
            {groups.length > 0 && (
              <ToolbarSelect
                value={group}
                onChange={setGroup}
                options={[
                  { value: '', label: 'Mọi nhóm vật tư' },
                  ...groups.map((g) => ({ value: g, label: g })),
                ]}
              />
            )}
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã, tên vật tư…"
              icon={<Search className="size-4" />}
            />
          </>
        }
      />

      <section className="bg-card overflow-hidden rounded-lg border">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={
              rows.length === 0
                ? 'Lệnh chưa có nhu cầu vật tư và chưa có đơn mua nào'
                : 'Không có mã nào khớp bộ lọc'
            }
            description={
              rows.length === 0
                ? 'Bấm "Thêm mã" hoặc "Dán từ Excel" để nhập bảng kê tay, hoặc chờ định mức từ Kỹ thuật.'
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Mã VT</TableHead>
                  <TableHead className="min-w-[220px]">Tên vật tư</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead className="text-right">Cần</TableHead>
                  <TableHead className="text-right">Đã xuất</TableHead>
                  <TableHead className="text-right">Tồn KD</TableHead>
                  <TableHead className="text-right">Đã đặt</TableHead>
                  <TableHead className="text-right">Nháp / chờ ký</TableHead>
                  <TableHead className="text-right">Đã về</TableHead>
                  <TableHead className="text-right">Còn phải đặt</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="min-w-[200px]">Đơn · NCC</TableHead>
                  {canEdit && <TableHead className="min-w-[150px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.material_id}>
                    <TableCell>
                      <DocChip>{r.material_code || '—'}</DocChip>
                      <div className="text-muted-foreground mt-0.5 text-[11px]">
                        {SOURCE_LABEL[r.source]}
                        {r.deviates && r.auto_needed != null && (
                          <span className="text-[var(--warn)]">
                            {' '}
                            · lệch định mức {fmt(r.auto_needed)}
                          </span>
                        )}
                        {r.incomplete && (
                          <span className="text-[var(--warn)]"> · thiếu hệ số</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="line-clamp-2">{r.material_name}</div>
                      {r.group_name && (
                        <div className="text-muted-foreground text-[11px]">
                          {r.group_name}
                        </div>
                      )}
                      {canEdit && r.source === 'manual' && !data.manual_error ? (
                        <NoteCell
                          value={r.note ?? ''}
                          disabled={busy}
                          onSave={(v) =>
                            saveRows(
                              [{ material_id: r.material_id, qty_needed: r.qty_needed, note: v || null }],
                              v ? `${r.material_code}: đã ghi chú` : `${r.material_code}: đã xoá ghi chú`,
                            )
                          }
                        />
                      ) : (
                        r.note && (
                          <div className="text-muted-foreground text-[11px] italic">{r.note}</div>
                        )
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.unit}</TableCell>
                    <TableCell className="t-data text-right">
                      {canEdit && r.source === 'manual' && !data.manual_error ? (
                        <QtyCell
                          value={r.qty_needed}
                          disabled={busy}
                          onSave={(v) =>
                            saveRows(
                              [
                                {
                                  material_id: r.material_id,
                                  qty_needed: v,
                                  note: r.note,
                                },
                              ],
                              `${r.material_code}: cần ${fmt(v)} ${r.unit}`,
                            )
                          }
                        />
                      ) : (
                        fmt(r.qty_needed)
                      )}
                    </TableCell>
                    <TableCell className="t-data text-muted-foreground text-right">
                      {fmt(r.qty_issued)}
                    </TableCell>
                    <TableCell className="t-data text-right">
                      {fmt(r.available)}
                      {r.reserved_others > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground ml-1 text-[11px]">
                              ({fmt(r.on_hand)})
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Tồn {fmt(r.on_hand)}, lệnh khác giữ chỗ{' '}
                            {fmt(r.reserved_others)}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="t-data text-right">{fmt(r.ordered)}</TableCell>
                    <TableCell
                      className={cn(
                        't-data text-right',
                        r.draft + r.pending > 0
                          ? 'text-[var(--warn)]'
                          : 'text-muted-foreground',
                      )}
                    >
                      {fmt(r.draft + r.pending)}
                    </TableCell>
                    <TableCell className="t-data text-right">{fmt(r.received)}</TableCell>
                    <TableCell
                      className={cn(
                        't-data text-right font-semibold',
                        r.suggest > 0 ? 'text-[var(--stop)]' : 'text-muted-foreground',
                      )}
                    >
                      {fmt(r.suggest)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_BADGE[r.status]}>
                        {BANG_KE_STATUS[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.pos.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {r.pos.map((p) => (
                            <li
                              key={p.id}
                              className="flex flex-wrap items-center gap-1.5 text-[12px]"
                            >
                              <Link
                                href={`/planning/pos/${p.id}`}
                                className="hover:opacity-80"
                              >
                                <DocChip>{p.code}</DocChip>
                              </Link>
                              <span className="max-w-[160px] truncate">
                                {p.supplier_name}
                              </span>
                              <span className="text-muted-foreground">
                                {isPoStatus(p.status)
                                  ? PO_STATUS_LABEL[p.status]
                                  : p.status}
                                {' · '}
                                <span className="t-data">{fmt(p.qty_ordered)}</span>
                                {p.expected_at && (
                                  <>
                                    {' · hẹn '}
                                    <span
                                      className={cn(
                                        't-data',
                                        p.late && 'text-[var(--stop)]',
                                      )}
                                    >
                                      {dmy(p.expected_at)}
                                    </span>
                                  </>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                          {r.suggest > 0 && r.material_code && (
                            <Button
                              variant="link"
                              size="sm"
                              asChild
                              className="h-auto p-0"
                            >
                              <Link
                                href={`/planning/pos/new?lsx=${lsx.id}&material=${encodeURIComponent(r.material_code)}&qty=${r.suggest}`}
                              >
                                <ShoppingCart />
                                Soạn đơn
                              </Link>
                            </Button>
                          )}
                          {!data.manual_error &&
                            (r.source === 'manual' ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-muted-foreground h-auto p-0"
                                disabled={busy}
                                onClick={() => removeManual(r)}
                                title={
                                  r.auto_needed != null
                                    ? 'Bỏ số tay, quay về định mức'
                                    : 'Bỏ dòng nhập tay'
                                }
                              >
                                <Undo2 />
                                {r.auto_needed != null ? 'Về định mức' : 'Bỏ dòng'}
                              </Button>
                            ) : (
                              <Button
                                variant="link"
                                size="sm"
                                className="text-muted-foreground h-auto p-0"
                                disabled={busy}
                                onClick={() => override(r)}
                                title="Chuyển thành dòng nhập tay để sửa số Cần"
                              >
                                <Pencil />
                                {r.source === 'none' ? 'Nhập số cần' : 'Ghi đè'}
                              </Button>
                            ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      <p className="text-muted-foreground text-[12px]">
        Còn phải đặt = cần − đã xuất − tồn khả dụng − đã đặt (đơn đã duyệt, chưa về). Đơn
        nháp và chờ ký không trừ vào số này, chỉ hiện ở cột riêng để biết đã có ai soạn.
        Dòng nhập tay ghi đè từng mã; nút Về định mức là bỏ số tay của mã đó.
      </p>

      {canEdit && (
        <>
          <MaterialPickDialog
            open={pickOpen}
            onClose={() => setPickOpen(false)}
            template="accessory"
            usedIds={usedIds}
            onAdd={onPicked}
            needs={suggestById}
          />
          <PasteLinesDialog
            open={pasteOpen}
            template="accessory"
            allowFree={false}
            confirmLabel={(n) => `Đưa ${n} dòng vào bảng kê`}
            onClose={() => setPasteOpen(false)}
            onConfirm={onPasted}
          />
        </>
      )}
    </div>
  )
}

/** Ô số Cần của dòng tay: sửa tại chỗ, lưu khi rời ô hoặc Enter, chỉ khi đổi. */
function QtyCell({
  value,
  disabled,
  onSave,
}: {
  value: number
  disabled: boolean
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState<number | ''>(value)
  // Ref giữ giá trị MỚI NHẤT: blur có thể tới trước khi React kịp render lại
  // state sau lần gõ cuối — đọc state lúc đó là đọc số cũ và bỏ qua lần lưu.
  const latest = useRef<number | ''>(value)
  const change = (v: number | '') => {
    latest.current = v
    setDraft(v)
  }
  const commit = () => {
    const v = latest.current
    if (v === '' || v === value) {
      change(value)
      return
    }
    onSave(v)
  }
  return (
    <NumberField
      value={draft}
      onValueChange={change}
      disabled={disabled}
      className="t-data h-7 w-24 text-right"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') change(value)
      }}
      aria-label="Số cần"
    />
  )
}

/** Ghi chú của dòng tay ("phải lấy tròn bó"): sửa tại chỗ, lưu khi rời ô hoặc Enter. */
function NoteCell({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled: boolean
  onSave: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const latest = useRef(value)
  const change = (v: string) => {
    latest.current = v
    setDraft(v)
  }
  const commit = () => {
    const v = latest.current.trim()
    if (v === value) return
    onSave(v)
  }
  return (
    <Input
      value={draft}
      onChange={(e) => change(e.target.value)}
      disabled={disabled}
      placeholder="ghi chú…"
      className="mt-1 h-7 text-[11px]"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') change(value)
      }}
      aria-label="Ghi chú dòng"
    />
  )
}

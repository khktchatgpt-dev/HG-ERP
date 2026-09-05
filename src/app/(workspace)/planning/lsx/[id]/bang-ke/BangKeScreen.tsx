'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ClipboardPaste,
  Download,
  FlaskConical,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
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
  unconfirmed: 'amber',
  blank: 'gray',
  none: 'red',
  short: 'amber',
  pending: 'amber',
  inflight: 'blue',
  done: 'green',
  extra: 'gray',
}

/** Vạch trái mã hoá mức khẩn — chỉ ba màu vòng đời + xám. */
const STATUS_STRIPE: Record<BangKeStatus, string> = {
  unconfirmed: 'var(--warn)',
  blank: 'var(--muted-foreground)',
  none: 'var(--stop)',
  short: 'var(--warn)',
  pending: 'var(--warn)',
  inflight: 'var(--primary)',
  done: 'var(--done)',
  extra: 'var(--muted-foreground)',
}

const SOURCE_LABEL: Record<BangKeRow['source'], string> = {
  manual: 'nhập tay',
  components: 'định hình',
  bom: 'định mức đã xác nhận',
  bom_draft: 'BOM chưa xác nhận',
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
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — màn nhân viên Cung ứng mở đầu ngày.
 *
 * Ba nguyên tắc trình bày (thiết kế lại 05/09/2026):
 *  1. CHỈ ĐỊNH MỨC ĐÃ XÁC NHẬN mới thành số "Cần" — bản nháp hiện riêng, có
 *     công tắc, và luôn mang nhãn cảnh báo. Mua theo bản nháp là mua sai.
 *  2. GOM THEO NHÓM VẬT TƯ như sổ Excel của phòng: người mua gọi NCC theo
 *     nhóm (thép một cuộc, ngũ kim một cuộc), không gọi theo thứ tự bảng chữ.
 *  3. Mỗi dòng trả lời đúng một câu "còn phải đặt bao nhiêu" — cột đó nổi bật
 *     nhất, các số phụ (tồn, đã đặt, đã về) gom lại và giải thích khi rê chuột.
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
  const [showProducts, setShowProducts] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  /** Mã đang mở phần "dùng cho sản phẩm nào". */
  const [openRow, setOpenRow] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return rows.filter((r) => {
      if (status !== null && r.status !== status) return false
      if (group && r.group_name !== group) return false
      if (nq && !norm(`${r.material_code} ${r.material_name}`).includes(nq)) return false
      return true
    })
  }, [rows, status, group, q])

  /** Gom theo nhóm vật tư, giữ thứ tự ưu tiên trong từng nhóm. */
  const sections = useMemo(() => {
    const map = new Map<string, BangKeRow[]>()
    for (const r of filtered) {
      const k = r.group_name ?? 'Chưa phân nhóm'
      const list = map.get(k)
      if (list) list.push(r)
      else map.set(k, [r])
    }
    return (
      [...map.entries()]
        .map(([name, list]) => ({
          name,
          rows: list,
          short: list.filter((r) => r.suggest > 0).length,
        }))
        // Nhóm còn phải đặt nhiều nhất lên trước — đó là cuộc gọi tiếp theo.
        .sort((a, b) => b.short - a.short || a.name.localeCompare(b.name, 'vi'))
    )
  }, [filtered])

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
  const unconfirmedProducts = useMemo(
    () => data.products.filter((p) => !p.bom_confirmed && p.coded_parts > 0),
    [data.products],
  )

  const manualDisabled = !canEdit || data.manual_error !== null
  const draftHref = `/planning/lsx/${lsx.id}/bang-ke${data.include_draft ? '' : '?nhap=1'}`

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

  /** Dòng tự động → dòng tay với đúng số đang thấy, để sửa ngay sau đó. */
  function override(r: BangKeRow) {
    const start =
      r.source === 'none'
        ? r.pos.reduce((s, p) => s + p.qty_ordered, 0)
        : r.qty_needed || r.draft_needed
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
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {lsx.ship_date && (
              <span>
                Ngày xuất <span className="t-data">{dmy(lsx.ship_date)}</span>
              </span>
            )}
            <span>
              Hạn vật tư{' '}
              {lsx.materials_due_at ? (
                <span className="t-data">{dmy(lsx.materials_due_at)}</span>
              ) : (
                <span className="text-[var(--warn)]">chưa đặt</span>
              )}
            </span>
            <span>
              <span className="t-data">{data.products.length}</span> sản phẩm ·{' '}
              <span className="t-data">{rows.length}</span> mã vật tư
            </span>
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
              <a
                href={`/api/dept/supply/lsx-report?lsx=${lsx.id}${data.include_draft ? "&nhap=1" : ""}`}
                download
              >
                <Download />
                Tải Excel
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
                  Soạn đơn cho {Math.min(shortRows.length, MAX_PREFILL)} mã thiếu
                </Link>
              </Button>
            )}
          </>
        }
      />

      {data.manual_error && (
        <Notice tone="warn">
          Chưa đọc được bảng kê nhập tay: migration{' '}
          <span className="t-data">0184_supply_lsx_needs</span> chưa áp lên cơ sở dữ liệu.
          Phần định mức vẫn hiện bình thường.
        </Notice>
      )}

      {/* ── Nguồn định mức: nói thẳng số nào dùng được để mua ────────── */}
      <section className="bg-card rounded-lg border">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-md"
              style={{
                background:
                  unconfirmedProducts.length > 0
                    ? 'color-mix(in srgb, var(--warn) 14%, transparent)'
                    : 'color-mix(in srgb, var(--done) 14%, transparent)',
                color: unconfirmedProducts.length > 0 ? 'var(--warn)' : 'var(--done)',
              }}
            >
              {unconfirmedProducts.length > 0 ? (
                <AlertTriangle className="size-5" strokeWidth={1.8} />
              ) : (
                <ShieldCheck className="size-5" strokeWidth={1.8} />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="t-title">Nguồn số &ldquo;Cần&rdquo;</h2>
              <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                {unconfirmedProducts.length > 0 ? (
                  <>
                    <span className="t-data">{unconfirmedProducts.length}</span>/
                    <span className="t-data">{data.products.length}</span> sản phẩm có
                    định mức nhưng <b>Kỹ thuật chưa xác nhận BOM</b>. Số của những sản
                    phẩm này{' '}
                    {data.include_draft ? (
                      <>
                        đang được cộng vào vì bạn bật xem cả bản nháp — đừng gửi đơn dựa
                        trên đó.
                      </>
                    ) : (
                      <>chưa tính vào cột Cần, để không mua theo bản nháp.</>
                    )}
                  </>
                ) : data.need_source === 'none' ? (
                  <>
                    Lệnh chưa có định mức lẫn bảng định hình. Nhập tay bằng &ldquo;Thêm
                    mã&rdquo; hoặc &ldquo;Dán từ Excel&rdquo;.
                  </>
                ) : (
                  <>
                    Toàn bộ định mức của lệnh đã được Kỹ thuật xác nhận — số Cần dùng để
                    mua được.
                  </>
                )}
                {data.manual_count > 0 && (
                  <>
                    {' '}
                    Có <span className="t-data">{data.manual_count}</span> mã do Cung ứng
                    nhập tay, ghi đè định mức.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {unconfirmedProducts.length > 0 && (
              <>
                <Button
                  variant={data.include_draft ? 'secondary' : 'outline'}
                  size="sm"
                  asChild
                >
                  <Link href={draftHref} scroll={false}>
                    <FlaskConical />
                    {data.include_draft
                      ? 'Đang tính cả bản nháp'
                      : 'Tính cả BOM chưa xác nhận'}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProducts((v) => !v)}
                  aria-expanded={showProducts}
                >
                  {showProducts ? 'Ẩn danh sách' : 'Xem sản phẩm chưa chốt'}
                </Button>
              </>
            )}
          </div>
        </div>
        {showProducts && unconfirmedProducts.length > 0 && (
          <ul className="divide-border grid gap-px border-t sm:grid-cols-2 lg:grid-cols-3">
            {unconfirmedProducts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
                  <DocChip>{p.code}</DocChip>
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="t-data text-muted-foreground shrink-0 text-[11px]">
                  {fmt(p.qty)} SP · {p.coded_parts} dòng ĐM
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.blocked.length > 0 && (
        <section className="bg-card rounded-lg border">
          <div className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md"
                style={{
                  background: 'color-mix(in srgb, var(--stop) 14%, transparent)',
                  color: 'var(--stop)',
                }}
              >
                <AlertTriangle className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h2 className="t-title">
                  <span className="t-data">{data.blocked.length}</span> dòng định mức chưa
                  quy đổi được sang đơn vị mua
                </h2>
                <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                  Định mức đếm theo chi tiết, vật tư lại bán theo cây hoặc kg. Số của những
                  dòng này <b>không được cộng vào cột Cần</b> — lấy số thanh làm số cây là
                  mua thừa nhiều lần.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBlocked((v) => !v)}
              aria-expanded={showBlocked}
            >
              {showBlocked ? 'Ẩn danh sách' : 'Xem chi tiết'}
            </Button>
          </div>
          {showBlocked && (
            <ul className="divide-border divide-y border-t">
              {data.blocked.map((b, i) => (
                <li
                  key={`${b.material_code}-${b.product_code}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[12.5px]"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <DocChip>{b.material_code}</DocChip>
                    <span className="truncate">{b.material_name}</span>
                    <span className="text-muted-foreground">
                      SP {b.product_code}
                      {b.part_name ? ` · ${b.part_name}` : ''}
                    </span>
                  </span>
                  <span className="text-[var(--stop)]">{b.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Tóm tắt: 4 con số người mua đọc trước ─────────────────────── */}
      <StatTiles>
        <StatTile
          label="Cần mua thêm"
          value={shortRows.length}
          hint={
            shortRows.length > 0
              ? `${fmt(shortRows.reduce((s, r) => s + r.suggest, 0))} đơn vị tổng cộng`
              : 'không còn mã nào thiếu'
          }
          tone="stop"
          icon={PackageSearch}
          active={status === 'none' || status === 'short'}
          onClick={() => setStatus(status === 'none' ? null : 'none')}
        />
        <StatTile
          label="Đã đặt · đang về"
          value={summary.inflight + summary.pending}
          hint="đơn đã gửi hoặc còn nháp"
          tone="primary"
          icon={ShoppingCart}
          active={status === 'inflight'}
          onClick={() => setStatus(status === 'inflight' ? null : 'inflight')}
        />
        <StatTile
          label="Đủ"
          value={summary.done}
          hint="tồn kho và hàng về đã phủ"
          tone="done"
          icon={CheckCircle2}
          active={status === 'done'}
          onClick={() => setStatus(status === 'done' ? null : 'done')}
        />
        <StatTile
          label="Chưa dùng được"
          value={summary.unconfirmed + summary.blank}
          hint="BOM chưa xác nhận hoặc chưa điền số"
          tone="warn"
          icon={AlertTriangle}
          active={status === 'unconfirmed'}
          onClick={() => setStatus(status === 'unconfirmed' ? null : 'unconfirmed')}
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
            {BANG_KE_STATUSES.filter((k) => summary[k] > 0).map((k) => (
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

      {filtered.length === 0 ? (
        <section className="bg-card rounded-lg border">
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={
              rows.length === 0
                ? 'Lệnh chưa có nhu cầu vật tư và chưa có đơn mua nào'
                : 'Không có mã nào khớp bộ lọc'
            }
            description={
              rows.length === 0
                ? 'Bấm "Thêm mã" hoặc "Dán từ Excel" để nhập bảng kê tay, hoặc chờ Kỹ thuật xác nhận định mức.'
                : undefined
            }
          />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((sec) => (
            <section key={sec.name} className="bg-card overflow-hidden rounded-lg border">
              <header className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
                <h2 className="t-title flex items-center gap-2">
                  <Package className="text-muted-foreground size-4" strokeWidth={1.8} />
                  {sec.name}
                  <span className="t-data text-muted-foreground font-normal">
                    {sec.rows.length} mã
                  </span>
                </h2>
                {sec.short > 0 && (
                  <span className="text-[12px] font-medium text-[var(--stop)]">
                    {sec.short} mã còn phải đặt
                  </span>
                )}
              </header>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1" />
                      <TableHead className="min-w-[260px]">Vật tư</TableHead>
                      <TableHead className="text-right">Cần</TableHead>
                      <TableHead className="text-right">Đã có</TableHead>
                      <TableHead className="text-right">Đã đặt</TableHead>
                      <TableHead className="text-right">Còn phải đặt</TableHead>
                      <TableHead className="min-w-[150px]">Tình trạng</TableHead>
                      <TableHead className="min-w-[180px]">Đơn mua</TableHead>
                      {canEdit && <TableHead className="w-[130px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sec.rows.map((r) => (
                      <Row
                        key={r.material_id}
                        r={r}
                        lsxId={lsx.id}
                        open={openRow === r.material_id}
                        onToggle={() =>
                          setOpenRow(openRow === r.material_id ? null : r.material_id)
                        }
                        canEdit={canEdit}
                        editable={!data.manual_error}
                        busy={busy}
                        onSaveQty={(v) =>
                          saveRows(
                            [{ material_id: r.material_id, qty_needed: v, note: r.note }],
                            `${r.material_code}: cần ${fmt(v)} ${r.unit}`,
                          )
                        }
                        onSaveNote={(v) =>
                          saveRows(
                            [
                              {
                                material_id: r.material_id,
                                qty_needed: r.qty_needed,
                                note: v || null,
                              },
                            ],
                            v
                              ? `${r.material_code}: đã ghi chú`
                              : `${r.material_code}: đã xoá ghi chú`,
                          )
                        }
                        onOverride={() => override(r)}
                        onRemove={() => removeManual(r)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-[12px]">
        <b>Còn phải đặt</b> = Cần − đã xuất cho lệnh − tồn khả dụng − đã đặt (đơn đã
        duyệt, chưa về). Đơn nháp và chờ ký không trừ vào số này. Chỉ định mức đã được Kỹ
        thuật xác nhận mới thành số Cần; dòng nhập tay ghi đè định mức của đúng mã đó.
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

/** Một dòng vật tư — tách riêng cho gọn và để ô sửa giữ được state của nó. */
function Row({
  r,
  lsxId,
  open,
  onToggle,
  canEdit,
  editable,
  busy,
  onSaveQty,
  onSaveNote,
  onOverride,
  onRemove,
}: {
  r: BangKeRow
  lsxId: string
  open: boolean
  onToggle: () => void
  canEdit: boolean
  editable: boolean
  busy: boolean
  onSaveQty: (v: number) => void
  onSaveNote: (v: string) => void
  onOverride: () => void
  onRemove: () => void
}) {
  const isManual = r.source === 'manual'
  const onHandTotal = r.available + r.received
  return (
    <TableRow>
      <TableCell className="p-0">
        <span
          className="block h-full min-h-[44px] w-1"
          style={{ background: STATUS_STRIPE[r.status] }}
          aria-hidden
        />
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <DocChip>{r.material_code || '—'}</DocChip>
          <span className="line-clamp-1 font-medium">{r.material_name}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
          <span>{r.unit}</span>
          <span>·</span>
          <span
            className={
              r.source === 'bom_draft' || r.deviates ? 'text-[var(--warn)]' : undefined
            }
          >
            {SOURCE_LABEL[r.source]}
          </span>
          {r.deviates && r.auto_needed != null && (
            <span className="text-[var(--warn)]">lệch định mức {fmt(r.auto_needed)}</span>
          )}
          {r.incomplete && <span className="text-[var(--warn)]">thiếu hệ số</span>}
          {r.from_products.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={onToggle}
              aria-expanded={open}
              className="h-auto p-0 text-[11px] underline decoration-dotted"
            >
              {open ? 'Ẩn' : `dùng cho ${r.from_products.length} SP`}
            </Button>
          )}
        </div>
        {canEdit && isManual && editable ? (
          <NoteCell value={r.note ?? ''} disabled={busy} onSave={onSaveNote} />
        ) : (
          r.note && (
            <div className="text-muted-foreground mt-0.5 text-[11px] italic">
              {r.note}
            </div>
          )
        )}
        {open && r.from_products.length > 0 && (
          <ul className="bg-muted/40 mt-2 flex flex-col gap-1 rounded-md p-2">
            {r.from_products.map((p) => (
              <li
                key={p.code}
                className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]"
              >
                <DocChip>{p.code}</DocChip>
                <span className="text-muted-foreground max-w-[220px] truncate">
                  {p.name}
                </span>
                <span className="t-data">
                  {fmt(p.per)} × {fmt(p.qty)} SP = {fmt(p.per * p.qty)} {r.unit}
                </span>
                {p.explain && <span className="text-muted-foreground">({p.explain})</span>}
                {!p.confirmed && (
                  <span className="text-[var(--warn)]">BOM chưa xác nhận</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </TableCell>

      <TableCell className="text-right">
        {canEdit && isManual && editable ? (
          <QtyCell value={r.qty_needed} disabled={busy} onSave={onSaveQty} />
        ) : (
          <div className="t-data">{fmt(r.qty_needed)}</div>
        )}
        {r.draft_needed > 0 && (
          <div className="mt-0.5 text-[11px] text-[var(--warn)]">
            {r.qty_needed > 0 ? '+' : ''}
            {fmt(r.draft_needed)} chờ xác nhận
          </div>
        )}
        {r.qty_issued > 0 && (
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            đã xuất {fmt(r.qty_issued)}
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="t-data cursor-help">{fmt(onHandTotal)}</span>
          </TooltipTrigger>
          <TooltipContent>
            Tồn khả dụng {fmt(r.available)}
            {r.reserved_others > 0 &&
              ` (tồn ${fmt(r.on_hand)}, lệnh khác giữ ${fmt(r.reserved_others)})`}
            {' · '}đã về cho lệnh {fmt(r.received)}
          </TooltipContent>
        </Tooltip>
      </TableCell>

      <TableCell className="text-right">
        <div className="t-data">{fmt(r.ordered)}</div>
        {r.draft + r.pending > 0 && (
          <div className="mt-0.5 text-[11px] text-[var(--warn)]">
            {fmt(r.draft + r.pending)} chưa duyệt
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        <span
          className={cn(
            't-data text-[15px] font-semibold',
            r.suggest > 0 ? 'text-[var(--stop)]' : 'text-muted-foreground',
          )}
        >
          {fmt(r.suggest)}
        </span>
      </TableCell>

      <TableCell>
        <Badge tone={STATUS_BADGE[r.status]}>{BANG_KE_STATUS[r.status].label}</Badge>
      </TableCell>

      <TableCell>
        {r.pos.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {r.pos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <Link href={`/planning/pos/${p.id}`} className="hover:opacity-80">
                  <DocChip>{p.code}</DocChip>
                </Link>
                <span className="max-w-[140px] truncate">{p.supplier_name}</span>
                <span className="text-muted-foreground">
                  {isPoStatus(p.status) ? PO_STATUS_LABEL[p.status] : p.status}
                  {p.expected_at && (
                    <>
                      {' · '}
                      <span className={cn('t-data', p.late && 'text-[var(--stop)]')}>
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
          <div className="flex flex-col items-end gap-1">
            {r.suggest > 0 && r.material_code && (
              <Button variant="link" size="sm" asChild className="h-auto p-0">
                <Link
                  href={`/planning/pos/new?lsx=${lsxId}&material=${encodeURIComponent(r.material_code)}&qty=${r.suggest}`}
                >
                  <ShoppingCart />
                  Soạn đơn
                </Link>
              </Button>
            )}
            {editable &&
              (isManual ? (
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  disabled={busy}
                  onClick={onRemove}
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
                  onClick={onOverride}
                  title="Chuyển thành dòng nhập tay để sửa số Cần"
                >
                  <Pencil />
                  {r.source === 'none' || r.status === 'unconfirmed'
                    ? 'Nhập số cần'
                    : 'Ghi đè'}
                </Button>
              ))}
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}

function Notice({ tone, children }: { tone: 'warn'; children: React.ReactNode }) {
  return (
    <p
      className="rounded-md border px-3 py-2 text-[12.5px]"
      style={{
        borderColor: `var(--${tone})`,
        background: `color-mix(in srgb, var(--${tone}) 10%, transparent)`,
      }}
    >
      {children}
    </p>
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
      className="t-data ml-auto h-7 w-24 text-right"
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
      className="mt-1 h-7 max-w-[260px] text-[11px]"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') change(value)
      }}
      aria-label="Ghi chú dòng"
    />
  )
}

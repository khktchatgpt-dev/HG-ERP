'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Affected,
  Btn,
  Cell,
  Chip,
  Code,
  Consequence,
  DateInput,
  DocChain,
  Empty,
  GroupRow,
  InspectPanel,
  InspectSection,
  NextAction,
  NoticeBar,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Sheet,
  SheetActions,
  StatusBar,
  StatusTrack,
  THead,
  Table,
  Tag,
  TextArea,
  Tick,
  WhyBox,
  poHolder,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { assessPoFit } from '@/lib/po-fit'
import {
  PO_NEXT_HINT,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  type PoStatus,
} from '@/lib/po-status'
import {
  PO_BUCKETS,
  countPos,
  isFilterActive,
  poMatches,
  type PoBucket,
  type PoFilterState,
} from '@/app/(workspace)/planning/pos/po-filter'
import { groupPosByLsx, type LsxRef } from '@/app/(workspace)/planning/pos/pos-groups'
import type { Po } from '@/app/(workspace)/planning/pos/po-types'
import { useLocalPref } from '../../_shell/use-local-pref'
import { DENSE_KEY } from '../../_shell/SupplyShell'
import { actionsFor, bulkActionFor, type Action } from './actions'
import {
  GROUP_LABEL,
  NAMED_VIEWS,
  SORT_LABEL,
  encodeView,
  groupSimple,
  matchNamedView,
  sortPos,
  type GroupBy,
  type SortBy,
  type ViewState,
} from './views'

/**
 * Phần nhìn của Khuôn C — Phiếu mua. Tầng server ở `page.tsx`, phân tích ở
 * `docs/mua-hang-phieu-mua.md`.
 *
 * NĂM ĐIỀU KHÁC MÀN CŨ, mỗi điều chép của một hệ:
 *  · Khung nhìn có tên, mã trên URL           — SAP variant / Dynamics saved view
 *  · Gom theo là điều khiển, không phải hai màn — Odoo group-by
 *  · Hai trục trạng thái tách cột             — Dynamics / Odoo
 *  · Khay kiểm tra bày đủ hành động, khoá kèm lý do — Dynamics Action Pane
 *  · Chọn cột + mật độ nhớ theo máy           — SAP personalization
 */

const TONE: Record<string, 'stop' | 'warn' | 'done' | 'neutral'> = {
  gray: 'neutral',
  amber: 'warn',
  blue: 'neutral',
  green: 'done',
  red: 'stop',
}

const dmy = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(b) - t(a)) / 86_400_000)
}

/* ── CỘT ───────────────────────────────────────────────────────────────
   Chọn cột — chép SAP personalization. Bộ mặc định = bộ màn cũ, trừ "Ngày
   tạo" (màn cũ cũng chỉ hiện ở bảng phẳng). "Đơn" không tắt được: cột định
   danh mà tắt thì bảng còn toàn số không biết của ai. */
type ColKey =
  | 'ncc'
  | 'chuoi'
  | 'trang_thai'
  | 've_kho'
  | 'hen'
  | 'kip'
  | 'phu_trach'
  | 'gia_tri'
  | 'tao'

const COLS: { key: ColKey; label: string; num?: boolean }[] = [
  { key: 'ncc', label: 'Nhà cung cấp' },
  { key: 'chuoi', label: 'Chuỗi liên kết' },
  { key: 'trang_thai', label: 'Trạng thái đơn' },
  { key: 've_kho', label: 'Về kho' },
  { key: 'hen', label: 'Hẹn giao' },
  { key: 'kip', label: 'Kịp SX?' },
  { key: 'phu_trach', label: 'Phụ trách' },
  { key: 'gia_tri', label: 'Giá trị', num: true },
  { key: 'tao', label: 'Ngày tạo' },
]
const DEFAULT_COLS: ColKey[] = ['ncc', 'chuoi', 'trang_thai', 've_kho', 'hen', 'kip', 'phu_trach', 'gia_tri'] // prettier-ignore

export function DonScreen({
  today,
  pos,
  suppliers,
  lsxs,
  meId,
  canEdit,
  canApprove,
  canManageAny,
  truncatedAt,
  initial,
  openId,
}: {
  today: string
  pos: Po[]
  suppliers: { id: string; name: string }[]
  lsxs: LsxRef[]
  meId: string
  canEdit: boolean
  canApprove: boolean
  canManageAny: boolean
  truncatedAt: number | null
  initial: ViewState
  openId: string | null
}) {
  const router = useRouter()
  const toast = useToast()

  const [view, setViewState] = useState<ViewState>(initial)
  const [pick, setPick] = useState<string | null>(openId)
  const [ticked, setTicked] = useState<string[]>([])
  const [sheet, setSheet] = useState<null | { action: Action; ids: string[] }>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [colSheet, setColSheet] = useState(false)
  const [dueDraft, setDueDraft] = useState<string | null>(null)

  const [colsRaw, setColsRaw] = useLocalPref('hg.mua-hang.don.cols', '')
  const [denseRaw, setDenseRaw] = useLocalPref(DENSE_KEY, '0')
  const cols = useMemo<ColKey[]>(() => {
    const keep = new Set(COLS.map((c) => c.key))
    const list = colsRaw ? colsRaw.split(',').filter((k): k is ColKey => keep.has(k as ColKey)) : DEFAULT_COLS // prettier-ignore
    return COLS.map((c) => c.key).filter((k) => list.includes(k))
  }, [colsRaw])
  const dense = denseRaw === '1'

  /**
   * ĐỔI KHUNG NHÌN = đổi state + đổi URL, không điều hướng.
   *
   * `history.replaceState` được App Router theo dõi, nên URL khớp mà không
   * tải lại server — bộ lọc chạy ở client trên tập đã nạp, y như màn cũ.
   * F5 hay dán link thì `page.tsx` giải mã lại từ URL.
   */
  function setView(next: ViewState) {
    setViewState(next)
    setPick(null)
    setTicked([])
    const qs = encodeView(next)
    window.history.replaceState(null, '', qs ? `?${qs}` : location.pathname)
  }
  const patchFilter = (f: Partial<PoFilterState>) =>
    setView({ ...view, filter: { ...view.filter, ...f } })

  const ctx = { meId, today }
  const counts = useMemo(() => countPos(pos, meId, today), [pos, meId, today])
  const shown = useMemo(
    () =>
      sortPos(
        pos.filter((p) => poMatches(p, view.filter, ctx)),
        view.sortBy,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, view, meId, today],
  )
  const lsxDue = useMemo(
    () => new Map(lsxs.map((l) => [l.id, l.materials_due_at])),
    [lsxs],
  )
  const lsxById = useMemo(() => new Map(lsxs.map((l) => [l.id, l])), [lsxs])
  const emptyLsx = useMemo(() => groupPosByLsx(pos, lsxs, today).emptyLsxs.length, [pos, lsxs, today]) // prettier-ignore
  const namedId = matchNamedView(view)

  /* Nhóm để vẽ: mỗi nhóm = tiêu đề + meta + dòng. Gom theo lệnh dùng hàm của
     màn cũ (biết tiền theo tệ, đơn mượn); bốn trục kia dùng `groupSimple`. */
  const groups = useMemo(() => {
    if (view.groupBy === 'none') return [{ key: '@all', name: null as string | null, meta: null as React.ReactNode, pos: shown, borrowed: new Set<string>(), lsxId: null as string | null }] // prettier-ignore
    if (view.groupBy === 'lsx') {
      const g = groupPosByLsx(shown, lsxs, today)
      const out = g.groups.map((x) => ({
        key: x.key,
        name: x.lsx_code,
        meta: (
          <>
            {x.customer_name && <span>{x.customer_name} · </span>}
            <span className="num">{x.pos.length} đơn</span>
            {x.total > 0 && (
              <span>
                {' '}
                ·{' '}
                <span className="num">
                  {x.total.toLocaleString('vi-VN')} {x.currency}
                </span>
              </span>
            )}{' '}
            {/* prettier-ignore */}
            {x.otherTotals.map(
              (t) =>
              <span key={t.currency}> · <span className="num">{t.total.toLocaleString('vi-VN')} {t.currency}</span></span>, // prettier-ignore
            )}
            {x.late > 0 && (
              <span className="text-[var(--stop)]"> · {x.late} quá hẹn</span>
            )}
            {x.linesTotal > 0 && (
              <span>
                {' '}
                · về {x.linesDone}/{x.linesTotal} dòng
              </span>
            )}
            {x.materials_due_at && <span> · hạn VT {dmy(x.materials_due_at)}</span>}
            {canEdit && x.lsx_id && (
              <a
                href={`/mua-hang/don/moi?lsx=${x.lsx_id}`}
                className="ml-2 font-semibold text-[var(--act)] normal-case"
              >
                + Đặt thêm
              </a>
            )}
          </>
        ),
        pos: x.pos,
        borrowed: x.borrowed,
        lsxId: x.lsx_id,
      }))
      if (g.standalone.pos.length > 0)
        out.push({ key: '@standalone', name: 'Ngoài lệnh sản xuất', meta: <span className="num">{g.standalone.pos.length} đơn</span>, pos: g.standalone.pos, borrowed: new Set(), lsxId: null }) // prettier-ignore
      return out
    }
    return groupSimple(shown, view.groupBy).map((x) => ({ ...x, name: x.name as string | null, meta: <span>{x.meta}</span> as React.ReactNode, borrowed: new Set<string>(), lsxId: null as string | null })) // prettier-ignore
  }, [shown, view.groupBy, lsxs, today, canEdit])

  const sel = useMemo(() => pos.find((p) => p.id === pick) ?? null, [pos, pick])
  const own = (p: Po) => canEdit && (canManageAny || p.assigned_to === meId)
  const selActions = sel ? actionsFor(sel.status as PoStatus, { own: own(sel), approve: canApprove }) : [] // prettier-ignore

  const tickedRows = pos.filter((p) => ticked.includes(p.id))
  const bulk = bulkActionFor(
    tickedRows.map((p) => ({ status: p.status as PoStatus, own: own(p) })),
    { approve: canApprove },
  )

  /* ── chạy hành động ────────────────────────────────────────────────── */
  async function run(ids: string[], a: Action) {
    if (!a.build) return
    setBusy(true)
    let ok = 0
    let failCode = ''
    let failMsg = ''
    try {
      for (const id of ids) {
        const p = pos.find((x) => x.id === id)
        if (!p) continue
        try {
          for (const c of a.build({ id, reason: reason.trim(), date }))
            await api(c.path, { method: c.method, body: c.body })
          ok += 1
        } catch (e) {
          failCode = p.code
          failMsg = apiErrorText(e)
          break
        }
      }
    } finally {
      setBusy(false)
      setSheet(null)
      setReason('')
      setDate('')
      setTicked([])
      if (a.id === 'delete') setPick(null)
      router.refresh()
    }
    if (failCode) toast.error(ok > 0 ? `Xong ${ok} đơn rồi dừng ở ${failCode}` : `Không làm được ${failCode}`, failMsg) // prettier-ignore
    else toast.success(ids.length === 1 ? `${a.done} ${pos.find((x) => x.id === ids[0])?.code ?? ''}` : `${a.done} ${ok} đơn`) // prettier-ignore
  }

  function start(ids: string[], a: Action) {
    if (a.blocked || ids.length === 0) return
    if (a.ui === 'link' && a.href) {
      router.push(a.href(ids[0]))
      return
    }
    if (a.ui === 'direct') {
      void run(ids, a)
      return
    }
    setReason('')
    setDate('')
    setSheet({ action: a, ids })
  }

  async function saveDue(lsxId: string) {
    if (dueDraft == null) return
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/materials-due`, {
        method: 'PATCH',
        body: { materials_due_at: dueDraft || null },
      })
      toast.success('Đã đổi hạn vật tư của lệnh')
      setDueDraft(null)
      router.refresh()
    } catch (e) {
      toast.error('Không đổi được hạn vật tư', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Mở bằng link (`?mo=`) thì CUỘN TỚI đúng dòng. Khay mở mà dòng nằm ở
   * đáy bảng 68 đơn thì người dùng thấy khay nói về một đơn không có trên màn.
   * Chỉ chạm DOM, không đổi state — nên nằm trong effect là đúng chỗ.
   */
  useEffect(() => {
    if (openId)
      document.getElementById(`po-${openId}`)?.scrollIntoView({ block: 'center' })
  }, [openId])

  const sheetInvalid =
    sheet != null &&
    ((sheet.action.needReason && reason.trim().length === 0) ||
      (sheet.action.needDate && date.length === 0))

  const colCount = 1 + cols.length
  const has = (k: ColKey) => cols.includes(k)

  /* ── vẽ ─────────────────────────────────────────────────────────────── */
  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Phiếu mua"
        facts={[
          { label: 'Đang hiện', value: `${shown.length} / ${pos.length}` },
          { label: 'Của tôi', value: String(counts.mine) },
          { label: 'NCC trễ hẹn', value: String(counts.late), tone: counts.late > 0 ? 'stop' : undefined }, // prettier-ignore
          { label: 'Quá hẹn mà chưa gửi', value: String(counts.lateUnsent), tone: counts.lateUnsent > 0 ? 'warn' : undefined }, // prettier-ignore
        ]}
        actions={
          <>
            <Btn href="/planning/lsx">Vật tư theo lệnh</Btn>
            {canEdit && (
              <Btn primary href="/mua-hang/don/moi">
                + Soạn đơn mua
              </Btn>
            )}
          </>
        }
      />

      {/* Hàng 1: khung nhìn + tìm + ba ô chọn */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[4px]">
        <Pick
          label="Khung nhìn"
          value={namedId ?? '@custom'}
          width={220}
          onChange={(id) => {
            const v = NAMED_VIEWS.find((x) => x.id === id)
            if (v) setView(v.state)
          }}
          options={[
            ...(namedId
              ? []
              : [{ value: '@custom', label: '— tuỳ chỉnh —', disabled: true }]),
            ...NAMED_VIEWS.map((v) => ({ value: v.id, label: v.label })),
          ]}
        />
        <SearchInput
          value={view.filter.q}
          onChange={(q) => patchFilter({ q })}
          placeholder="Số PO, NCC, LSX, mã đơn hàng…"
          width={260}
        />
        <Pick
          label="Rổ trạng thái"
          value={view.filter.bucket}
          onChange={(b) => patchFilter({ bucket: b as PoBucket })}
          options={[
            { value: 'all', label: `Mọi trạng thái (${counts.all})` },
            ...PO_BUCKETS.map((b) => ({
              value: b.key,
              label: `${b.label} (${counts[b.key]})`,
            })),
          ]}
        />
        <Pick
          label="Nhà cung cấp"
          value={view.filter.supplierId}
          onChange={(supplierId) => patchFilter({ supplierId })}
          width={200}
          options={[{ value: 'all', label: 'Mọi NCC' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} // prettier-ignore
        />
        <Pick
          label="Loại đơn"
          value={view.filter.type}
          onChange={(t) => patchFilter({ type: t as PoFilterState['type'] })}
          options={[
            { value: 'all', label: 'Mọi loại' },
            { value: 'lsx', label: 'Theo lệnh SX' },
            { value: 'standalone', label: 'Ngoài LSX' },
          ]}
        />
      </div>

      {/* Hàng 2: ba công tắc + gom + sắp + cột + mật độ */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[4px]">
        <Chip
          on={view.filter.mine}
          count={counts.mine}
          onClick={() => patchFilter({ mine: !view.filter.mine })}
        >
          Của tôi
        </Chip>
        <Chip
          on={view.filter.late}
          count={counts.late + counts.lateUnsent}
          onClick={() => patchFilter({ late: !view.filter.late })}
        >
          Quá hẹn
        </Chip>
        <Chip
          on={view.filter.noEta}
          count={counts.noEta}
          onClick={() => patchFilter({ noEta: !view.filter.noEta })}
        >
          Chưa hẹn giao
        </Chip>
        {isFilterActive(view.filter) && (
          <Btn
            onClick={() =>
              setView({
                ...view,
                filter: {
                  ...view.filter,
                  q: '',
                  bucket: 'all',
                  supplierId: 'all',
                  type: 'all',
                  mine: false,
                  late: false,
                  noEta: false,
                },
              })
            }
          >
            {' '}
            {/* prettier-ignore */}
            Bỏ lọc
          </Btn>
        )}
        <span className="ml-auto flex items-center gap-2">
          <Pick
            label="Gom theo"
            value={view.groupBy}
            onChange={(g) => setView({ ...view, groupBy: g as GroupBy })}
            options={(Object.keys(GROUP_LABEL) as GroupBy[]).map((k) => ({ value: k, label: `Gom: ${GROUP_LABEL[k]}` }))} // prettier-ignore
          />
          <Pick
            label="Sắp xếp"
            value={view.sortBy}
            onChange={(s) => setView({ ...view, sortBy: s as SortBy })}
            options={(Object.keys(SORT_LABEL) as SortBy[]).map((k) => ({ value: k, label: SORT_LABEL[k] }))} // prettier-ignore
          />
          <Btn onClick={() => setColSheet(true)}>Cột ({cols.length})</Btn>
          <Btn
            onClick={() => setDenseRaw(dense ? '0' : '1')}
            title="Dày hơn cho người quen Excel"
          >
            {dense ? 'Thưa' : 'Dày'}
          </Btn>
        </span>
      </div>

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Thu hẹp bộ lọc' }}>
          Sổ chạm trần <b>{truncatedAt} đơn</b> khi nạp — mọi con số trên màn có thể
          thiếu.
        </NoticeBar>
      )}
      {emptyLsx > 0 && view.groupBy === 'lsx' && (
        <NoticeBar
          tone="warn"
          tag="Lệnh trống"
          action={{
            label: 'Vật tư theo lệnh',
            onClick: () => router.push('/planning/lsx'),
          }}
        >
          <b>{emptyLsx} lệnh đang chạy chưa có đơn mua nào.</b> Gom theo lệnh chỉ hiện
          lệnh đã có đơn — câu “lệnh nào còn thiếu đồ” trả lời ở trang Vật tư theo lệnh.
        </NoticeBar>
      )}

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {shown.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Không có đơn nào khớp"
              reason={`Khung nhìn "${namedId ? NAMED_VIEWS.find((v) => v.id === namedId)?.label : 'tuỳ chỉnh'}" không còn dòng nào trong ${pos.length} đơn của sổ.`}
              next={
                <>
                  <Btn
                    onClick={() =>
                      setView(NAMED_VIEWS.find((v) => v.id === 'tat-ca')!.state)
                    }
                  >
                    Xem tất cả {pos.length} đơn
                  </Btn>
                  {canEdit && (
                    <Btn primary href="/mua-hang/don/moi">
                      + Soạn đơn mua
                    </Btn>
                  )}
                </>
              }
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead pinFirst>
                <th style={{ width: 34 }} />
                <th>Đơn</th>
                {COLS.filter((c) => has(c.key)).map((c) => (
                  <th key={c.key} style={c.num ? { textAlign: 'right' } : undefined}>
                    {c.label}
                  </th>
                ))}
              </THead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {g.name && (
                      <GroupRow name={g.name} meta={g.meta} cols={colCount + 1} />
                    )}
                    {g.pos.map((p) => {
                      const late = assessPoLate(p, today)
                      const noEta = isMissingEta(p)
                      const fit = assessPoFit(p, lsxDue.get(p.production_order_id ?? ''))
                      const borrowed = g.borrowed.has(p.id)
                      return (
                        <Row
                          key={`${g.key}:${p.id}`}
                          id={`po-${p.id}`}
                          selected={p.id === pick}
                          onClick={() => setPick(p.id)}
                        >
                          <Cell>
                            {own(p) && !borrowed ? (
                              <Tick
                                checked={ticked.includes(p.id)}
                                label={`Chọn đơn ${p.code} — ${p.supplier_name}`}
                                onChange={() => setTicked((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} // prettier-ignore
                              />
                            ) : null}
                          </Cell>
                          <Cell
                            pin
                            className={
                              p.status === 'cancelled' ? 'opacity-60' : undefined
                            }
                          >
                            <Code>{p.code}</Code>
                            {borrowed && <Tag tone="neutral">mua chung</Tag>}
                            {!borrowed && (p.extra_lsx?.length ?? 0) > 0 && (
                              <Tag tone="neutral">
                                gộp {(p.extra_lsx?.length ?? 0) + 1} lệnh
                              </Tag>
                            )}
                          </Cell>
                          {has('ncc') && <Cell grow>{p.supplier_name}</Cell>}
                          {has('chuoi') && (
                            <Cell muted>
                              {p.lsx_code
                                ? `${p.order_code ? p.order_code + ' › ' : ''}${p.lsx_code}`
                                : 'Ngoài LSX'}
                            </Cell>
                          )}
                          {has('trang_thai') && (
                            <Cell>
                              <Tag tone={TONE[PO_STATUS_TONE[p.status as PoStatus]]}>
                                {PO_STATUS_LABEL[p.status as PoStatus]}
                              </Tag>
                              {PO_NEXT_HINT[p.status as PoStatus] && (
                                <span className="ml-1 text-[11px] text-[var(--ink-3)]">
                                  → {PO_NEXT_HINT[p.status as PoStatus]}
                                </span>
                              )}
                            </Cell>
                          )}
                          {has('ve_kho') && (
                            <Cell num>
                              <Num
                                value={
                                  p.lines_total
                                    ? `${p.lines_done}/${p.lines_total} dòng`
                                    : ''
                                }
                                zero="dash"
                              />
                            </Cell>
                          )}
                          {has('hen') && (
                            <Cell
                              num
                              className={
                                late === 'overdue' ? 'text-[var(--stop)]' : undefined
                              }
                            >
                              {p.expected_at ? (
                                <>
                                  {dmy(p.expected_at)}
                                  {late === 'overdue' && (
                                    <span className="ml-1 text-[11px]">
                                      quá {daysBetween(p.expected_at, today)} ng
                                    </span>
                                  )}
                                  {late === 'due_soon' && (
                                    <span className="ml-1 text-[11px] text-[var(--warn)]">
                                      còn {-daysBetween(p.expected_at, today)} ng
                                    </span>
                                  )}
                                </>
                              ) : noEta ? (
                                <Tag tone="warn">chưa hẹn</Tag>
                              ) : (
                                <Num value="" />
                              )}
                            </Cell>
                          )}
                          {has('kip') && (
                            <Cell>
                              {fit === 'late' ? (
                                <Tag tone="stop">Trễ SX</Tag>
                              ) : fit === 'tight' ? (
                                <Tag tone="warn">Sát hạn</Tag>
                              ) : fit === 'ok' ? (
                                <Tag tone="done">Kịp</Tag>
                              ) : (
                                <Num value="" />
                              )}
                            </Cell>
                          )}
                          {has('phu_trach') && (
                            <Cell muted>
                              {p.assigned_to === meId ? '★ ' : ''}
                              {p.assignee_name ?? 'chưa giao ai'}
                            </Cell>
                          )}
                          {has('gia_tri') && (
                            <Cell num>
                              <Num
                                value={
                                  p.total
                                    ? `${p.total.toLocaleString('vi-VN')} ${p.currency}`
                                    : ''
                                }
                                strong
                              />
                            </Cell>
                          )}
                          {has('tao') && (
                            <Cell num>
                              <Num value={dmy(p.created_at)} muted />
                            </Cell>
                          )}
                        </Row>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </Table>

            {ticked.length > 0 && (
              <div className="flex shrink-0 items-center gap-3 border-t border-[var(--line)] bg-[var(--act-wash)] px-[var(--gutter)] py-[9px]">
                <span className="num font-semibold text-[var(--act-text)] text-[var(--fs-sm)]">
                  {ticked.length} đơn đã chọn
                </span>
                <Btn onClick={() => setTicked([])}>Bỏ chọn</Btn>
                <span className="ml-auto">
                  {'action' in bulk ? (
                    <Btn
                      primary
                      disabled={busy}
                      onClick={() => start(ticked, bulk.action)}
                    >
                      {bulk.action.label} {ticked.length} đơn
                    </Btn>
                  ) : (
                    <span className="text-[var(--fs-sm)] text-[var(--ink-2)]">
                      {bulk.reason}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {sel &&
          (() => {
            const h = poHolder(sel, meId)
            const since = h.since
            const late = assessPoLate(sel, today)
            const lsx = sel.production_order_id
              ? lsxById.get(sel.production_order_id)
              : undefined
            const fit = assessPoFit(sel, lsx?.materials_due_at)
            const primary = selActions.find((a) => a.primary)
            const rest = selActions.filter((a) => !a.primary)
            const stepIdx = [
              'draft',
              'pending_approval',
              'approved',
              'ordered',
              'confirmed',
              'in_transit',
            ].indexOf(sel.status)
            const recvIdx =
              sel.status === 'received' ? 2 : sel.status === 'partial' ? 1 : 0
            return (
              <InspectPanel
                code={sel.code}
                title={sel.supplier_name}
                subtitle={`${sel.lsx_code ?? 'Ngoài LSX'} · ${PO_STATUS_LABEL[sel.status as PoStatus]}`}
                actions={
                  <>
                    {primary && (
                      <Btn
                        primary
                        disabled={busy || !!primary.blocked}
                        title={primary.blocked}
                        onClick={() => start([sel.id], primary)}
                      >
                        {primary.label}
                      </Btn>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {rest.map((a) => (
                        <Btn
                          key={a.id}
                          danger={a.danger}
                          disabled={busy || !!a.blocked}
                          title={a.blocked}
                          onClick={() => start([sel.id], a)}
                        >
                          {a.label}
                        </Btn>
                      ))}
                    </div>
                  </>
                }
              >
                <InspectSection title="Đến lượt ai">
                  <NextAction
                    mine={h.mine}
                    holder={h.who}
                    what={h.what}
                    days={since ? daysBetween(since, today) : null}
                    hint={PO_NEXT_HINT[sel.status as PoStatus]}
                  />
                </InspectSection>

                <InspectSection title="Hai trục trạng thái">
                  <div className="flex flex-col gap-2">
                    <StatusTrack
                      label="Đơn"
                      steps={[
                        'Nháp',
                        'Chờ duyệt',
                        'Đã duyệt',
                        'Đã gửi',
                        'NCC xác nhận',
                        'Đang giao',
                      ]}
                      at={Math.max(0, stepIdx)}
                    />
                    <StatusTrack
                      label="Về kho"
                      steps={['Chưa', 'Một phần', 'Đủ']}
                      at={recvIdx}
                    />
                    <p className="text-[11px] text-[var(--ink-3)]">
                      Trục thanh toán chưa nối phân hệ — cố ý không vẽ.
                    </p>
                  </div>
                </InspectSection>

                {lsx && (
                  <InspectSection title="Kịp sản xuất?">
                    <WhyBox
                      lines={[
                        `hẹn giao ${dmy(sel.expected_at) || 'chưa có'}`,
                        `hạn vật tư của lệnh ${dmy(lsx.materials_due_at) || 'chưa đặt'}`,
                      ]}
                      result={
                        fit === 'late'
                          ? 'TRỄ so với hạn vật tư'
                          : fit === 'tight'
                            ? 'sát hạn (≤ 2 ngày)'
                            : fit === 'ok'
                              ? 'kịp'
                              : 'không so được — thiếu một trong hai mốc'
                      }
                    />
                    {canEdit && (
                      <div className="mt-2 flex items-end gap-2">
                        <div className="flex-1">
                          <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                            Hạn vật tư của lệnh
                          </span>
                          <DateInput
                            value={dueDraft ?? lsx.materials_due_at ?? ''}
                            onChange={setDueDraft}
                            label="Hạn vật tư của lệnh"
                          />
                        </div>
                        <Btn
                          disabled={
                            busy ||
                            dueDraft == null ||
                            dueDraft === (lsx.materials_due_at ?? '')
                          }
                          onClick={() => saveDue(lsx.id)}
                        >
                          Lưu
                        </Btn>
                      </div>
                    )}
                  </InspectSection>
                )}

                {late === 'overdue' && sel.expected_at && (
                  <InspectSection title="Vì sao đỏ">
                    <WhyBox
                      lines={[
                        `hẹn giao ${dmy(sel.expected_at)}`,
                        `hôm nay ${dmy(today)}`,
                      ]}
                      result={`quá hẹn ${daysBetween(sel.expected_at, today)} ngày`}
                    />
                  </InspectSection>
                )}

                <InspectSection title="Chuỗi chứng từ">
                  <DocChain
                    links={[
                      ...(sel.order_code
                        ? [{ label: 'Đơn khách', code: sel.order_code }]
                        : []),
                      ...(sel.lsx_code
                        ? [
                            {
                              label: 'Lệnh SX',
                              code: sel.lsx_code,
                              href: sel.production_order_id
                                ? `/planning/lsx/${sel.production_order_id}`
                                : undefined,
                            },
                          ]
                        : []),
                      {
                        label: 'Đơn mua',
                        code: sel.code,
                        href: `/planning/pos/${sel.id}`,
                        muted: true,
                      },
                    ]}
                  />
                </InspectSection>
              </InspectPanel>
            )
          })()}
      </div>

      <StatusBar
        left={[
          <span key="v">
            Khung nhìn:{' '}
            <b>
              {namedId ? NAMED_VIEWS.find((v) => v.id === namedId)?.label : 'tuỳ chỉnh'}
            </b>
          </span>,
          'Gom: ' + GROUP_LABEL[view.groupBy],
        ]}
        right={`${shown.length} / ${pos.length} đơn`}
      />

      {/* Hộp chọn cột */}
      <Sheet
        open={colSheet}
        onClose={() => setColSheet(false)}
        title="Cột đang hiện"
        subtitle="Nhớ theo máy này. Cột Đơn luôn hiện."
        stakes="nhe"
        width={360}
        footer={
          <>
            <Btn onClick={() => setColsRaw('')}>Về mặc định</Btn>
            <Btn primary onClick={() => setColSheet(false)}>
              Xong
            </Btn>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {COLS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-[var(--fs-body)]">
              <Tick
                checked={has(c.key)}
                label={`Hiện cột ${c.label}`}
                onChange={(on) => {
                  const next = on ? [...cols, c.key] : cols.filter((k) => k !== c.key)
                  setColsRaw(
                    COLS.map((x) => x.key)
                      .filter((k) => next.includes(k))
                      .join(','),
                  )
                }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </Sheet>

      {/* Hộp hành động */}
      {sheet && (
        <Sheet
          open
          onClose={() => setSheet(null)}
          title={
            sheet.ids.length === 1
              ? `${sheet.action.label} · ${pos.find((p) => p.id === sheet.ids[0])?.code ?? ''}`
              : `${sheet.action.label} · ${sheet.ids.length} đơn`
          }
          stakes={sheet.action.stakes}
          footer={
            <SheetActions
              stakes={sheet.action.stakes}
              busy={busy}
              onCancel={() => setSheet(null)}
              onConfirm={() => void run(sheet.ids, sheet.action)}
              confirmLabel={sheet.action.label}
            />
          }
        >
          {sheet.action.consequence && (
            <Consequence>{sheet.action.consequence}</Consequence>
          )}
          {sheet.action.needDate && (
            <label className="mb-3 block">
              <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                Ngày giao mới
              </span>
              <DateInput value={date} onChange={setDate} label="Ngày giao mới" />
            </label>
          )}
          {sheet.action.needReason && (
            <label className="block">
              <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                {sheet.action.reasonLabel}
              </span>
              <TextArea value={reason} onChange={setReason} rows={3} />
              <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                {sheet.action.reasonHint}
              </span>
            </label>
          )}
          {sheet.ids.length > 1 && (
            <Affected
              items={sheet.ids.map((id) => {
                const p = pos.find((x) => x.id === id)
                return {
                  code: p?.code ?? id,
                  label: p?.supplier_name,
                  amount: p?.total
                    ? `${p.total.toLocaleString('vi-VN')} ${p.currency}`
                    : undefined,
                }
              })}
            />
          )}
          {sheetInvalid && (
            <p className="mt-3 font-semibold text-[var(--fs-sm)] text-[var(--warn)]">
              {sheet.action.needDate && !date
                ? 'Chọn ngày giao mới trước đã.'
                : 'Viết một câu — người sau đọc để khỏi hỏi lại.'}
            </p>
          )}
        </Sheet>
      )}
    </ScreenFrame>
  )
}

'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronDown,
  Download,
  ExternalLink,
  Printer,
  Save,
  SendHorizontal,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  checkColumnsOf,
  colKey,
  hasCbm,
  specColumnsOf,
  type LsxTemplate,
} from '@/modules/dept/sales/lsx-template'
import type { LsxGroup, LsxLine } from '@/modules/dept/production/lsx-lines.repo'
import {
  lineOrigins,
  lineReadiness,
  sheetReadiness,
  TAB_LABEL,
  type FieldOrigin,
  type LineReadiness,
  type ProfileMap,
  type ProfileTab,
} from '@/modules/dept/production/lsx-line-fill'
import { valueState } from '@/modules/dept/production/lsx-sheet-cells'
import { LineMeter } from './lsx-editor/LineMeter'
import { SourceChip } from './lsx-editor/SourceChip'
import { SheetReadinessBar } from './lsx-editor/SheetReadinessBar'

/**
 * SOẠN DÒNG LỆNH SẢN XUẤT (0114) — màn thay file Excel của Sales.
 *
 * Cấu trúc bám đúng file thật: lệnh → NHÓM (số PO / bộ sưu tập / nơi gia công)
 * → DÒNG. Một mã SP được lặp nhiều dòng, mỗi dòng một số lượng và một đợt xuất
 * ("Tách đợt" nhân đôi dòng để khỏi gõ lại).
 *
 * Bố cục v2 (06/08/2026): bản cũ trải ~15 cột nhập trên một bảng cuộn ngang —
 * ô nào cũng bé. Nay bảng CHỈ giữ trường hay sửa (Mã SP · Tên · ĐVT · SL ·
 * CBM · Đợt xuất); vật liệu / đóng gói / ghi chú / kiểm tra hồ sơ nằm trong
 * PHẦN MỞ RỘNG của từng dòng (bấm "Chi tiết") — hết cuộn ngang, ô nhập rộng.
 *
 * NGUỒN + ĐỘ ĐẦY ĐỦ (0117): dòng được nạp sẵn từ hồ sơ SP và dòng đơn, nên mỗi
 * ô mang chú thích nguồn ("từ hồ sơ SP" / "khác hồ sơ SP" / "hồ sơ trống — tự
 * nhập"), mỗi dòng có dải 4 ô đo độ đủ, và thanh gửi duyệt khoá lại khi còn
 * dòng thiếu mã SP / số lượng / ĐVT. Luật khai một chỗ ở `lsx-line-fill.ts` —
 * server dùng lại đúng luật đó ở `lsxService.submit`.
 */

type EditLine = Partial<LsxLine> & { id?: string; _key: string }
type EditGroup = Partial<LsxGroup> & { id?: string; _key: string; lines: EditLine[] }

let seq = 0
const newKey = () => `k${++seq}`

const toEditLine = (l: LsxLine): EditLine => ({ ...l, _key: newKey() })

/** Ô nhập mật độ bảng — thấp hơn Input mặc định để bảng soạn không phình. */
const cellInput = 'h-8 rounded-md px-2 text-xs'
// Tiêu đề cột đậm màu chữ chính; nhãn ô nhập lùi lại bằng muted (nay là
// stone-600, đủ tương phản để đọc ở 12px).
const th =
  'py-1.5 pr-2 text-left text-[11px] font-semibold tracking-wider text-foreground uppercase'
// Nhãn trường phải ĐỌC ĐƯỢC: panel chi tiết nền xám nhạt, ô nhập nền trắng —
// nhãn để màu muted nữa là ba sắc trắng-xám chồng nhau, không phân biệt nổi.
const fieldLabel = 'flex flex-col gap-1 text-xs font-medium text-foreground'

export function LsxSheetEditor({
  lsxId,
  lsxCode,
  customerName,
  revision,
  canEdit,
  isDraft = false,
  template,
  groups: initial,
  profiles = {},
  backHref,
}: {
  lsxId: string
  lsxCode: string
  customerName: string
  revision: number
  canEdit: boolean
  /** Lệnh còn NHÁP (0117) — hiện nút "Gửi GĐ duyệt" ở thanh lưu. */
  isDraft?: boolean
  template: LsxTemplate
  groups: (LsxGroup & { lines: LsxLine[] })[]
  /** productId → ảnh chụp hồ sơ SP: suy nguồn từng ô + biết hồ sơ thiếu gì. */
  profiles?: ProfileMap
  backHref: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [groups, setGroups] = useState<EditGroup[]>(
    initial.map((g) => ({ ...g, _key: newKey(), lines: g.lines.map(toEditLine) })),
  )
  // Dòng đang mở phần chi tiết (vật liệu/đóng gói/kiểm tra hồ sơ).
  const [openLines, setOpenLines] = useState<Set<string>>(new Set())
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  // Ô nhập theo khoá dòng — để nhảy tới đúng ô thiếu khi bấm từ thanh gửi duyệt.
  const inputRefs = useRef(new Map<string, HTMLInputElement>())

  const specCols = specColumnsOf(template)
  const checkCols = checkColumnsOf(template)
  const showCbm = hasCbm(template)

  const readinessOpts = useMemo(
    () => ({
      specKeys: specCols.map((c) => ({ key: colKey(c), label: c.label })),
      checkKeys: checkCols.map((c) => ({ key: colKey(c), label: c.label })),
      needCbm: showCbm,
    }),
    [specCols, checkCols, showCbm],
  )

  const snapOf = (l: EditLine) => (l.product_id ? profiles[l.product_id] : undefined)
  const readinessOf = (l: EditLine): LineReadiness =>
    lineReadiness(l, snapOf(l), readinessOpts)
  /** Ô đang ghi giá trị tạm ("xác nhận sau") — dấu "chờ chốt" trên chip nguồn. */
  const isPendingText = (v?: string | null) => {
    const t = (v ?? '').trim()
    return !!t && valueState(t, false) === 'pending'
  }
  /** Tab hồ sơ chứa trường này — để link "mở hồ sơ" nhảy đúng chỗ sửa. */
  const gapTabOf = (l: EditLine, key: string): ProfileTab =>
    snapOf(l)?.gaps.find((gp) => gp.key === key)?.tab ?? 'thong-so'

  /**
   * Trường hồ sơ đang trống MÀ dòng đã có giá trị dùng được — tức là thứ nút
   * "Bổ sung vào hồ sơ SP" thực sự đẩy lên được. Trước đây nút sáng theo gaps
   * nên bấm xong hay nhận toast "không có gì để bổ sung".
   */
  function pushableGaps(l: EditLine): string[] {
    const snap = snapOf(l)
    if (!snap) return []
    const has = (v?: string | null) => {
      const t = (v ?? '').trim()
      return !!t && valueState(t, false) !== 'pending'
    }
    return snap.gaps
      .filter((gp) => {
        if (gp.key === 'name_foreign') return has(l.name_foreign)
        if (gp.key === 'barcode') return has(l.barcode)
        if (gp.key === 'packing') return has(l.packing)
        if (gp.key === 'cbm') return l.cbm != null
        return has(l.specs?.[gp.key])
      })
      .map((gp) => gp.label)
  }

  const totalQty = groups.reduce(
    (s, g) => s + g.lines.reduce((x, l) => x + Number(l.qty ?? 0), 0),
    0,
  )
  const totalCbm = groups.reduce(
    (s, g) =>
      s + g.lines.reduce((x, l) => x + Number(l.cbm ?? 0) * Number(l.qty ?? 0), 0),
    0,
  )

  /** Tổng hợp cả phiếu — nuôi thanh tổng quan + gate gửi duyệt. */
  const sheet = useMemo(
    () =>
      sheetReadiness(
        groups.flatMap((g) =>
          g.lines.map((l, i) => ({
            groupTitle: g.po_no || g.title || 'Nhóm chưa đặt tên',
            index: i + 1,
            line: l,
            readiness: lineReadiness(l, snapOf(l), readinessOpts),
          })),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapOf đọc `profiles` (prop tĩnh)
    [groups, profiles, readinessOpts],
  )

  /** Nhảy tới dòng lỗi (bấm từ thanh gửi duyệt): cuộn tới + focus ô đầu dòng. */
  function jumpTo(groupTitle: string, index: number) {
    const g = groups.find(
      (x) => (x.po_no || x.title || 'Nhóm chưa đặt tên') === groupTitle,
    )
    const line = g?.lines[index - 1]
    if (!line) return
    setOnlyIncomplete(false)
    setOpenLines((prev) => new Set(prev).add(line._key))
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(line._key)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus()
    })
  }

  function toggleLine(key: string) {
    setOpenLines((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function patchGroup(key: string, patch: Partial<EditGroup>) {
    setGroups((gs) => gs.map((g) => (g._key === key ? { ...g, ...patch } : g)))
  }
  function patchLine(gKey: string, lKey: string, patch: Partial<EditLine>) {
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey
          ? {
              ...g,
              lines: g.lines.map((l) => (l._key === lKey ? { ...l, ...patch } : l)),
            }
          : g,
      ),
    )
  }
  /** Lấy lại giá trị hồ sơ SP cho một ô đã lệch (nút "khôi phục" ở chip nguồn). */
  function revertField(gKey: string, l: EditLine, field: string) {
    const snap = snapOf(l)
    if (!snap) return
    if (field.startsWith('spec.')) {
      const key = field.slice(5)
      patchLine(gKey, l._key, {
        specs: { ...(l.specs ?? {}), [key]: snap.specs[key] ?? '' },
      })
      return
    }
    if (field === 'cbm') return patchLine(gKey, l._key, { cbm: snap.cbm })
    if (field === 'packing') return patchLine(gKey, l._key, { packing: snap.packing })
    if (field === 'name_foreign')
      return patchLine(gKey, l._key, { name_foreign: snap.name_foreign })
    if (field === 'barcode') return patchLine(gKey, l._key, { barcode: snap.barcode })
    if (field === 'customer_item_code')
      return patchLine(gKey, l._key, { customer_item_code: snap.customer_item_code })
  }

  function addLine(gKey: string, from?: EditLine) {
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey
          ? {
              ...g,
              lines: [
                ...g.lines,
                // Tách đợt = chép dòng nhưng BỎ id (dòng mới) và bỏ số lượng cũ.
                from
                  ? { ...from, id: undefined, _key: newKey(), qty: 0 }
                  : { _key: newKey(), product_code: '', unit: '', qty: 0 },
              ],
            }
          : g,
      ),
    )
  }
  function removeLine(gKey: string, lKey: string) {
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey ? { ...g, lines: g.lines.filter((l) => l._key !== lKey) } : g,
      ),
    )
  }

  /** Bản ghi gửi lên API — dùng chung cho "Lưu" và "Gửi GĐ duyệt". */
  function buildPayload() {
    return {
      groups: groups.map((g, gi) => ({
        id: g.id,
        sales_order_id: g.sales_order_id ?? null,
        title: g.title ?? null,
        buyer_name: g.buyer_name ?? null,
        po_no: g.po_no ?? null,
        ship_date: g.ship_date ?? null,
        ship_label: g.ship_label ?? null,
        note: g.note ?? null,
        sort_order: gi,
        lines: g.lines.map((l, li) => ({
          id: l.id,
          product_id: l.product_id ?? null,
          sales_order_line_id: l.sales_order_line_id ?? null,
          product_code: l.product_code ?? '',
          customer_item_code: l.customer_item_code ?? null,
          name_foreign: l.name_foreign ?? null,
          name_vi: l.name_vi ?? null,
          name_customs: l.name_customs ?? null,
          barcode: l.barcode ?? null,
          unit: l.unit ?? '',
          qty: Number(l.qty ?? 0),
          packing: l.packing ?? null,
          cbm: l.cbm == null || l.cbm === ('' as never) ? null : Number(l.cbm),
          ship_date: l.ship_date ?? null,
          ship_label: l.ship_label ?? null,
          specs: l.specs ?? {},
          checks: l.checks ?? {},
          extras: l.extras ?? {},
          note: l.note ?? null,
          important_note: l.important_note ?? null,
          image_file_id: l.image_file_id ?? null,
          sort_order: li,
        })),
      })),
      revision_note: note.trim() || null,
    }
  }

  async function save() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/lines`, {
        method: 'PUT',
        body: buildPayload(),
      })
      toast.success('Đã lưu dòng lệnh', lsxCode)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function reseed() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/lines`, { method: 'POST', body: {} })
      toast.success('Đã nạp dòng từ đơn hàng')
      router.refresh()
    } catch (e) {
      toast.error('Nạp thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Gửi lệnh nháp sang bàn duyệt của GĐ (0117). LƯU TRƯỚC rồi mới gửi — Sales
   * hay bấm gửi ngay sau khi gõ, mất công sửa lại nếu bản gửi đi là bản cũ.
   */
  async function submitForApproval() {
    // Mức A đã khoá nút từ trước; đây là chốt chặn cuối phòng lọt.
    if (sheet.blocked.length) return
    // Mức B: nói rõ còn thiếu gì rồi để Sales quyết — nhiều ca khách chưa chốt
    // thông tin mà lệnh vẫn phải chạy.
    const gaps: string[] = []
    if (sheet.warned.length) {
      const byIssue = new Map<string, number>()
      for (const w of sheet.warned) {
        for (const label of w.issues.split(', ')) {
          byIssue.set(label, (byIssue.get(label) ?? 0) + 1)
        }
      }
      for (const [label, n] of [...byIssue].sort((a, b) => b[1] - a[1])) {
        gaps.push(` · ${n} dòng thiếu ${label}`)
      }
    }
    if (sheet.pending) gaps.push(` · ${sheet.pending} ô đang ghi "chờ chốt"`)
    const lines = sheet.warned
      .slice(0, 8)
      .map((w) => `${w.groupTitle} #${w.index} ${w.code}`)
      .join(', ')
    const detail = gaps.length
      ? `\n\nCòn thiếu (vẫn gửi được):\n${gaps.join('\n')}${
          lines
            ? `\nChi tiết: ${lines}${sheet.warned.length > 8 ? ` … và ${sheet.warned.length - 8} dòng nữa` : ''}`
            : ''
        }`
      : ''
    if (
      !confirm(
        `Gửi lệnh ${lsxCode} cho Giám đốc duyệt?${detail}\n\nDòng lệnh sẽ được lưu trước khi gửi.`,
      )
    )
      return
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/lines`, {
        method: 'PUT',
        body: buildPayload(),
      })
      await api(`/api/dept/production/lsx/${lsxId}/submit`, { method: 'POST', body: {} })
      toast.success('Đã gửi Giám đốc duyệt', lsxCode)
      router.push(backHref)
    } catch (e) {
      toast.error('Gửi duyệt thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Bổ sung hồ sơ SP từ dòng lệnh — server chỉ điền trường hồ sơ đang TRỐNG
   * (không ghi đè, bỏ qua placeholder "xác nhận sau"). Dùng giá trị ĐÃ LƯU của
   * dòng nên dòng mới thêm phải Lưu trước.
   */
  async function fillProduct(l: EditLine) {
    if (!l.id) {
      toast.error('Dòng chưa lưu', 'Bấm "Lưu dòng lệnh" trước rồi mới bổ sung hồ sơ.')
      return
    }
    setBusy(true)
    try {
      const { filled } = await api<{ filled: string[] }>(
        `/api/dept/production/lsx/${lsxId}/lines/${l.id}/fill-product`,
        { method: 'POST', body: {} },
      )
      if (filled.length) {
        toast.success('Đã bổ sung vào hồ sơ SP', filled.join(', '))
      } else {
        toast.success(
          'Không có gì để bổ sung',
          'Dòng chưa có giá trị dùng được cho các trường hồ sơ đang trống.',
        )
      }
      router.refresh()
    } catch (e) {
      toast.error('Bổ sung thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const crumbs: { label: string; href?: string }[] = [
    { label: 'Lệnh sản xuất', href: backHref },
    { label: lsxCode },
  ]
  // 6 cột nhập + # + Chi tiết + thao tác.
  const colCount = 7 + (showCbm ? 1 : 0) + (canEdit ? 1 : 0)

  return (
    <div className="theme-v2 text-foreground flex flex-col gap-4">
      <TopProgressBar active={busy} />

      {/* ── Đầu trang ─────────────────────────────────────────────────────── */}
      <div>
        <nav className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
          {crumbs.map((b, i) => (
            <Fragment key={i}>
              {i > 0 && <span>/</span>}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span className="font-mono">{b.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              Soạn dòng lệnh <span className="font-mono">{lsxCode}</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {customerName} · mẫu cột: {template.label}
              {revision > 1 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {' '}
                  · đang ở bản chỉnh sửa lần {revision}
                </span>
              )}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Tổng: <b className="text-foreground">{totalQty.toLocaleString('vi-VN')}</b>{' '}
              SP
              {showCbm && (
                <>
                  {' · '}
                  <b className="text-foreground">
                    {totalCbm.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}
                  </b>{' '}
                  CBM
                </>
              )}{' '}
              · {groups.length} nhóm
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void reseed()} disabled={busy}>
                <Download />
                Nạp dòng từ đơn
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/print/lsx/${lsxId}`} target="_blank" rel="noopener">
                  <Printer />
                  Xem phiếu in
                </Link>
              </Button>
              <Button onClick={() => void save()} disabled={busy}>
                {busy ? <Spinner size={14} /> : <Save />}
                Lưu dòng lệnh
              </Button>
            </div>
          )}
        </div>
      </div>

      <SheetReadinessBar
        readiness={sheet}
        onlyIncomplete={onlyIncomplete}
        onToggle={setOnlyIncomplete}
      />

      {/* ── Từng nhóm (số PO / bộ sưu tập) ─────────────────────────────────── */}
      {groups.map((g) => (
        <section key={g._key} className="bg-card rounded-xl border p-3 shadow-xs">
          <div className="flex flex-wrap items-end gap-2">
            <label className={fieldLabel}>
              Tên nhóm
              <Input
                value={g.title ?? ''}
                onChange={(e) => patchGroup(g._key, { title: e.target.value })}
                disabled={!canEdit}
                placeholder="HALI - HALSTON - AMELIA"
                className={`${cellInput} w-64`}
              />
            </label>
            <label className={fieldLabel}>
              Số PO
              <Input
                value={g.po_no ?? ''}
                onChange={(e) => patchGroup(g._key, { po_no: e.target.value })}
                disabled={!canEdit}
                placeholder="PT-138-155-HG"
                className={`${cellInput} w-40 font-mono`}
              />
            </label>
            <label className={fieldLabel}>
              Khách con
              <Input
                value={g.buyer_name ?? ''}
                onChange={(e) => patchGroup(g._key, { buyer_name: e.target.value })}
                disabled={!canEdit}
                placeholder="PAPAYA 138"
                className={`${cellInput} w-36`}
              />
            </label>
            <label className={fieldLabel}>
              Ngày giao
              <Input
                type="date"
                value={g.ship_date ?? ''}
                onChange={(e) =>
                  patchGroup(g._key, { ship_date: e.target.value || null })
                }
                disabled={!canEdit}
                className={`${cellInput} w-36`}
              />
            </label>
            <span className="text-muted-foreground ml-auto text-xs">
              {g.lines.length} dòng ·{' '}
              {g.lines
                .reduce((s, l) => s + Number(l.qty ?? 0), 0)
                .toLocaleString('vi-VN')}{' '}
              SP
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className={`${th} w-8`}>#</th>
                  <th className={`${th} w-36`}>Mã SP</th>
                  <th className={th}>Tên tiếng Việt</th>
                  <th className={`${th} w-16`}>ĐVT</th>
                  <th className={`${th} w-20`}>SL</th>
                  {showCbm && <th className={`${th} w-24`}>CBM</th>}
                  <th className={`${th} w-28`}>Đợt xuất</th>
                  <th className={`${th} w-36`}>Đủ thông tin</th>
                  {canEdit && <th className={`${th} w-20`} />}
                </tr>
              </thead>
              <tbody>
                {/* LỌC CHỈ Ở TẦNG RENDER — tuyệt đối không lọc vào state `groups`,
                    `buildPayload()` phải luôn duyệt đủ dòng, nếu không bấm Lưu là
                    xoá mất các dòng đang bị ẩn. */}
                {g.lines
                  .map((l, i) => ({ l, i, r: readinessOf(l) }))
                  .filter(({ r }) => !onlyIncomplete || r.level !== 'ok')
                  .map(({ l, i, r }) => {
                    const open = openLines.has(l._key)
                    const origins = lineOrigins(l, snapOf(l))
                    const blocked = new Set(r.blocking.map((b) => b.key))
                    const badCls = (key: string) =>
                      blocked.has(key) ? 'ring-1 ring-red-400' : ''
                    return (
                      <Fragment key={l._key}>
                        <tr
                          className={`${open ? '' : 'border-b last:border-0'} ${
                            r.level === 'block'
                              ? 'border-l-2 border-l-red-500 bg-red-50/40 dark:bg-red-950/10'
                              : ''
                          }`}
                        >
                          <td className="text-muted-foreground py-1.5 tabular-nums">
                            <span className="flex items-center gap-1">
                              {r.level === 'block' && (
                                <TriangleAlert
                                  className="size-3 shrink-0 text-red-600"
                                  aria-hidden
                                />
                              )}
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input
                              ref={(el) => {
                                if (el) inputRefs.current.set(l._key, el)
                                else inputRefs.current.delete(l._key)
                              }}
                              value={l.product_code ?? ''}
                              onChange={(e) =>
                                patchLine(g._key, l._key, {
                                  product_code: e.target.value,
                                })
                              }
                              disabled={!canEdit}
                              placeholder="Thông báo sau"
                              className={`${cellInput} font-mono ${badCls('product_code')}`}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input
                              value={l.name_vi ?? ''}
                              onChange={(e) =>
                                patchLine(g._key, l._key, { name_vi: e.target.value })
                              }
                              disabled={!canEdit}
                              className={cellInput}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input
                              value={l.unit ?? ''}
                              onChange={(e) =>
                                patchLine(g._key, l._key, { unit: e.target.value })
                              }
                              disabled={!canEdit}
                              className={`${cellInput} ${badCls('unit')}`}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Input
                              type="number"
                              min={0}
                              value={String(l.qty ?? 0)}
                              onChange={(e) =>
                                patchLine(g._key, l._key, { qty: Number(e.target.value) })
                              }
                              disabled={!canEdit}
                              className={`${cellInput} text-right tabular-nums ${badCls('qty')}`}
                            />
                          </td>
                          {showCbm && (
                            <td className="py-1.5 pr-2">
                              <Input
                                type="number"
                                step="0.001"
                                min={0}
                                value={l.cbm == null ? '' : String(l.cbm)}
                                onChange={(e) =>
                                  patchLine(g._key, l._key, {
                                    cbm:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                disabled={!canEdit}
                                className={`${cellInput} text-right tabular-nums`}
                              />
                            </td>
                          )}
                          <td className="py-1.5 pr-2">
                            <Input
                              value={l.ship_label ?? l.ship_date ?? ''}
                              onChange={(e) =>
                                patchLine(g._key, l._key, { ship_label: e.target.value })
                              }
                              disabled={!canEdit}
                              placeholder="w37.26"
                              className={cellInput}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <button
                              onClick={() => toggleLine(l._key)}
                              aria-expanded={open}
                              className={`hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 transition-colors ${
                                open ? 'bg-accent' : ''
                              }`}
                              title="Mở chi tiết: vật liệu · đóng gói · ghi chú · kiểm tra hồ sơ"
                            >
                              <LineMeter meters={r.meters} />
                              <ChevronDown
                                className={`text-muted-foreground size-3 transition-transform ${open ? 'rotate-180' : ''}`}
                              />
                            </button>
                          </td>
                          {canEdit && (
                            <td className="py-1.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => addLine(g._key, l)}
                                title="Tách đợt xuất — chép dòng này thành dòng mới"
                                className="text-primary px-1 font-medium hover:underline"
                              >
                                Tách
                              </button>
                              <button
                                onClick={() => removeLine(g._key, l._key)}
                                title="Xoá dòng"
                                className="text-destructive px-1 font-medium hover:underline"
                              >
                                Xoá
                              </button>
                            </td>
                          )}
                        </tr>
                        {open && (
                          <tr className="border-b last:border-0">
                            <td colSpan={colCount} className="pt-1 pb-3">
                              <div className="bg-muted/30 rounded-lg border p-3">
                                {/* Ba ô này IN TRÊN PHIẾU mà trước đây Sales
                                    không sửa được ở đâu — chúng chính là phần
                                    "máy lấy sẵn từ hồ sơ SP". */}
                                <div className="mb-3 grid gap-3 border-b pb-3 sm:grid-cols-3">
                                  {(
                                    [
                                      [
                                        'customer_item_code',
                                        'Mã khách',
                                        l.customer_item_code,
                                      ],
                                      ['name_foreign', 'Tên nước ngoài', l.name_foreign],
                                      ['barcode', 'Số barcode', l.barcode],
                                    ] as const
                                  ).map(([field, label, value]) => (
                                    <label key={field} className={fieldLabel}>
                                      {label}
                                      <Input
                                        value={value ?? ''}
                                        onChange={(e) =>
                                          patchLine(g._key, l._key, {
                                            [field]: e.target.value,
                                          })
                                        }
                                        disabled={!canEdit}
                                        className={`${cellInput} bg-card ${
                                          field === 'barcode' ? 'font-mono' : ''
                                        }`}
                                      />
                                      <SourceChip
                                        origin={origins[field] as FieldOrigin}
                                        refValue={snapOf(l)?.[field] ?? null}
                                        productId={l.product_id}
                                        tab={gapTabOf(l, field)}
                                        onRestore={
                                          canEdit && origins[field] === 'edited'
                                            ? () => revertField(g._key, l, field)
                                            : undefined
                                        }
                                      />
                                    </label>
                                  ))}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {specCols.map((c) => (
                                    <label key={colKey(c)} className={fieldLabel}>
                                      {c.label}
                                      <Textarea
                                        rows={2}
                                        value={l.specs?.[colKey(c)] ?? ''}
                                        onChange={(e) =>
                                          patchLine(g._key, l._key, {
                                            specs: {
                                              ...(l.specs ?? {}),
                                              [colKey(c)]: e.target.value,
                                            },
                                          })
                                        }
                                        disabled={!canEdit}
                                        placeholder={c.hint}
                                        className="bg-card min-h-14 px-2 py-1.5 text-xs"
                                      />
                                      <SourceChip
                                        origin={origins[`spec.${colKey(c)}`] ?? null}
                                        refValue={snapOf(l)?.specs[colKey(c)] ?? null}
                                        pending={isPendingText(l.specs?.[colKey(c)])}
                                        productId={l.product_id}
                                        tab="thong-so"
                                        onRestore={
                                          canEdit &&
                                          origins[`spec.${colKey(c)}`] === 'edited'
                                            ? () =>
                                                revertField(
                                                  g._key,
                                                  l,
                                                  `spec.${colKey(c)}`,
                                                )
                                            : undefined
                                        }
                                      />
                                    </label>
                                  ))}
                                  <label className={fieldLabel}>
                                    Đóng gói
                                    <Input
                                      value={l.packing ?? ''}
                                      onChange={(e) =>
                                        patchLine(g._key, l._key, {
                                          packing: e.target.value,
                                        })
                                      }
                                      disabled={!canEdit}
                                      placeholder="4 cái/ thùng"
                                      className={`${cellInput} bg-card`}
                                    />
                                    <SourceChip
                                      origin={origins.packing ?? null}
                                      refValue={snapOf(l)?.packing ?? null}
                                      productId={l.product_id}
                                      tab="dong-goi"
                                      onRestore={
                                        canEdit && origins.packing === 'edited'
                                          ? () => revertField(g._key, l, 'packing')
                                          : undefined
                                      }
                                    />
                                  </label>
                                  <label className={fieldLabel}>
                                    Ghi chú
                                    <Input
                                      value={l.note ?? ''}
                                      onChange={(e) =>
                                        patchLine(g._key, l._key, {
                                          note: e.target.value,
                                        })
                                      }
                                      disabled={!canEdit}
                                      className={`${cellInput} bg-card`}
                                    />
                                  </label>
                                </div>
                                {checkCols.length > 0 && (
                                  <div className="mt-3 border-t pt-2">
                                    <div className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                                      Kiểm tra hồ sơ (nội bộ — không in trên phiếu)
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                      {checkCols.map((c) => (
                                        <label key={colKey(c)} className={fieldLabel}>
                                          {c.label}
                                          <Input
                                            value={l.checks?.[colKey(c)] ?? ''}
                                            onChange={(e) =>
                                              patchLine(g._key, l._key, {
                                                checks: {
                                                  ...(l.checks ?? {}),
                                                  [colKey(c)]: e.target.value,
                                                },
                                              })
                                            }
                                            disabled={!canEdit}
                                            placeholder={c.hint ?? 'Có / Không'}
                                            className={`${cellInput} bg-card`}
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Ghi ngược về hồ sơ SP — chỉ hiện khi hồ sơ
                                  còn trường trống; server chỉ điền chỗ trống. */}
                                {canEdit &&
                                  l.product_id &&
                                  (snapOf(l)?.gaps.length ?? 0) > 0 &&
                                  (() => {
                                    const gaps = snapOf(l)!.gaps
                                    const pushable = pushableGaps(l)
                                    const tabs = [...new Set(gaps.map((gp) => gp.tab))]
                                    return (
                                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2">
                                        <span className="text-muted-foreground text-[11px]">
                                          Hồ sơ SP đang thiếu:{' '}
                                          {gaps.map((gp) => gp.label).join(' · ')}
                                        </span>
                                        {tabs.map((tab) => (
                                          <Link
                                            key={tab}
                                            href={`/technical/products/${l.product_id}/${tab}`}
                                            target="_blank"
                                            rel="noopener"
                                            className="text-primary inline-flex items-center gap-0.5 text-[11px] hover:underline"
                                          >
                                            mở tab {TAB_LABEL[tab]}
                                            <ExternalLink
                                              className="size-2.5"
                                              aria-hidden
                                            />
                                          </Link>
                                        ))}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="bg-card ml-auto"
                                          disabled={busy || !pushable.length}
                                          onClick={() => void fillProduct(l)}
                                          title={
                                            pushable.length
                                              ? 'Chỉ điền trường hồ sơ đang trống — dùng giá trị ĐÃ LƯU của dòng'
                                              : 'Dòng chưa có giá trị nào để đẩy lên hồ sơ'
                                          }
                                        >
                                          <Upload />
                                          {pushable.length
                                            ? `Bổ sung vào hồ sơ SP: ${pushable.join(', ')}`
                                            : 'Bổ sung vào hồ sơ SP'}
                                        </Button>
                                      </div>
                                    )
                                  })()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => addLine(g._key)}
            >
              + Thêm dòng
            </Button>
          )}
        </section>
      ))}

      {/* ── Thanh lưu ghim đáy — sửa tới đâu lưu được tới đó ───────────────── */}
      {canEdit && (
        <div className="bg-card/95 sticky bottom-0 z-10 -mx-1 rounded-t-xl border px-3 py-2.5 shadow-xs backdrop-blur">
          <div className="flex flex-wrap items-end gap-2">
            {/* Lệnh NHÁP chưa ai duyệt nên chưa có gì để "chỉnh sửa" — ô lý do
                chỉ có nghĩa với lệnh đã qua duyệt (0117). */}
            {isDraft ? (
              <span className="text-muted-foreground flex-1 text-xs">
                Lệnh đang là <b className="text-foreground">nháp</b> — sửa thoải mái, Giám
                đốc chưa nhận được gì. Soạn xong bấm “Gửi GĐ duyệt”.
              </span>
            ) : (
              <label className="text-muted-foreground flex min-w-56 flex-1 flex-col gap-1 text-xs">
                Lý do chỉnh sửa (ghi vào bản phát lại — xưởng đọc để biết đổi gì)
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Khách chốt lại số lượng SIGRID, thêm bộ IMANI"
                  className="bg-background h-8 text-xs"
                />
              </label>
            )}
            <span className="text-muted-foreground text-xs">
              {totalQty.toLocaleString('vi-VN')} SP · {groups.length} nhóm
            </span>
            {/* "Lưu" KHÔNG BAO GIỜ bị chặn — bản dở phải cất được. */}
            <Button variant="outline" onClick={() => void save()} disabled={busy}>
              {busy ? <Spinner size={14} /> : <Save />}
              Lưu dòng lệnh
            </Button>
            {isDraft && (
              <Button
                onClick={() => void submitForApproval()}
                disabled={busy || sheet.blocked.length > 0}
                title={
                  sheet.blocked.length
                    ? `${sheet.blocked.length} dòng còn thiếu Mã SP / Số lượng / ĐVT`
                    : undefined
                }
              >
                {busy ? <Spinner size={14} /> : <SendHorizontal />}
                Gửi GĐ duyệt
              </Button>
            )}

            {isDraft && sheet.blocked.length > 0 && (
              <div className="basis-full text-xs">
                <span className="font-medium text-red-600 dark:text-red-400">
                  <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />
                  Chưa gửi được: {sheet.blocked.length} dòng thiếu Mã SP / Số lượng / ĐVT
                </span>
                <span className="text-muted-foreground ml-2">
                  {sheet.blocked.slice(0, 6).map((b, i) => (
                    <Fragment key={`${b.groupTitle}-${b.index}`}>
                      {i > 0 && ' · '}
                      <button
                        onClick={() => jumpTo(b.groupTitle, b.index)}
                        className="hover:text-foreground underline underline-offset-2"
                        title={`Thiếu ${b.issues}`}
                      >
                        {b.groupTitle} #{b.index}
                      </button>
                    </Fragment>
                  ))}
                  {sheet.blocked.length > 6 &&
                    ` … và ${sheet.blocked.length - 6} dòng nữa`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

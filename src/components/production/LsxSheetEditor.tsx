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
 * → DÒNG. Một mã SP có thể lặp nhiều dòng, mỗi dòng một số lượng và một đợt xuất.
 *
 * LỆNH BÁM THEO ĐƠN (chốt 07/08/2026): màn này KHÔNG thêm/xoá dòng và KHÔNG sửa
 * thông tin sản phẩm — mã SP, tên, ĐVT, số lượng, CBM, mã khách, tên nước ngoài,
 * barcode, đóng gói đều chỉ đọc. Muốn thêm/bớt mặt hàng thì sửa ĐƠN HÀNG; muốn
 * đổi thông tin SP thì sửa HỒ SƠ SP (chip nguồn có link mở thẳng tab tương ứng).
 * Ở đây chỉ còn: đợt xuất, quy cách theo mẫu cột của khách, ghi chú dòng — và
 * nút đẩy ngược giá trị lên hồ sơ SP khi hồ sơ còn trống.
 *
 * Bố cục v2 (06/08/2026): bản cũ trải ~15 cột nhập trên một bảng cuộn ngang —
 * ô nào cũng bé. Nay bảng chỉ bày Ảnh · Mã SP · Tên · ĐVT · SL · CBM · Đợt xuất;
 * nhận diện / quy cách / đóng gói / ghi chú nằm trong PHẦN MỞ RỘNG của từng dòng
 * (bấm "Chi tiết") — hết cuộn ngang, ô nhập rộng.
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

/**
 * Ô CHỈ ĐỌC cho thông tin sản phẩm cố định (chốt 07/08/2026: "thông tin sản
 * phẩm có tính cố định không cho sửa trong giao diện LSX").
 *
 * Cố tình KHÔNG dùng `<Input disabled>`: ô nhập xám vẫn trông như ô nhập, người
 * dùng bấm vào rồi mới biết gõ không được. Chữ trơn nói ngay "cái này lấy từ
 * nơi khác". `bad` = trường trống mà gate gửi duyệt đang chặn.
 */
function Fixed({
  value,
  mono,
  right,
  bad,
}: {
  value?: string | null
  mono?: boolean
  right?: boolean
  bad?: boolean
}) {
  const v = (value ?? '').trim()
  return (
    <div
      className={`px-2 py-1.5 text-xs ${mono ? 'font-mono' : ''} ${
        right ? 'text-right tabular-nums' : ''
      } ${bad ? 'rounded-md ring-1 ring-red-400' : ''} ${
        v ? '' : 'text-muted-foreground'
      }`}
      title={v || undefined}
    >
      {v || '—'}
    </div>
  )
}

/** Ảnh SP trong bảng soạn dòng — nhận mặt hàng bằng mắt, khỏi dò mã. */
function LineImage({ url }: { url?: string }) {
  if (!url) return <div className="bg-muted size-9 rounded" aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-9 rounded object-contain" />
}

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
  imageUrls = {},
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
  /** fileId → URL ảnh SP đã ký (07/08/2026) — cột ảnh nhận diện trong bảng. */
  imageUrls?: Record<string, string>
  backHref: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [groups, setGroups] = useState<EditGroup[]>(
    initial.map((g) => ({ ...g, _key: newKey(), lines: g.lines.map(toEditLine) })),
  )
  // Dòng đang mở phần chi tiết (nhận diện/quy cách/đóng gói/ghi chú).
  const [openLines, setOpenLines] = useState<Set<string>>(new Set())
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  // Ô nhập theo khoá dòng — để nhảy tới đúng ô thiếu khi bấm từ thanh gửi duyệt.
  const inputRefs = useRef(new Map<string, HTMLInputElement>())

  const specCols = specColumnsOf(template)
  const showCbm = hasCbm(template)

  const readinessOpts = useMemo(
    () => ({
      specKeys: specCols.map((c) => ({ key: colKey(c), label: c.label })),
      // Khối 'Kiểm tra hồ sơ' đã bỏ khỏi màn soạn (07/08/2026) nên không còn
      // tính vào độ đầy đủ của dòng — thước đo phải khớp thứ màn hình thật sự hỏi.
      checkKeys: [],
      needCbm: showCbm,
    }),
    [specCols, showCbm],
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
  // # · Ảnh · Mã SP · Tên · ĐVT · SL · Đợt xuất · Đủ thông tin (+ CBM nếu mẫu có).
  // Cột thao tác đã bỏ: LSX bám theo đơn, không thêm/xoá dòng ở đây (07/08/2026).
  const colCount = 8 + (showCbm ? 1 : 0)

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
                  <th className={`${th} w-12`}>Ảnh</th>
                  <th className={`${th} w-36`}>Mã SP</th>
                  <th className={th}>Tên tiếng Việt</th>
                  <th className={`${th} w-16`}>ĐVT</th>
                  <th className={`${th} w-20`}>SL</th>
                  {showCbm && <th className={`${th} w-24`}>CBM</th>}
                  <th className={`${th} w-28`}>Đợt xuất</th>
                  <th className={`${th} w-36`}>Đủ thông tin</th>
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
                          {/* Ảnh SP — nhận mặt hàng bằng mắt, khỏi dò mã (07/08/2026). */}
                          <td className="py-1.5 pr-2">
                            <LineImage url={imageUrls[l.image_file_id ?? '']} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Fixed
                              value={l.product_code}
                              mono
                              bad={blocked.has('product_code')}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Fixed value={l.name_vi} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Fixed value={l.unit} bad={blocked.has('unit')} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <Fixed
                              value={l.qty == null ? null : l.qty.toLocaleString('vi-VN')}
                              right
                              bad={blocked.has('qty')}
                            />
                          </td>
                          {showCbm && (
                            <td className="py-1.5 pr-2">
                              <Fixed value={l.cbm == null ? null : String(l.cbm)} right />
                            </td>
                          )}
                          <td className="py-1.5 pr-2">
                            {/*
                              Đợt xuất là NGÀY, không phải chữ tự do (chốt
                              07/08/2026). Ô cũ nhận text nên dữ liệu thật lẫn
                              lộn: "w37.26" (tuần), "11/01/27" (ngày viết tay,
                              lại trùng ship_date đã có), và cả một đoạn ghi chú
                              dài — không lọc/xếp/cảnh báo hạn gì được. Ô nhóm
                              ("Ngày giao") vốn đã là date; nay dòng theo cho khớp.
                              Ghi thẳng ship_date và xoá ship_label để hai cột
                              không còn mâu thuẫn nhau.
                            */}
                            <Input
                              type="date"
                              value={l.ship_date ?? ''}
                              onChange={(e) =>
                                patchLine(g._key, l._key, {
                                  ship_date: e.target.value || null,
                                  ship_label: null,
                                })
                              }
                              disabled={!canEdit}
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
                              title="Mở chi tiết: nhận diện · quy cách · đóng gói · ghi chú"
                            >
                              <LineMeter meters={r.meters} />
                              <ChevronDown
                                className={`text-muted-foreground size-3 transition-transform ${open ? 'rotate-180' : ''}`}
                              />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b last:border-0">
                            <td colSpan={colCount} className="pt-1 pb-3">
                              <div className="bg-muted/30 rounded-lg border p-3">
                                {/*
                                  Nhận diện SP: LẤY TỪ HỒ SƠ SP, chỉ đọc
                                  (07/08/2026). Sửa thì sửa ở hồ sơ SP rồi lệnh
                                  lấy lại — chip nguồn có sẵn link "mở hồ sơ".
                                */}
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
                                    <div key={field} className={fieldLabel}>
                                      {label}
                                      <Fixed value={value} mono={field === 'barcode'} />
                                      <SourceChip
                                        origin={origins[field] as FieldOrigin}
                                        refValue={snapOf(l)?.[field] ?? null}
                                        productId={l.product_id}
                                        tab={gapTabOf(l, field)}
                                      />
                                    </div>
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
                                  {/* Đóng gói: quy cách của SP → chỉ đọc, sửa ở hồ sơ SP. */}
                                  <div className={fieldLabel}>
                                    Đóng gói
                                    <Fixed value={l.packing} />
                                    <SourceChip
                                      origin={origins.packing ?? null}
                                      refValue={snapOf(l)?.packing ?? null}
                                      productId={l.product_id}
                                      tab="dong-goi"
                                    />
                                  </div>
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
                                {/* Khối "Kiểm tra hồ sơ" (BOM/Bản vẽ/Mẫu/Showroom)
                                    đã BỎ HẲN khỏi màn soạn (07/08/2026) — nó
                                    không in trên phiếu, không xuất Excel, và
                                    trạng thái BOM/mẫu đã có ở hồ sơ SP. Giá trị
                                    cũ vẫn nằm trong DB, chỉ là không sửa ở đây. */}
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
                                            href={`/products/${l.product_id}/${tab}`}
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

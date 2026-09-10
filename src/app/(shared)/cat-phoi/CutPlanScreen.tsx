'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, FileSpreadsheet, PackageOpen } from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import { useToast } from '@/components/ui/Toast'
import { ApiError, apiErrorText } from '@/lib/api'
import { planCut } from '@/lib/cut-plan/optimize'
import { CUT_PLAN_STORAGE_KEY, CUT_PLAN_STORAGE_KEY_V2 } from '@/lib/cut-plan/storage'
import {
  DEFAULT_STOCK_LENGTH_MM,
  blankLine,
  isBlankLine,
  lineHasData,
  planTotals,
  specKey,
  type CutLine,
  type CutPlanDoc,
  type CutPlanResult,
} from '@/lib/cut-plan/types'
import { CutBomDialog } from './CutBomDialog'
import { CutLinesGrid } from './CutLinesGrid'
import { CutPasteDialog, type PasteMode } from './CutPasteDialog'
import { CutResults } from './CutResults'
import { CutSpecTable } from './CutSpecTable'
import { useVnNumber } from './vn-number'

/**
 * QUY CẮT PHÔI — màn chính, cùng nhịp với phần mềm Steel Cutting cũ của xưởng:
 * đầu phiếu (Project / Item / Available Length) → lưới chi tiết → Run → sơ đồ
 * cắt + Used + Diminish → Export XLS. Khác bản cũ ở chỗ lưới không giới hạn
 * dòng, chọn nhiều để xoá, dán được từ Excel, và bản nháp tự lưu trong trình
 * duyệt (`localStorage`) để nhập dở không mất.
 *
 * Tính theo NÚT chứ không tự tính mỗi phím: bảng DP trên vài trăm chi tiết mất
 * tới cả giây, gõ số mà lag là người ta tưởng máy hỏng. Đổi số liệu sau khi tính
 * thì kết quả mờ đi kèm câu nhắc bấm lại.
 */

let seq = 1
const nextKey = () => seq++

function freshDoc(): CutPlanDoc {
  return {
    title: '',
    item: '',
    stock_length_mm: DEFAULT_STOCK_LENGTH_MM,
    stock_by_spec: {},
    lines: Array.from({ length: 5 }, () => blankLine(nextKey())),
  }
}

/** Bản nháp đã lưu — v3 (quy cách theo dòng) hoặc v2 (quy cách ở đầu phiếu). */
type SavedDoc = Partial<CutPlanDoc> & { spec?: string; lines?: Partial<CutLine>[] }

function readSavedDoc(): CutPlanDoc | null {
  const v3 = localStorage.getItem(CUT_PLAN_STORAGE_KEY)
  const raw = v3 ?? localStorage.getItem(CUT_PLAN_STORAGE_KEY_V2)
  if (!raw) return null
  const saved = JSON.parse(raw) as SavedDoc
  if (!Array.isArray(saved.lines) || saved.lines.length === 0) return null
  const legacySpec = v3 ? '' : (saved.spec ?? '')
  const lines = saved.lines.map((l) => ({
    ...blankLine(nextKey()),
    ...l,
    qty: intQty(l.qty ?? ''),
    spec: l.spec ?? legacySpec,
    key: nextKey(),
  }))
  return {
    title: saved.title ?? '',
    item: saved.item ?? '',
    stock_length_mm: saved.stock_length_mm || DEFAULT_STOCK_LENGTH_MM,
    stock_by_spec:
      saved.stock_by_spec && typeof saved.stock_by_spec === 'object'
        ? saved.stock_by_spec
        : {},
    lines,
  }
}

/**
 * Chữ ký của phần SỐ đi vào thuật toán (cây + dài + SL theo thứ tự dòng). Tên
 * chi tiết và ghi chú không nằm trong đây: sửa chúng không đổi sơ đồ (bảng kết
 * quả đọc tên trực tiếp từ lưới), nên không được bật nhãn "tính lại".
 */
const sigOf = (d: CutPlanDoc) =>
  JSON.stringify([
    d.stock_length_mm,
    d.stock_by_spec,
    d.lines.map((l) => [l.key, l.length_mm, l.qty, specKey(l.spec)]),
  ])

/** SL trong bản nháp cũ (trước khi SL bị ép nguyên) có thể là 2,5 → làm tròn. */
const intQty = (q: number | ''): number | '' =>
  typeof q === 'number' ? Math.max(1, Math.round(q)) : ''

export function CutPlanScreen() {
  const toast = useToast()
  const [doc, setDoc] = useState<CutPlanDoc>(freshDoc)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [plan, setPlan] = useState<CutPlanResult | null>(null)
  const [computedSig, setComputedSig] = useState('')
  const [busy, setBusy] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [bomOpen, setBomOpen] = useState(false)
  const loaded = useRef(false)

  // ── localStorage: nạp một lần sau khi mount, lưu mỗi khi đổi ─────────────
  useEffect(() => {
    try {
      const saved = readSavedDoc()
      // Đồng bộ state với localStorage bên ngoài — ngoại lệ hợp lệ của luật.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDoc(saved)
    } catch {
      // dữ liệu hỏng → dùng form trống
    }
    loaded.current = true
  }, [])
  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(CUT_PLAN_STORAGE_KEY, JSON.stringify(doc))
    } catch {
      // hết quota → bỏ qua
    }
  }, [doc])

  const sig = useMemo(() => sigOf(doc), [doc])
  const stale = plan != null && sig !== computedSig
  const skippedMap = useMemo(
    () => new Map(plan && !stale ? plan.skipped.map((s) => [s.key, s.reason]) : []),
    [plan, stale],
  )

  const summary = useMemo(() => {
    let lines = 0
    let pieces = 0
    for (const l of doc.lines) {
      if (!lineHasData(l)) continue
      lines += 1
      if (typeof l.qty === 'number') pieces += l.qty
    }
    return { lines, pieces }
  }, [doc.lines])
  const hasData = summary.lines > 0
  const stockBind = useVnNumber({
    value: doc.stock_length_mm || '',
    onValueChange: (v) => setDoc((d) => ({ ...d, stock_length_mm: v === '' ? 0 : v })),
    col: 'length_mm',
  })

  function compute() {
    if (!(doc.stock_length_mm > 0)) {
      toast.error('Chưa nhập chiều dài cây tiêu chuẩn')
      return
    }
    // Bật thanh tiến trình TRƯỚC rồi mới tính: bảng DP trên nhiều chiều dài khác
    // nhau có thể mất tới ~1,5 s (ngân sách SHP) và chạy đồng bộ — không nhường
    // một nhịp cho React vẽ thì nút bấm xong đứng im, người dùng bấm tiếp.
    setBusy(true)
    setTimeout(() => {
      try {
        const r = planCut(doc)
        const t = planTotals(r)
        if (t.pieces_total === 0 && t.errors === 0) {
          setPlan(null)
          toast.error(
            'Chưa có chi tiết nào để tính',
            r.skipped.length
              ? `${r.skipped.length} dòng thiếu chiều dài hoặc số lượng.`
              : 'Nhập ít nhất một dòng có dài cắt và số lượng.',
          )
          return
        }
        setPlan(r)
        setComputedSig(sig)
        toast.success(
          `${t.bars} cây${t.groups > 1 ? ` · ${t.groups} quy cách` : ''} · hao hụt ${t.waste_pct.toLocaleString('vi-VN')}%`,
          t.errors > 0
            ? `${t.errors} dòng không xếp được — xem cảnh báo bên dưới.`
            : `${t.pieces_total} chi tiết đã bố trí.`,
        )
      } finally {
        setBusy(false)
      }
    }, 0)
  }

  function applyRows(
    rows: Omit<CutLine, 'key'>[],
    mode: PasteMode,
    meta?: { item: string; title: string; stockBySpec: Record<string, number> },
  ) {
    const fresh = rows.map((r) => ({ ...r, key: nextKey() }))
    setDoc((d) => ({
      ...d,
      // Đầu phiếu: nạp từ hồ sơ SP thì điền mã hàng / tên đợt nếu đang trống.
      item: meta && !d.item ? meta.item : d.item,
      title: meta && !d.title ? meta.title : d.title,
      // Cây BOM gợi ý chỉ điền cho quy cách CHƯA có cây riêng — không ghi đè
      // con số người dùng đã chỉnh.
      stock_by_spec: meta ? { ...meta.stockBySpec, ...d.stock_by_spec } : d.stock_by_spec,
      lines:
        mode === 'replace'
          ? fresh
          : [...d.lines.filter((l) => !isBlankLine(l)), ...fresh],
    }))
    setSelected(new Set())
  }

  function setStockFor(key: string, v: number | '') {
    setDoc((d) => {
      const next = { ...d.stock_by_spec }
      if (v === '') delete next[key]
      else next[key] = v
      return { ...d, stock_by_spec: next }
    })
  }

  async function exportExcel() {
    if (!(doc.stock_length_mm > 0)) {
      toast.error('Chưa nhập chiều dài cây tiêu chuẩn')
      return
    }
    setBusy(true)
    try {
      // File nhị phân — `api()` chỉ nói JSON nên gọi fetch thẳng cho riêng chỗ
      // này, nhưng giữ đúng hai thói quen của nó: 401 → về trang đăng nhập,
      // lỗi zod → đọc `issues` ra câu người dùng hiểu (qua `ApiError`).
      const res = await fetch('/api/dept/production/cut-plan/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(doc),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string
          code?: string
          issues?: unknown
        }
        throw new ApiError(res.status, j.error ?? `HTTP ${res.status}`, j.code, j.issues)
      }
      const blob = await res.blob()
      const m = /filename\*=UTF-8''([^;]+)/.exec(
        res.headers.get('content-disposition') ?? '',
      )
      const name = m ? decodeURIComponent(m[1]) : 'quy-cat.xlsx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất Excel', name)
    } catch (e) {
      toast.error(
        'Xuất Excel thất bại',
        apiErrorText(e, e instanceof Error ? e.message : 'Có lỗi, thử lại'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Quy cắt phôi' }]}
        title="Quy cắt phôi"
        description="Nhập chi tiết cần cắt (gõ tay, dán từ Excel hoặc nạp từ hồ sơ sản phẩm), máy gom theo quy cách vật liệu và xếp sơ đồ cắt trên cây tiêu chuẩn của từng loại để ít cây nhất, ít hao hụt nhất."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              <b className="t-data">{summary.lines}</b> dòng ·{' '}
              <b className="t-data">{summary.pieces.toLocaleString('vi-VN')}</b> chi tiết
            </span>
            {plan && !stale && <Badge tone="green">Đã tính</Badge>}
            {stale && <Badge tone="amber">Số liệu đã đổi — tính lại</Badge>}
          </div>
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setBomOpen(true)}>
              <PackageOpen aria-hidden /> Nạp từ hồ sơ SP
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!hasData || busy}
              onClick={() => void exportExcel()}
            >
              {busy ? <Spinner size={14} /> : <FileSpreadsheet aria-hidden />} Xuất Excel
            </Button>
            <Button type="button" onClick={compute}>
              <Calculator aria-hidden /> Tính quy cắt
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="t-title">Đầu phiếu</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="t-label">Tên đợt cắt</span>
            <Input
              value={doc.title}
              onChange={(e) => setDoc((d) => ({ ...d, title: e.target.value }))}
              placeholder="VD: Ghế Chelsea đợt 1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="t-label">Mã hàng</span>
            <Input
              value={doc.item}
              onChange={(e) => setDoc((d) => ({ ...d, item: e.target.value }))}
              placeholder="VD: S0005HG-AL"
              className="t-data"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="t-label">Cây tiêu chuẩn mặc định (mm)</span>
            <Input {...stockBind} className="t-data text-right" />
            <span className="text-muted-foreground text-xs">
              Quy cách nào cây khác thì ghi riêng ở bảng quy cách bên dưới lưới.
            </span>
          </label>
        </CardContent>
      </Card>

      <CutLinesGrid
        lines={doc.lines}
        selected={selected}
        nextKey={nextKey}
        onLines={(lines) => setDoc((d) => ({ ...d, lines }))}
        onSelected={setSelected}
        onOpenPaste={() => setPasteOpen(true)}
        skipped={skippedMap}
      />

      <CutSpecTable doc={doc} onStock={setStockFor} />

      {plan && <CutResults doc={doc} plan={plan} stale={stale} />}

      <CutPasteDialog
        open={pasteOpen}
        hasData={hasData}
        onClose={() => setPasteOpen(false)}
        onConfirm={applyRows}
      />
      <CutBomDialog
        open={bomOpen}
        hasData={hasData}
        onClose={() => setBomOpen(false)}
        onConfirm={applyRows}
      />
    </div>
  )
}

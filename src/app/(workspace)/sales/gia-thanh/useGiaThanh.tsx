'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { guessDecimalSep, parsePriceText, type DecimalSep } from '@/lib/price-paste'
import {
  matchPlanRows,
  parsePlanBlock,
  parsePlanPaste,
  planCheck,
  planDeviationPct,
  PLAN_WARN_PCT,
  type PlanTarget,
} from '@/lib/plan-cost'
import {
  EMPTY_PLAN_DRAFT,
  planDraftDirty,
  resolvePlanDraft,
  type PlanDraft,
  type PlanResolved,
} from '@/lib/plan-cost-draft'
import type {
  PlanCostBoard,
  PlanCostRow,
} from '@/modules/dept/technical/plan-cost.service'

export type Missing = { msg: string; focus?: string }
export type View = 'missing' | 'fob_only' | 'all'
export type Currency = 'USD' | 'VND'
export type DraftKey = 'direct' | 'overhead' | 'profit' | 'price'
export type PasteMode = { kind: 'table' } | { kind: 'block'; row: PlanCostRow }

/** Khách của dòng — SP chưa rõ khách gom vào một nhóm có tên. */
export const custOf = (r: PlanCostRow) => r.customer_name ?? '— chưa rõ khách —'

/**
 * State + xử lý bảng GIÁ THÀNH KẾ HOẠCH (khuôn F, dựng lại 08/10/2026). Giữ
 * nguyên luật cũ: DÁN / GÕ chỉ điền vào ô, chưa lưu — soát rồi bấm Lưu MỘT lần;
 * server kiểm cả lô, một dòng lệch là từ chối cả lô.
 */
export function useGiaThanh(board: PlanCostBoard, canManage: boolean) {
  const toast = useToast()
  const router = useRouter()
  const s = board.stats
  const [draft, setDraft] = useState<Record<string, PlanDraft>>({})
  const [view, setView] = useState<View>(s.with_plan === s.total ? 'all' : 'missing')
  const [customer, setCustomer] = useState('all')
  const [q, setQ] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [sep, setSep] = useState<DecimalSep>('.')
  const [fxRate, setFxRate] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const setCell = (id: string, k: DraftKey, v: string) =>
    setDraft((p) => ({ ...p, [id]: { ...(p[id] ?? EMPTY_PLAN_DRAFT), [k]: v } }))
  const clearRow = (id: string) =>
    setDraft((p) => {
      const n = { ...p }
      delete n[id]
      return n
    })
  const toggleOpen = (id: string) =>
    setOpen((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const customers = useMemo(
    () =>
      [...s.missing_by_customer].sort(
        (a, b) => b.missing - a.missing || a.customer.localeCompare(b.customer, 'vi'),
      ),
    [s.missing_by_customer],
  )

  /** Kết quả kiểm từng dòng đang sửa — nguồn chung cho tô dòng, chân bảng, thanh đáy. */
  const resolved = useMemo(() => {
    const m = new Map<string, PlanResolved>()
    for (const r of board.rows) {
      const d = draft[r.product_id]
      if (!planDraftDirty(d)) continue
      m.set(r.product_id, resolvePlanDraft(d, r, sep, currency))
    }
    return m
  }, [board.rows, draft, sep, currency])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return board.rows.filter((r) => {
      const dirty = resolved.has(r.product_id)
      if (!dirty) {
        if (view === 'missing' && r.price != null) return false
        if (view === 'fob_only' && !(r.price != null && r.direct == null)) return false
      }
      if (customer !== 'all' && custOf(r) !== customer) return false
      if (!needle) return true
      return `${r.code} ${r.customer_item_code ?? ''} ${r.name} ${r.customer_name ?? ''}`
        .toLowerCase()
        .includes(needle)
    })
  }, [board.rows, view, customer, q, resolved])

  const dirty = useMemo(
    () => board.rows.filter((r) => resolved.has(r.product_id)),
    [board.rows, resolved],
  )
  const bad = useMemo(
    () => dirty.filter((r) => !resolved.get(r.product_id)!.ok),
    [dirty, resolved],
  )
  /** FOB mới lệch quá 30% so với số đang có — cảnh báo, không chặn. */
  const warn = useMemo(
    () =>
      dirty.filter((r) => {
        const x = resolved.get(r.product_id)!
        if (!x.ok || r.currency !== currency) return false
        const dev = planDeviationPct(x.price, r.price)
        return dev != null && Math.abs(dev) > PLAN_WARN_PCT
      }),
    [dirty, resolved, currency],
  )
  const fxBad = fxRate.trim() !== '' && parsePriceText(fxRate, sep) == null

  const missing = useMemo<Missing[]>(() => {
    const m: Missing[] = []
    if (!canManage)
      return [{ msg: 'chỉ Bán hàng / Kỹ thuật nạp được giá thành kế hoạch' }]
    if (bad.length)
      m.push({
        msg: `${bad.length} dòng chưa hợp lệ (${bad[0].code}: ${(resolved.get(bad[0].product_id) as { reason: string }).reason})`,
        focus: `gt-${bad[0].product_id}-price`,
      })
    if (fxBad) m.push({ msg: 'tỷ giá không phải số', focus: 'gt-fx' })
    if (dirty.length && !source.trim())
      m.push({ msg: 'chưa ghi nguồn — tên bản báo giá đã lấy số', focus: 'gt-source' })
    if (!dirty.length && !bad.length) m.push({ msg: 'chưa gõ số nào' })
    return m
  }, [canManage, bad, resolved, fxBad, dirty.length, source])

  /* ── dán: bảng 5 cột hoặc khối chi phí của một SP ─────────────────────── */
  const [paste, setPaste] = useState<PasteMode | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteSep, setPasteSep] = useState<DecimalSep>('.')
  const [touchedSep, setTouchedSep] = useState(false)
  const targets = useMemo<PlanTarget[]>(
    () =>
      board.rows.map((r) => ({
        product_id: r.product_id,
        code: r.code,
        customer_code: r.customer_item_code,
      })),
    [board.rows],
  )
  const byId = useMemo(
    () => new Map(board.rows.map((r) => [r.product_id, r])),
    [board.rows],
  )
  const table = useMemo(() => {
    if (paste?.kind !== 'table' || !pasteText.trim()) return null
    const parsed = parsePlanPaste(pasteText, pasteSep)
    const match = matchPlanRows(targets, parsed.rows)
    const bad = match.matched.filter((m) => !planCheck(m.row.plan, currency).ok)
    return { parsed, match, bad }
  }, [paste, pasteText, pasteSep, targets, currency])
  const block = useMemo(
    () =>
      paste?.kind === 'block' && pasteText.trim()
        ? parsePlanBlock(pasteText, pasteSep)
        : null,
    [paste, pasteText, pasteSep],
  )
  const openPaste = (m: PasteMode) => {
    setPaste(m)
    setPasteText('')
    setTouchedSep(false)
  }
  const closePaste = () => setPaste(null)
  const setPasteInput = (v: string) => {
    setPasteText(v)
    if (!touchedSep) setPasteSep(guessDecimalSep(v))
  }
  const choosePasteSep = (v: DecimalSep) => {
    setPasteSep(v)
    setTouchedSep(true)
  }
  const canApply =
    paste?.kind === 'table' ? !!table && table.match.matched.length > 0 : !!block
  const applyPaste = () => {
    const str = (n: number) => String(n)
    setDraft((p) => {
      const next = { ...p }
      if (paste?.kind === 'table' && table) {
        for (const m of table.match.matched)
          next[m.target.product_id] = {
            direct: str(m.row.plan.direct),
            overhead: str(m.row.plan.overhead),
            profit: str(m.row.plan.profit),
            price: str(m.row.plan.price),
            from_line: m.row.line,
          }
      } else if (paste?.kind === 'block' && block) {
        next[paste.row.product_id] = {
          direct: str(block.plan.direct),
          overhead: str(block.plan.overhead),
          profit: str(block.plan.profit),
          price: str(block.plan.price),
          breakdown: block.breakdown,
        }
      }
      return next
    })
    // Số dán ra dạng "144.5" → ô đọc dấu chấm.
    setSep('.')
    const n = paste?.kind === 'table' ? (table?.match.matched.length ?? 0) : 1
    toast.success(`Đã điền ${n} dòng vào bảng`, 'Soát lại rồi bấm Lưu')
    setPaste(null)
  }

  async function save() {
    if (missing.length || busy) return
    setBusy(true)
    try {
      const res = await api<{ updated: number }>('/api/dept/sales/gia-thanh', {
        method: 'PATCH',
        body: {
          items: dirty.map((r) => {
            const x = resolved.get(r.product_id)!
            if (!x.ok) throw new Error('unreachable')
            const d = draft[r.product_id]
            return {
              product_id: r.product_id,
              direct: x.direct,
              overhead: x.overhead,
              profit: x.profit,
              price: x.price,
              ...(d.breakdown ? { breakdown: d.breakdown } : {}),
            }
          }),
          currency,
          fx_rate: fxRate.trim() ? parsePriceText(fxRate, sep) : null,
          source: source.trim(),
        },
      })
      setDraft({})
      router.refresh()
      toast.success(
        `Đã lưu giá thành kế hoạch cho ${res.updated} sản phẩm`,
        `Nguồn: ${source.trim()}`,
      )
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return {
    board,
    canManage,
    draft,
    setCell,
    clearRow,
    resolved,
    view,
    setView,
    customer,
    setCustomer,
    customers,
    q,
    setQ,
    currency,
    setCurrency,
    sep,
    setSep,
    fxRate,
    setFxRate,
    fxBad,
    source,
    setSource,
    busy,
    rows,
    dirty,
    bad,
    warn,
    missing,
    open,
    toggleOpen,
    reset: () => setDraft({}),
    paste,
    openPaste,
    closePaste,
    pasteText,
    setPasteInput,
    pasteSep,
    choosePasteSep,
    table,
    block,
    byId,
    canApply,
    applyPaste,
    save,
  } as const
}

export type GiaThanhCtx = ReturnType<typeof useGiaThanh>

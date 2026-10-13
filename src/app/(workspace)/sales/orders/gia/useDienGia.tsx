'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  guessDecimalSep,
  matchPasteRows,
  parsePricePaste,
  type DecimalSep,
} from '@/lib/price-paste'
import type { PricingBoard, PricingLine } from '@/modules/dept/sales/orders.service'
import { avgLai, checkPrice, PRICE_NAME, type PlanPrice } from '@/lib/sale-price'

export type Missing = { msg: string; focus?: string }

/** Giá kế hoạch của một dòng theo khuôn lib/sale-price (null = SP chưa có / không quyền). */
export const planOf = (l: PricingLine): PlanPrice | null =>
  l.plan_price == null
    ? null
    : { cost: l.plan_cost, price: l.plan_price, currency: l.plan_currency ?? l.currency }

/** Giá hợp lệ từ ô gõ: '' = chưa gõ (null), số âm / chữ = NaN. */
export const parsePrice = (raw: string | undefined): number | null => {
  if (raw === undefined || raw.trim() === '') return null
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/**
 * State + xử lý bảng ĐIỀN ĐƠN GIÁ (khuôn F). Nguyên tắc giữ nguyên từ bản cũ:
 * DÁN / MỒI KHÔNG LƯU THẲNG — chỉ điền vào ô, người dùng soát rồi bấm Lưu.
 * Đây là tiền hợp đồng; một cú dán nhầm cột mà tự lưu là hỏng cả sổ đơn.
 */
export function useDienGia(board: PricingBoard, initialOrder: string | null = null) {
  const toast = useToast()
  const router = useRouter()
  const [draft, setDraft] = useState<Record<string, string>>({})
  // Vào từ "Sửa giá" của một đơn → hiện MỌI dòng của đơn đó (giá đã có), không chỉ dòng thiếu giá.
  const [onlyUnpriced, setOnlyUnprice] = useState(!initialOrder)
  /** Lọc "dưới giá vốn" (bấm ô đếm) — đè lên lọc thiếu giá. */
  const [belowOnly, setBelowOnly] = useState(false)
  const setOnlyUnpriced = (v: boolean) => {
    setOnlyUnprice(v)
    setBelowOnly(false)
  }
  const [customer, setCustomer] = useState('all')
  const [order, setOrder] = useState(initialOrder ?? 'all')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const setCell = (id: string, raw: string) => setDraft((d) => ({ ...d, [id]: raw }))

  const customers = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of board.lines) m.set(l.customer_name, (m.get(l.customer_name) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
  }, [board.lines])
  const orders = useMemo(() => {
    const m = new Map<string, { code: string; customer: string; unpriced: number }>()
    for (const l of board.lines) {
      if (customer !== 'all' && l.customer_name !== customer) continue
      const o = m.get(l.order_id) ?? {
        code: l.order_code,
        customer: l.customer_name,
        unpriced: 0,
      }
      if (l.unit_price <= 0) o.unpriced++
      m.set(l.order_id, o)
    }
    return [...m.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code))
  }, [board.lines, customer])

  /** Giá đang có hiệu lực của dòng: số đang gõ (nếu hợp lệ), không thì số đã lưu. */
  const effPrice = (l: PricingLine) => {
    const t = parsePrice(draft[l.line_id])
    return t == null || Number.isNaN(t) ? l.unit_price : t
  }
  /** Dòng bán dưới giá vốn KH — CÙNG hàm `checkPrice` với cột Lãi thực, để ô đếm và cột không lệch. */
  const belowCostIds = useMemo(
    () =>
      new Set(
        board.lines
          .filter((l) => checkPrice(effPrice(l), l.currency, planOf(l)).below_cost)
          .map((l) => l.line_id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effPrice đọc draft (đã trong deps)
    [board.lines, draft],
  )

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return board.lines.filter((l) => {
      if (belowOnly && !belowCostIds.has(l.line_id)) return false
      if (
        !belowOnly &&
        onlyUnpriced &&
        l.unit_price > 0 &&
        draft[l.line_id] === undefined
      )
        return false
      if (customer !== 'all' && l.customer_name !== customer) return false
      if (order !== 'all' && l.order_id !== order) return false
      if (!needle) return true
      return `${l.order_code} ${l.product_code} ${l.customer_item_code ?? ''} ${l.product_name} ${l.customer_name}`
        .toLowerCase()
        .includes(needle)
    })
  }, [board.lines, onlyUnpriced, belowOnly, belowCostIds, customer, order, q, draft])

  /** Σ lãi + lãi thực bình quân trên các dòng ĐANG HIỆN (giá hiệu lực, có giá vốn cùng tiền tệ). */
  const rowsLai = useMemo(() => {
    let gain = 0
    const curs = new Set<string>()
    const xs: Parameters<typeof avgLai>[0] = []
    for (const l of rows) {
      const price = effPrice(l)
      const plan = planOf(l)
      const c = checkPrice(price, l.currency, plan)
      const comparable = !!plan && !c.currency_mismatch
      xs.push({ price, qty: l.qty, cost: plan?.cost ?? null, comparable })
      if (comparable && plan?.cost != null && price > 0) {
        gain += (price - plan.cost) * l.qty
        curs.add(l.currency)
      }
    }
    const a = avgLai(xs)
    // Nhiều tiền tệ thì KHÔNG cộng chung — trả cur null để màn nói thẳng.
    const cur = curs.size === 1 ? [...curs][0] : null
    return { gain, cur, pct: curs.size > 1 ? null : a.pct, n: a.n }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effPrice đọc draft (đã trong deps)
  }, [rows, draft])

  /** Dòng thực sự đổi số — nguồn cho nút Lưu và chân bảng. */
  const dirty = useMemo(() => {
    const out: { line: PricingLine; price: number }[] = []
    for (const l of board.lines) {
      const p = parsePrice(draft[l.line_id])
      if (p == null || Number.isNaN(p) || p === l.unit_price) continue
      out.push({ line: l, price: p })
    }
    return out
  }, [board.lines, draft])
  const invalidIds = useMemo(
    () =>
      Object.entries(draft)
        .filter(([, raw]) => Number.isNaN(parsePrice(raw)))
        .map(([id]) => id),
    [draft],
  )
  const missing = useMemo<Missing[]>(() => {
    const m: Missing[] = []
    if (invalidIds.length)
      m.push({
        msg: `${invalidIds.length} ô sai định dạng (số ≥ 0)`,
        focus: `cell-${invalidIds[0]}`,
      })
    if (!dirty.length && !invalidIds.length) m.push({ msg: 'chưa gõ giá nào' })
    // Q5 (13/10/2026): bán dưới giá vốn không chặn, nhưng bắt lý do — server cũng gác.
    const below = dirty.filter((x) => belowCostIds.has(x.line.line_id)).length
    if (below && !note.trim())
      m.push({
        msg: `ghi lý do: ${below} dòng dưới ${PRICE_NAME.cost}`,
        focus: 'f-ly-do',
      })
    return m
  }, [dirty, invalidIds, belowCostIds, note])

  const totalByCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dirty)
      m.set(d.line.currency, (m.get(d.line.currency) ?? 0) + d.price * d.line.qty)
    return [...m.entries()]
  }, [dirty])
  /** Dòng gõ giá THẤP hơn FOB kế hoạch — cảnh báo, không chặn (giá đã thương lượng là thật). */
  const belowPlan = useMemo(
    () =>
      dirty.filter(
        (d) =>
          d.line.plan_price != null &&
          d.line.plan_currency === d.line.currency &&
          d.price < d.line.plan_price,
      ).length,
    [dirty],
  )

  /* ── mồi FOB kế hoạch ─────────────────────────────────────────────────── */
  const planFillable = useMemo(
    () =>
      board.lines.filter(
        (l) =>
          l.editable &&
          l.unit_price <= 0 &&
          l.plan_price != null &&
          l.plan_currency === l.currency &&
          (draft[l.line_id] === undefined || draft[l.line_id] === ''),
      ),
    [board.lines, draft],
  )
  const applyMany = (items: { line_id: string; price: number }[]) =>
    setDraft((d) => {
      const n = { ...d }
      for (const a of items) n[a.line_id] = String(a.price)
      return n
    })
  const fillFromPlan = () =>
    applyMany(planFillable.map((l) => ({ line_id: l.line_id, price: l.plan_price! })))
  const hasPlanColumn = board.lines.some((l) => l.plan_price != null)

  /* ── dán từ Excel (ngăn tại chỗ) ─────────────────────────────────────── */
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [sep, setSep] = useState<DecimalSep>('.')
  const [touchedSep, setTouchedSep] = useState(false)
  const parsed = useMemo(() => parsePricePaste(pasteText, sep), [pasteText, sep])
  const byId = useMemo(
    () => new Map(board.lines.map((l) => [l.line_id, l])),
    [board.lines],
  )
  const match = useMemo(
    () =>
      matchPasteRows(
        board.lines.map((l) => ({
          line_id: l.line_id,
          order_code: l.order_code,
          product_code: l.product_code,
          // File dán vào là báo giá CỦA KHÁCH — khách ghi mã của họ.
          customer_code: l.customer_item_code,
        })),
        parsed.rows,
      ),
    [board.lines, parsed.rows],
  )
  const applicable = useMemo(
    () => match.matched.filter((m) => byId.get(m.line_id)?.editable),
    [match, byId],
  )
  const lockedCount = match.matched.length - applicable.length
  const setPaste = (v: string) => {
    setPasteText(v)
    if (!touchedSep) setSep(guessDecimalSep(v))
  }
  const chooseSep = (s: DecimalSep) => {
    setSep(s)
    setTouchedSep(true)
  }
  const applyPaste = () => {
    applyMany(applicable.map((m) => ({ line_id: m.line_id, price: m.price })))
    setPasteText('')
    setTouchedSep(false)
    setPasteOpen(false)
    toast.success(`Đã điền ${applicable.length} dòng vào bảng`, 'Soát lại rồi bấm Lưu')
  }

  async function save() {
    if (missing.length) {
      // Nút Lưu góc trên vẫn bấm được khi thanh đáy đang khoá — đừng im lặng
      // (soi UI 13/10/2026): nói thiếu gì và đưa con trỏ tới chỗ đầu tiên.
      toast.error('Chưa lưu được', missing.map((m) => m.msg).join(' · '))
      const id = missing.find((m) => m.focus)?.focus
      const el = id ? document.getElementById(id) : null
      el?.scrollIntoView({ block: 'center' })
      el?.focus()
      return
    }
    setBusy(true)
    try {
      const res = await api<{ updated: number; orders: number }>(
        '/api/dept/sales/orders/prices',
        {
          method: 'PATCH',
          body: {
            items: dirty.map((d) => ({ line_id: d.line.line_id, unit_price: d.price })),
            note: note.trim() || null,
          },
        },
      )
      setDraft({})
      setNote('')
      router.refresh()
      toast.success(`Đã điền giá ${res.updated} dòng`, `Thuộc ${res.orders} đơn hàng`)
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return {
    board,
    draft,
    setCell,
    onlyUnpriced,
    setOnlyUnpriced,
    belowOnly,
    showBelowCost: () => {
      setBelowOnly(true)
      setOnlyUnprice(false)
    },
    belowCostCount: belowCostIds.size,
    rowsLai,
    customer,
    setCustomer: (v: string) => {
      setCustomer(v)
      setOrder('all')
    },
    order,
    setOrder,
    customers,
    orders,
    q,
    setQ,
    note,
    setNote,
    busy,
    rows,
    dirty,
    invalidIds,
    missing,
    totalByCurrency,
    belowPlan,
    planFillable,
    fillFromPlan,
    hasPlanColumn,
    applyMany,
    reset: () => setDraft({}),
    pasteOpen,
    setPasteOpen,
    pasteText,
    setPaste,
    sep,
    chooseSep,
    parsed,
    match,
    applicable,
    lockedCount,
    byId,
    applyPaste,
    save,
  } as const
}

export type DienGiaCtx = ReturnType<typeof useDienGia>

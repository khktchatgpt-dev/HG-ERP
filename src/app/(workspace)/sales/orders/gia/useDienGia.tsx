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

export type Missing = { msg: string; focus?: string }

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
export function useDienGia(board: PricingBoard) {
  const toast = useToast()
  const router = useRouter()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [onlyUnpriced, setOnlyUnpriced] = useState(true)
  const [customer, setCustomer] = useState('all')
  const [order, setOrder] = useState('all')
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

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return board.lines.filter((l) => {
      if (onlyUnpriced && l.unit_price > 0 && draft[l.line_id] === undefined) return false
      if (customer !== 'all' && l.customer_name !== customer) return false
      if (order !== 'all' && l.order_id !== order) return false
      if (!needle) return true
      return `${l.order_code} ${l.product_code} ${l.customer_item_code ?? ''} ${l.product_name} ${l.customer_name}`
        .toLowerCase()
        .includes(needle)
    })
  }, [board.lines, onlyUnpriced, customer, order, q, draft])

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
    return m
  }, [dirty.length, invalidIds])

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
    if (missing.length) return
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

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { uploadFile, MAX_UPLOAD_BYTES } from '@/lib/upload'
import { quoteNetPrice } from '@/lib/quote-price'
import { parseOrderPaste, type PastedOrderRow } from '@/lib/order-paste'
import { invalidateProductPickCache } from '@/components/sales/ProductPicker'
import {
  emptySpec,
  num,
  SPEC_FIELDS,
  type CustomerOption,
  type LineDraft,
  type LineInitial,
  type LineRow,
  type Missing,
  type OrderInitial,
  type ProductPick,
  type QuoteOption,
} from './don-form.shared'

export type DonHangFormProps = {
  mode: 'create' | 'edit'
  customers: CustomerOption[]
  /** Chỉ các SP đang nằm trên dòng (sửa đơn) — ô chọn tự tìm ở server. */
  lineProducts: ProductPick[]
  sentQuotes?: QuoteOption[]
  initialQuoteId?: string | null
  order?: OrderInitial
  initialLines?: LineInitial[]
}

const AFTER_LSX = [
  'lsx_pending',
  'lsx_issued',
  'completed',
  'partially_shipped',
  'shipped',
]

/**
 * Toàn bộ state + xử lý của form đơn bán. Khối con nhận `d`, không ghi thẳng
 * state. Mọi "còn thiếu" kèm id ô để thanh chốt đáy bấm là nhảy tới.
 */
export function useDonHangForm(p: DonHangFormProps) {
  const router = useRouter()
  const toast = useToast()
  const { mode, order } = p
  const [busy, setBusy] = useState(false)
  const keyRef = useRef(p.initialLines?.length ?? 0)

  /* ── nguồn / khách / tiền tệ ─────────────────────────────────────────── */
  const initialQuoteId = mode === 'create' ? (p.initialQuoteId ?? null) : null
  const [source, setSource] = useState<'quote' | 'direct'>(
    mode === 'edit'
      ? 'direct'
      : initialQuoteId || (p.sentQuotes?.length ?? 0) > 0
        ? 'quote'
        : 'direct',
  )
  const [quoteId, setQuoteId] = useState(initialQuoteId ?? '')
  const [quoteCustomerId, setQuoteCustomerId] = useState('')
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [customerId, setCustomerId] = useState(order?.customer_id ?? '')
  const [code, setCode] = useState('')

  const [h, setH] = useState({
    customer_po_no: order?.customer_po_no ?? '',
    due_date: order?.due_date ?? '',
    container_summary: order?.container_summary ?? '',
    currency: order?.currency ?? 'USD',
    note: order?.note ?? '',
    change_note: '',
  })
  const set = (k: keyof typeof h, v: string) => setH((x) => ({ ...x, [k]: v }))
  const [noPo, setNoPo] = useState(mode === 'edit' && !order?.customer_po_no)

  const tri = (v: boolean | null | undefined) => (v == null ? '' : v ? 'true' : 'false')
  const [terms, setTerms] = useState({
    price_term: order?.price_term ?? '',
    payment_terms: order?.payment_terms ?? '',
    deposit_percent: order?.deposit_percent != null ? String(order.deposit_percent) : '',
    qty_tolerance_pct:
      order?.qty_tolerance_pct != null ? String(order.qty_tolerance_pct) : '',
    port_of_loading: order?.port_of_loading ?? '',
    port_of_discharge: order?.port_of_discharge ?? '',
    payment_method: order?.payment_method ?? '',
    required_docs: order?.required_docs ?? '',
    partial_shipment: tri(order?.partial_shipment),
    transhipment: tri(order?.transhipment),
  })
  const setTerm = (k: keyof typeof terms, v: string) =>
    setTerms((x) => ({ ...x, [k]: v }))
  const termsFilled = Object.values(terms).filter((v) => v !== '').length
  const [termsOpen, setTermsOpen] = useState(mode === 'edit' || termsFilled > 0)

  /** Chọn khách khi tạo mới → mồi tiền tệ + điều khoản mặc định vào ô trống (server cũng làm thế khi lưu). */
  function pickCustomer(cid: string) {
    setCustomerId(cid)
    if (mode === 'edit') return
    const c = p.customers.find((x) => x.id === cid)
    if (!c) return
    if (c.default_currency) set('currency', c.default_currency)
    setTerms((t) => ({
      ...t,
      price_term: t.price_term || c.default_price_term || '',
      payment_terms: t.payment_terms || c.default_payment_terms || '',
      port_of_discharge: t.port_of_discharge || c.port_of_discharge || '',
    }))
  }

  /* ── dòng ───────────────────────────────────────────────────────────────── */
  const [known, setKnown] = useState<Map<string, ProductPick>>(
    () => new Map(p.lineProducts.map((x) => [x.id, x])),
  )
  const remember = (x: ProductPick) => setKnown((m) => new Map(m).set(x.id, x))
  const [lines, setLines] = useState<LineRow[]>(() =>
    (p.initialLines ?? []).map((l, i) => ({
      key: i,
      id: l.id,
      productId: l.product_id,
      draft: null,
      qty: String(l.qty),
      unitPrice: String(l.unit_price),
      shipDate: l.ship_date ?? '',
      note: l.note ?? '',
      shipped: l.shipped,
    })),
  )
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const setLine = (key: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const removeLine = (key: number) => {
    setLines((ls) => ls.filter((l) => l.key !== key))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(key)
      return n
    })
  }
  const toggleSel = (key: number, v: boolean) =>
    setSelected((s) => {
      const n = new Set(s)
      if (v) n.add(key)
      else n.delete(key)
      return n
    })
  const selectAll = (v: boolean) =>
    setSelected(v ? new Set(lines.map((l) => l.key)) : new Set())

  const newRow = (over: Partial<LineRow>): LineRow => ({
    key: keyRef.current++,
    productId: '',
    draft: null,
    qty: '',
    unitPrice: '',
    shipDate: h.due_date || '',
    note: '',
    shipped: 0,
    ...over,
  })

  /** Thêm nhiều SP một lượt từ hộp chọn — mỗi SP một dòng (D2: cùng SP thêm lần nữa vẫn được). */
  function addPicked(products: ProductPick[]) {
    products.forEach(remember)
    setLines((ls) => [...ls, ...products.map((x) => newRow({ productId: x.id }))])
  }
  /** Đổi SP của MỘT dòng (dán chưa khớp / chọn nhầm). */
  function replaceProduct(key: number, x: ProductPick) {
    remember(x)
    setLine(key, { productId: x.id, pastedCode: undefined, draft: null })
  }
  function addEmpty() {
    setLines((ls) => [...ls, newRow({})])
  }
  function addDraft(draft: LineDraft, unitPrice: string) {
    setLines((ls) => [...ls, newRow({ draft, unitPrice })])
  }

  /** Áp một ngày giao cho dòng đang tick (không tick → dòng trống). */
  function applyShipDate(date: string) {
    if (!date) return
    setLines((ls) =>
      ls.map((l) =>
        selected.size
          ? selected.has(l.key)
            ? { ...l, shipDate: date }
            : l
          : l.shipDate
            ? l
            : { ...l, shipDate: date },
      ),
    )
  }
  function removeSelected() {
    setLines((ls) => ls.filter((l) => !selected.has(l.key) || l.shipped > 0))
    setSelected(new Set())
  }

  /* ── dán từ Excel ───────────────────────────────────────────────────────── */
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteBusy, setPasteBusy] = useState(false)
  const [pasteReport, setPasteReport] = useState<{
    ok: number
    unmatched: string[]
    errors: string[]
  } | null>(null)
  async function applyPaste() {
    const parsed = parseOrderPaste(pasteText)
    if (!parsed.rows.length) {
      setPasteReport({
        ok: 0,
        unmatched: [],
        errors: parsed.errors.map((e) => `Dòng ${e.line}: ${e.reason}`),
      })
      return
    }
    setPasteBusy(true)
    try {
      const codes = [...new Set(parsed.rows.map((r) => r.code))]
      const res = await api<{ products: ProductPick[] }>(
        `/api/dept/sales/products?codes=${encodeURIComponent(codes.join(','))}&limit=50`,
      )
      const cid = activeCustomerId
      const pick = (r: PastedOrderRow): ProductPick | undefined => {
        const k = r.code.trim().toLowerCase()
        const hits = res.products.filter(
          (x) =>
            x.code.toLowerCase() === k ||
            (x.customer_item_code ?? '').toLowerCase() === k,
        )
        // Mã HG thắng mã khách; cùng mã khách ở nhiều hồ sơ → ưu tiên khách đang chọn.
        return (
          hits.find((x) => x.code.toLowerCase() === k) ??
          hits.find((x) => x.customer_id === cid) ??
          hits[0]
        )
      }
      const unmatched: string[] = []
      const rows = parsed.rows.map((r) => {
        const x = pick(r)
        if (x) remember(x)
        else unmatched.push(r.code)
        return newRow({
          productId: x?.id ?? '',
          pastedCode: x ? undefined : r.code,
          qty: r.qty != null ? String(r.qty) : '',
          unitPrice: r.unit_price != null ? String(r.unit_price) : '',
          shipDate: r.ship_date ?? h.due_date ?? '',
          note: r.note ?? '',
        })
      })
      setLines((ls) => [...ls, ...rows])
      setPasteReport({
        ok: rows.length - unmatched.length,
        unmatched,
        errors: parsed.errors.map((e) => `Dòng ${e.line}: ${e.reason}`),
      })
      setPasteText('')
      if (!unmatched.length && !parsed.errors.length) setPasteOpen(false)
    } catch (e) {
      toast.error('Tra mã thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setPasteBusy(false)
    }
  }

  /* ── báo giá ────────────────────────────────────────────────────────────── */
  async function selectQuote(qid: string) {
    setQuoteId(qid)
    if (!qid) {
      setQuoteCustomerId('')
      setLines([])
      return
    }
    setLoadingQuote(true)
    try {
      const data = await api<{
        quote: { customer_id: string; currency: string }
        lines: {
          product_id: string
          qty: number | null
          unit_price: number
          discount_pct: number | null
          note: string | null
        }[]
      }>(`/api/dept/sales/quotes/${qid}`)
      setQuoteCustomerId(data.quote.customer_id)
      set('currency', data.quote.currency)
      const ids = data.lines.map((l) => l.product_id)
      const known2 = await api<{ products: ProductPick[] }>(
        `/api/dept/sales/products?ids=${ids.join(',')}&limit=50`,
      )
      known2.products.forEach(remember)
      setLines(
        data.lines.map((l) =>
          newRow({
            productId: l.product_id,
            qty: l.qty != null ? String(l.qty) : '',
            // Giá NET — bản in gửi khách là giá sau chiết khấu.
            unitPrice: String(quoteNetPrice(l.unit_price, l.discount_pct)),
            note: l.note ?? '',
          }),
        ),
      )
    } catch (e) {
      toast.error('Không tải được báo giá', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setLoadingQuote(false)
    }
  }
  const bootQuote = useRef(initialQuoteId)
  useEffect(() => {
    const qid = bootQuote.current
    bootQuote.current = null
    if (qid) void selectQuote(qid)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy một lần lúc mở
  }, [])

  const activeCustomerId =
    mode === 'edit'
      ? order!.customer_id
      : source === 'quote'
        ? quoteCustomerId
        : customerId
  const currency = mode === 'edit' ? order!.currency : h.currency
  const linesEditable =
    mode === 'edit' || source === 'direct' || (source === 'quote' && !!quoteId)

  /* ── file ───────────────────────────────────────────────────────────────── */
  const [files, setFiles] = useState<File[]>([])
  function addFiles(list: FileList | null) {
    if (!list) return
    const ok = Array.from(list).filter((f) => {
      if (f.size > MAX_UPLOAD_BYTES) {
        toast.error('Tệp quá lớn', `${f.name} > ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`)
        return false
      }
      return true
    })
    setFiles((prev) => [...prev, ...ok])
  }

  /* ── còn thiếu (mỗi mục bấm được) ──────────────────────────────────────── */
  const afterLsx = mode === 'edit' && !!order && AFTER_LSX.includes(order.status)
  const missing = useMemo<Missing[]>(() => {
    const m: Missing[] = []
    if (mode === 'create' && !code.trim())
      m.push({ msg: 'nhập mã đơn hàng', focus: 'f-code' })
    if (mode === 'create' && source === 'quote' && !quoteId)
      m.push({ msg: 'chọn báo giá đã chốt', focus: 'f-quote' })
    if (mode === 'create' && source === 'direct' && !customerId)
      m.push({ msg: 'chọn khách hàng', focus: 'f-customer' })
    if (!h.customer_po_no.trim() && !noPo)
      m.push({ msg: 'nhập số PO khách (hoặc tick "không có PO")', focus: 'f-po' })
    if (linesEditable) {
      if (lines.length === 0)
        m.push({ msg: 'thêm ít nhất 1 dòng sản phẩm', focus: 'btn-pick' })
      const noSp = lines.find((l) => !l.productId && !l.draft)
      if (noSp)
        m.push({
          msg: noSp.pastedCode
            ? `chọn SP cho mã "${noSp.pastedCode}"`
            : 'chọn SP cho mọi dòng',
          focus: `cell-${noSp.key}-sp`,
        })
      const badQty = lines.find((l) => !(num(l.qty) > 0))
      if (badQty) m.push({ msg: 'nhập số lượng > 0', focus: `cell-${badQty.key}-qty` })
      const under = lines.find((l) => l.shipped > 0 && num(l.qty) < l.shipped)
      if (under)
        m.push({
          msg: `dòng đã xuất ${under.shipped} — SL không được thấp hơn`,
          focus: `cell-${under.key}-qty`,
        })
      const noPrice = lines.find((l) => l.unitPrice.trim() === '')
      if (noPrice)
        m.push({
          msg: 'nhập đơn giá (0 nếu chưa có)',
          focus: `cell-${noPrice.key}-price`,
        })
    }
    if (afterLsx && !h.change_note.trim())
      m.push({ msg: 'ghi lý do thay đổi (đơn đã có lệnh)', focus: 'f-change' })
    return m
  }, [
    mode,
    code,
    source,
    quoteId,
    customerId,
    h.customer_po_no,
    h.change_note,
    noPo,
    linesEditable,
    lines,
    afterLsx,
  ])
  const invalid = missing.length > 0

  const tong = useMemo(() => {
    const qty = lines.reduce((s, l) => s + num(l.qty), 0)
    const value = lines.reduce((s, l) => s + num(l.qty) * num(l.unitPrice), 0)
    const zero = lines.filter((l) => !(num(l.unitPrice) > 0)).length
    const noDate = lines.filter((l) => !l.shipDate).length
    const late = h.due_date
      ? lines.filter((l) => l.shipDate && l.shipDate > h.due_date).length
      : 0
    return { qty, value, zero, noDate, late }
  }, [lines, h.due_date])

  /* ── lưu ────────────────────────────────────────────────────────────────── */
  const headerBody = () => ({
    customer_po_no: h.customer_po_no.trim() || null,
    no_customer_po: noPo && !h.customer_po_no.trim(),
    due_date: h.due_date || null,
    container_summary: h.container_summary.trim() || null,
    note: h.note.trim() || null,
  })
  const termsBody = () => {
    const txt = (v: string) => v.trim() || null
    const n = (v: string) => (v.trim() === '' ? null : Number(v))
    const b = (v: string) => (v === '' ? null : v === 'true')
    return {
      price_term: txt(terms.price_term),
      payment_terms: txt(terms.payment_terms),
      deposit_percent: n(terms.deposit_percent),
      qty_tolerance_pct: n(terms.qty_tolerance_pct),
      port_of_loading: txt(terms.port_of_loading),
      port_of_discharge: txt(terms.port_of_discharge),
      payment_method: txt(terms.payment_method),
      required_docs: txt(terms.required_docs),
      partial_shipment: b(terms.partial_shipment),
      transhipment: b(terms.transhipment),
    }
  }

  /** SP mới → tạo vào thư viện + ảnh, đổi dòng thành SP đã lưu (lưu lại an toàn nếu bước sau lỗi). */
  async function materialize() {
    const out: {
      id?: string | null
      product_id: string
      qty: number
      unit_price: number
      ship_date: string | null
      note: string | null
    }[] = []
    const updated = [...lines]
    for (let i = 0; i < updated.length; i++) {
      const l = updated[i]
      let pid = l.productId
      if (!pid && l.draft) {
        const { product } = await api<{ product: { id: string } }>(
          '/api/dept/sales/products',
          {
            method: 'POST',
            body: {
              code: l.draft.code,
              name: l.draft.name,
              unit: l.draft.unit,
              customer_id: activeCustomerId || null,
              customer_item_code: l.draft.itemCode || null,
              notes: l.draft.notes || null,
              reference_price: l.unitPrice.trim() === '' ? null : num(l.unitPrice),
              barcode: l.draft.barcode || null,
              tech_spec: Object.fromEntries(
                SPEC_FIELDS.map(([k]) => [k, l.draft!.spec[k].trim()]).filter(
                  ([, v]) => v,
                ),
              ),
            },
          },
        )
        pid = product.id
        invalidateProductPickCache()
        updated[i] = { ...l, productId: pid, draft: null }
        if (l.draft.image) {
          try {
            const fid = await uploadFile(l.draft.image, { kind: 'product', id: pid })
            await api(`/api/dept/sales/products/${pid}/image`, {
              method: 'POST',
              body: { file_id: fid },
            })
          } catch {
            /* ảnh lỗi không chặn — thêm lại ở Kỹ thuật */
          }
        }
      }
      out.push({
        id: l.id ?? null,
        product_id: pid,
        qty: num(l.qty),
        unit_price: num(l.unitPrice),
        ship_date: l.shipDate || null,
        note: l.note.trim() || null,
      })
    }
    setLines(updated)
    return out
  }

  async function submit() {
    if (invalid) {
      toast.error('Chưa thể lưu', `Còn thiếu: ${missing.map((m) => m.msg).join(', ')}`)
      return
    }
    setBusy(true)
    try {
      const orderLines = linesEditable ? await materialize() : []
      if (mode === 'create') {
        const body: Record<string, unknown> =
          source === 'quote'
            ? {
                code: code.trim(),
                quote_id: quoteId,
                lines: orderLines,
                ...headerBody(),
                ...termsBody(),
              }
            : {
                code: code.trim(),
                customer_id: customerId,
                currency: h.currency,
                lines: orderLines,
                ...headerBody(),
                ...termsBody(),
              }
        const { order: created } = await api<{ order: { id: string } }>(
          '/api/dept/sales/orders',
          { method: 'POST', body },
        )
        if (files.length) {
          let ok = 0
          for (const f of files) {
            try {
              await uploadFile(f, { kind: 'sales_order', id: created.id })
              ok++
            } catch {
              /* báo tổng hợp */
            }
          }
          if (ok < files.length)
            toast.error(
              'Một số file tải lên lỗi',
              `${ok}/${files.length} thành công — tải lại ở trang chi tiết`,
            )
        }
        toast.success('Đã tạo đơn hàng')
        router.push(`/sales/orders/${created.id}`)
      } else {
        await api(`/api/dept/sales/orders/${order!.id}`, {
          method: 'PATCH',
          body: {
            ...headerBody(),
            ...termsBody(),
            change_note: h.change_note.trim() || null,
            lines: orderLines,
          },
        })
        toast.success('Đã lưu + ghi lịch sử', order!.code)
        router.push(`/sales/orders/${order!.id}`)
      }
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /* ── rời trang khi chưa lưu ─────────────────────────────────────────────── */
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = lines.length > 0 || !!code || !!h.customer_po_no
  }, [lines, code, h.customer_po_no])
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && !busy) e.preventDefault()
    }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [busy])

  const [pickOpen, setPickOpen] = useState(false)
  const [replaceKey, setReplaceKey] = useState<number | null>(null)
  const [draftOpen, setDraftOpen] = useState(false)

  return {
    ...p,
    busy,
    source,
    setSource,
    quoteId,
    selectQuote,
    loadingQuote,
    quoteCustomerId,
    customerId,
    pickCustomer,
    code,
    setCode,
    h,
    set,
    noPo,
    setNoPo,
    terms,
    setTerm,
    termsFilled,
    termsOpen,
    setTermsOpen,
    known,
    lines,
    selected,
    setLine,
    removeLine,
    toggleSel,
    selectAll,
    addPicked,
    replaceProduct,
    addEmpty,
    addDraft,
    applyShipDate,
    removeSelected,
    pasteOpen,
    setPasteOpen,
    pasteText,
    setPasteText,
    pasteBusy,
    pasteReport,
    applyPaste,
    activeCustomerId,
    currency,
    linesEditable,
    afterLsx,
    files,
    addFiles,
    removeFile: (i: number) => setFiles((f) => f.filter((_, k) => k !== i)),
    missing,
    invalid,
    tong,
    submit,
    pickOpen,
    setPickOpen,
    replaceKey,
    setReplaceKey,
    draftOpen,
    setDraftOpen,
    emptySpec,
  } as const
}

export type DonHangFormCtx = ReturnType<typeof useDonHangForm>

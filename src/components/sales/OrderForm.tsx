'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { uploadFile, MAX_UPLOAD_BYTES } from '@/lib/upload'

export type ProductPick = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  dims: string | null
  spec: string | null
  has_image: boolean
}
export type QuoteOption = {
  id: string
  code: string
  customer_name: string
  currency: string
}
export type CustomerOption = { id: string; name: string }

export type OrderInitial = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  currency: string
  quote_code: string | null
  customer_po_no: string | null
  due_date: string | null
  container_summary: string | null
  note: string | null
  // Điều khoản thương mại (Sales Contract) — sửa được khi khách đổi.
  price_term: string | null
  payment_terms: string | null
  deposit_percent: number | null
  qty_tolerance_pct: number | null
  port_of_loading: string | null
  port_of_discharge: string | null
  payment_method: string | null
  required_docs: string | null
  partial_shipment: boolean | null
  transhipment: boolean | null
}

/** SP mới sale tự điền — chỉ tạo vào thư viện Kỹ thuật KHI submit đơn (không mồ côi). */
type LineDraft = {
  code: string
  name: string
  unit: string
  itemCode: string
  notes: string
  image: File | null
}
type LineRow = {
  key: number
  productId: string // '' nếu là SP mới (draft)
  draft: LineDraft | null
  qty: number | ''
  unitPrice: number | ''
  note: string
}

const BOM_LABEL = { none: 'Chưa có BOM', drawing: 'Đang vẽ', done: 'Đã vẽ' } as const
const BOM_TONE = { none: 'gray', drawing: 'amber', done: 'green' } as const

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function OrderForm(props: {
  mode: 'create' | 'edit'
  customers: CustomerOption[]
  products: ProductPick[]
  sentQuotes?: QuoteOption[]
  order?: OrderInitial
  initialLines?: { product_id: string; qty: number; unit_price: number; note: string }[]
}) {
  const { mode, customers, order } = props
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const keyRef = useRef(props.initialLines?.length ?? 0)

  const [source, setSource] = useState<'quote' | 'direct'>(
    mode === 'edit' ? 'direct' : (props.sentQuotes?.length ?? 0) > 0 ? 'quote' : 'direct',
  )
  const [code, setCode] = useState('')
  const [quoteId, setQuoteId] = useState('')
  // Khách của báo giá đã chọn (đơn từ báo giá) — để nhóm SP theo đúng khách.
  const [quoteCustomerId, setQuoteCustomerId] = useState('')
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [customerId, setCustomerId] = useState(order?.customer_id ?? '')
  const [lines, setLines] = useState<LineRow[]>(() =>
    (props.initialLines ?? []).map((l, i) => ({
      key: i,
      productId: l.product_id,
      draft: null,
      qty: l.qty,
      unitPrice: l.unit_price,
      note: l.note,
    })),
  )
  const [productList] = useState<ProductPick[]>(props.products)

  // Mini-form "SP mới" (chưa lưu — thành 1 dòng draft).
  const [npOpen, setNpOpen] = useState(false)
  const [np, setNp] = useState({
    code: '',
    name: '',
    unit: 'cai',
    itemCode: '',
    price: '',
  })
  const [npNotes, setNpNotes] = useState('')
  const [npImage, setNpImage] = useState<File | null>(null)

  const [files, setFiles] = useState<File[]>([])

  const [h, setH] = useState({
    customer_po_no: order?.customer_po_no ?? '',
    due_date: order?.due_date ?? '',
    container_summary: order?.container_summary ?? '',
    currency: order?.currency ?? 'USD',
    note: order?.note ?? '',
    change_note: '',
  })
  const set = (k: keyof typeof h, v: string) => setH((p) => ({ ...p, [k]: v }))

  // Điều khoản thương mại — mọi field lưu dạng chuỗi trong form; boolean dùng
  // tri-state '' | 'true' | 'false' để giữ được null (không ghi đè đơn từ báo giá).
  const triBool = (v: boolean | null | undefined) =>
    v == null ? '' : v ? 'true' : 'false'
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
    partial_shipment: triBool(order?.partial_shipment),
    transhipment: triBool(order?.transhipment),
  })
  const setTerm = (k: keyof typeof terms, v: string) =>
    setTerms((p) => ({ ...p, [k]: v }))
  // Điều khoản chỉnh được khi sửa đơn, hoặc khi tạo đơn TRỰC TIẾP. Đơn từ báo giá
  // snapshot điều khoản từ báo giá — sửa sau ở màn Sửa đơn.
  const showTerms = mode === 'edit' || source === 'direct'
  const hasTerms = Object.values(terms).some((v) => v !== '')
  const [termsOpen, setTermsOpen] = useState(mode === 'edit' && hasTerms)

  const productById = useMemo(() => {
    const m = new Map<string, ProductPick>()
    for (const p of productList) m.set(p.id, p)
    return m
  }, [productList])

  const activeCustomerId =
    mode === 'edit'
      ? order!.customer_id
      : source === 'quote'
        ? quoteCustomerId
        : customerId

  const productChoices = useMemo(() => {
    const cid = activeCustomerId
    return {
      own: productList.filter((p) => p.customer_id === cid),
      common: productList.filter((p) => !p.customer_id),
      others: productList.filter((p) => p.customer_id && p.customer_id !== cid),
    }
  }, [productList, activeCustomerId])

  /**
   * Chọn báo giá đã chốt → nạp SP + đơn giá + tiền tệ từ báo giá vào dòng để Sale
   * nhập SỐ LƯỢNG (báo giá không có SL). Điều khoản vẫn do server lấy từ báo giá.
   */
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
        lines: { product_id: string; unit_price: number; note: string | null }[]
      }>(`/api/dept/sales/quotes/${qid}`)
      setQuoteCustomerId(data.quote.customer_id)
      setH((p) => ({ ...p, currency: data.quote.currency }))
      setLines(
        data.lines.map((l) => ({
          key: keyRef.current++,
          productId: l.product_id,
          draft: null,
          qty: '' as const,
          unitPrice: l.unit_price,
          note: l.note ?? '',
        })),
      )
    } catch (e) {
      toast.error('Không tải được báo giá', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setLoadingQuote(false)
    }
  }

  const usedIds = new Set(lines.filter((l) => l.productId).map((l) => l.productId))
  const linesEditable =
    mode === 'edit' || source === 'direct' || (source === 'quote' && !!quoteId)
  const currency = mode === 'edit' ? order!.currency : h.currency
  const total = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
    0,
  )

  // ── Danh sách điều kiện còn thiếu ─────────────────────────────────────────
  const missing: string[] = []
  if (mode === 'create' && !code.trim()) missing.push('nhập mã đơn hàng')
  if (mode === 'create' && source === 'quote' && !quoteId)
    missing.push('chọn báo giá đã chốt')
  if (mode === 'create' && source === 'direct' && !customerId)
    missing.push('chọn khách hàng')
  // Dòng SP + SL: cần khi tạo trực tiếp, sửa đơn, hoặc tạo từ báo giá đã chọn.
  if (linesEditable) {
    if (lines.length === 0) missing.push('thêm ít nhất 1 dòng sản phẩm')
    else if (lines.some((l) => !l.productId && !l.draft))
      missing.push('chọn SP cho mọi dòng')
    else if (
      new Set(lines.filter((l) => l.productId).map((l) => l.productId)).size !==
      lines.filter((l) => l.productId).length
    )
      missing.push('SP bị trùng dòng')
    else if (lines.some((l) => l.qty === '' || Number(l.qty) <= 0))
      missing.push('nhập số lượng > 0')
    else if (lines.some((l) => l.unitPrice === '')) missing.push('nhập đơn giá')
  }
  const invalid = missing.length > 0

  // ── Handlers ──────────────────────────────────────────────────────────────
  function setLine(key: number, patch: Partial<LineRow>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: number) {
    setLines((ls) => ls.filter((l) => l.key !== key))
  }
  function addExistingLine() {
    setLines((ls) => [
      ...ls,
      {
        key: keyRef.current++,
        productId: '',
        draft: null,
        qty: '',
        unitPrice: '',
        note: '',
      },
    ])
  }
  function addDraftLine() {
    if (!np.code.trim() || !np.name.trim()) {
      toast.error('Thiếu thông tin', 'SP mới cần mã và tên')
      return
    }
    if (npImage && npImage.size > MAX_UPLOAD_BYTES) {
      toast.error('Ảnh quá lớn', `Tối đa ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`)
      return
    }
    setLines((ls) => [
      ...ls,
      {
        key: keyRef.current++,
        productId: '',
        draft: {
          code: np.code.trim(),
          name: np.name.trim(),
          unit: np.unit.trim() || 'cai',
          itemCode: np.itemCode.trim(),
          notes: npNotes.trim(),
          image: npImage,
        },
        qty: '',
        unitPrice: np.price.trim() ? Number(np.price) : '',
        note: '',
      },
    ])
    setNp({ code: '', name: '', unit: 'cai', itemCode: '', price: '' })
    setNpNotes('')
    setNpImage(null)
    setNpOpen(false)
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list).filter((f) => {
      if (f.size > MAX_UPLOAD_BYTES) {
        toast.error('Tệp quá lớn', `${f.name} > ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`)
        return false
      }
      return true
    })
    setFiles((prev) => [...prev, ...picked])
  }

  function headerBody() {
    return {
      customer_po_no: h.customer_po_no.trim() || null,
      due_date: h.due_date || null,
      container_summary: h.container_summary.trim() || null,
      note: h.note.trim() || null,
    }
  }

  function termsBody() {
    const txt = (v: string) => v.trim() || null
    const num = (v: string) => (v.trim() === '' ? null : Number(v))
    const bool = (v: string) => (v === '' ? null : v === 'true')
    return {
      price_term: txt(terms.price_term),
      payment_terms: txt(terms.payment_terms),
      deposit_percent: num(terms.deposit_percent),
      qty_tolerance_pct: num(terms.qty_tolerance_pct),
      port_of_loading: txt(terms.port_of_loading),
      port_of_discharge: txt(terms.port_of_discharge),
      payment_method: txt(terms.payment_method),
      required_docs: txt(terms.required_docs),
      partial_shipment: bool(terms.partial_shipment),
      transhipment: bool(terms.transhipment),
    }
  }

  /**
   * Chuẩn hoá dòng SP: với dòng SP mới (draft) → tạo SP vào thư viện + upload ảnh,
   * đồng thời đổi dòng đó thành SP-đã-lưu (resubmit an toàn nếu bước sau lỗi).
   */
  async function materializeLines() {
    const result: {
      product_id: string
      qty: number
      unit_price: number
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
              reference_price: l.unitPrice === '' ? null : Number(l.unitPrice),
            },
          },
        )
        pid = product.id
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
      result.push({
        product_id: pid,
        qty: Number(l.qty),
        unit_price: Number(l.unitPrice),
        note: l.note.trim() || null,
      })
    }
    setLines(updated)
    return result
  }

  async function submit() {
    if (invalid) {
      toast.error('Chưa thể lưu', `Còn thiếu: ${missing.join(', ')}`)
      return
    }
    setBusy(true)
    try {
      const orderLines = linesEditable ? await materializeLines() : []
      if (mode === 'create') {
        const body: Record<string, unknown> =
          source === 'quote'
            ? {
                // Đơn từ báo giá: SP + đơn giá nạp từ báo giá, SL do Sale nhập.
                // Khách + tiền tệ + điều khoản do server lấy từ báo giá.
                code: code.trim(),
                quote_id: quoteId,
                lines: orderLines,
                ...headerBody(),
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
        if (files.length > 0) {
          let ok = 0
          for (const f of files) {
            try {
              await uploadFile(f, { kind: 'sales_order', id: created.id })
              ok++
            } catch {
              /* báo tổng hợp */
            }
          }
          if (ok < files.length) {
            toast.error(
              'Một số file tải lên lỗi',
              `${ok}/${files.length} thành công — tải lại ở trang chi tiết`,
            )
          }
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 pb-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          { label: mode === 'create' ? 'Tạo đơn' : `Sửa ${order!.code}` },
        ]}
        title={mode === 'create' ? 'Tạo đơn hàng' : `Sửa đơn ${order!.code}`}
        description={
          mode === 'create'
            ? 'Từ báo giá đã chốt hoặc trực tiếp. SP mới tạo nhanh sẽ vào thư viện Kỹ thuật khi lưu đơn.'
            : 'Khách thay đổi — mọi chỉnh sửa được ghi vào lịch sử đơn.'
        }
        actions={
          <Link
            href={mode === 'edit' ? `/sales/orders/${order!.id}` : '/sales/orders'}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Huỷ
          </Link>
        }
      />

      {/* 1. Khách hàng & nguồn */}
      <Card title="Khách hàng & nguồn đơn">
        {mode === 'create' ? (
          <>
            <label className="mb-3 flex flex-col gap-1 text-sm">
              Mã đơn hàng <span className="text-red-500">*</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={50}
                placeholder="Sale tự đặt mã — vd HG-MX-001"
                className={`${cls} font-mono sm:max-w-xs`}
              />
            </label>
            <div className="mb-3 flex gap-2">
              <Tab on={source === 'quote'} onClick={() => setSource('quote')}>
                Từ báo giá đã chốt
              </Tab>
              <Tab on={source === 'direct'} onClick={() => setSource('direct')}>
                Trực tiếp (không báo giá)
              </Tab>
            </div>
            {source === 'quote' ? (
              (props.sentQuotes?.length ?? 0) === 0 ? (
                <p className="text-sm text-zinc-500">
                  Chưa có báo giá đã chốt — chuyển “Trực tiếp” hoặc chốt báo giá trước.
                </p>
              ) : (
                <label className="flex flex-col gap-1 text-sm">
                  Báo giá đã chốt <span className="text-red-500">*</span>
                  <select
                    value={quoteId}
                    onChange={(e) => void selectQuote(e.target.value)}
                    disabled={loadingQuote}
                    className={cls}
                  >
                    <option value="">— chọn báo giá —</option>
                    {props.sentQuotes!.map((qt) => (
                      <option key={qt.id} value={qt.id}>
                        {qt.code} — {qt.customer_name} ({qt.currency})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-500">
                    {loadingQuote
                      ? 'Đang nạp dòng SP từ báo giá…'
                      : 'SP + đơn giá + điều khoản lấy từ báo giá — bạn chỉ cần nhập số lượng bên dưới.'}
                  </span>
                </label>
              )
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  Khách hàng <span className="text-red-500">*</span>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className={cls}
                  >
                    <option value="">— chọn khách —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Tiền tệ
                  <select
                    value={h.currency}
                    onChange={(e) => set('currency', e.target.value)}
                    className={cls}
                  >
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{order!.customer_name}</span>
            <Badge>{order!.currency}</Badge>
            {order!.quote_code && <Badge>Từ BG {order!.quote_code}</Badge>}
          </div>
        )}
      </Card>

      {/* 2. Dòng sản phẩm */}
      {linesEditable && (
        <Card
          title={`Dòng sản phẩm (${lines.length})`}
          right={
            <span className="text-sm">
              Tổng: <b className="text-base">{total.toLocaleString('en-US')}</b>{' '}
              {currency}
            </span>
          }
        >
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700">
              Chưa có dòng nào — bấm <b>“+ Chọn SP có sẵn”</b> hoặc <b>“+ SP mới”</b> bên
              dưới.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {lines.map((l) => {
                const p = l.productId ? productById.get(l.productId) : undefined
                const lineTotal = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)
                return (
                  <div
                    key={l.key}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {l.draft ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="green">SP mới</Badge>
                            <span className="font-medium">{l.draft.name}</span>
                            <span className="font-mono text-xs text-zinc-400">
                              {l.draft.code}
                            </span>
                            {l.draft.image && (
                              <span className="text-xs text-emerald-600">🖼 có ảnh</span>
                            )}
                            <span className="text-xs text-zinc-400">
                              (tạo vào thư viện khi lưu đơn)
                            </span>
                          </div>
                        ) : (
                          <>
                            <select
                              value={l.productId}
                              onChange={(e) =>
                                setLine(l.key, { productId: e.target.value })
                              }
                              className={cls}
                            >
                              <option value="">— chọn sản phẩm —</option>
                              {productChoices.own.length > 0 && (
                                <optgroup label="SP của khách này">
                                  {productChoices.own.map((o) =>
                                    opt(o, usedIds, l.productId),
                                  )}
                                </optgroup>
                              )}
                              {productChoices.common.length > 0 && (
                                <optgroup label="Mẫu chung">
                                  {productChoices.common.map((o) =>
                                    opt(o, usedIds, l.productId),
                                  )}
                                </optgroup>
                              )}
                              {productChoices.others.length > 0 && (
                                <optgroup label="SP khách khác">
                                  {productChoices.others.map((o) =>
                                    opt(o, usedIds, l.productId),
                                  )}
                                </optgroup>
                              )}
                            </select>
                            {p && (
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                                <span className="font-mono">{p.code}</span>
                                {p.customer_item_code && (
                                  <span>KH: {p.customer_item_code}</span>
                                )}
                                <Badge tone={BOM_TONE[p.bom_status]}>
                                  {BOM_LABEL[p.bom_status]}
                                </Badge>
                                {p.dims && <span>📐 {p.dims}</span>}
                                {p.spec && <span>🛠 {p.spec}</span>}
                                {p.has_image && <span>🖼 ảnh</span>}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        aria-label="Xoá dòng"
                      >
                        ✕
                      </button>
                    </div>

                    {/* SL / Đơn giá / Thành tiền — có nhãn rõ ràng */}
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <LineField label="Số lượng *">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.qty}
                          onChange={(e) =>
                            setLine(l.key, {
                              qty: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          className={cls}
                        />
                      </LineField>
                      <LineField label={`Đơn giá * (${currency})`}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.unitPrice}
                          onChange={(e) =>
                            setLine(l.key, {
                              unitPrice:
                                e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          className={cls}
                        />
                      </LineField>
                      <LineField label={`Thành tiền (${currency})`}>
                        <div className="rounded-md bg-zinc-100 px-3 py-2 text-right text-sm font-semibold tabular-nums dark:bg-zinc-800">
                          {lineTotal.toLocaleString('en-US')}
                        </div>
                      </LineField>
                      <LineField label="Ghi chú dòng">
                        <input
                          value={l.note}
                          maxLength={500}
                          onChange={(e) => setLine(l.key, { note: e.target.value })}
                          placeholder="tuỳ chọn"
                          className={cls}
                        />
                      </LineField>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Nút thêm dòng */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addExistingLine}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              + Chọn SP có sẵn
            </button>
            <button
              type="button"
              onClick={() => setNpOpen((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                npOpen
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
              }`}
            >
              + SP mới
            </button>
          </div>

          {/* Mini-form SP mới */}
          {npOpen && (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
              <div className="mb-2 text-xs font-semibold text-emerald-700 uppercase dark:text-emerald-400">
                Sản phẩm mới — chỉ tạo vào thư viện Kỹ thuật khi bạn lưu đơn
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input
                  value={np.code}
                  onChange={(e) => setNp((p) => ({ ...p, code: e.target.value }))}
                  placeholder="Mã SP *"
                  className={`${cls} font-mono`}
                />
                <input
                  value={np.name}
                  onChange={(e) => setNp((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Tên SP *"
                  className={`${cls} col-span-2`}
                />
                <input
                  value={np.unit}
                  onChange={(e) => setNp((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="ĐVT"
                  className={cls}
                />
                <input
                  value={np.itemCode}
                  onChange={(e) => setNp((p) => ({ ...p, itemCode: e.target.value }))}
                  placeholder="Mã KH đặt"
                  className={`${cls} col-span-2 font-mono`}
                />
                <input
                  value={np.price}
                  onChange={(e) => setNp((p) => ({ ...p, price: e.target.value }))}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Đơn giá"
                  className={cls}
                />
                <label className="col-span-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-300 px-2 py-2 text-xs text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-700">
                  {npImage ? '🖼 Đổi ảnh' : '🖼 Ảnh'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setNpImage(e.currentTarget.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <textarea
                value={npNotes}
                onChange={(e) => setNpNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Ghi chú đầy đủ (vật liệu, lưu ý SX…) — Kỹ thuật đọc để bổ sung BOM/thông số"
                className={`${cls} mt-2`}
              />
              <div className="mt-2 flex items-center gap-3">
                {npImage && (
                  <span className="truncate text-xs text-emerald-700 dark:text-emerald-400">
                    {npImage.name}
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNpOpen(false)}
                    className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={addDraftLine}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Thêm vào đơn
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-zinc-500">
            ℹ Dòng “SP mới” chỉ được tạo vào thư viện Kỹ thuật khi bạn bấm{' '}
            <b>{mode === 'create' ? 'Tạo đơn hàng' : 'Lưu thay đổi'}</b> — thêm rồi xoá
            thì không tạo gì bên Kỹ thuật.
          </p>
        </Card>
      )}

      {/* 3. Thông tin đơn (tối giản) */}
      <Card title="Thông tin đơn">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <L label="Số PO của khách">
            <input
              value={h.customer_po_no}
              onChange={(e) => set('customer_po_no', e.target.value)}
              maxLength={100}
              placeholder="HG-MX"
              className={`${cls} font-mono`}
            />
          </L>
          <L label="Hạn giao">
            <input
              type="date"
              value={h.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className={cls}
            />
          </L>
          <L label="Container">
            <input
              value={h.container_summary}
              onChange={(e) => set('container_summary', e.target.value)}
              maxLength={100}
              placeholder="3 x 40'HC"
              className={cls}
            />
          </L>
          <L label="Ghi chú đơn" span2>
            <textarea
              value={h.note}
              onChange={(e) => set('note', e.target.value)}
              rows={2}
              maxLength={2000}
              className={cls}
            />
          </L>
          {mode === 'edit' && (
            <L label="Lý do thay đổi (ghi lịch sử)" span2>
              <input
                value={h.change_note}
                onChange={(e) => set('change_note', e.target.value)}
                maxLength={1000}
                placeholder="vd: khách tăng SL ghế 48 → 60, đổi màu nệm"
                className={cls}
              />
            </L>
          )}
        </div>
        <p className="mt-3 rounded-md bg-sky-50 p-2 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          {showTerms ? (
            <>
              ℹ Điều khoản thương mại (giá, thanh toán, cảng, dung sai, chứng từ…) nhập ở{' '}
              <b>mục dưới</b> — hoặc để trong <b>file hợp đồng</b> đính kèm.
            </>
          ) : (
            <>
              ℹ Đơn từ báo giá đã snapshot điều khoản từ báo giá — sửa sau ở màn{' '}
              <b>Sửa đơn</b> nếu khách đổi.
            </>
          )}
        </p>
      </Card>

      {/* 3b. Điều khoản thương mại (tuỳ chọn, gập được) */}
      {showTerms && (
        <Card
          title="Điều khoản thương mại (tuỳ chọn)"
          right={
            <button
              type="button"
              onClick={() => setTermsOpen((v) => !v)}
              className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              {termsOpen ? 'Thu gọn ▲' : 'Mở rộng ▼'}
            </button>
          }
        >
          {!termsOpen ? (
            <p className="text-sm text-zinc-500">
              {hasTerms
                ? 'Đã có điều khoản — bấm “Mở rộng” để xem/sửa.'
                : 'Giá (FOB/CIF…), thanh toán, cảng bốc/dỡ, dung sai SL, chứng từ. Bấm “Mở rộng” để nhập.'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <L label="Điều kiện giá (Incoterm)">
                <input
                  value={terms.price_term}
                  onChange={(e) => setTerm('price_term', e.target.value)}
                  maxLength={100}
                  placeholder="FOB Hai Phong"
                  className={cls}
                />
              </L>
              <L label="Điều khoản thanh toán">
                <input
                  value={terms.payment_terms}
                  onChange={(e) => setTerm('payment_terms', e.target.value)}
                  maxLength={500}
                  placeholder="30% deposit, 70% T/T"
                  className={cls}
                />
              </L>
              <L label="Đặt cọc (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={terms.deposit_percent}
                  onChange={(e) => setTerm('deposit_percent', e.target.value)}
                  className={cls}
                />
              </L>
              <L label="Dung sai SL (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={terms.qty_tolerance_pct}
                  onChange={(e) => setTerm('qty_tolerance_pct', e.target.value)}
                  className={cls}
                />
              </L>
              <L label="Cảng bốc (POL)">
                <input
                  value={terms.port_of_loading}
                  onChange={(e) => setTerm('port_of_loading', e.target.value)}
                  maxLength={200}
                  placeholder="Hai Phong, Vietnam"
                  className={cls}
                />
              </L>
              <L label="Cảng dỡ (POD)">
                <input
                  value={terms.port_of_discharge}
                  onChange={(e) => setTerm('port_of_discharge', e.target.value)}
                  maxLength={200}
                  className={cls}
                />
              </L>
              <L label="Phương thức thanh toán">
                <input
                  value={terms.payment_method}
                  onChange={(e) => setTerm('payment_method', e.target.value)}
                  maxLength={200}
                  placeholder="T/T, L/C at sight…"
                  className={cls}
                />
              </L>
              <L label="Giao hàng từng phần">
                <select
                  value={terms.partial_shipment}
                  onChange={(e) => setTerm('partial_shipment', e.target.value)}
                  className={cls}
                >
                  <option value="">— không đặt —</option>
                  <option value="true">Cho phép</option>
                  <option value="false">Không cho phép</option>
                </select>
              </L>
              <L label="Chuyển tải (transhipment)">
                <select
                  value={terms.transhipment}
                  onChange={(e) => setTerm('transhipment', e.target.value)}
                  className={cls}
                >
                  <option value="">— không đặt —</option>
                  <option value="true">Cho phép</option>
                  <option value="false">Không cho phép</option>
                </select>
              </L>
              <L label="Chứng từ yêu cầu" span2>
                <textarea
                  value={terms.required_docs}
                  onChange={(e) => setTerm('required_docs', e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="B/L, C/O form B, Invoice, Packing list, Phytosanitary…"
                  className={cls}
                />
              </L>
            </div>
          )}
        </Card>
      )}

      {/* 4. File liên quan (chỉ create) */}
      {mode === 'create' && (
        <Card title="File liên quan (hợp đồng / chứng từ)">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400">
            📎 Chọn file (PDF, Excel, ảnh…)
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.currentTarget.files)
                e.currentTarget.value = ''
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-3 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, x) => x !== i))}
                    className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label="Bỏ file"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            File tải lên sau khi bấm “Tạo đơn hàng”. Tối đa 10MB/file. Có thể thêm ở trang
            chi tiết đơn.
          </p>
        </Card>
      )}

      {/* Thanh hành động sticky */}
      <div className="sticky bottom-3 z-10 rounded-lg border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <span className="text-zinc-500">
              Tổng đơn: <b>{total.toLocaleString('en-US')}</b> {currency}
            </span>
            {invalid && (
              <span className="block truncate text-xs text-amber-600 dark:text-amber-400">
                Còn thiếu: {missing.join(' · ')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={mode === 'edit' ? `/sales/orders/${order!.id}` : '/sales/orders'}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </Link>
            <button
              type="button"
              disabled={busy || invalid}
              title={invalid ? `Còn thiếu: ${missing.join(', ')}` : undefined}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {mode === 'create' ? 'Tạo đơn hàng' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function opt(p: ProductPick, used: Set<string>, current: string) {
  return (
    <option key={p.id} value={p.id} disabled={used.has(p.id) && p.id !== current}>
      {p.code} — {p.name}
    </option>
  )
}

function Card({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function L({
  label,
  span2,
  children,
}: {
  label: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      className={`flex flex-col gap-1 text-sm ${span2 ? 'sm:col-span-2 lg:col-span-4' : ''}`}
    >
      {label}
      {children}
    </label>
  )
}

function LineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        on
          ? 'bg-sky-600 text-white'
          : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900'
      }`}
    >
      {children}
    </button>
  )
}

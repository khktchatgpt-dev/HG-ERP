'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { ProductPick } from '@/components/sales/ProductPicker'

/** Dòng xem trước — khớp payload `quoteImportService.preview`. */
export type PreviewRow = {
  row: number
  code: string | null
  customer_item_code: string | null
  name: string | null
  description_en: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  material: string | null
  qty_per_carton: number | null
  carton_l_cm: number | null
  carton_w_cm: number | null
  carton_h_cm: number | null
  nw_kg: number | null
  gw_kg: number | null
  loading_40hc: number | null
  unit: string | null
  qty: number | null
  unit_price: number | null
  discount_pct: number | null
  note: string | null
  missing: string[]
  warnings: string[]
  action: 'existing' | 'new' | 'blocked'
  matched_product_id: string | null
  matched_label: string | null
  matched_image_url: string | null
  ambiguous: boolean
  candidates: { id: string; code: string; name: string; image_url: string | null }[]
  has_image: boolean
  /** Ảnh nhúng trong file (data URL, có trần) — null khi không có / quá lớn. */
  image_data_url: string | null
  blocked_reason: string | null
}

export type Preview = {
  source_file_id: string
  source_name: string
  sheet_name: string
  header_row: number | null
  rows: PreviewRow[]
  skipped: { row: number; text: string; reason: string }[]
  summary: { total: number; existing: number; new_products: number; blocked: number }
}

export type Customer = { id: string; name: string; default_currency: string | null }

/** Người dùng chỉ đích danh SP cho một dòng — thắng mọi kết quả khớp tự động. */
export type Pick = { id: string; code: string; name: string; image_url: string | null }

/** Dòng SAU khi áp lựa chọn tay: việc sẽ làm + SP sẽ dùng. */
export type RowView = PreviewRow & {
  pick: Pick | null
  effective: 'existing' | 'new' | 'blocked'
  effectiveId: string | null
  effectiveLabel: string | null
  /** Ảnh sẽ đi với dòng: thư viện (SP khớp / SP chọn) hoặc ảnh nhúng (SP mới). */
  thumb: string | null
  /** Vì sao chưa lưu được dòng này (null = ổn). */
  why: string | null
}

export type Missing = { msg: string; focus?: string }

/**
 * State + xử lý của màn nhập báo giá từ Excel. Hai nhịp: đọc (server khớp, không
 * ghi) → người dùng soi, chọn SP tại chỗ cho dòng mơ hồ / SP mới nếu muốn, bỏ
 * dòng → lưu. Khối con nhận `d`.
 */
export function useImportQuote(customers: Customer[]) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [skip, setSkip] = useState<Set<number>>(new Set())
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map())
  const [customerId, setCustomerId] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [filter, setFilter] = useState<'all' | 'existing' | 'new' | 'blocked'>('all')
  const [pickFor, setPickFor] = useState<number | null>(null)

  async function readFile(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dept/sales/quotes/import', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Lỗi ${res.status}`)
      }
      const data = (await res.json()) as Omit<Preview, 'source_name'>
      setPreview({ ...data, source_name: file.name })
      setSkip(new Set())
      setPicks(new Map())
      setFilter('all')
      toast.success(
        'Đã đọc file',
        `${data.summary.total} dòng · ${data.summary.existing} khớp SP có sẵn · ${data.summary.new_products} SP mới · ${data.summary.blocked} dòng cần xem`,
      )
    } catch (err) {
      toast.error('Không đọc được file', err instanceof Error ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  function pickCustomer(id: string) {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    if (c?.default_currency) setCurrency(c.default_currency)
  }

  const toggle = (row: number) =>
    setSkip((s) => {
      const n = new Set(s)
      if (n.has(row)) n.delete(row)
      else n.add(row)
      return n
    })

  /** Lấy / bỏ mọi dòng lấy được (dòng bị chặn không đổi). */
  const setAll = (on: boolean) =>
    setSkip(on ? new Set() : new Set((preview?.rows ?? []).map((r) => r.row)))

  /** Chỉ đích danh SP cho một dòng (ứng viên hoặc hộp tìm). */
  function setPick(row: number, p: Pick | ProductPick | null) {
    setPicks((m) => {
      const n = new Map(m)
      if (p)
        n.set(row, {
          id: p.id,
          code: p.code,
          name: p.name,
          image_url: p.image_url ?? null,
        })
      else n.delete(row)
      return n
    })
    if (p)
      setSkip((s) => {
        const n = new Set(s)
        n.delete(row)
        return n
      })
  }

  const rows = useMemo<RowView[]>(() => {
    if (!preview) return []
    /** Chặn hai dòng cùng trỏ một SP sau khi chọn tay (server cũng chặn, nhưng nói trước thì đỡ bấm Lưu rồi mới biết). */
    const usedBy = new Map<string, number>()
    return preview.rows.map((r) => {
      const pick = picks.get(r.row) ?? null
      const hardBlocked = r.missing.length > 0
      let effective: RowView['effective'] = r.action
      let effectiveId = r.matched_product_id
      let effectiveLabel = r.matched_label
      let thumb: string | null = r.matched_image_url ?? r.image_data_url
      let why: string | null = r.action === 'blocked' ? r.blocked_reason : null
      if (pick && !hardBlocked) {
        effective = 'existing'
        effectiveId = pick.id
        effectiveLabel = `${pick.code} — ${pick.name}`
        thumb = pick.image_url ?? r.image_data_url
        why = null
      }
      if (hardBlocked) {
        effective = 'blocked'
        why = r.missing.join(' · ')
      }
      if (effective !== 'blocked' && effectiveId && !skip.has(r.row)) {
        const first = usedBy.get(effectiveId)
        if (first != null) {
          effective = 'blocked'
          why = `trùng SP với dòng ${first} (đã chọn cùng một sản phẩm)`
        } else usedBy.set(effectiveId, r.row)
      }
      return { ...r, pick, effective, effectiveId, effectiveLabel, thumb, why }
    })
  }, [preview, picks, skip])

  const counts = useMemo(
    () => ({
      total: rows.length,
      existing: rows.filter((r) => r.effective === 'existing').length,
      new: rows.filter((r) => r.effective === 'new').length,
      blocked: rows.filter((r) => r.effective === 'blocked').length,
      kept: rows.filter((r) => r.effective !== 'blocked' && !skip.has(r.row)).length,
      withQty: rows.filter((r) => r.qty != null).length,
    }),
    [rows, skip],
  )
  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.effective === filter)),
    [rows, filter],
  )
  const kept = useMemo(
    () => rows.filter((r) => r.effective !== 'blocked' && !skip.has(r.row)),
    [rows, skip],
  )

  const missing = useMemo<Missing[]>(() => {
    const m: Missing[] = []
    if (!preview) return m
    if (!customerId) m.push({ msg: 'chọn khách hàng', focus: 'f-customer' })
    if (kept.length === 0) m.push({ msg: 'giữ lại ít nhất 1 dòng' })
    const amb = rows.find((r) => r.ambiguous && !r.pick && !skip.has(r.row))
    if (amb)
      m.push({
        msg: `dòng ${amb.row} khớp nhiều SP — chọn một hoặc bỏ dòng`,
        focus: `row-${amb.row}`,
      })
    return m
  }, [preview, customerId, kept.length, rows, skip])

  const tong = useMemo(() => {
    const value = kept.reduce(
      (s, r) =>
        s + (r.qty ?? 0) * (r.unit_price ?? 0) * (1 - (r.discount_pct ?? 0) / 100),
      0,
    )
    return { value, withQty: kept.filter((r) => r.qty != null).length }
  }, [kept])

  async function save() {
    if (!preview || missing.length) return
    setBusy(true)
    try {
      const res = await api<{ quote_id: string; created_products: number }>(
        '/api/dept/sales/quotes/import/commit',
        {
          method: 'POST',
          body: {
            source_file_id: preview.source_file_id,
            customer_id: customerId,
            currency,
            rows: kept.map((r) => ({
              row: r.row,
              product_id: r.effectiveId,
              code: r.code,
              name: r.name,
              description_en: r.description_en,
              customer_item_code: r.customer_item_code,
              unit: r.unit,
              qty: r.qty,
              unit_price: r.unit_price,
              discount_pct: r.discount_pct,
              length_mm: r.length_mm,
              width_mm: r.width_mm,
              height_mm: r.height_mm,
              material: r.material,
              qty_per_carton: r.qty_per_carton,
              carton_l_cm: r.carton_l_cm,
              carton_w_cm: r.carton_w_cm,
              carton_h_cm: r.carton_h_cm,
              nw_kg: r.nw_kg,
              gw_kg: r.gw_kg,
              loading_40hc: r.loading_40hc,
              note: r.note,
            })),
          },
        },
      )
      toast.success(
        'Đã tạo báo giá nháp',
        res.created_products > 0
          ? `${res.created_products} SP mới đã vào thư viện · file Excel gốc gắn ở ngăn Tài liệu`
          : 'Không tạo SP mới · file Excel gốc gắn ở ngăn Tài liệu',
      )
      router.push(`/sales/quotes/${res.quote_id}`)
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return {
    customers,
    busy,
    preview,
    readFile,
    reset: () => setPreview(null),
    customerId,
    pickCustomer,
    currency,
    setCurrency,
    filter,
    setFilter,
    rows,
    visible,
    counts,
    kept,
    skip,
    toggle,
    setAll,
    picks,
    setPick,
    pickFor,
    setPickFor,
    missing,
    tong,
    save,
  } as const
}

export type ImportQuoteCtx = ReturnType<typeof useImportQuote>

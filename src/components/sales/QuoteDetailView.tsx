'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isSvgUrl } from '@/lib/image'
import { Badge } from '@/components/Badge'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { DocumentFiles } from '@/components/DocumentFiles'
import type { Packing } from '@/components/sales/QuoteForm'

type QuoteStatus = 'draft' | 'sent'

type QuoteView = {
  id: string
  code: string
  status: QuoteStatus
  currency: string
  customer_name: string
  valid_from: string | null
  valid_to: string | null
  price_term: string | null
  payment_terms: string | null
  note: string | null
  owner_name: string | null
  created_at: string
}

type LineView = {
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  description_en: string | null
  unit_price: number
  discount_pct: number | null
  note: string | null
  packing: Packing
  image_url: string | null
}

const STATUS_LABEL: Record<QuoteStatus, string> = { draft: 'Nháp', sent: 'Đã gửi khách' }
const STATUS_TONE: Record<QuoteStatus, 'gray' | 'green'> = {
  draft: 'gray',
  sent: 'green',
}

const dimStr = (a?: number, b?: number, c?: number) =>
  a != null && b != null && c != null ? `${a}×${b}×${c}` : null
const cmToInch = (v?: number) => (v != null ? (v / 2.54).toFixed(1) : null)
const inchStr = (a?: number, b?: number, c?: number) => {
  const [x, y, z] = [cmToInch(a), cmToInch(b), cmToInch(c)]
  return x && y && z ? `${x}×${y}×${z}` : null
}
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '…')

export function QuoteDetailView({
  quote,
  lines,
  canEdit,
}: {
  quote: QuoteView
  lines: LineView[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const isDraft = quote.status === 'draft'

  async function send() {
    const ok = await confirm({
      title: `Chốt & gửi khách ${quote.code}?`,
      description: 'Sau khi chốt, báo giá bất biến và tạo được đơn hàng.',
      confirmLabel: 'Chốt & gửi',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/quotes/${quote.id}/send`, { method: 'POST' })
      toast.success('Đã chốt & gửi khách', quote.code)
      router.refresh()
    } catch (e) {
      toast.error('Không gửi được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Xoá báo giá ${quote.code}?`,
      description: 'Không thể hoàn tác.',
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/sales/quotes/${quote.id}`, { method: 'DELETE' })
      toast.success('Đã xoá báo giá')
      router.push('/sales/quotes')
    } catch (e) {
      toast.error('Không xoá được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Báo giá', href: '/sales/quotes' },
          { label: quote.code },
        ]}
        title={quote.code}
        description={quote.customer_name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/print/quotes/${quote.id}`}
              target="_blank"
              rel="noopener"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              🖨 In báo giá
            </a>
            {canEdit && isDraft && (
              <>
                <Link
                  href={`/sales/quotes/${quote.id}/edit`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Sửa
                </Link>
                <button
                  onClick={() => void send()}
                  disabled={busy}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Chốt & gửi khách
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Tổng quan */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge>
          <Badge>{quote.currency}</Badge>
          {quote.price_term && <Badge>{quote.price_term}</Badge>}
          {quote.payment_terms && <Badge>{quote.payment_terms}</Badge>}
          <span className="text-xs text-zinc-500">
            Lập: {fmtD(quote.created_at)}
            {quote.owner_name && ` · ${quote.owner_name}`}
          </span>
          {(quote.valid_from || quote.valid_to) && (
            <span className="text-xs text-zinc-500">
              Hiệu lực: {fmtD(quote.valid_from)} → {fmtD(quote.valid_to)}
            </span>
          )}
        </div>
        {quote.note && <p className="mt-2 text-sm text-zinc-500">{quote.note}</p>}
      </section>

      {/* Bảng sản phẩm — đầy đủ trường như tờ báo giá */}
      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Sản phẩm ({lines.length})
          </h2>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[900px] border-collapse text-center text-xs">
            <thead>
              <tr className="bg-zinc-50 text-[11px] text-zinc-500 uppercase dark:bg-zinc-900">
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">Ảnh</th>
                <th className="border border-zinc-200 p-1.5 text-left dark:border-zinc-800">
                  Sản phẩm
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  KT (cm)
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  Carton (cm)
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  Carton (inch)
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  SL/ctn
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  Load 40HC
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  NW/GW (kg)
                </th>
                <th className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                  Đơn giá ({quote.currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const pk = l.packing ?? {}
                const dims = dimStr(pk.l_cm, pk.w_cm, pk.h_cm)
                const carton = dimStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)
                const inch = inchStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)
                const nwgw =
                  pk.nw_kg != null || pk.gw_kg != null
                    ? `${pk.nw_kg ?? '—'} / ${pk.gw_kg ?? '—'}`
                    : null
                const cell = (v: string | null) =>
                  v ?? <span className="text-amber-500">—</span>
                return (
                  <tr key={i} className="align-top">
                    <td className="border border-zinc-200 p-1 dark:border-zinc-800">
                      {l.image_url ? (
                        <Image
                          src={l.image_url}
                          alt={l.product_name}
                          width={72}
                          height={56}
                          unoptimized={isSvgUrl(l.image_url)}
                          className="mx-auto h-14 w-20 object-contain"
                        />
                      ) : (
                        <span className="text-amber-500">—</span>
                      )}
                    </td>
                    <td className="border border-zinc-200 p-1.5 text-left dark:border-zinc-800">
                      <div className="font-mono text-[11px] text-zinc-400">
                        {l.product_code}
                        {l.customer_item_code && ` · KH: ${l.customer_item_code}`}
                      </div>
                      <div className="font-medium">{l.product_name}</div>
                      {l.description_en && (
                        <div className="text-[11px] text-zinc-500">
                          {l.description_en}
                        </div>
                      )}
                      {l.note && (
                        <div className="text-[11px] text-zinc-500 italic">{l.note}</div>
                      )}
                    </td>
                    <td className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                      {cell(dims)}
                    </td>
                    <td className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                      {cell(carton)}
                    </td>
                    <td className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                      {cell(inch)}
                    </td>
                    <td className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                      {cell(pk.qty_per_carton != null ? String(pk.qty_per_carton) : null)}
                    </td>
                    <td className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                      {cell(pk.loading_40hc != null ? String(pk.loading_40hc) : null)}
                    </td>
                    <td className="border border-zinc-200 p-1.5 dark:border-zinc-800">
                      {cell(nwgw)}
                    </td>
                    <td className="border border-zinc-200 p-1.5 text-right font-semibold dark:border-zinc-800">
                      {l.unit_price.toLocaleString('en-US')}
                      {l.discount_pct != null && l.discount_pct > 0 && (
                        <span className="block text-[10px] font-normal text-zinc-400">
                          −{l.discount_pct}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 pb-3 text-xs text-zinc-400">
          Báo giá chào theo <b>đơn giá</b> + quy cách — số lượng &amp; thành tiền nằm ở
          đơn hàng. Ô <span className="text-amber-500">—</span> là Kỹ thuật chưa khai.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <DocumentFiles
          kind="quote"
          id={quote.id}
          canEdit={canEdit}
          title="File báo giá gốc"
        />
      </section>

      {canEdit && isDraft && (
        <div className="flex justify-end">
          <button
            onClick={() => void remove()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            {busy && <Spinner size={14} />}
            Xoá báo giá nháp
          </button>
        </div>
      )}
    </div>
  )
}

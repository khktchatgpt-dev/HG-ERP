'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Badge } from '@/components/Badge'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'

/**
 * NHẬP BÁO GIÁ TỪ FILE EXCEL — hai nhịp, không ghi gì cho tới khi bấm lưu.
 *
 * Nhịp 1: chọn file → server đọc, khớp sản phẩm, trả về bảng để soi.
 * Nhịp 2: bỏ bớt dòng không muốn → chọn khách + tiền tệ → Lưu.
 *
 * Dòng thiếu dữ liệu (`blocked`) không cho tick — kèm lý do thiếu gì, để người
 * dùng sửa trong file rồi tải lại chứ không phải đoán.
 */

type PreviewRow = {
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
  unit_price: number | null
  note: string | null
  missing: string[]
  warnings: string[]
  action: 'existing' | 'new' | 'blocked'
  matched_product_id: string | null
  matched_label: string | null
  ambiguous: boolean
  has_image: boolean
  blocked_reason: string | null
}

type Preview = {
  source_file_id: string
  sheet_name: string
  header_row: number | null
  rows: PreviewRow[]
  skipped: { row: number; text: string; reason: string }[]
  summary: { total: number; existing: number; new_products: number; blocked: number }
}

type Customer = { id: string; name: string; default_currency: string | null }

const dims = (r: PreviewRow) =>
  r.length_mm != null && r.width_mm != null && r.height_mm != null
    ? `${r.length_mm} × ${r.width_mm} × ${r.height_mm}`
    : '—'

export function ImportQuoteScreen({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [skip, setSkip] = useState<Set<number>>(new Set())
  const [customerId, setCustomerId] = useState('')
  const [currency, setCurrency] = useState('USD')

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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
      const data = (await res.json()) as Preview
      setPreview(data)
      setSkip(new Set(data.rows.filter((r) => r.action === 'blocked').map((r) => r.row)))
      toast.success(
        'Đã đọc file',
        `${data.summary.total} dòng · ${data.summary.new_products} SP mới · ${data.summary.blocked} dòng thiếu dữ liệu`,
      )
    } catch (err) {
      toast.error('Không đọc được file', err instanceof Error ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  function toggle(row: number) {
    setSkip((s) => {
      const next = new Set(s)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return next
    })
  }

  const kept =
    preview?.rows.filter((r) => !skip.has(r.row) && r.action !== 'blocked') ?? []

  async function save() {
    if (!preview || !customerId || kept.length === 0) return
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
              product_id: r.matched_product_id,
              code: r.code,
              name: r.name,
              description_en: r.description_en,
              customer_item_code: r.customer_item_code,
              unit: r.unit,
              unit_price: r.unit_price,
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
        'Đã tạo báo giá',
        res.created_products > 0
          ? `${res.created_products} sản phẩm mới đã vào thư viện`
          : 'Không có sản phẩm mới',
      )
      router.push(`/sales/quotes/${res.quote_id}`)
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Báo giá', href: '/sales/quotes' },
          { label: 'Nhập từ Excel' },
        ]}
        title="Nhập báo giá từ file Excel"
        description="Đọc file báo giá có sẵn: khớp sản phẩm cũ, tạo sản phẩm mới kèm ảnh và thông số. Không ghi gì cho tới khi bấm Lưu."
        actions={
          /*
           * Tải file: phải là <a> thật để trình duyệt nhận content-disposition —
           * <Link> của Next điều hướng client-side nên không tải xuống được.
           * eslint-disable-next-line @next/next/no-html-link-for-pages
           */
          <a
            href="/api/dept/sales/quotes/import/template"
            download
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            ⭳ Tải file mẫu
          </a>
        }
      />

      {!preview && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <p className="mb-1 text-sm font-medium">Chọn file báo giá (.xlsx)</p>
          <p className="mb-4 text-xs text-zinc-500">
            Dùng mẫu <b>BÁO GIÁ — SẢN PHẨM MỚI</b>. Ảnh chèn đè lên ô cột “Ảnh” của đúng
            dòng. Kích thước theo (L/D × W × H) mm.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
            {busy && <Spinner size={14} />}
            Chọn file…
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => void onPick(e)}
              disabled={busy}
            />
          </label>
        </div>
      )}

      {preview && (
        <>
          <StatsBar
            stats={[
              { label: 'Dòng đọc được', value: preview.summary.total, tone: 'default' },
              { label: 'Khớp SP có sẵn', value: preview.summary.existing, tone: 'blue' },
              {
                label: 'Sẽ tạo SP mới',
                value: preview.summary.new_products,
                tone: preview.summary.new_products ? 'green' : 'gray',
              },
              {
                label: 'Thiếu dữ liệu',
                value: preview.summary.blocked,
                tone: preview.summary.blocked ? 'red' : 'gray',
              },
            ]}
          />

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Khách hàng <span className="text-red-500">*</span>
              </span>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value)
                  const c = customers.find((x) => x.id === e.target.value)
                  if (c?.default_currency) setCurrency(c.default_currency)
                }}
                className="h-9 min-w-64 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— chọn khách hàng —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Tiền tệ</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                className="h-9 w-24 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPreview(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Chọn file khác
              </button>
              <button
                disabled={busy || !customerId || kept.length === 0}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Lưu {kept.length} dòng thành báo giá
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase dark:bg-zinc-900">
                <tr>
                  <th className="w-10 px-2 py-2">Lấy</th>
                  <th className="w-14 px-2 py-2">Dòng</th>
                  <th className="px-2 py-2">Sản phẩm</th>
                  <th className="px-2 py-2">Việc sẽ làm</th>
                  <th className="px-2 py-2">KT (mm)</th>
                  <th className="px-2 py-2 text-right">Đơn giá</th>
                  <th className="w-12 px-2 py-2">Ảnh</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const off = skip.has(r.row) || r.action === 'blocked'
                  return (
                    <tr
                      key={r.row}
                      className={`border-t border-zinc-100 dark:border-zinc-900 ${off ? 'opacity-50' : ''}`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={!off}
                          disabled={r.action === 'blocked'}
                          onChange={() => toggle(r.row)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-zinc-400">{r.row}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col">
                          <span className="font-medium">{r.name ?? '—'}</span>
                          <span className="text-[11px] text-zinc-500">
                            {[
                              r.code,
                              r.customer_item_code && `KH: ${r.customer_item_code}`,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </span>
                          {r.warnings.map((w) => (
                            <span
                              key={w}
                              className="text-[11px] text-amber-600 dark:text-amber-500"
                            >
                              ⚠ {w}
                            </span>
                          ))}
                          {r.blocked_reason && (
                            <span className="text-[11px] text-red-600 dark:text-red-400">
                              {r.blocked_reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        {r.action === 'blocked' ? (
                          <Badge tone="red">bỏ qua</Badge>
                        ) : r.action === 'existing' ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge tone="blue">dùng SP có sẵn</Badge>
                            <span className="text-[11px] text-zinc-500">
                              {r.matched_label}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <Badge tone="green">tạo SP mới</Badge>
                            {r.ambiguous && (
                              <span className="text-[11px] text-amber-600">
                                trùng nhiều SP — kiểm lại mã
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{dims(r)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {r.unit_price?.toLocaleString('en-US') ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r.has_image ? '🖼' : <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {preview.skipped.length > 0 && (
            <p className="text-xs text-zinc-500">
              Bỏ {preview.skipped.length} dòng khi đọc file:{' '}
              {preview.skipped
                .slice(0, 5)
                .map((s) => `dòng ${s.row} (${s.reason})`)
                .join(' · ')}
            </p>
          )}

          <p className="text-xs text-zinc-500">
            Đọc sheet <b>{preview.sheet_name}</b>, tiêu đề ở dòng {preview.header_row}.{' '}
            <Link href="/sales/quotes" className="underline">
              Về danh sách báo giá
            </Link>
          </p>
        </>
      )}
    </div>
  )
}

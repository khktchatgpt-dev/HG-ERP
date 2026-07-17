'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { ProductFilesPanel } from '@/components/technical/ProductFilesPanel'

type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
  pack_unit_label?: string
  nw_kg?: number
  gw_kg?: number
}
type TechSpec = {
  machine?: string
  cushion?: string
  paint?: string
  glass?: string
  wood?: string
}

export type ProductFull = {
  id: string
  image_file_id: string | null
  code: string
  name: string
  category: string | null
  customer_id: string | null
  customer_item_code: string | null
  description_en: string | null
  unit: string
  bom_status: 'none' | 'drawing' | 'done'
  packing: Packing
  notes: string | null
  name_foreign: string | null
  shipping_mark: string | null
  barcode: string | null
  showroom_sample: boolean
  reference_price: number | null
  tech_spec: TechSpec
  hs_code: string | null
  origin_country: string | null
  material: string | null
  max_load_kg: number | null
  assembly: 'assembled' | 'kd' | null
  set_contents: string | null
}

export type CustomerOption = { id: string; name: string }

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function ProductForm({
  mode,
  initial,
  customers,
}: {
  mode: 'create' | 'edit'
  initial?: ProductFull
  customers: CustomerOption[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const strOrUndef = (k: string) => String(fd.get(k) ?? '').trim() || undefined
    const packing: Packing = {
      l_cm: numOrUndef(fd.get('l_cm')),
      w_cm: numOrUndef(fd.get('w_cm')),
      h_cm: numOrUndef(fd.get('h_cm')),
      carton_l_cm: numOrUndef(fd.get('carton_l_cm')),
      carton_w_cm: numOrUndef(fd.get('carton_w_cm')),
      carton_h_cm: numOrUndef(fd.get('carton_h_cm')),
      qty_per_carton: numOrUndef(fd.get('qty_per_carton')),
      loading_40hc: numOrUndef(fd.get('loading_40hc')),
      pack_unit_label: strOrUndef('pack_unit_label'),
      nw_kg: numOrUndef(fd.get('nw_kg')),
      gw_kg: numOrUndef(fd.get('gw_kg')),
    }
    const tech_spec: TechSpec = {
      machine: strOrUndef('machine'),
      cushion: strOrUndef('cushion'),
      paint: strOrUndef('paint'),
      glass: strOrUndef('glass'),
      wood: strOrUndef('wood'),
    }
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      category: String(fd.get('category') ?? '').trim() || null,
      customer_id: String(fd.get('customer_id') ?? '') || null,
      customer_item_code: String(fd.get('customer_item_code') ?? '').trim() || null,
      description_en: String(fd.get('description_en') ?? '').trim() || null,
      unit: String(fd.get('unit') ?? '').trim() || 'cai',
      packing,
      notes: String(fd.get('notes') ?? '').trim() || null,
      name_foreign: String(fd.get('name_foreign') ?? '').trim() || null,
      shipping_mark: String(fd.get('shipping_mark') ?? '').trim() || null,
      barcode: String(fd.get('barcode') ?? '').trim() || null,
      showroom_sample: fd.get('showroom_sample') === 'on',
      reference_price: numOrUndef(fd.get('reference_price')) ?? null,
      tech_spec,
      hs_code: String(fd.get('hs_code') ?? '').trim() || null,
      origin_country: String(fd.get('origin_country') ?? '').trim() || null,
      material: String(fd.get('material') ?? '').trim() || null,
      max_load_kg: numOrUndef(fd.get('max_load_kg')) ?? null,
      assembly: String(fd.get('assembly') ?? '') || null,
      set_contents: String(fd.get('set_contents') ?? '').trim() || null,
    }
    if (mode === 'edit') {
      body.bom_status = String(fd.get('bom_status') ?? initial!.bom_status)
    }

    setBusy(true)
    try {
      if (mode === 'create') {
        const { product } = await api<{ product: { id: string } }>(
          '/api/dept/technical/products',
          { method: 'POST', body },
        )
        toast.success('Đã thêm sản phẩm', String(body.name))
        router.push(`/technical/products/${product.id}`)
      } else {
        await api(`/api/dept/technical/products/${initial!.id}`, {
          method: 'PATCH',
          body,
        })
        toast.success('Đã lưu sản phẩm', String(body.name))
        router.push(`/technical/products/${initial!.id}`)
      }
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
      setBusy(false)
    }
  }

  const pk = initial?.packing ?? {}
  const ts = initial?.tech_spec ?? {}
  const backHref =
    mode === 'edit' ? `/technical/products/${initial!.id}` : '/technical/products'

  return (
    <div className="flex flex-col gap-4 pb-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Thư viện sản phẩm', href: '/technical/products' },
          { label: mode === 'create' ? 'Thêm sản phẩm' : `Sửa ${initial!.code}` },
        ]}
        title={mode === 'create' ? 'Thêm sản phẩm' : `Sửa sản phẩm ${initial!.code}`}
        description="Thư viện là nguồn chuẩn — quy cách/thông số ở đây in ra báo giá & LSX."
        actions={
          <Link
            href={backHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Huỷ
          </Link>
        }
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Mã nội bộ <span className="text-red-500">*</span>
            <input
              name="code"
              required
              maxLength={100}
              defaultValue={initial?.code ?? ''}
              className={`${cls} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Mã KH đặt (Customer Item)
            <input
              name="customer_item_code"
              maxLength={100}
              defaultValue={initial?.customer_item_code ?? ''}
              className={`${cls} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Tên SP (tiếng Việt) <span className="text-red-500">*</span>
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={initial?.name ?? ''}
              className={cls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Tên theo khách — mọi ngôn ngữ (in trên LSX)
            <input
              name="name_foreign"
              maxLength={300}
              defaultValue={initial?.name_foreign ?? ''}
              className={cls}
              placeholder="Tên hàng theo cách gọi của khách (Đức / Anh / Pháp…)"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Barcode
            <input
              name="barcode"
              maxLength={50}
              defaultValue={initial?.barcode ?? ''}
              className={`${cls} font-mono`}
              placeholder="4033662987552"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Giá tham khảo (nội bộ)
            <input
              name="reference_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.reference_price ?? ''}
              className={cls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Khách hàng
            <select
              name="customer_id"
              defaultValue={initial?.customer_id ?? ''}
              className={cls}
            >
              <option value="">Mẫu chung (không gắn khách)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Danh mục
            <input
              name="category"
              maxLength={100}
              defaultValue={initial?.category ?? ''}
              className={cls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ĐVT bán
            <input
              name="unit"
              maxLength={30}
              defaultValue={initial?.unit ?? 'cai'}
              className={cls}
            />
          </label>
          {mode === 'edit' && (
            <label className="flex flex-col gap-1 text-sm">
              Trạng thái BOM
              <select
                name="bom_status"
                defaultValue={initial!.bom_status}
                className={cls}
              >
                <option value="none">Chưa có BOM</option>
                <option value="drawing">Đang vẽ</option>
                <option value="done">Đã vẽ</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Mô tả tiếng Anh (in báo giá)
            <textarea
              name="description_en"
              rows={2}
              maxLength={2000}
              defaultValue={initial?.description_en ?? ''}
              className={cls}
              placeholder="Materials: FSC eucalyptus wood with powder-coated aluminium frame…"
            />
          </label>

          <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:col-span-2 sm:grid-cols-4 dark:border-zinc-800">
            <legend className="px-1 text-xs font-semibold text-zinc-500 uppercase">
              Đóng gói xuất khẩu (in báo giá / xếp cont)
            </legend>
            {(
              [
                ['l_cm', 'Dài (cm)', '0.1'],
                ['w_cm', 'Rộng (cm)', '0.1'],
                ['h_cm', 'Cao (cm)', '0.1'],
                ['qty_per_carton', 'SP / thùng', '1'],
                ['carton_l_cm', 'Carton dài (cm)', '0.1'],
                ['carton_w_cm', 'Carton rộng (cm)', '0.1'],
                ['carton_h_cm', 'Carton cao (cm)', '0.1'],
                ['loading_40hc', "Loading 40'HC", '1'],
                ['nw_kg', 'NW / thùng (kg)', '0.01'],
                ['gw_kg', 'GW / thùng (kg)', '0.01'],
              ] as const
            ).map(([name, label, step]) => (
              <label key={name} className="flex flex-col gap-1 text-xs">
                {label}
                <input
                  name={name}
                  type="number"
                  step={step}
                  min="0"
                  defaultValue={(pk[name as keyof Packing] as number | undefined) ?? ''}
                  className={cls}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs">
              Đơn vị đóng gói
              <input
                name="pack_unit_label"
                maxLength={30}
                defaultValue={pk.pack_unit_label ?? ''}
                className={cls}
                placeholder="ctn / pallet"
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:col-span-2 sm:grid-cols-3 dark:border-zinc-800">
            <legend className="px-1 text-xs font-semibold text-zinc-500 uppercase">
              Xuất khẩu & đặc tính (khai hải quan / catalogue)
            </legend>
            <label className="flex flex-col gap-1 text-xs">
              Mã HS (hải quan)
              <input
                name="hs_code"
                maxLength={20}
                defaultValue={initial?.hs_code ?? ''}
                className={`${cls} font-mono`}
                placeholder="9401.69.90"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Xuất xứ
              <input
                name="origin_country"
                maxLength={100}
                defaultValue={initial?.origin_country ?? ''}
                className={cls}
                placeholder="Việt Nam"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Tải trọng tối đa (kg)
              <input
                name="max_load_kg"
                type="number"
                step="0.1"
                min="0"
                defaultValue={initial?.max_load_kg ?? ''}
                className={cls}
                placeholder="120"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Chất liệu chính
              <input
                name="material"
                maxLength={300}
                defaultValue={initial?.material ?? ''}
                className={cls}
                placeholder="Khung nhôm sơn tĩnh điện + mây nhựa HDPE"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Lắp ráp
              <select
                name="assembly"
                defaultValue={initial?.assembly ?? ''}
                className={cls}
              >
                <option value="">—</option>
                <option value="assembled">Nguyên chiếc</option>
                <option value="kd">Tháo rời (KD)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Bộ gồm (nếu là bộ)
              <input
                name="set_contents"
                maxLength={500}
                defaultValue={initial?.set_contents ?? ''}
                className={cls}
                placeholder="1 bàn + 6 ghế"
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:col-span-2 sm:grid-cols-3 dark:border-zinc-800">
            <legend className="px-1 text-xs font-semibold text-zinc-500 uppercase">
              Thông số sản xuất (in trên LSX)
            </legend>
            <label className="flex flex-col gap-1 text-xs">
              Máy
              <input
                name="machine"
                maxLength={200}
                defaultValue={ts.machine ?? ''}
                className={cls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Nệm
              <input
                name="cushion"
                maxLength={200}
                defaultValue={ts.cushion ?? ''}
                className={cls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Sơn (mã màu)
              <input
                name="paint"
                maxLength={200}
                defaultValue={ts.paint ?? ''}
                className={cls}
                placeholder="Màu Graphit H-SM-96 08"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Kính
              <input
                name="glass"
                maxLength={200}
                defaultValue={ts.glass ?? ''}
                className={cls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Gỗ
              <input
                name="wood"
                maxLength={200}
                defaultValue={ts.wood ?? ''}
                className={cls}
                placeholder="Acacia FSC 100% Màu 142"
              />
            </label>
            <label className="flex items-center gap-2 text-xs sm:self-end">
              <input
                type="checkbox"
                name="showroom_sample"
                defaultChecked={initial?.showroom_sample ?? false}
              />
              Có mẫu tại showroom
            </label>
            <label className="flex flex-col gap-1 text-xs sm:col-span-3">
              Nội dung shipping mark
              <textarea
                name="shipping_mark"
                rows={2}
                maxLength={2000}
                defaultValue={initial?.shipping_mark ?? ''}
                className={cls}
              />
            </label>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Ghi chú
            <textarea
              name="notes"
              rows={2}
              maxLength={2000}
              defaultValue={initial?.notes ?? ''}
              className={cls}
            />
          </label>

          <div className="sticky bottom-3 z-10 mt-2 flex justify-end gap-2 sm:col-span-2">
            <Link
              href={backHref}
              className="rounded-md border border-zinc-300 bg-white/95 px-4 py-2 text-sm backdrop-blur hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/95 dark:hover:bg-zinc-900"
            >
              Huỷ
            </Link>
            <button
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : mode === 'create' ? 'Thêm sản phẩm' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </section>

      {/* Tài liệu — chỉ khi SỬA (lúc tạo chưa có id để gắn file). */}
      {mode === 'edit' ? (
        <ProductFilesPanel productId={initial!.id} canEdit />
      ) : (
        <p className="rounded-md bg-sky-50 p-2.5 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          ℹ Tải bản vẽ / BOM / hướng dẫn lắp ráp… sau khi bấm <b>Thêm sản phẩm</b> — hồ sơ
          tài liệu mở ngay ở trang sản phẩm. Ảnh SP thêm bằng cách bấm vào ô ảnh.
        </p>
      )}
    </div>
  )
}

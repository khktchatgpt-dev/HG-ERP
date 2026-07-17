'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { ProductFilesPanel } from '@/components/technical/ProductFilesPanel'
import { ProductImagePanel } from '@/components/technical/ProductImagePanel'

type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
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
type BomStatus = 'none' | 'drawing' | 'done'

export type ProductView = {
  id: string
  code: string
  name: string
  category: string | null
  customer_item_code: string | null
  description_en: string | null
  unit: string
  bom_status: BomStatus
  packing: Packing
  image_file_id: string | null
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
  is_active: boolean
}

export type BomLineView = {
  material_code: string
  material_name: string
  material_unit: string
  qty_per_unit: number
  note: string | null
}

const BOM_LABEL: Record<BomStatus, string> = {
  none: 'Chưa có BOM',
  drawing: 'Đang vẽ',
  done: 'Đã vẽ',
}
const BOM_TONE: Record<BomStatus, 'gray' | 'amber' | 'green'> = {
  none: 'gray',
  drawing: 'amber',
  done: 'green',
}

const dim3 = (a?: number, b?: number, c?: number) =>
  a != null && b != null && c != null ? `${a} × ${b} × ${c} cm` : null

export function ProductDetailView({
  product,
  customerName,
  imageUrl,
  bom,
  canEdit,
}: {
  product: ProductView
  customerName: string | null
  imageUrl: string | null
  bom: BomLineView[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const pk = product.packing ?? {}
  const ts = product.tech_spec ?? {}
  const dims = dim3(pk.l_cm, pk.w_cm, pk.h_cm)
  const carton = dim3(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)
  const cbm =
    pk.carton_l_cm != null && pk.carton_w_cm != null && pk.carton_h_cm != null
      ? (pk.carton_l_cm * pk.carton_w_cm * pk.carton_h_cm) / 1_000_000
      : null

  async function toggleActive() {
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${product.id}`, {
        method: 'PATCH',
        body: { is_active: !product.is_active },
      })
      toast.success(product.is_active ? 'Đã ngừng sử dụng' : 'Đã kích hoạt lại')
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Xoá sản phẩm "${product.name}"?`,
      description: 'BOM của sản phẩm cũng bị xoá theo. Không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${product.id}`, { method: 'DELETE' })
      toast.success('Đã xoá', product.name)
      router.push('/technical/products')
    } catch (e) {
      toast.error('Xoá thất bại', apiErrorText(e))
      setBusy(false)
    }
  }

  // 'openbom' (không phải 'bom') để tránh đụng tham số lọc BOM của thư viện.
  const editHref = (action: 'edit' | 'clone' | 'openbom') =>
    `/technical/products?${action}=${product.id}`

  return (
    <div className="flex flex-col gap-5 pb-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Thư viện sản phẩm', href: '/technical/products' },
          { label: product.code },
        ]}
        title={product.name}
        description={product.code}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <a
                  href={editHref('openbom')}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  BOM định mức
                </a>
                <a
                  href={editHref('clone')}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Nhân bản
                </a>
                <a
                  href={`/technical/products/${product.id}/edit`}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Sửa
                </a>
              </>
            )}
          </div>
        }
      />

      {/* Ảnh + tóm tắt */}
      <section className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <ProductImagePanel
          productId={product.id}
          productName={product.name}
          imageFileId={product.image_file_id}
          imageUrl={imageUrl}
          canEdit={canEdit}
        />
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={BOM_TONE[product.bom_status]}>
              {BOM_LABEL[product.bom_status]}
            </Badge>
            <Badge tone={product.is_active ? 'green' : 'gray'}>
              {product.is_active ? 'Đang dùng' : 'Ngừng'}
            </Badge>
            {customerName ? (
              <Badge tone="blue">{customerName}</Badge>
            ) : (
              <Badge tone="gray">Mẫu chung</Badge>
            )}
            {product.showroom_sample && <Badge tone="green">Có mẫu showroom</Badge>}
          </div>
          <FieldGrid>
            <Field label="Tên theo khách" value={product.name_foreign} span={3} />
            <Field label="Mã KH đặt" value={product.customer_item_code} mono />
            <Field label="Danh mục" value={product.category} />
            <Field label="ĐVT" value={product.unit} />
            <Field
              label="Giá tham khảo"
              value={product.reference_price?.toLocaleString('en-US') ?? null}
            />
            <Field label="Barcode" value={product.barcode} mono />
          </FieldGrid>
          {product.description_en && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              <span className="text-zinc-400">Mô tả EN: </span>
              {product.description_en}
            </p>
          )}
        </div>
      </section>

      {/* Đóng gói xuất khẩu */}
      <Card title="Đóng gói xuất khẩu (in báo giá / xếp cont)">
        <FieldGrid cols={4}>
          <Field label="Kích thước SP" value={dims} />
          <Field label="Carton" value={carton} />
          <Field
            label="SP / thùng"
            value={pk.qty_per_carton != null ? String(pk.qty_per_carton) : null}
          />
          <Field
            label="Loading 40'HC"
            value={pk.loading_40hc != null ? String(pk.loading_40hc) : null}
          />
          <Field label="NW / thùng" value={pk.nw_kg != null ? `${pk.nw_kg} kg` : null} />
          <Field label="GW / thùng" value={pk.gw_kg != null ? `${pk.gw_kg} kg` : null} />
          <Field
            label="CBM / thùng"
            value={cbm != null ? `${cbm.toFixed(3)} m³` : null}
          />
        </FieldGrid>
      </Card>

      {/* Xuất khẩu & đặc tính */}
      <Card title="Xuất khẩu & đặc tính (khai hải quan / catalogue)">
        <FieldGrid cols={4}>
          <Field label="Mã HS" value={product.hs_code} mono />
          <Field label="Xuất xứ" value={product.origin_country} />
          <Field label="Chất liệu chính" value={product.material} />
          <Field
            label="Tải trọng tối đa"
            value={product.max_load_kg != null ? `${product.max_load_kg} kg` : null}
          />
          <Field
            label="Lắp ráp"
            value={
              product.assembly === 'kd'
                ? 'Tháo rời (KD)'
                : product.assembly === 'assembled'
                  ? 'Nguyên chiếc'
                  : null
            }
          />
          <Field label="Bộ gồm" value={product.set_contents} />
        </FieldGrid>
      </Card>

      {/* Thông số sản xuất (LSX) */}
      {(ts.machine || ts.cushion || ts.paint || ts.glass || ts.wood) && (
        <Card title="Thông số sản xuất (in trên LSX)">
          <FieldGrid cols={4}>
            <Field label="Máy" value={ts.machine} />
            <Field label="Nệm" value={ts.cushion} />
            <Field label="Sơn" value={ts.paint} />
            <Field label="Kính" value={ts.glass} />
            <Field label="Gỗ" value={ts.wood} />
          </FieldGrid>
        </Card>
      )}

      {/* BOM định mức (read-only) */}
      <Card
        title={`BOM định mức (${bom.length})`}
        right={
          canEdit ? (
            <a
              href={editHref('openbom')}
              className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              Sửa BOM
            </a>
          ) : null
        }
      >
        {bom.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Chưa bóc tách định mức vật tư. {canEdit && 'Bấm “Sửa BOM” để thêm.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                  <th className="py-2 pr-3">Vật tư</th>
                  <th className="py-2 pr-3 text-right">Định mức / SP</th>
                  <th className="py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((l, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1.5 pr-3">
                      <span className="font-mono text-xs text-zinc-400">
                        {l.material_code}
                      </span>{' '}
                      {l.material_name}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {l.qty_per_unit.toLocaleString('en-US')} {l.material_unit}
                    </td>
                    <td className="py-1.5 text-zinc-500">{l.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {product.shipping_mark && (
        <Card title="Shipping mark">
          <p className="text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
            {product.shipping_mark}
          </p>
        </Card>
      )}
      {product.notes && (
        <Card title="Ghi chú">
          <p className="text-sm whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
            {product.notes}
          </p>
        </Card>
      )}

      <ProductFilesPanel productId={product.id} canEdit={canEdit} />

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => void toggleActive()}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {product.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại'}
          </button>
          <button
            onClick={() => void remove()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            {busy && <Spinner size={14} />}
            Xoá sản phẩm
          </button>
        </div>
      )}
    </div>
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

function FieldGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-4 gap-y-2 ${cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
    >
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  mono,
  span,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  /**
   * Số cột chiếm ở breakpoint sm. Dành cho field văn bản dài (tên theo khách,
   * mô tả): để mặc định 1 cột thì chúng xuống 3-4 dòng trong khi field ngắn bên
   * cạnh bỏ trống chỗ. Mobile luôn full width vì lưới chỉ có 2 cột.
   */
  span?: 2 | 3
}) {
  const spanClass = span
    ? `col-span-2 ${span === 3 ? 'sm:col-span-3' : 'sm:col-span-2'}`
    : ''
  return (
    <div className={`flex min-w-0 flex-col ${spanClass}`}>
      <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
        {label}
      </span>
      <span
        className={
          value
            ? mono
              ? 'font-mono text-sm break-words'
              : 'text-sm break-words'
            : 'text-sm text-zinc-400'
        }
      >
        {value ?? '—'}
      </span>
    </div>
  )
}

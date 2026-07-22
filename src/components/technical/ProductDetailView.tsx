'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Boxes,
  Copy,
  Globe2,
  ListTree,
  Package,
  Pencil,
  Ruler,
  Ship,
  StickyNote,
} from 'lucide-react'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Card, CardContent } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { cn } from '@/lib/utils'
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
const BOM_TONE: Record<BomStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  drawing: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
}

const dim3 = (a?: number, b?: number, c?: number) =>
  a != null && b != null && c != null ? `${a} × ${b} × ${c} cm` : null
const num = (n?: number | null, suffix = '') =>
  n != null ? `${n.toLocaleString('en-US')}${suffix}` : null

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

  const editHref = `/technical/products/${product.id}/edit`
  // 'openbom'/'clone' đi qua thư viện (dialog); 'bom' đụng tham số lọc BOM.
  const libHref = (action: 'clone' | 'openbom') =>
    `/technical/products?${action}=${product.id}`

  // ── Hồ sơ hoàn thiện: đếm trường đã điền / tổng, dẫn người dùng bổ sung ──
  const checklist = useMemo(
    () =>
      [
        ['Ảnh sản phẩm', !!product.image_file_id],
        ['Tên theo khách', !!product.name_foreign],
        ['Mã KH đặt', !!product.customer_item_code],
        ['Mô tả', !!product.description_en],
        ['Chất liệu', !!product.material],
        ['Kích thước SP', dims != null],
        ['Đóng gói carton', carton != null],
        ['SP / thùng', pk.qty_per_carton != null],
        ['Loading 40′HC', pk.loading_40hc != null],
        ['NW / GW', pk.nw_kg != null || pk.gw_kg != null],
        ['Mã HS', !!product.hs_code],
        ['Xuất xứ', !!product.origin_country],
        ['Tải trọng', product.max_load_kg != null],
        ['Lắp ráp', !!product.assembly],
        ['Barcode', !!product.barcode],
        ['Giá tham khảo', product.reference_price != null],
        ['BOM / bản vẽ', product.bom_status !== 'none'],
      ] as [string, boolean][],
    [product, dims, carton, pk.qty_per_carton, pk.loading_40hc, pk.nw_kg, pk.gw_kg],
  )
  const done = checklist.filter(([, v]) => v).length
  const pct = Math.round((done / checklist.length) * 100)
  const missing = checklist.filter(([, v]) => !v).map(([l]) => l)

  const quickStats = [
    { icon: Ruler, label: 'Kích thước', value: dims },
    { icon: Boxes, label: 'Chất liệu', value: product.material },
    { icon: Package, label: 'ĐVT', value: product.unit },
    { icon: ListTree, label: 'Mã KH', value: product.customer_item_code, mono: true },
  ].filter((s) => s.value)

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

  return (
    <div className="flex flex-col gap-6 pb-6">
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
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={libHref('openbom')}>
                  <ListTree className="size-4" /> BOM định mức
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={libHref('clone')}>
                  <Copy className="size-4" /> Nhân bản
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={editHref}>
                  <Pencil className="size-4" /> Sửa
                </a>
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* ── Cột trái: ảnh + hồ sơ hoàn thiện (sticky) ── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <ProductImagePanel
            productId={product.id}
            productName={product.name}
            imageFileId={product.image_file_id}
            imageUrl={imageUrl}
            canEdit={canEdit}
          />
          <CompletenessCard
            pct={pct}
            done={done}
            total={checklist.length}
            missing={missing}
            editHref={editHref}
            canEdit={canEdit}
          />
        </div>

        {/* ── Cột phải: nhận diện + chỉ số + thông số + BOM + tài liệu ── */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Nhận diện */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('border-transparent', BOM_TONE[product.bom_status])}>
              {BOM_LABEL[product.bom_status]}
            </Badge>
            <Badge variant={product.is_active ? 'secondary' : 'outline'}>
              {product.is_active ? 'Đang dùng' : 'Ngừng dùng'}
            </Badge>
            {product.category && <Badge variant="outline">{product.category}</Badge>}
            {customerName ? (
              <Badge variant="outline">{customerName}</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Mẫu chung
              </Badge>
            )}
            {product.showroom_sample && (
              <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Có mẫu showroom
              </Badge>
            )}
          </div>

          {/* Chỉ số nhanh */}
          {quickStats.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickStats.map((s) => (
                <div key={s.label} className="bg-card rounded-lg border px-3 py-2.5">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
                    <s.icon className="size-3.5" /> {s.label}
                  </div>
                  <div
                    className={cn(
                      'mt-1 truncate text-sm font-medium',
                      s.mono && 'font-mono',
                    )}
                    title={s.value ?? undefined}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {product.description_en && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {product.description_en}
            </p>
          )}

          {/* Tài liệu — catalog nội thất, đặt cao */}
          <ProductFilesPanel productId={product.id} canEdit={canEdit} />

          {/* Đóng gói xuất khẩu */}
          <SpecSection
            icon={Package}
            title="Đóng gói xuất khẩu"
            hint="in báo giá / xếp cont"
            fields={[
              ['Kích thước SP', dims],
              ['Carton', carton],
              ['SP / thùng', num(pk.qty_per_carton)],
              ['Loading 40′HC', num(pk.loading_40hc)],
              ['NW / thùng', num(pk.nw_kg, ' kg')],
              ['GW / thùng', num(pk.gw_kg, ' kg')],
              ['CBM / thùng', cbm != null ? `${cbm.toFixed(3)} m³` : null],
            ]}
          />

          {/* Đặc tính & hải quan */}
          <SpecSection
            icon={Globe2}
            title="Đặc tính & hải quan"
            hint="khai hải quan / catalogue"
            fields={[
              ['Mã HS', product.hs_code, true],
              ['Xuất xứ', product.origin_country],
              ['Chất liệu chính', product.material],
              ['Tải trọng tối đa', num(product.max_load_kg, ' kg')],
              [
                'Lắp ráp',
                product.assembly === 'kd'
                  ? 'Tháo rời (KD)'
                  : product.assembly === 'assembled'
                    ? 'Nguyên chiếc'
                    : null,
              ],
              ['Bộ gồm', product.set_contents],
              ['Tên theo khách', product.name_foreign],
              ['Mã KH đặt', product.customer_item_code, true],
              ['Barcode', product.barcode, true],
              [
                'Giá tham khảo',
                product.reference_price != null
                  ? product.reference_price.toLocaleString('en-US')
                  : null,
              ],
            ]}
          />

          {/* Thông số sản xuất (LSX) */}
          <SpecSection
            icon={Ship}
            title="Thông số sản xuất"
            hint="in trên LSX"
            fields={[
              ['Máy', ts.machine],
              ['Nệm', ts.cushion],
              ['Sơn', ts.paint],
              ['Kính', ts.glass],
              ['Gỗ', ts.wood],
            ]}
          />

          {/* BOM định mức */}
          <BomCard bom={bom} canEdit={canEdit} openHref={libHref('openbom')} />

          {product.shipping_mark && (
            <TextCard icon={Ship} title="Shipping mark" text={product.shipping_mark} />
          )}
          {product.notes && (
            <TextCard icon={StickyNote} title="Ghi chú" text={product.notes} />
          )}

          {canEdit && (
            <>
              <Separator />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleActive()}
                  disabled={busy}
                >
                  {product.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {busy && <Spinner size={14} />} Xoá sản phẩm
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CompletenessCard({
  pct,
  done,
  total,
  missing,
  editHref,
  canEdit,
}: {
  pct: number
  done: number
  total: number
  missing: string[]
  editHref: string
  canEdit: boolean
}) {
  const tone = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-sky-500' : 'bg-amber-500'
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Hồ sơ hoàn thiện
          </span>
          <span className="text-lg font-semibold tabular-nums">{pct}%</span>
        </div>
        <div
          className="bg-muted h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full rounded-full transition-all', tone)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Đã điền {done}/{total} trường
          {missing.length > 0 && (
            <>
              {' · còn thiếu '}
              <span className="text-foreground/70">
                {missing.slice(0, 3).join(', ')}
                {missing.length > 3 && `, +${missing.length - 3}`}
              </span>
            </>
          )}
        </p>
        {canEdit && missing.length > 0 && (
          <Button variant="outline" size="sm" className="mt-0.5 w-full" asChild>
            <a href={editHref}>
              Bổ sung thông tin <ArrowRight className="size-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/** Card thông số: CHỈ hiện trường có giá trị; rỗng hoàn toàn thì ẩn cả card. */
function SpecSection({
  icon: Icon,
  title,
  hint,
  fields,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
  fields: [string, string | null | undefined, boolean?][]
}) {
  const shown = fields.filter(([, v]) => v)
  if (shown.length === 0) return null
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Icon className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-muted-foreground text-xs">· {hint}</span>}
      </div>
      <Separator />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
        {shown.map(([label, value, mono]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {label}
            </dt>
            <dd className={cn('text-sm break-words', mono && 'font-mono')}>{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function BomCard({
  bom,
  canEdit,
  openHref,
}: {
  bom: BomLineView[]
  canEdit: boolean
  openHref: string
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <ListTree className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">BOM định mức</h2>
          <span className="text-muted-foreground text-xs">· {bom.length} dòng</span>
        </div>
        {canEdit && (
          <a href={openHref} className="text-primary text-xs font-medium hover:underline">
            Sửa BOM
          </a>
        )}
      </div>
      <Separator />
      {bom.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">
          Chưa bóc tách định mức vật tư.{canEdit && ' Bấm “Sửa BOM” để thêm.'}
        </p>
      ) : (
        <div className="overflow-x-auto px-5 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <th className="py-2 pr-3 font-medium">Vật tư</th>
                <th className="py-2 pr-3 text-right font-medium">Định mức / SP</th>
                <th className="py-2 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="text-muted-foreground font-mono text-xs">
                      {l.material_code}
                    </span>{' '}
                    {l.material_name}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {l.qty_per_unit.toLocaleString('en-US')} {l.material_unit}
                  </td>
                  <td className="text-muted-foreground py-1.5">{l.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function TextCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
}) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Icon className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <Separator />
      <p className="text-muted-foreground px-5 py-4 text-sm whitespace-pre-wrap">
        {text}
      </p>
    </Card>
  )
}

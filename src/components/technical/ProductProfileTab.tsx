'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Globe2, Package, Ship, StickyNote } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { ProductImagePanel } from '@/components/technical/ProductImagePanel'
import { EYEBROW, SpecSection, TextCard } from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import type { PackingOptionView } from '@/components/technical/ProductProfileCards'
import {
  SECTION_TAB,
  cartonCbm,
  dim3,
  num,
  withPackingFallback,
  type ProductView,
} from '@/components/technical/product-sections'

/**
 * Tab HỒ SƠ — đọc như một tờ PHIẾU THÔNG SỐ sản phẩm, không phải dashboard:
 *
 *  1. Măng-sét: ảnh + tên khách gọi + các mã nhận diện.
 *  2. Dải hoàn thiện: % + những mục còn thiếu, bấm được để nhảy thẳng tới nơi điền.
 *  3. Băng quy cách xuất khẩu: mấy con số cả nhà máy chạy theo, cỡ chữ lớn nhất trang.
 *  4. Tóm tắt đặc tính / thông số SX / mô tả — chỉ đọc, sửa nằm ở tab của nó.
 *
 * Mã và tên SP KHÔNG lặp ở đây: `layout.tsx` đã in trên PageHeader + badge.
 */
export function ProductProfileTab({
  product,
  packingOptions,
  imageUrl,
  suggestions,
  canEdit,
}: {
  product: ProductView
  /** Bù các ô "Quy cách xuất khẩu" còn trống bằng phương án đóng gói mặc định. */
  packingOptions: PackingOptionView[]
  imageUrl: string | null
  suggestions: Record<string, string[]>
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const { editingKey, editHandler, node } = useSectionEditor(
    product,
    suggestions,
    canEdit,
  )

  const pk = useMemo(
    () => withPackingFallback(product.packing ?? {}, packingOptions),
    [product.packing, packingOptions],
  )
  const ts = product.tech_spec ?? {}
  const dims = dim3(pk.l_cm, pk.w_cm, pk.h_cm)
  const carton = dim3(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)
  const cbm = cartonCbm(pk)
  const base = `/technical/products/${product.id}`

  // ── Hồ sơ hoàn thiện ──
  // Checklist bao trùm CẢ 4 tab, không riêng tab này. Cột thứ 3 là PHẦN chứa
  // trường đó, để mỗi mục còn thiếu bấm được và nhảy đúng chỗ điền.
  const checklist = useMemo(
    () =>
      [
        ['Ảnh sản phẩm', !!product.image_file_id, null],
        ['Tên theo khách', !!product.name_foreign, 'identity'],
        ['Mã KH đặt', !!product.customer_item_code, 'identity'],
        ['Barcode', !!product.barcode, 'identity'],
        ['Giá tham khảo', product.reference_price != null, 'identity'],
        ['Mô tả', !!product.description_en, 'text'],
        ['Chất liệu', !!product.material, 'export'],
        ['Tải trọng', product.max_load_kg != null, 'export'],
        ['Lắp ráp', !!product.assembly, 'export'],
        ['Kích thước SP', dims != null, 'packing'],
        ['Đóng gói carton', carton != null, 'packing'],
        ['SP / thùng', pk.qty_per_carton != null, 'packing'],
        ['Loading 40′HC', pk.loading_40hc != null, 'packing'],
        ['NW / GW', pk.nw_kg != null || pk.gw_kg != null, 'packing'],
        ['BOM / bản vẽ', product.bom_status !== 'none', null],
      ] as [string, boolean, string | null][],
    [product, dims, carton, pk.qty_per_carton, pk.loading_40hc, pk.nw_kg, pk.gw_kg],
  )
  const done = checklist.filter(([, v]) => v).length
  const pct = Math.round((done / checklist.length) * 100)
  const missing = checklist.filter(([, v]) => !v)

  /** Phần nằm ở tab khác thì điều hướng sang đó, ở tab này thì mở form tại chỗ. */
  function fillGap(section: string) {
    const tab = SECTION_TAB[section] ?? ''
    if (tab) router.push(`${base}/${tab}`)
    else editHandler(section)?.()
  }

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
    <div className="flex flex-col gap-4 pb-6">
      <TopProgressBar active={busy} />

      {/* ── 1. Măng-sét ── */}
      <Card
        className={cn(
          'gap-0 overflow-hidden py-0',
          editingKey === 'identity' && 'ring-primary/30 ring-1',
        )}
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          <div className="shrink-0 sm:w-52">
            <ProductImagePanel
              productId={product.id}
              productName={product.name}
              imageFileId={product.image_file_id}
              imageUrl={imageUrl}
              canEdit={canEdit}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {editingKey === 'identity' ? (
              node('identity')
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    <p className={EYEBROW}>Tên theo khách · in trên LSX</p>
                    <p
                      className={cn(
                        'mt-1 text-lg leading-snug font-medium',
                        !product.name_foreign && 'text-muted-foreground/50',
                      )}
                    >
                      {product.name_foreign || 'Chưa có tên theo khách'}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={editHandler('identity')}
                      className="text-primary focus-visible:ring-ring ml-auto shrink-0 rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Sửa nhận diện
                    </button>
                  )}
                </div>

                <Separator />

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                  {(
                    [
                      ['Khách hàng / nhóm', product.customer_name ?? 'Mẫu chung', false],
                      ['Mã KH đặt', product.customer_item_code, true],
                      ['Danh mục', product.category, false],
                      ['ĐVT bán', product.unit, false],
                      ['Barcode', product.barcode, true],
                      [
                        'Giá tham khảo',
                        product.reference_price != null
                          ? product.reference_price.toLocaleString('en-US')
                          : null,
                        false,
                      ],
                    ] as [string, string | null, boolean][]
                  ).map(([label, value, mono]) => (
                    <div key={label} className="flex min-w-0 flex-col gap-0.5">
                      <dt className={EYEBROW}>{label}</dt>
                      <dd
                        className={cn(
                          'text-sm break-words',
                          mono && value && 'font-mono',
                          !value && 'text-muted-foreground/50',
                        )}
                      >
                        {value || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* ── 2. Dải hoàn thiện — mỗi mục thiếu là một lối đi thẳng tới nơi điền ── */}
      <CompletenessStrip
        pct={pct}
        done={done}
        total={checklist.length}
        missing={missing}
        onFill={canEdit ? fillGap : null}
      />

      {/* ── 3. Băng quy cách — mấy con số cả nhà máy chạy theo ── */}
      <PackingBand
        href={`${base}/dong-goi`}
        cells={[
          ['Kích thước SP', dims],
          ['SP / thùng', num(pk.qty_per_carton)],
          ['Xếp 40′HC', num(pk.loading_40hc)],
          ['CBM / thùng', cbm != null ? `${cbm.toFixed(3)} m³` : null],
          ['GW / thùng', num(pk.gw_kg, ' kg')],
        ]}
      />

      {/* ── 4. Tóm tắt phần còn lại — chỉ đọc, sửa nằm ở tab tương ứng ── */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <SpecSection
          icon={Globe2}
          title="Đặc tính sản phẩm"
          hint="catalogue / báo giá"
          fields={[
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
          ]}
          moreHref={`${base}/thong-so`}
        />

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
            ['Mẫu showroom', product.showroom_sample ? 'Có' : 'Không'],
          ]}
          moreHref={`${base}/thong-so`}
        />
      </div>

      <TextCard
        icon={StickyNote}
        title="Mô tả & ghi chú"
        blocks={[
          ['Mô tả tiếng Anh (in báo giá)', product.description_en],
          ['Shipping mark', product.shipping_mark],
          ['Ghi chú nội bộ', product.notes],
        ]}
        onEdit={editHandler('text')}
        editing={node('text')}
      />

      {canEdit && (
        <>
          <Separator className="mt-2" />
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
  )
}

/**
 * Dải hoàn thiện hồ sơ. Mỗi mục còn thiếu là một chip BẤM ĐƯỢC — mở đúng hộp
 * thoại hoặc nhảy sang tab chứa nó, thay vì chỉ đọc một câu "còn thiếu…".
 */
function CompletenessStrip({
  pct,
  done,
  total,
  missing,
  onFill,
}: {
  pct: number
  done: number
  total: number
  /** [nhãn, đã điền, phần chứa nó] — phần null là mục không sửa bằng hộp thoại. */
  missing: [string, boolean, string | null][]
  onFill: ((section: string) => void) | null
}) {
  const tone = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-sky-500' : 'bg-amber-500'
  return (
    <div className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className={EYEBROW}>Hồ sơ hoàn thiện</span>
        <span className="text-base font-semibold tabular-nums">{pct}%</span>
        <div
          className="bg-muted h-1.5 w-24 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`Đã điền ${done}/${total} trường`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full rounded-full transition-all', tone)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {missing.length === 0 ? (
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" /> Đã điền đủ {total} mục
        </span>
      ) : (
        <>
          <span className={EYEBROW}>Còn thiếu</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {missing.map(([label, , section]) =>
              section && onFill ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => onFill(section)}
                  className="hover:border-primary hover:text-primary focus-visible:ring-ring text-muted-foreground rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {label}
                </button>
              ) : (
                <span
                  key={label}
                  className="text-muted-foreground/70 rounded-full border border-dashed px-2.5 py-0.5 text-xs"
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Băng quy cách xuất khẩu — chỗ DUY NHẤT trên trang dùng cỡ chữ lớn. Đây là bộ
 * số quyết định báo giá và xếp cont, nên đọc được từ xa; mọi thứ khác giữ nhỏ.
 */
function PackingBand({
  cells,
  href,
}: {
  cells: [string, string | null][]
  href: string
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Package className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">Quy cách xuất khẩu</h2>
        <span className="text-muted-foreground text-xs">· báo giá / xếp cont</span>
        <Link
          href={href}
          className="text-primary focus-visible:ring-ring ml-auto inline-flex items-center gap-1 rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Xem chi tiết <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {/* gap-px trên nền border = kẻ hairline giữa các ô, đúng cả khi xuống dòng */}
      <div className="bg-border grid grid-cols-2 gap-px border-t sm:grid-cols-3 xl:grid-cols-5">
        {cells.map(([label, value]) => (
          <div key={label} className="bg-card px-5 py-3.5">
            <div
              className={cn(
                'truncate text-lg font-semibold tracking-tight tabular-nums',
                !value && 'text-muted-foreground/40',
              )}
              title={value ?? undefined}
            >
              {value || '—'}
            </div>
            <div className={cn(EYEBROW, 'mt-1')}>{label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

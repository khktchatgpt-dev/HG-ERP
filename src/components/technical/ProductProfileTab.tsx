'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Factory,
  Package,
  Receipt,
  Ruler,
  ShieldCheck,
  StickyNote,
  Tags,
} from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { ProductImagePanel } from '@/components/technical/ProductImagePanel'
import {
  EYEBROW,
  NumberBand,
  SectionIcon,
  SpecSection,
  TONE,
  TextCard,
  type Tone,
} from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import type { PackingOptionView } from '@/components/technical/ProductProfileCards'
import {
  SECTION_TAB,
  cartonCbm,
  dec,
  num,
  productDims,
  withPackingFallback,
  type ProductView,
} from '@/components/technical/product-sections'

/**
 * Tab HỒ SƠ — đọc như một tờ PHIẾU THÔNG SỐ sản phẩm, không phải dashboard:
 *
 *  1. Măng-sét: ảnh lớn + loại SP / vật liệu khung + các mã nhận diện.
 *  2. Dải hoàn thiện: TÁCH hai vế sản xuất và thương mại (xem `TRACKS`).
 *  3. Hai băng số: kích thước–khối lượng (từ BOM) và quy cách xuất khẩu.
 *  4. Tóm tắt đặc tính / thông số SX / mô tả — chỉ đọc, sửa nằm ở tab của nó.
 *
 * Mã và tên SP KHÔNG lặp ở đây: `layout.tsx` đã in trên PageHeader + badge.
 */
export function ProductProfileTab({
  product,
  packingOptions,
  bomRows,
  imageUrl,
  suggestions,
  canEdit,
}: {
  product: ProductView
  /** Bù các ô "Quy cách xuất khẩu" còn trống bằng phương án đóng gói mặc định. */
  packingOptions: PackingOptionView[]
  /** Số dòng định mức THẬT trong app — khác `product.part_count` (từ Excel). */
  bomRows: number
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
  const dims = productDims(product, pk)
  const carton =
    pk.carton_l_cm != null && pk.carton_w_cm != null && pk.carton_h_cm != null
      ? `${pk.carton_l_cm} × ${pk.carton_w_cm} × ${pk.carton_h_cm}`
      : null
  const cbm = cartonCbm(pk)
  const base = `/technical/products/${product.id}`

  // Chỉ nhận giá trị nguyên thuỷ: `ts`/`dims` là object dựng lại mỗi lần render
  // nên đưa vào deps thì memo không bao giờ trúng.
  const hasDims = dims != null
  const hasCarton = carton != null
  const hasLoading = pk.loading_40hc != null
  const tracks = useMemo(
    () => buildTracks(product, hasDims, hasCarton, hasLoading),
    [product, hasDims, hasCarton, hasLoading],
  )

  /** Mục nằm ở tab khác thì điều hướng, ở tab này thì mở form tại chỗ. */
  function fillGap(gap: Gap) {
    if (gap.href) return router.push(gap.href)
    if (!gap.section) return
    const tab = SECTION_TAB[gap.section] ?? ''
    if (tab) router.push(`${base}/${tab}`)
    else editHandler(gap.section)?.()
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
          <div className="shrink-0 sm:w-60">
            <ProductImagePanel
              productId={product.id}
              productName={product.name}
              imageFileId={product.image_file_id}
              imageUrl={imageUrl}
              canEdit={canEdit}
              className="h-56 w-full sm:h-60"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {editingKey === 'identity' ? (
              node('identity')
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    {/*
                     * Dòng dẫn là LOẠI SP + VẬT LIỆU KHUNG chứ không phải "tên
                     * theo khách": tên theo khách chỉ 5/537 SP có, để nó làm
                     * dòng to nhất thì 99% hồ sơ mở ra là một câu xám "chưa có".
                     * Loại + vật liệu thì 529/537 SP có, và đúng là thứ nhận ra
                     * sản phẩm ngoài xưởng.
                     */}
                    <p className={EYEBROW}>Loại sản phẩm · khung</p>
                    <p className="mt-1 text-lg leading-snug font-medium">
                      {labelOf(PRODUCT_TYPES, product.product_type) ?? 'Chưa phân loại'}
                      {product.frame_material && (
                        <span className="text-muted-foreground font-normal">
                          {' · khung '}
                          {(
                            labelOf(FRAME_MATERIALS, product.frame_material) ??
                            product.frame_material
                          ).toLowerCase()}
                        </span>
                      )}
                    </p>
                    <TraitChips product={product} />
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
                      ['Mã cũ', product.code_legacy, true],
                      ['Tên theo khách', product.name_foreign, false],
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

      {/* ── 2. Dải hoàn thiện — hai vế đọc riêng, mỗi mục thiếu bấm được ── */}
      <ReadinessCard tracks={tracks} onFill={canEdit ? fillGap : null} />

      {/* ── 3a. Băng kích thước & khối lượng — số của chính sản phẩm ── */}
      <NumberBand
        icon={Ruler}
        tone="sky"
        title="Kích thước & khối lượng"
        hint="báo giá / kế hoạch phôi"
        href={`${base}/dinh-muc`}
        hrefLabel="Xem định mức"
        emptyText="Chưa có số tổng hợp. Các số này nạp từ file BOM khi import, hoặc suy ra khi nhập định mức chi tiết."
        cells={[
          {
            label: 'Kích thước SP',
            value: dims?.text ?? null,
            unit: dims?.unit,
            sub: dims?.source === 'bom' ? 'từ file BOM' : undefined,
          },
          {
            /*
             * App có dòng thật thì đếm dòng thật; chưa có thì mượn con số người
             * nhập đã tính trong file Excel, NHƯNG phải nói rõ — nếu không thì
             * ô ghi "103 dòng" mà bấm "Xem định mức" lại ra bảng trắng.
             */
            label: 'Số chi tiết',
            value: num(bomRows > 0 ? bomRows : product.part_count),
            unit: 'dòng',
            sub:
              bomRows === 0 && product.part_count != null
                ? 'theo file BOM, chưa nhập vào app'
                : undefined,
          },
          { label: 'KL khung', value: dec(product.frame_weight_kg, 2), unit: 'kg' },
          { label: 'KL tịnh', value: dec(product.net_weight_kg, 2), unit: 'kg' },
          { label: 'Tổng mét khung', value: dec(product.frame_length_m, 1), unit: 'm' },
          { label: 'Diện tích sơn', value: dec(product.paint_area_m2, 2), unit: 'm²' },
        ]}
      />

      {/* ── 3b. Băng quy cách — mấy con số xếp cont chạy theo ── */}
      <NumberBand
        icon={Package}
        tone="amber"
        title="Quy cách xuất khẩu"
        hint="báo giá / xếp cont"
        href={`${base}/dong-goi`}
        /*
         * SP nhiều kiện thì kích thước/khối lượng không gộp về một con số được
         * (withPackingFallback chỉ bù khi phương án có đúng 1 kiện) — nói thẳng
         * là dữ liệu NẰM Ở tab Đóng gói, đừng để người đọc tưởng chưa ai nhập.
         */
        emptyText={
          packingOptions.length > 0
            ? `Đã có ${packingOptions.length} phương án đóng gói nhiều kiện — số từng kiện xem ở tab Đóng gói.`
            : 'Chưa có quy cách đóng gói. Nhập ở tab Đóng gói, hoặc nạp cùng phương án đóng gói từ file BOM.'
        }
        cells={[
          { label: 'Carton', value: carton, unit: 'cm' },
          { label: 'SP / thùng', value: num(pk.qty_per_carton) },
          { label: 'Xếp 40′HC', value: num(pk.loading_40hc), unit: 'thùng' },
          {
            label: 'CBM / thùng',
            value: cbm != null ? cbm.toFixed(3) : null,
            unit: 'm³',
          },
          { label: 'GW / thùng', value: dec(pk.gw_kg, 2), unit: 'kg' },
        ]}
      />

      {/* ── 4. Tóm tắt phần còn lại — chỉ đọc, sửa nằm ở tab tương ứng ── */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <SpecSection
          icon={Tags}
          tone="violet"
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
          icon={Factory}
          tone="emerald"
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
        tone="slate"
        title="Mô tả & ghi chú"
        blocks={[
          ['Mô tả tiếng Anh (in báo giá)', product.description_en],
          ['Shipping mark', product.shipping_mark],
          ['Ghi chú nội bộ', product.notes],
        ]}
        onEdit={editHandler('text')}
        editing={node('text')}
      />

      <DocControlLine product={product} />

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

const labelOf = (
  list: readonly { code: string; label: string }[],
  code: string | null,
) => (code ? (list.find((x) => x.code === code)?.label ?? null) : null)

/**
 * Đặc tính bật/tắt — quyết định SP đi qua tổ nào, nên hiện ngay dưới dòng dẫn.
 * Màu theo cùng bảng `TONE`: nệm/bọc là việc của tổ may (violet, miền thương
 * phẩm), kính là chi tiết đo–lắp (sky), bộ nhiều món là chuyện đóng gói (amber).
 */
function TraitChips({ product }: { product: ProductView }) {
  const traits = (
    [
      // Loại 'ST' đã dịch ra "Bộ sản phẩm" ngay dòng trên — không lặp thành chip.
      [product.is_set && product.product_type !== 'ST', 'Bộ sản phẩm', 'amber'],
      [product.is_upholstered, 'Có nệm / bọc', 'violet'],
      [product.has_glass, 'Có kính', 'sky'],
      // "Ngừng dùng" KHÔNG lặp ở đây — layout.tsx đã in badge trạng thái.
    ] as [boolean, string, Tone][]
  ).filter(([on]) => on)
  if (traits.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {traits.map(([, label, tone]) => (
        <span
          key={label}
          className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', TONE[tone])}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

// ── Hoàn thiện hồ sơ ─────────────────────────────────────────────────────────

type Gap = {
  label: string
  done: boolean
  /** Phần sửa được — mở form tại chỗ hoặc nhảy sang tab chứa nó. */
  section?: string
  /** Đường dẫn riêng cho mục không thuộc phần sửa nào (định mức). */
  href?: string
}

type Track = {
  key: string
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
  gaps: Gap[]
}

/**
 * Hai VẾ, không phải một con số.
 *
 * Trước đây 15 mục gộp chung một thanh %: trộn thứ xưởng cần (định mức, kích
 * thước, đóng gói) với thứ phòng kinh doanh cần (barcode, giá, mô tả EN). Vì
 * nhóm thương mại gần như trống toàn thư viện (barcode 4/537, giá 7/537), mọi
 * SP đều hiện ~13% kèm một dãy chip đỏ — người dùng quen mắt rồi bỏ qua, kể cả
 * khi thiếu đúng thứ chặn sản xuất. Tách ra thì mỗi vế nói đúng một câu hỏi:
 * "xưởng làm được chưa?" và "bán/khai báo được chưa?".
 */
function buildTracks(
  p: ProductView,
  hasDims: boolean,
  hasCarton: boolean,
  hasLoading: boolean,
): Track[] {
  const base = `/technical/products/${p.id}`
  const ts = p.tech_spec ?? {}
  return [
    {
      key: 'production',
      label: 'Sẵn sàng sản xuất',
      hint: 'xưởng đọc',
      icon: Factory,
      tone: 'emerald',
      gaps: [
        {
          label: 'Định mức / BOM',
          done: p.bom_status !== 'none',
          href: `${base}/dinh-muc`,
        },
        { label: 'Kích thước SP', done: hasDims, section: 'packing' },
        { label: 'Chất liệu', done: !!p.material, section: 'export' },
        {
          label: 'Thông số SX',
          done: !!(ts.machine || ts.paint || ts.cushion || ts.glass || ts.wood),
          section: 'techSpec',
        },
        { label: 'Đóng gói carton', done: hasCarton, section: 'packing' },
        { label: 'Xếp 40′HC', done: hasLoading, section: 'packing' },
      ],
    },
    {
      key: 'commercial',
      label: 'Đủ hồ sơ thương mại',
      hint: 'báo giá / chứng từ',
      icon: Receipt,
      tone: 'violet',
      gaps: [
        { label: 'Ảnh sản phẩm', done: !!p.image_file_id },
        { label: 'Tên theo khách', done: !!p.name_foreign, section: 'identity' },
        { label: 'Mã KH đặt', done: !!p.customer_item_code, section: 'identity' },
        { label: 'Barcode', done: !!p.barcode, section: 'identity' },
        { label: 'Giá tham khảo', done: p.reference_price != null, section: 'identity' },
        { label: 'Mô tả tiếng Anh', done: !!p.description_en, section: 'text' },
      ],
    },
  ]
}

function ReadinessCard({
  tracks,
  onFill,
}: {
  tracks: Track[]
  onFill: ((gap: Gap) => void) | null
}) {
  return (
    <Card className="gap-0 divide-y py-0">
      {tracks.map((t) => (
        <TrackRow key={t.key} track={t} onFill={onFill} />
      ))}
    </Card>
  )
}

function TrackRow({
  track,
  onFill,
}: {
  track: Track
  onFill: ((gap: Gap) => void) | null
}) {
  const done = track.gaps.filter((g) => g.done).length
  const total = track.gaps.length
  const missing = track.gaps.filter((g) => !g.done)
  const pct = Math.round((done / total) * 100)
  const tone = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-amber-500'

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="flex w-full min-w-0 items-center gap-2.5 sm:w-72">
        <SectionIcon icon={track.icon} tone={track.tone} />
        <div className="min-w-0">
          <span className="text-sm font-medium">{track.label}</span>
          <span className="text-muted-foreground ml-1.5 text-xs">· {track.hint}</span>
        </div>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          {done}/{total}
        </span>
        <div
          className="bg-muted h-1.5 w-14 shrink-0 overflow-hidden rounded-full"
          role="progressbar"
          aria-label={`${track.label}: đã điền ${done}/${total} mục`}
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
          <Check className="size-3.5" /> Đủ cả {total} mục
        </span>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {missing.map((gap) =>
            (gap.section || gap.href) && onFill ? (
              <button
                key={gap.label}
                type="button"
                onClick={() => onFill(gap)}
                className="hover:border-primary hover:text-primary focus-visible:ring-ring text-muted-foreground rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {gap.label}
              </button>
            ) : (
              <span
                key={gap.label}
                className="text-muted-foreground/70 rounded-full border border-dashed px-2.5 py-0.5 text-xs"
              >
                {gap.label}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Khối kiểm soát tài liệu ISO (HG-QT-07/M02) — chỉ SP đã có BOM ký duyệt mới
 * có, nên ẩn hẳn khi trống thay vì in bốn dấu "—".
 */
function DocControlLine({ product }: { product: ProductView }) {
  const items = [
    product.bom_rev != null && ['Rev.', String(product.bom_rev)],
    product.bom_effective_date && [
      'Hiệu lực',
      new Date(product.bom_effective_date).toLocaleDateString('vi-VN'),
    ],
    product.bom_prepared_by && ['Người lập', product.bom_prepared_by],
    product.bom_approved_by && ['Người duyệt', product.bom_approved_by],
  ].filter((x): x is [string, string] => Array.isArray(x))
  if (items.length === 0) return null

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" />
        Kiểm soát tài liệu BOM
      </span>
      {items.map(([label, value]) => (
        <span key={label}>
          {label}: <span className="text-foreground font-medium">{value}</span>
        </span>
      ))}
    </div>
  )
}

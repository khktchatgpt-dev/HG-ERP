'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Factory, Package, Receipt, StickyNote } from 'lucide-react'
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
import { PackingEditor } from '@/components/technical/PackingEditor'
import {
  EYEBROW,
  SectionIcon,
  SpecSection,
  TextCard,
  type Tone,
} from '@/components/technical/ProductSpecCards'
import {
  useSectionEditor,
  type CategoryOption,
  type OwnerOption,
} from '@/components/technical/useSectionEditor'
import {
  PackingOptionsCard,
  type PackingOptionView,
} from '@/components/technical/ProductProfileCards'
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
 * Tab HỒ SƠ — tờ nhận diện sản phẩm cho MỌI phòng đọc:
 *
 *  1. Măng-sét: ảnh lớn + loại SP / vật liệu khung + các mã nhận diện.
 *  2. Dải hoàn thiện: TÁCH hai vế sản xuất và thương mại (xem `TRACKS`).
 *  3. Đóng gói xuất khẩu + các phương án đóng gói (gộp về đây 13/08/2026).
 *  4. Mô tả & ghi chú.
 *
 * KHÔNG có thông số kỹ thuật ở đây (user chốt 13/08/2026: "thông tin của kỹ
 * thuật nên ở bên kỹ thuật"). Kích thước, khối lượng, vật liệu, màu, đặc tính,
 * kiểm soát tài liệu ISO — tất cả ở tab Thông số kỹ thuật, MỘT chỗ đọc và MỘT
 * chỗ sửa. Trước đây tab này bày lại bản tóm tắt của chúng, thành ra hai nơi
 * cùng nói một chuyện mà người đọc không biết chỗ nào mới sửa được.
 *
 * Mã và tên SP KHÔNG lặp ở đây: `layout.tsx` đã in trên PageHeader + badge.
 */
export function ProductProfileTab({
  product,
  packingOptions,
  imageUrl,
  suggestions,
  categories,
  owners,
  creatorName,
  canEdit,
}: {
  product: ProductView
  /** Bù các ô "Quy cách xuất khẩu" còn trống bằng phương án đóng gói mặc định. */
  packingOptions: PackingOptionView[]
  imageUrl: string | null
  suggestions: Record<string, string[]>
  /** Danh mục SP đang hiệu lực — đổ vào ô "Danh mục" ở phần Nhận diện. */
  categories: CategoryOption[]
  /** Nhân sự chọn được làm người phụ trách (0144) — cùng phần Nhận diện. */
  owners: OwnerOption[]
  /**
   * Tên NGƯỜI LẬP hồ sơ (0179) — tra sẵn ở server. Không dò trong `owners`:
   * danh sách đó chỉ có người đang làm việc, người lập đã nghỉ sẽ mất tên.
   */
  creatorName: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const pk = useMemo(
    () => withPackingFallback(product.packing ?? {}, packingOptions),
    [product.packing, packingOptions],
  )
  const { editingKey, editHandler, node, close } = useSectionEditor(
    product,
    suggestions,
    canEdit,
    categories,
    owners,
    // Ô đóng gói còn trống lấy số của phương án mặc định làm gợi ý xám — thẻ
    // bên ngoài đang hiện đúng số đó, để trắng thì người dùng gõ lại từ trí nhớ.
    // `pk` là bản ĐÃ BÙ; hook tự bỏ qua khoá nào hồ sơ đã có giá trị riêng.
    pk,
  )
  /** Nhãn danh mục; SP còn mang giá trị ngoài danh mục thì hiện nguyên văn. */
  const categoryLabel = product.category
    ? (categories.find((c) => c.code === product.category)?.label ?? product.category)
    : null
  const dims = productDims(product)
  const carton =
    pk.carton_l_cm != null && pk.carton_w_cm != null && pk.carton_h_cm != null
      ? `${pk.carton_l_cm} × ${pk.carton_w_cm} × ${pk.carton_h_cm}`
      : null
  const cbm = cartonCbm(pk)
  const base = `/products/${product.id}`

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
      router.push('/products')
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
                    {/* Chip "Có nệm / Có kính / Bộ sản phẩm" đã bỏ (13/08/2026):
                        đó là đặc tính kỹ thuật, đã nằm ở tab Thông số kỹ thuật. */}
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
                      // Hiện NHÃN danh mục, không hiện mã: `category` lưu code
                      // (`ban_ghe_ngoai_troi`), người đọc cần "Bàn ghế ngoài trời".
                      ['Danh mục', categoryLabel, false],
                      // 0144 — người phụ trách hồ sơ. Hiện TÊN, không hiện id.
                      [
                        'Người phụ trách',
                        product.owner_id
                          ? (owners.find((o) => o.id === product.owner_id)?.name ??
                            'Người cũ (đã khoá / xoá)')
                          : null,
                        false,
                      ],
                      ['ĐVT bán', product.unit, false],
                      // 0179 — NGƯỜI LẬP hồ sơ, đứng ngay cạnh ngày tạo vì hai
                      // ô này trả lời chung một câu hỏi. Khác "Người phụ trách"
                      // ở trên: ô kia đổi được khi bàn giao, ô này bất biến.
                      ['Người tạo', creatorName, false],
                      [
                        'Ngày tạo hồ sơ',
                        new Date(product.created_at).toLocaleDateString('vi-VN'),
                        false,
                      ],
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
                          !value && 'text-muted-foreground',
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

      {/*
       * Băng "Kích thước & khối lượng" ĐÃ BỎ khỏi tab này (user chốt 13/08/2026:
       * "thông tin của kỹ thuật nên ở bên kỹ thuật, hiện bên hồ sơ vẫn còn").
       * Số kích thước / khối lượng / số chi tiết / diện tích sơn nay chỉ có ở
       * tab Thông số kỹ thuật — một nguồn, một chỗ sửa.
       */}

      {/*
       * ── 3. ĐÓNG GÓI — nằm LUÔN ở đây, không còn tab riêng (user chốt
       * 13/08/2026). Trước đây chỗ này chỉ là băng số chỉ-đọc kèm link sang tab
       * Đóng gói; nay là thẻ SỬA ĐƯỢC tại chỗ, kèm luôn danh sách phương án
       * đóng gói bên dưới — mở hồ sơ là thấy hết, không phải nhảy tab.
       */}
      <SpecSection
        icon={Package}
        tone="amber"
        title="Đóng gói xuất khẩu"
        hint="báo giá / xếp cont"
        fields={[
          ['Carton (D × R × C)', carton && `${carton} cm`],
          ['SP / thùng', num(pk.qty_per_carton)],
          ['Xếp 40′HC', num(pk.loading_40hc, ' thùng')],
          ['CBM / thùng', cbm != null ? `${cbm.toFixed(3)} m³` : null],
          ['NW / thùng', dec(pk.nw_kg, 2) && `${dec(pk.nw_kg, 2)} kg`],
          ['GW / thùng', dec(pk.gw_kg, 2) && `${dec(pk.gw_kg, 2)} kg`],
          ['Đơn vị đóng gói', pk.pack_unit_label ?? null],
        ]}
        onEdit={editHandler('packing')}
        /* Form đóng gói KHÔNG dùng bản sinh từ `SECTIONS` như các phần khác
           (user 13/08/2026: "nhập quy cách rất khó hiểu") — xem PackingEditor:
           carton gộp một dòng D × R × C, CBM tự hiện, nhãn viết tiếng Việt. */
        editing={
          editingKey === 'packing' ? (
            <PackingEditor
              productId={product.id}
              packing={product.packing ?? {}}
              fallback={pk}
              onClose={close}
            />
          ) : null
        }
      />

      {/*
       * Phương án đóng gói nhiều kiện: SP nhiều kiện thì số không gộp về một
       * dòng được (`withPackingFallback` chỉ bù khi phương án có đúng 1 kiện),
       * nên bảng chi tiết phải đứng ngay dưới — trước đây nó nằm ở tab khác,
       * người đọc thấy thẻ trên trống là tưởng chưa ai nhập.
       */}
      <PackingOptionsCard options={packingOptions} />

      {/*
       * Hai thẻ tóm tắt "Vật liệu & màu" + "Đặc tính sản phẩm" ĐÃ BỎ (13/08/2026)
       * — đó là thông số kỹ thuật, chỗ của nó là tab Thông số kỹ thuật. Để bản
       * tóm tắt ở đây chỉ tạo ra hai nơi cùng nói một chuyện, và người đọc không
       * biết chỗ nào mới là chỗ sửa. Một dòng dẫn ở cuối trang là đủ.
       */}

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

      {/*
       * Dòng kiểm soát tài liệu ISO (Rev. / ngày hiệu lực / người lập / duyệt)
       * cũng đã BỎ khỏi đây: nó là chữ ký của bảng định mức, sống ở tab Thông số
       * kỹ thuật cùng thẻ "Kiểm soát tài liệu BOM".
       */}
      <p className="text-muted-foreground text-xs">
        Kích thước, vật liệu, màu hoàn thiện, đặc tính và kiểm soát tài liệu BOM nằm ở{' '}
        <Link href={`${base}/thong-so`} className="text-primary hover:underline">
          tab Thông số kỹ thuật
        </Link>
        .
      </p>

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
  const base = `/products/${p.id}`
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
        // Ba mục này nằm ở tab Thông số kỹ thuật (13/08/2026) — khoá section
        // phải khớp `SECTION_TAB`, sai một chữ là bấm vào không đi đâu cả.
        { label: 'Kích thước SP', done: hasDims, section: 'dims' },
        { label: 'Chất liệu', done: !!p.material, section: 'materials' },
        {
          label: 'Vật liệu / thông số SX',
          done: !!(ts.machine || ts.paint || ts.cushion || ts.glass || ts.wood),
          section: 'materials',
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
                className="text-muted-foreground rounded-full border border-dashed px-2.5 py-0.5 text-xs"
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

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, PackageSearch, Plus, Sparkles, X } from 'lucide-react'
import { BomAiNewProduct } from '@/components/technical/BomAiNewProduct'
import { Button } from '@/components/shadcn/button'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { parseProductCode } from '@/lib/product-code'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import type { RowMenuItem } from '@/components/erp/RowMenu'
import { TopProgressBar } from '@/components/erp/Spinner'
import { BomEditor } from './_components/BomEditor'
import { CloneForm } from './_components/CloneForm'
import { FilterBar } from './_components/FilterBar'
import { StartPanel } from './_components/StartPanel'
import { ImagePreviewModal } from './_components/ImagePreviewModal'
import { ProductCard } from './_components/ProductCard'
import { ProductTable } from './_components/ProductTable'
import {
  ACCENT_SOLID,
  VIEW_STORAGE_KEY,
  type BomRow,
  type BomTarget,
  type CategoryOption,
  type CustomerNameOption,
  type Filters,
  type MaterialOption,
  type Product,
  type ProductCounts,
  type ProductRow,
  type ToggleFilterKey,
} from './_components/types'

/** Hằng ngoài component: `{}` viết tại chỗ là object mới mỗi render → thẻ nhớ lại. */
const EMPTY_IMAGE_URLS: Record<string, string> = {}

/** Người dùng đang thu hẹp danh sách (tìm hoặc lọc) chứ không phải chỉ mở trang. */
function hasActiveFilter(f: Filters): boolean {
  return (
    !!f.q ||
    f.customer !== 'all' ||
    f.bom !== 'all' ||
    f.status !== 'all' ||
    f.image !== 'all' ||
    // `locked` bị bỏ sót từ 0140 và `sample` thêm ở 0141: bật một trong hai chip
    // này mà nút "Xoá lọc" không hiện thì người dùng kẹt với danh sách đã lọc.
    f.locked !== 'all' ||
    f.lifecycle !== 'all' ||
    f.type !== 'all' ||
    f.category !== 'all'
  )
}

/**
 * Màn Thư viện sản phẩm — chỉ giữ TRẠNG THÁI và ĐIỀU PHỐI.
 *
 * Phần nhìn nằm ở `_components/`: FilterBar (thanh lọc), ProductCard (thẻ lưới),
 * ProductTable (chế độ bảng), ImagePreviewModal / CloneForm / BomEditor (3 hộp
 * thoại), product-meta (dải hồ sơ + nhãn phân loại), types (kiểu + hằng).
 */
export function ProductsManager({
  products,
  total,
  idle,
  recent,
  fuzzy,
  page,
  pageSize,
  counts,
  filters,
  customerNames,
  categories,
  imageUrls,
  canEdit,
}: {
  /** Kết quả là GẦN ĐÚNG (0098) — khớp chặt ra 0 dòng nên đã tìm theo độ giống. */
  fuzzy?: boolean
  products: ProductRow[]
  total: number
  /** Chưa gõ và chưa lọc gì → server KHÔNG truy vấn danh sách; bày màn mở đầu. */
  idle: boolean
  /** Đang xem lối tắt "Vừa sửa gần đây" (?recent=1) — không phải bộ lọc. */
  recent: boolean
  page: number
  pageSize: number
  counts: ProductCounts
  filters: Filters
  customerNames: CustomerNameOption[]
  /** Danh mục SP dùng chung (admin khai ở /admin/catalogs) — bộ lọc + nhãn thẻ. */
  categories: CategoryOption[]
  imageUrls: Record<string, string>
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  /** Modal "Tạo từ file BOM" — đọc hồ sơ + định mức từ một file, không gõ tay. */
  const [fromBom, setFromBom] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [cloning, setCloning] = useState<Product | null>(null)
  /**
   * Ảnh đang xem phóng to. URL đã được server ký sẵn cho lưới nên mở hộp xem
   * KHÔNG tốn thêm lượt gọi API — chỉ hiện to đúng tấm đang có.
   */
  const [preview, setPreview] = useState<{ product: ProductRow; url: string } | null>(
    null,
  )
  /** Mã gợi ý cho bản sao — xin sẵn ở `openClone`, '' nếu không suy ra được. */
  const [cloneCode, setCloneCode] = useState('')
  const [bomFor, setBomFor] = useState<{ product: BomTarget; rows: BomRow[] } | null>(
    null,
  )
  // Vật tư cho BOM editor — lazy-load (chỉ khi mở editor), cache sau lần đầu.
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [materialsLoaded, setMaterialsLoaded] = useState(false)

  // Ô tìm (debounce) — đẩy xuống URL để SERVER lọc, không lọc toàn bộ ở client.
  const [q, setQ] = useState(filters.q)

  // Kiểu xem là thói quen cá nhân (KT hay soi ảnh, KH hay tra bảng) nên nhớ lại.
  // Đọc SAU hydration: lazy-init từ localStorage sẽ lệch với HTML server.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(VIEW_STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync 1 lần từ localStorage
    if (saved === 'grid' || saved === 'list') setView(saved)
  }, [])

  function changeView(v: 'grid' | 'list') {
    setView(v)
    if (typeof window !== 'undefined') localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  // Đổi bộ lọc/trang → cập nhật query param → server refetch đúng 1 trang.
  const applyParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === 'all') next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page') // đổi lọc → về trang 1
      const qs = next.toString()
      // `replace`: lọc/tìm không phải là "đi tới trang khác", đẩy vào lịch sử chỉ
      // khiến nút Back phải bấm hàng chục lần mới ra khỏi thư viện.
      router.replace(qs ? `/products?${qs}` : '/products')
    },
    [router, sp],
  )

  /** Chip lọc: bấm lại giá trị đang bật thì bỏ lọc đó. */
  const toggleParam = useCallback(
    (key: ToggleFilterKey, value: string) => {
      applyParams({ [key]: filters[key] === value ? undefined : value })
    },
    [applyParams, filters],
  )

  /**
   * Đẩy từ khoá xuống URL sau 1 GIÂY ngừng gõ.
   *
   * Mỗi lần đẩy là một lượt điều hướng → server truy vấn lại cả trang, nên nhịp
   * này phải theo tốc độ gõ của người dùng chứ không theo từng phím. 400ms cũ
   * vẫn bắn giữa chừng khi gõ chậm hoặc gõ tiếng Việt có dấu (bộ gõ nhả phím
   * thành nhiều nhịp), thành ra vài lượt gọi cho một từ khoá.
   *
   * `router.replace` chứ không `push`: gõ "ghế" mà đẩy 1 mục lịch sử cho mỗi
   * nhịp thì bấm Back phải qua từng ký tự mới thoát khỏi ô tìm.
   */
  useEffect(() => {
    if (q.trim() === (filters.q ?? '')) return
    const t = setTimeout(() => applyParams({ q: q.trim() || undefined }), 1000)
    return () => clearTimeout(t)
  }, [q, filters.q, applyParams])

  /** Đang chờ nhịp debounce / server trả về — để ô tìm nói "đang tìm…". */
  const searching = q.trim() !== (filters.q ?? '')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilter = hasActiveFilter(filters)

  /*
   * ẢNH CHỈ TẢI KHI ĐƯỢC HỎI TỚI.
   *
   * Mỗi tấm ảnh là một vòng gọi Supabase Storage ~0,9–1,5 giây (đo 31/08/2026:
   * phần lớn là độ trễ mạng tới Storage, gần như không phụ thuộc file to hay
   * nhỏ). Lưới 24 thẻ nghĩa là mở trang trắng cũng nổ 24 lượt như thế — trong
   * khi phần lớn lần vào đây người ta đang đi TÌM một mã, chưa cần nhìn ảnh.
   *
   * Nên: vào trang trơn = không ảnh; vừa gõ tìm hoặc bấm một bộ lọc là ảnh hiện
   * (lúc đó danh sách đã hẹp lại, ảnh mới đáng tiền). Nút 🖼 để bật/tắt tay khi
   * muốn ngắm cả lưới. Suy ra chứ không dùng effect: 'auto' bám theo bộ lọc,
   * bấm nút là chốt cứng cho tới khi rời trang. KHÔNG nhớ vào localStorage —
   * nhớ "bật" thì lần vào sau lại nổ 24 lượt, đúng thứ đang muốn tránh.
   */
  const [imagePref, setImagePref] = useState<'auto' | 'on' | 'off'>('auto')
  const showImages = imagePref === 'auto' ? hasFilter : imagePref === 'on'
  const shownImageUrls = showImages ? imageUrls : EMPTY_IMAGE_URLS
  const imageCount = products.filter((p) => p.image_file_id).length

  function clearFilters() {
    setQ('')
    applyParams({
      q: undefined,
      customer: undefined,
      bom: undefined,
      status: undefined,
      image: undefined,
      locked: undefined,
      lifecycle: undefined,
      type: undefined,
      category: undefined,
      // Xoá lọc phải đưa về ĐÚNG màn mở đầu; sót `recent` thì vẫn còn một danh
      // sách 24 dòng nằm đó và người dùng tưởng lọc chưa xoá hết.
      recent: undefined,
    })
  }

  async function send(
    url: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    body?: unknown,
  ): Promise<boolean> {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteProduct(p: ProductRow) {
    const ok = await confirm({
      title: `Xoá sản phẩm "${p.name}"?`,
      description: 'BOM của sản phẩm cũng bị xoá theo. Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/technical/products/${p.id}`, 'DELETE')
    if (ok2) toast.success('Đã xoá', p.name)
  }

  /** Nạp SP ĐẦY ĐỦ (GET) — list chỉ giữ bản nhẹ nên clone cần full trước khi mở. */
  async function fetchFull(id: string): Promise<Product | null> {
    try {
      const { product } = await api<{ product: Product }>(
        `/api/dept/technical/products/${id}`,
      )
      return product
    } catch (e) {
      toast.error('Không tải được sản phẩm', e instanceof ApiError ? e.message : 'Có lỗi')
      return null
    }
  }

  /**
   * Mở hộp nhân bản. Xin luôn mã kế tiếp ở ĐÂY (không phải trong form) để form
   * không phải chạy effect gọi API lúc mount. Bản sao giữ nguyên loại + vật
   * liệu của mẫu gốc; mẫu mang mã cũ không suy ra được thì để trống, nhập tay.
   */
  async function openClone(id: string) {
    setBusy(true)
    const p = await fetchFull(id)
    let suggested = ''
    const src = p ? parseProductCode(p.code) : null
    if (src) {
      suggested = await api<{ code: string }>(
        `/api/dept/technical/products/next-code?type=${src.type}&material=${src.material}`,
      )
        .then((r) => r.code)
        .catch(() => '')
    }
    setBusy(false)
    if (p) {
      setCloneCode(suggested)
      setCloning(p)
    }
  }

  /** Vật tư (cho BOM editor) — nạp 1 lần khi cần, cache lại cho các lần mở sau. */
  async function ensureMaterials() {
    if (materialsLoaded) return
    const { rows } = await api<{
      rows: { id: string; code: string; name: string; unit: string }[]
    }>('/api/dept/warehouse/materials?active_only=true&page_size=1000')
    setMaterials(
      rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit })),
    )
    setMaterialsLoaded(true)
  }

  /**
   * Mở BOM editor: nạp dòng hiện có + vật tư (lazy) rồi mới mở modal (tránh
   * setState trong effect). Chỉ cần id/code/name/bom_status.
   */
  async function openBom(p: BomTarget) {
    setBusy(true)
    try {
      const [data] = await Promise.all([
        api<{
          lines: { material_id: string; qty_per_unit: number; note: string | null }[]
        }>(`/api/dept/technical/products/${p.id}/bom`),
        ensureMaterials(),
      ])
      setBomFor({
        product: p,
        rows: data.lines.map((l) => ({
          material_id: l.material_id,
          qty_per_unit: l.qty_per_unit,
          note: l.note ?? '',
        })),
      })
    } catch (e) {
      toast.error('Không tải được BOM', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  // Deep-link từ trang chi tiết: ?clone / ?openbom = <id> → nạp full rồi mở
  // modal (SP có thể không ở trang hiện tại nên GET theo id). Dùng 'openbom' KHÁC
  // tham số lọc 'bom' của thư viện để không đụng nhau.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const clone = sp.get('clone')
    const openbom = sp.get('openbom')
    if (canEdit && clone) void openClone(clone)
    else if (openbom) void fetchFull(openbom).then((p) => p && openBom(p))
    if (clone || openbom) {
      // Gỡ tham số deep-link nhưng GIỮ bộ lọc/trang.
      const next = new URLSearchParams(sp.toString())
      next.delete('clone')
      next.delete('openbom')
      const qs = next.toString()
      router.replace(qs ? `/products?${qs}` : '/products')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Menu ⋯ dùng chung cho thẻ và dòng bảng — một bộ hành động, một thứ tự. */
  function rowActions(p: ProductRow): RowMenuItem[] {
    const items: RowMenuItem[] = [
      {
        label: 'Xem chi tiết',
        onClick: () => router.push(`/products/${p.id}`),
      },
      { label: 'BOM định mức', onClick: () => void openBom(p) },
    ]
    if (canEdit) {
      items.push(
        // Sửa nằm ngay trong tab Hồ sơ của trang chi tiết — không có route /edit.
        {
          label: 'Sửa hồ sơ',
          onClick: () => router.push(`/products/${p.id}`),
        },
        { label: 'Nhân bản mẫu', onClick: () => void openClone(p.id) },
        {
          label: p.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại',
          onClick: () =>
            send(`/api/dept/technical/products/${p.id}`, 'PATCH', {
              is_active: !p.is_active,
            }),
        },
        { label: 'Xoá', onClick: () => void deleteProduct(p), danger: true },
      )
    }
    return items
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      {/* Khu dùng chung: breadcrumb KHÔNG dẫn về /technical — người ngoài phòng
          Kỹ thuật bấm vào là bị gate workspace đá về '/'. */}
      <PageHeader
        breadcrumbs={[{ label: 'Thư viện sản phẩm' }]}
        title="Thư viện sản phẩm"
        description={
          idle
            ? `${counts.total} sản phẩm · ${customerNames.length} khách hàng`
            : // `total` lúc này là CẢ THƯ VIỆN (recent chỉ đổi thứ tự, không thu
              // hẹp) nên không được ghi "779 sản phẩm vừa sửa" — sai nghĩa.
              recent && !hasFilter
              ? `Sửa gần đây nhất · ${counts.total} sản phẩm trong thư viện`
              : `${total} kết quả · lọc từ ${counts.total} sản phẩm`
        }
        actions={
          <>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setFromBom(true)}>
                <Sparkles /> Tạo bằng AI
              </Button>
            )}
            {canEdit && (
              <Button size="sm" className={ACCENT_SOLID} asChild>
                <Link href="/products/new">
                  <Plus /> Thêm sản phẩm
                </Link>
              </Button>
            )}
          </>
        }
      />

      {fromBom && <BomAiNewProduct onClose={() => setFromBom(false)} />}

      <FilterBar
        filters={filters}
        counts={counts}
        customerNames={customerNames}
        categories={categories}
        q={q}
        onQChange={setQ}
        searching={searching}
        view={view}
        onViewChange={changeView}
        showImages={showImages}
        imageCount={imageCount}
        onToggleImages={() => setImagePref(showImages ? 'off' : 'on')}
        onParamChange={applyParams}
        onToggle={toggleParam}
        hasFilter={hasFilter}
        onClear={clearFilters}
      />

      {/* Kết quả gần đúng phải NÓI RA: người tra mã mà nhận nhầm sản phẩm khác
          là chuyện tốn tiền, không được lặng lẽ đưa thứ na ná. */}
      {fuzzy && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Không có kết quả khớp đúng “<b>{filters.q}</b>” — đây là {products.length} sản
          phẩm có tên/mã <b>gần giống</b>, xếp theo độ giống. Kiểm lại mã trước khi dùng.
        </div>
      )}

      {idle ? (
        <StartPanel counts={counts} customerNames={customerNames} onPick={applyParams} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-6 text-sky-500" />}
          title={hasFilter ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm nào'}
          description={
            hasFilter
              ? 'Thử bỏ bớt bộ lọc hoặc gõ lại từ khoá.'
              : canEdit
                ? 'Thêm sản phẩm đầu tiên để bắt đầu thư viện.'
                : 'Liên hệ Kỹ thuật để bổ sung sản phẩm vào thư viện.'
          }
          action={
            hasFilter ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X /> Xoá lọc
              </Button>
            ) : canEdit ? (
              <Button size="sm" className={ACCENT_SOLID} asChild>
                <Link href="/products/new">
                  <Plus /> Thêm sản phẩm
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : view === 'list' ? (
        <ProductTable
          products={products}
          imageUrls={shownImageUrls}
          rowActions={rowActions}
          onZoom={(product, url) => setPreview({ product, url })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              imageUrl={shownImageUrls[p.id]}
              imageHidden={!showImages && !!p.image_file_id}
              actions={rowActions(p)}
              onZoom={(url) => setPreview({ product: p, url })}
            />
          ))}
        </div>
      )}

      {products.length > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground text-xs tabular-nums">
            {from}–{to} / {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => applyParams({ page: String(page - 1) })}
            >
              <ChevronLeft /> Trước
            </Button>
            <span className="text-muted-foreground px-2 text-xs tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => applyParams({ page: String(page + 1) })}
            >
              Sau <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <ImagePreviewModal preview={preview} onClose={() => setPreview(null)} />

      {/* Clone (FR-ENG-02: tái sử dụng mẫu) */}
      <Modal
        open={!!cloning}
        onClose={() => setCloning(null)}
        title={cloning ? `Nhân bản mẫu — ${cloning.name}` : ''}
      >
        {cloning && (
          <CloneForm
            source={cloning}
            suggestedCode={cloneCode}
            customerNames={customerNames}
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/technical/products/${cloning.id}/clone`,
                'POST',
                body,
              )
              if (ok) {
                setCloning(null)
                toast.success('Đã nhân bản', `${cloning.code} → ${String(body.code)}`)
              }
            }}
          />
        )}
      </Modal>

      {/* BOM editor (FR-ENG-04) */}
      <Modal
        open={!!bomFor}
        onClose={() => setBomFor(null)}
        title={bomFor ? `BOM — ${bomFor.product.code} · ${bomFor.product.name}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {bomFor && (
          <BomEditor
            key={bomFor.product.id}
            initialRows={bomFor.rows}
            bomStatus={bomFor.product.bom_status}
            materials={materials}
            canEdit={canEdit}
            onSave={async (rows) => {
              const ok = await send(
                `/api/dept/technical/products/${bomFor.product.id}/bom`,
                'PUT',
                {
                  lines: rows.map((r) => ({
                    material_id: r.material_id,
                    qty_per_unit: r.qty_per_unit,
                    note: r.note.trim() || null,
                  })),
                },
              )
              if (ok) {
                setBomFor(null)
                toast.success('Đã lưu BOM', bomFor.product.name)
              }
            }}
          />
        )}
      </Modal>
    </div>
  )
}

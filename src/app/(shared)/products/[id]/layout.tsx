import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Copy, History, Sheet } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { productProfileRepo, productsRepo } from '@/modules/dept/technical/technical.repo'
import {
  canSetLifecycle,
  canEditProducts,
  canLockProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { PageHeader } from '@/components/erp/PageHeader'
import { ProductTabs } from '@/components/technical/ProductTabs'
import { ProductLockButton } from '@/components/technical/ProductLockButton'
import { ProductStatusControl } from '@/components/technical/ProductStatusControl'

/**
 * Khung chung của trang chi tiết: nhận diện sản phẩm + điều hướng tab. Nằm ở
 * layout nên KHÔNG render lại khi đổi tab, và mỗi tab con chỉ nạp dữ liệu của nó.
 */
export default async function ProductDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>
  children: React.ReactNode
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [canEdit, canLock, canStatus, currentRev] = await Promise.all([
    canEditProducts(user),
    canLockProducts(user),
    canSetLifecycle(user),
    // Số bản chốt (0143) — hiện ở hàng nhãn để mọi tab đều thấy đang xem bản mấy.
    productsService.currentRev(user, id),
  ])

  const product = await productsRepo.findById(id)
  if (!product) notFound()
  const partCount = await productProfileRepo.partsCount(id)

  /*
   * `category` lưu MÃ danh mục (`catalog_items` loại `product_category`) nên phải
   * tra nhãn để badge không in ra mã máy. Chỉ tra khi SP có danh mục — 528/537 SP
   * đang để trống, không đáng thêm một truy vấn cho mọi lần mở hồ sơ.
   */
  const categoryLabel = product.category
    ? ((await catalogsService.list(user, 'product_category')).find(
        (c) => c.code === product.category,
      )?.label ?? product.category)
    : null

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        breadcrumbs={[
          // Không có crumb 'Kỹ thuật': khu dùng chung, người ngoài phòng KT bấm
          // vào /technical là bị gate workspace đá về '/'.
          { label: 'Thư viện sản phẩm', href: '/products' },
          { label: product.code },
        ]}
        title={product.name}
        description={product.code}
        /* Nhãn nhận diện về đúng chỗ của nó: NGAY DƯỚI TÊN SP, thay vì đứng
           thành một hàng riêng phía dưới thanh trạng thái (13/08/2026 — gọn
           lại). Chúng là thuộc tính của sản phẩm, không phải trạng thái. */
        meta={
          <>
            {categoryLabel && <Badge variant="outline">{categoryLabel}</Badge>}
            <Badge variant="outline">{product.customer_name ?? 'Mẫu chung'}</Badge>
            {product.showroom_sample && (
              <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Có mẫu showroom
              </Badge>
            )}
            {/* Bản chốt: theo thanh trạng thái cũ mà về đây, để bỏ thanh đi vẫn
                còn đường vào tab Lịch sử. */}
            {currentRev > 0 && (
              <Link href={`/products/${product.id}/lich-su`}>
                <Badge variant="outline" title="Xem lịch sử phiên bản">
                  <History /> Bản #{currentRev}
                </Badge>
              </Link>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* TRẠNG THÁI đứng đầu hàng nút (13/08/2026 — "gọn nữa: 1 badge +
                menu xổ"): một badge, bấm ra lộ trình 5 chặng. Người chỉ xem vẫn
                thấy badge, chỉ mất menu. */}
            <ProductStatusControl
              productId={product.id}
              current={product.lifecycle}
              changedAt={product.lifecycle_at}
              canEdit={canStatus}
            />
            {/* Khoá/mở khoá đứng NGAY ĐÂY (user chốt 13/08/2026): trước đó nút
                nằm trong tab Tài liệu nên muốn chốt hồ sơ phải đi tìm. */}
            {canLock && (
              <ProductLockButton
                productId={product.id}
                locked={product.locked_at != null}
              />
            )}
            {/* Xuất Excel: AI ĐỌC ĐƯỢC hồ sơ thì tải được — không gác theo
                quyền sửa, vì đây là việc của cả Cung ứng/Sản xuất/Bán hàng. */}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/dept/technical/products/${product.id}/export`}>
                <Sheet className="size-4" /> Xuất Excel
              </a>
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/products?clone=${product.id}`}>
                  <Copy className="size-4" /> Nhân bản
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <ProductTabs productId={product.id} partCount={partCount} />
      {children}
    </div>
  )
}

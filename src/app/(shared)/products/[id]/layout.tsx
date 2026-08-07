import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Copy } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { productProfileRepo, productsRepo } from '@/modules/dept/technical/technical.repo'
import { canEditProducts } from '@/modules/dept/technical/technical.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { PageHeader } from '@/components/erp/PageHeader'
import { ProductTabs } from '@/components/technical/ProductTabs'

const BOM_LABEL = { none: 'Chưa có BOM', drawing: 'Đang vẽ', done: 'Đã vẽ' } as const
const BOM_TONE = {
  none: 'bg-muted text-muted-foreground',
  drawing: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
} as const

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
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = await canEditProducts(user)

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

  const status = (product.bom_status ?? 'none') as keyof typeof BOM_LABEL

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
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/products?clone=${product.id}`}>
                <Copy className="size-4" /> Nhân bản
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`border-transparent ${BOM_TONE[status]}`}>
          {BOM_LABEL[status]}
        </Badge>
        <Badge variant={product.is_active ? 'secondary' : 'outline'}>
          {product.is_active ? 'Đang dùng' : 'Ngừng dùng'}
        </Badge>
        {categoryLabel && <Badge variant="outline">{categoryLabel}</Badge>}
        <Badge
          variant="outline"
          className={product.customer_name ? '' : 'text-muted-foreground'}
        >
          {product.customer_name ?? 'Mẫu chung'}
        </Badge>
        {product.showroom_sample && (
          <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Có mẫu showroom
          </Badge>
        )}
      </div>

      <ProductTabs productId={product.id} partCount={partCount} />
      {children}
    </div>
  )
}

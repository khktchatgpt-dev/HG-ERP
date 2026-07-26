import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { HttpError } from '@/server/http'
import { ProductPackingTab } from '@/components/technical/ProductPackingTab'
import { toProductView } from '@/components/technical/product-sections'

/** Tab Đóng gói — quy cách carton + các phương án đóng gói, không kéo định mức. */
export default async function ProductPackingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const canEdit = user.role === 'admin' || user.role === 'manager'

  let data
  let suggestions: Record<string, string[]> = {}
  try {
    ;[data, suggestions] = await Promise.all([
      productsService.getProfileInfo(user, id),
      productsService.fieldSuggestions(),
    ])
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }

  return (
    <ProductPackingTab
      product={toProductView(data.product)}
      packingOptions={data.packing}
      suggestions={suggestions}
      canEdit={canEdit}
    />
  )
}

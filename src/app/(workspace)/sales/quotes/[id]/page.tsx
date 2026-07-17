import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { filesService } from '@/modules/core/files/files.service'
import { HttpError } from '@/server/http'
import { QuoteDetailView } from '@/components/sales/QuoteDetailView'

/** Trang chi tiết báo giá — hiện đầy đủ trường + ảnh SP như tờ báo giá thật. */
export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params

  let data
  try {
    data = await quotesService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { quote, lines } = data

  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const canEdit = user.role === 'admin' || dept?.name === 'Bán Hàng'

  const [customer, owner] = await Promise.all([
    customersRepo.findById(quote.customer_id).catch(() => null),
    quote.created_by ? usersRepo.findById(quote.created_by) : null,
  ])

  // Ảnh SP (signed URL ngắn hạn) — lỗi thì bỏ ảnh, không chặn xem báo giá.
  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(lines.map((l) => l.image_file_id).filter(Boolean))].map(async (fid) => {
      try {
        imageUrls.set(
          fid as string,
          await filesService.getDownloadUrl(user, fid as string),
        )
      } catch {
        /* ignore */
      }
    }),
  )

  return (
    <QuoteDetailView
      quote={{
        id: quote.id,
        code: quote.code,
        status: quote.status,
        currency: quote.currency,
        customer_name: customer?.name ?? '?',
        valid_from: quote.valid_from,
        valid_to: quote.valid_to,
        price_term: quote.price_term,
        payment_terms: quote.payment_terms,
        note: quote.note,
        owner_name: owner?.name ?? null,
        created_at: quote.created_at,
      }}
      lines={lines.map((l) => ({
        product_code: l.product_code,
        product_name: l.product_name,
        product_unit: l.product_unit,
        customer_item_code: l.customer_item_code,
        description_en: l.description_en,
        unit_price: l.unit_price,
        discount_pct: l.discount_pct,
        note: l.note,
        packing: l.packing,
        image_url: l.image_file_id ? (imageUrls.get(l.image_file_id) ?? null) : null,
      }))}
      canEdit={canEdit}
    />
  )
}

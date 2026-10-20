import { redirect } from 'next/navigation'

/**
 * Màn ghi đã TÁCH RIÊNG thành /thongke/ghi (27/08) — giữ route cũ làm redirect
 * cho link/bookmark đã phát tán trong ngày, khỏi ai ăn 404.
 */
export default async function GhiRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ stage?: string }>
}) {
  const { id } = await params
  const { stage } = await searchParams
  redirect(`/thongke/ghi?lsx=${id}${stage ? `&stage=${stage}` : ''}`)
}

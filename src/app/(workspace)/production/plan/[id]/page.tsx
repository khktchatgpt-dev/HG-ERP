import { redirect } from 'next/navigation'

/** Đường cũ — Kế hoạch SX đã dời sang workspace riêng. */
export default async function OldPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/kehoach-sx/${id}`)
}

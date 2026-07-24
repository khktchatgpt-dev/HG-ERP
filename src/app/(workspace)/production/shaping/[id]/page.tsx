import { redirect } from 'next/navigation'

/** Đường cũ — Định hình đã dời sang workspace Thống kê xưởng. */
export default async function OldShapingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/thongke/dinh-hinh/${id}`)
}

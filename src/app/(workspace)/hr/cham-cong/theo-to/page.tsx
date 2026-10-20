import { redirect } from 'next/navigation'

/**
 * Bảng chấm công theo tổ (luật tạm 12/10: công theo ca) đã thay bằng BẢNG GIỜ CÔNG theo
 * khung giờ — luật thật của Nhân sự (17/10/2026). Link cũ `?thang=&to=` vẫn mở đúng tổ.
 */
export default async function TheoToPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; to?: string }>
}) {
  const sp = await searchParams
  const q = new URLSearchParams()
  if (sp.thang) q.set('thang', sp.thang)
  if (sp.to) q.set('bp', sp.to)
  redirect(`/hr/cham-cong/gio-cong${q.size ? `?${q}` : ''}`)
}

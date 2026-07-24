import { redirect } from 'next/navigation'

/** Đường cũ — màn tổ đã dời sang workspace Tổ sản xuất (/to). */
export default async function OldTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const { team } = await searchParams
  redirect(team ? `/to?team=${team}` : '/to')
}

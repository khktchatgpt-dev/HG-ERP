import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { BaoTriScreen, type Tab } from './BaoTriScreen'

export const metadata = { title: 'Lịch bảo trì' }

// Khai ở đây, không lấy từ file 'use client' — hằng số qua ranh giới đó chỉ là
// tham chiếu client, server đọc không được.
const TABS: readonly string[] = ['todo', 'all', 'kd', 'done'] satisfies Tab[]

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ tab }, d] = await Promise.all([searchParams, assetsService.board(user)])
  return (
    <BaoTriScreen
      meta={d.meta}
      plans={d.plans}
      done30={d.done30}
      options={d.options}
      initialTab={tab && TABS.includes(tab) ? (tab as Tab) : 'todo'}
    />
  )
}

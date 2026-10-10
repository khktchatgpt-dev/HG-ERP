import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { NhapPrint } from './NhapPrint'

/**
 * XEM TRƯỚC phiếu đặt hàng từ bản ĐANG GÕ — cùng khung, cùng `PoPrintSheet`, cùng
 * nguồn dữ liệu với `/print/supply/[id]` (10/10/2026, "dùng 1 loại thôi").
 */
export default async function PoPrintDraftPage() {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  return (
    <Suspense>
      <NhapPrint />
    </Suspense>
  )
}

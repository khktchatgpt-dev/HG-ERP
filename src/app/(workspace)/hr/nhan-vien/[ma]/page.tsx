import { authService } from '@/modules/core/auth/auth.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { HoSoNvScreen } from './HoSoNvScreen'

export const metadata = { title: 'Hồ sơ nhân viên' }

/** /hr/nhan-vien/[mã]?muc=lich-su — link gửi được, mở đúng mục (B2a). */
export default async function HoSoNvPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>
  searchParams: Promise<{ muc?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ ma }, sp] = await Promise.all([params, searchParams])
  const h = await hoSoNvService.trang(user, decodeURIComponent(ma))
  return (
    <HoSoNvScreen
      key={h.n.id}
      h={h}
      muc={sp.muc === 'lich-su' ? 'lich-su' : 'tong-quan'}
    />
  )
}

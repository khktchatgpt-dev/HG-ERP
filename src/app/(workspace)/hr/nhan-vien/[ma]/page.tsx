import { authService } from '@/modules/core/auth/auth.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { HoSoNvScreen } from './HoSoNvScreen'
import { MUC, type Muc } from './muc'

export const metadata = { title: 'Hồ sơ nhân viên' }

/** /hr/nhan-vien/[mã]?muc=ca-nhan|luong|lich-su — link gửi được, mở đúng mục (B2a/B2b). */
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
      muc={
        // Lương là mật (0255): không có quyền lương thì ?muc=luong rơi về Tổng quan.
        MUC.includes(sp.muc as Muc) && (sp.muc !== 'luong' || h.quyen.luong)
          ? (sp.muc as Muc)
          : 'tong-quan'
      }
    />
  )
}

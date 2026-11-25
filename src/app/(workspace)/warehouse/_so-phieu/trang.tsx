import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadSoPhieuKy } from '@/modules/dept/warehouse/so-phieu.service'
import { todayVn } from '@/lib/date-vn'
import { kyTuThamSo, type SoPhieuLoai } from '@/lib/kho-so-phieu'
import { SoPhieuKyScreen } from './SoPhieuKyScreen'

export type SoPhieuSearch = Promise<{
  ky?: string
  q?: string
  ro?: string
  ly_do?: string
  nguoi?: string
}>

/**
 * Trang server chung của Phiếu nhập / Phiếu xuất: gác đăng nhập, đọc kỳ, tải sổ
 * của kỳ song song với cờ quyền ghi. Mọi lọc khác làm ở client trên phiếu của kỳ.
 */
export async function TrangSoPhieu({
  loai,
  searchParams,
}: {
  loai: SoPhieuLoai
  searchParams: SoPhieuSearch
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const today = todayVn()
  const ky = kyTuThamSo(sp.ky, today)
  const [data, canEdit] = await Promise.all([
    loadSoPhieuKy(user, loai, ky, today),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])
  return (
    <SoPhieuKyScreen
      key={ky}
      loai={loai}
      ky={ky}
      today={today}
      data={data}
      loc={{
        q: sp.q ?? '',
        ro: sp.ro ?? '',
        lyDo: sp.ly_do ?? '',
        nguoi: sp.nguoi ?? '',
      }}
      canEdit={canEdit}
      meId={user.id}
    />
  )
}

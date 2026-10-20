import { authService } from '@/modules/core/auth/auth.service'
import { cachTinhService } from '@/modules/dept/hr/cham-cong/cach-tinh.service'
import { CachTinhScreen } from './CachTinhScreen'
import { MUC, type Muc } from './cach-tinh.shared'

/** Cách tính công (B2): bản cách tính theo kỳ — hệ số lương, khung giờ, cách tính theo tổ. */
export default async function CachTinhPage({
  searchParams,
}: {
  searchParams: Promise<{ ban?: string; muc?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const c = await cachTinhService.trang(user, sp.ban)
  const muc: Muc = (MUC as readonly string[]).includes(sp.muc ?? '')
    ? (sp.muc as Muc)
    : 'he-so'
  // key: đổi bản / dữ liệu vừa lưu → dựng lại màn, bỏ bản nháp đang gõ dở của bản cũ.
  return (
    <CachTinhScreen key={`${c.xem.id}|${c.xem.suaLuc}|${c.xem.tuKy}`} c={c} muc={muc} />
  )
}

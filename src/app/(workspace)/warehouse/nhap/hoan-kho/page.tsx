import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { lsxReturnRepo } from '@/modules/dept/warehouse/stock.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { todayVn } from '@/lib/date-vn'
import { dungLuoiHoan } from '@/lib/kho-hoan-kho'
import { HoanKhoScreen } from './HoanKhoScreen'

export const metadata = { title: 'Kho · Hoàn kho từ sản xuất' }
export const dynamic = 'force-dynamic'

/** Tổ xếp theo CÔNG ĐOẠN, không theo chữ cái — cùng luật với màn Xuất kho. */
const TO_THEO_CONG_DOAN = [
  'phôi',
  'hàn',
  'nguội',
  'sơn sắt',
  'sơn nhôm',
  'may',
  'cắt vải',
  'cơ điện',
]
const thuTuTo = (n: string) => {
  const k = n.toLowerCase().replace(/^tổ\s+/, '')
  const i = TO_THEO_CONG_DOAN.indexOf(k)
  return i < 0 ? 99 : i
}

/**
 * HOÀN KHO TỪ SẢN XUẤT — `/warehouse/nhap/hoan-kho?lsx=<id>` (hoàn thiện B1).
 *
 * Tổ lĩnh 100 dùng 95 trả 5. `createReceiptDoc` nhận `production_order_id` sẵn
 * và `issuedByLsx` đã tính NET — không migration, không service mới.
 *
 * ĐỔI LỆNH LÀ ĐỔI URL, không phải gọi API: tập vật tư hoàn được là HỆ QUẢ của
 * lệnh, nên nó thuộc về địa chỉ trang. Nhờ vậy mở tab mới / bấm quay lại đều
 * ra đúng lưới, và trang không cần thêm một route đọc.
 */
export default async function HoanKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams

  const [lsx, deps, company, tpl, canEdit] = await Promise.all([
    lsxReturnRepo.list(),
    departmentsRepo.list(),
    settingsService.getAll(),
    docTemplatesService.get('PNK'),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  // Chỉ nhận id nằm trong tập lệnh chọn được — URL là thứ người dùng sửa được.
  const lsxId = lsx.some((l) => l.id === sp.lsx) ? sp.lsx! : ''
  const daLinh = lsxId ? await stockService.lsxIssuedForReturn(user, lsxId) : []

  const to = deps
    .map((d) => d.name)
    .filter((n) => /^tổ\s+/i.test(n) || /^cắt vải$/i.test(n))
    .sort((a, b) => thuTuTo(a) - thuTuTo(b))

  return (
    /*
      KEY THEO LỆNH. Đổi lệnh là đổi cả lưới lẫn trần từng dòng, nên số đang
      gõ dở thuộc về lệnh cũ và phải mất đi. Dựng lại component bằng `key`
      thay vì đồng bộ state trong effect: effect gây thêm một vòng render và
      luật react-hooks chặn thẳng.
    */
    <HoanKhoScreen
      key={lsxId || 'chua-chon'}
      lsx={lsx.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
        status: l.status,
      }))}
      lsxId={lsxId}
      rows={dungLuoiHoan(daLinh)}
      to={to}
      today={todayVn()}
      nguoiNhan={user.name ?? user.email}
      canEdit={canEdit}
      company={company}
      tpl={tpl}
    />
  )
}

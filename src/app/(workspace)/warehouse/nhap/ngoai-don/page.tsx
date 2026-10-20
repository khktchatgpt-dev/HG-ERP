import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { todayVn } from '@/lib/date-vn'
import { NhapNgoaiDonScreen } from './NhapNgoaiDonScreen'

export const metadata = { title: 'Kho · Nhận hàng không theo đơn' }
export const dynamic = 'force-dynamic'

/**
 * NHẬN HÀNG KHÔNG THEO ĐƠN — `/warehouse/nhap/ngoai-don` (hoàn thiện A2,
 * `docs/kho-hoan-thien.md`).
 *
 * Việc có thật nhưng chưa có đường ghi: sổ đang có 3 dòng `ref_type='external'`
 * và cả ba không nhà cung cấp, không lý do, không phiếu — vì trước nay không
 * màn nào ghi được cho tử tế.
 *
 * KHÔNG MIGRATION, KHÔNG SERVICE MỚI: `receiptDocSchema` nhận `po_id` null sẵn
 * và `createReceiptDoc` tự gắn mã lý do **N2** cho dòng không có `po_line_id`.
 *
 * Trang nạp hai danh mục nhỏ: 169 nhà cung cấp (cho ô chọn tên) và các đơn
 * mua CÒN MỞ (để cảnh báo "NCC này đang có đơn — nhận theo đơn đi"). Vật tư
 * KHÔNG nạp trước — 13.229 mã, tìm từng mã qua API lúc thêm dòng.
 */
export default async function NhapNgoaiDonPage() {
  const user = await authService.requirePageUser()

  const [ncc, openPos, company, tpl, canEdit] = await Promise.all([
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    supplyRepo.listOpenPos(),
    // Xem bản in TRƯỚC khi ghi sổ (yêu cầu chủ dự án 16/09): mẫu 01-VT.
    settingsService.getAll(),
    docTemplatesService.get('PNK'),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  return (
    <NhapNgoaiDonScreen
      ncc={ncc.rows.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      openPos={openPos.map((p) => ({ code: p.code, supplier_name: p.supplier_name }))}
      today={todayVn()}
      nguoiNhan={user.name ?? user.email}
      canEdit={canEdit}
      company={company}
      tpl={tpl}
    />
  )
}
